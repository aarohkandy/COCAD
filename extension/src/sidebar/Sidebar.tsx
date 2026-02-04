import React, { useState, useCallback } from 'react';
import { ChatInput } from './components/ChatInput';
import { PlanningView } from './components/PlanningView';
import { ProgressView } from './components/ProgressView';
import { Settings, type UserSettings } from './components/Settings';
import type { PlanningDocument, UIAction, ExecutionState, ChatMessage } from '../types/actions';

type ViewState = 'input' | 'clarifying' | 'planning' | 'executing' | 'verifying' | 'complete' | 'error';

export const Sidebar: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('input');
  const [plan, setPlan] = useState<PlanningDocument | null>(null);
  const [actions, setActions] = useState<UIAction[]>([]);
  const [executionState, setExecutionState] = useState<ExecutionState>({
    isRunning: false,
    isPaused: false,
    currentAction: 0,
    totalActions: 0,
    currentActionType: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [clarifyQuestions, setClarifyQuestions] = useState<string[]>([]);
  const [baseDescription, setBaseDescription] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    units: 'mm',
    speed: 'normal',
    showTooltips: true,
  });
  const [verificationState, setVerificationState] = useState<{
    status: 'idle' | 'capturing' | 'verifying' | 'complete';
    satisfied: boolean;
    issues: string[];
    suggestedFixes: UIAction[];
    error: string | null;
  }>({
    status: 'idle',
    satisfied: false,
    issues: [],
    suggestedFixes: [],
    error: null,
  });

  const buildPlanDescription = useCallback((base: string, convo: ChatMessage[]) => {
    if (!convo.length) return base;
    const lines = convo.map((m) => `${m.role.toUpperCase()}: ${m.content}`);
    return `${base}\n\nClarifications:\n${lines.join('\n')}`;
  }, []);

  const getPauseForSpeed = useCallback((speed: UserSettings['speed']) => {
    switch (speed) {
      case 'slow':
        return 800;
      case 'fast':
        return 150;
      default:
        return 400;
    }
  }, []);

  React.useEffect(() => {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get(['cocadSettings'], (result) => {
      if (result.cocadSettings) {
        setSettings((prev) => ({ ...prev, ...result.cocadSettings }));
      }
    });
  }, []);

  const handleSettingsChange = useCallback((next: UserSettings) => {
    setSettings(next);
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ cocadSettings: next });
    }
  }, []);

  // Handle user submitting a description
  const handleSubmit = useCallback(async (description: string) => {
    setViewState('clarifying');
    setError(null);
    setPlan(null);
    setClarifyQuestions([]);
    setBaseDescription(description);

    const initialConversation: ChatMessage[] = [{ role: 'user', content: description }];
    setConversation(initialConversation);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_CLARIFY',
        description,
        conversation: initialConversation,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate clarifying questions');
      }

      if (response.readyToGenerate) {
        setClarifyQuestions([]);
        await requestPlan(description, initialConversation);
        return;
      }

      const questions = Array.isArray(response.questions) ? response.questions : [];
      setClarifyQuestions(questions);
      setConversation((prev) => [
        ...prev,
        { role: 'assistant', content: questions.join('\n') },
      ]);
      setViewState('clarifying');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setViewState('error');
    }
  }, []);

  const requestPlan = useCallback(async (description: string, convo: ChatMessage[]) => {
    setViewState('planning');
    setError(null);

    try {
      const planDescription = buildPlanDescription(description, convo);
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_PLAN',
        description: planDescription,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate plan');
      }

      setPlan(response.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setViewState('error');
    }
  }, [buildPlanDescription]);

  const handleClarifyAnswer = useCallback(async (answer: string) => {
    setViewState('clarifying');
    setError(null);

    const nextConversation: ChatMessage[] = [
      ...conversation,
      { role: 'user', content: answer },
    ];
    setConversation(nextConversation);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_CLARIFY',
        description: baseDescription,
        conversation: nextConversation,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate clarifying questions');
      }

      if (response.readyToGenerate) {
        setClarifyQuestions([]);
        await requestPlan(baseDescription, nextConversation);
        return;
      }

      const questions = Array.isArray(response.questions) ? response.questions : [];
      setClarifyQuestions(questions);
      setConversation((prev) => [
        ...prev,
        { role: 'assistant', content: questions.join('\n') },
      ]);
      setViewState('clarifying');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setViewState('error');
    }
  }, [baseDescription, conversation, requestPlan]);

  // Handle user approving the plan
  const handleApprovePlan = useCallback(async () => {
    if (!plan) return;

    setViewState('executing');

    try {
      // Request action sequence from backend
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_ACTIONS',
        plan,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate actions');
      }

      setActions(response.actions);
      setExecutionState({
        isRunning: true,
        isPaused: false,
        currentAction: 0,
        totalActions: response.actions.length,
        currentActionType: response.actions[0]?.type || '',
      });

      // Execute actions via content script
      // This will be implemented in the automation module
      window.parent.postMessage(
        {
          type: 'EXECUTE_ACTIONS',
          actions: response.actions,
          options: {
            showTooltips: settings.showTooltips,
            pauseBetweenActions: getPauseForSpeed(settings.speed),
          },
        },
        '*'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setViewState('error');
    }
  }, [plan]);

  const startVerification = useCallback(() => {
    if (!plan) {
      setError('No plan available for verification');
      setViewState('error');
      return;
    }

    setViewState('verifying');
    setVerificationState({
      status: 'capturing',
      satisfied: false,
      issues: [],
      suggestedFixes: [],
      error: null,
    });

    window.parent.postMessage({ type: 'CAPTURE_SCREENSHOTS' }, '*');
  }, [plan]);

  const handleApplyFixes = useCallback(() => {
    if (!verificationState.suggestedFixes.length) return;

    setViewState('executing');
    setExecutionState({
      isRunning: true,
      isPaused: false,
      currentAction: 0,
      totalActions: verificationState.suggestedFixes.length,
      currentActionType: verificationState.suggestedFixes[0]?.type || '',
    });

    window.parent.postMessage(
      {
        type: 'EXECUTE_ACTIONS',
        actions: verificationState.suggestedFixes,
        options: {
          showTooltips: settings.showTooltips,
          pauseBetweenActions: getPauseForSpeed(settings.speed),
        },
      },
      '*'
    );
  }, [getPauseForSpeed, settings.showTooltips, settings.speed, verificationState.suggestedFixes]);

  const handleConfirmVerified = useCallback(() => {
    setViewState('complete');
    setVerificationState((prev) => ({ ...prev, status: 'complete' }));
  }, []);

  const handlePause = useCallback(() => {
    setExecutionState((prev) => ({ ...prev, isPaused: true }));
    window.parent.postMessage({ type: 'PAUSE_ACTIONS' }, '*');
  }, []);

  const handleResume = useCallback(() => {
    setExecutionState((prev) => ({ ...prev, isPaused: false }));
    window.parent.postMessage({ type: 'RESUME_ACTIONS' }, '*');
  }, []);

  // Handle editing the plan
  const handleEditPlan = useCallback(() => {
    setViewState('input');
    setPlan(null);
    setClarifyQuestions([]);
    setConversation([]);
    setBaseDescription('');
  }, []);

  // Handle starting over
  const handleReset = useCallback(() => {
    setViewState('input');
    setPlan(null);
    setActions([]);
    setError(null);
    setClarifyQuestions([]);
    setConversation([]);
    setBaseDescription('');
    setVerificationState({
      status: 'idle',
      satisfied: false,
      issues: [],
      suggestedFixes: [],
      error: null,
    });
    setExecutionState({
      isRunning: false,
      isPaused: false,
      currentAction: 0,
      totalActions: 0,
      currentActionType: '',
    });
  }, []);

  // Listen for progress updates from content script
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ACTION_PROGRESS') {
        setExecutionState({
          isRunning: true,
          isPaused: false,
          currentAction: event.data.index,
          totalActions: event.data.total,
          currentActionType: event.data.action?.type || '',
        });
      } else if (event.data?.type === 'ACTION_COMPLETE') {
        setExecutionState((prev) => ({ ...prev, isRunning: false }));
        startVerification();
      } else if (event.data?.type === 'ACTION_ERROR') {
        const actionType = event.data.action?.type ? ` (${event.data.action.type})` : '';
        const indexInfo = typeof event.data.index === 'number' ? `Step ${event.data.index + 1}` : 'Step';
        setError(`${indexInfo}${actionType}: ${event.data.error}`);
        setViewState('error');
      } else if (event.data?.type === 'CAPTURE_SCREENSHOTS_RESULT') {
        const screenshots = event.data.screenshots as string[];
        setVerificationState((prev) => ({ ...prev, status: 'verifying', error: null }));

        chrome.runtime.sendMessage({
          type: 'VERIFY_PART',
          screenshots,
          originalRequest: baseDescription,
          plan,
        }).then((response) => {
          if (!response.success) {
            setVerificationState((prev) => ({
              ...prev,
              status: 'complete',
              error: response.error || 'Failed to verify part',
            }));
            return;
          }

          setVerificationState({
            status: 'complete',
            satisfied: Boolean(response.satisfied),
            issues: Array.isArray(response.issues) ? response.issues : [],
            suggestedFixes: Array.isArray(response.suggestedFixes) ? response.suggestedFixes : [],
            error: null,
          });
        });
      } else if (event.data?.type === 'CAPTURE_SCREENSHOTS_ERROR') {
        setVerificationState((prev) => ({
          ...prev,
          status: 'complete',
          error: event.data.error || 'Failed to capture screenshots',
        }));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [baseDescription, plan, startVerification]);

  return (
    <div className="flex flex-col h-screen bg-onshape-bg text-onshape-text">
      {/* Header - Onshape-style toolbar */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-onshape-border bg-onshape-bg-elevated shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-onshape-accent shrink-0">
            <span className="text-white font-semibold text-[10px]">AI</span>
          </div>
          <h1 className="text-xs font-semibold text-onshape-text truncate">COCAD</h1>
        </div>
        <div className="flex items-center gap-1">
          {viewState !== 'input' && (
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-onshape-text-muted hover:text-onshape-text px-2 py-1 rounded hover:bg-onshape-hover"
            >
              Start over
            </button>
          )}
          <button
            type="button"
            onClick={() => window.parent.postMessage({ type: 'COCAD_TOGGLE_SIDEBAR' }, '*')}
            className="p-1 rounded hover:bg-onshape-hover text-onshape-text-muted hover:text-onshape-text"
            title="Collapse sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            className="p-1 rounded hover:bg-onshape-hover text-onshape-text-muted hover:text-onshape-text"
            title="Settings"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317a1 1 0 011.35-.436l.784.392a1 1 0 00.948 0l.784-.392a1 1 0 011.35.436l.392.784a1 1 0 00.747.53l.87.145a1 1 0 01.832.98v.905a1 1 0 01-.832.98l-.87.145a1 1 0 00-.747.53l-.392.784a1 1 0 01-1.35.436l-.784-.392a1 1 0 00-.948 0l-.784.392a1 1 0 01-1.35-.436l-.392-.784a1 1 0 00-.747-.53l-.87-.145A1 1 0 015 12.66v-.905a1 1 0 01.832-.98l.87-.145a1 1 0 00.747-.53l.392-.784z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {showSettings && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <h2 className="text-base font-medium text-onshape-text mb-1.5">Settings</h2>
              <p className="text-onshape-text-muted text-xs">
                Adjust automation speed and UI behavior.
              </p>
            </div>
            <Settings settings={settings} onChange={handleSettingsChange} />
          </div>
        )}

        {!showSettings && viewState === 'input' && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <h2 className="text-base font-medium text-onshape-text mb-1.5">
                What would you like to create?
              </h2>
              <p className="text-onshape-text-muted text-xs">
                Describe your part in natural language and I'll generate it in Onshape.
              </p>
            </div>
            <ChatInput onSubmit={handleSubmit} placeholder="Describe the part you want to create..." />
            <div className="mt-5">
              <h3 className="text-xs font-medium text-onshape-text-muted mb-2 uppercase tracking-wide">Examples</h3>
              <div className="space-y-1.5">
                {[
                  'Create a 100mm x 50mm x 30mm box',
                  'Make a cylinder 40mm diameter, 60mm tall',
                  'Design a mounting bracket with 4 holes',
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => handleSubmit(example)}
                    className="w-full text-left px-3 py-2 rounded bg-onshape-bg-elevated hover:bg-onshape-hover text-onshape-text text-xs border border-transparent hover:border-onshape-border transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewState === 'clarifying' && clarifyQuestions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin w-7 h-7 border-2 border-onshape-accent border-t-transparent rounded-full mb-3" />
            <p className="text-onshape-text-muted text-sm">Clarifying your request...</p>
          </div>
        )}

        {viewState === 'clarifying' && clarifyQuestions.length > 0 && (
          <div className="space-y-4">
            <div className="rounded border border-onshape-border bg-onshape-bg-elevated p-3">
              <h3 className="text-xs font-semibold text-onshape-text uppercase tracking-wide mb-2">
                Quick questions
              </h3>
              <ul className="space-y-2 text-sm text-onshape-text">
                {clarifyQuestions.map((question, idx) => (
                  <li key={`${question}-${idx}`} className="leading-snug">
                    {question}
                  </li>
                ))}
              </ul>
            </div>
            <ChatInput onSubmit={handleClarifyAnswer} placeholder="Answer the questions above..." />
          </div>
        )}

        {viewState === 'planning' && !plan && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin w-7 h-7 border-2 border-onshape-accent border-t-transparent rounded-full mb-3" />
            <p className="text-onshape-text-muted text-sm">Generating plan...</p>
          </div>
        )}

        {viewState === 'planning' && plan && (
          <PlanningView
            plan={plan}
            onApprove={handleApprovePlan}
            onEdit={handleEditPlan}
          />
        )}

        {viewState === 'verifying' && (
          <div className="space-y-4">
            {verificationState.status === 'capturing' && (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="animate-spin w-7 h-7 border-2 border-onshape-accent border-t-transparent rounded-full mb-3" />
                <p className="text-onshape-text-muted text-sm">Capturing screenshots...</p>
              </div>
            )}

            {verificationState.status === 'verifying' && (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="animate-spin w-7 h-7 border-2 border-onshape-accent border-t-transparent rounded-full mb-3" />
                <p className="text-onshape-text-muted text-sm">Verifying model...</p>
              </div>
            )}

            {verificationState.status === 'complete' && (
              <div className="space-y-3">
                {verificationState.error && (
                  <div className="rounded border border-red-500/40 bg-onshape-bg-elevated p-3 text-sm text-red-300">
                    {verificationState.error}
                  </div>
                )}

                {!verificationState.error && verificationState.satisfied && (
                  <div className="rounded border border-onshape-border bg-onshape-bg-elevated p-3 text-sm text-onshape-text">
                    AI thinks the model looks correct. Confirm?
                  </div>
                )}

                {!verificationState.error && !verificationState.satisfied && (
                  <div className="rounded border border-onshape-border bg-onshape-bg-elevated p-3">
                    <h3 className="text-xs font-semibold text-onshape-text uppercase tracking-wide mb-2">
                      Issues found
                    </h3>
                    <ul className="space-y-2 text-sm text-onshape-text">
                      {verificationState.issues.length === 0 ? (
                        <li>Unspecified issues. Try rerunning verification.</li>
                      ) : (
                        verificationState.issues.map((issue, idx) => (
                          <li key={`${issue}-${idx}`}>{issue}</li>
                        ))
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2">
                  {verificationState.satisfied && (
                    <button
                      onClick={handleConfirmVerified}
                      className="px-3 py-2 bg-onshape-accent hover:bg-onshape-accent-hover text-white text-xs rounded transition-colors"
                    >
                      Looks good
                    </button>
                  )}
                  {verificationState.suggestedFixes.length > 0 && !verificationState.satisfied && (
                    <button
                      onClick={handleApplyFixes}
                      className="px-3 py-2 bg-onshape-accent hover:bg-onshape-accent-hover text-white text-xs rounded transition-colors"
                    >
                      Apply fixes
                    </button>
                  )}
                  <button
                    onClick={startVerification}
                    className="px-3 py-2 bg-onshape-bg-elevated hover:bg-onshape-hover text-onshape-text text-xs rounded transition-colors"
                  >
                    Retry verification
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {viewState === 'executing' && (
          <ProgressView
            actions={actions}
            executionState={executionState}
            onPause={handlePause}
            onResume={handleResume}
          />
        )}

        {viewState === 'complete' && (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-full bg-onshape-bg-elevated border border-onshape-border flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-onshape-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-base font-medium text-onshape-text mb-1.5">Model created</h2>
            <p className="text-onshape-text-muted text-xs mb-5">
              Your parametric model has been generated in Onshape.
            </p>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-onshape-accent hover:bg-onshape-accent-hover text-white text-sm rounded border-0 transition-colors"
            >
              Create another
            </button>
          </div>
        )}

        {viewState === 'error' && (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-full bg-onshape-bg-elevated border border-red-500/40 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-base font-medium text-onshape-text mb-1.5">Something went wrong</h2>
            <p className="text-onshape-text-muted text-xs mb-5 break-words">{error}</p>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-onshape-accent hover:bg-onshape-accent-hover text-white text-sm rounded border-0 transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 py-2 border-t border-onshape-border bg-onshape-bg shrink-0">
        <p className="text-[11px] text-onshape-text-muted text-center">
          COCAD · AI-powered CAD for Onshape
        </p>
      </footer>
    </div>
  );
};

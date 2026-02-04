import React, { useState, useCallback } from 'react';
import { ChatInput } from './components/ChatInput';
import { PlanningView } from './components/PlanningView';
import { ProgressView } from './components/ProgressView';
import type { PlanningDocument, UIAction, ExecutionState } from '../types/actions';

type ViewState = 'input' | 'planning' | 'executing' | 'complete' | 'error';

export const Sidebar: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('input');
  const [plan, setPlan] = useState<PlanningDocument | null>(null);
  const [actions, setActions] = useState<UIAction[]>([]);
  const [executionState, setExecutionState] = useState<ExecutionState>({
    isRunning: false,
    currentAction: 0,
    totalActions: 0,
    currentActionType: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Handle user submitting a description
  const handleSubmit = useCallback(async (description: string) => {
    setViewState('planning');
    setError(null);

    try {
      // Request plan from backend via background script
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_PLAN',
        description,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate plan');
      }

      setPlan(response.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setViewState('error');
    }
  }, []);

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
        currentAction: 0,
        totalActions: response.actions.length,
        currentActionType: response.actions[0]?.type || '',
      });

      // Execute actions via content script
      // This will be implemented in the automation module
      window.parent.postMessage(
        { type: 'EXECUTE_ACTIONS', actions: response.actions },
        '*'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setViewState('error');
    }
  }, [plan]);

  // Handle editing the plan
  const handleEditPlan = useCallback(() => {
    setViewState('input');
    setPlan(null);
  }, []);

  // Handle starting over
  const handleReset = useCallback(() => {
    setViewState('input');
    setPlan(null);
    setActions([]);
    setError(null);
    setExecutionState({
      isRunning: false,
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
          currentAction: event.data.index,
          totalActions: event.data.total,
          currentActionType: event.data.action?.type || '',
        });
      } else if (event.data?.type === 'ACTION_COMPLETE') {
        setViewState('complete');
        setExecutionState((prev) => ({ ...prev, isRunning: false }));
      } else if (event.data?.type === 'ACTION_ERROR') {
        setError(event.data.error);
        setViewState('error');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#1a1a2e]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">AI</span>
          </div>
          <h1 className="text-lg font-semibold text-white">COCAD</h1>
        </div>
        {viewState !== 'input' && (
          <button
            onClick={handleReset}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Start Over
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {viewState === 'input' && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <h2 className="text-xl font-medium text-white mb-2">
                What would you like to create?
              </h2>
              <p className="text-gray-400 text-sm">
                Describe your part in natural language and I'll generate it in Onshape.
              </p>
            </div>
            <ChatInput onSubmit={handleSubmit} />
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Examples:</h3>
              <div className="space-y-2">
                {[
                  'Create a 100mm x 50mm x 30mm box',
                  'Make a cylinder 40mm diameter, 60mm tall',
                  'Design a mounting bracket with 4 holes',
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => handleSubmit(example)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewState === 'planning' && !plan && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-4" />
            <p className="text-gray-400">Generating plan...</p>
          </div>
        )}

        {viewState === 'planning' && plan && (
          <PlanningView
            plan={plan}
            onApprove={handleApprovePlan}
            onEdit={handleEditPlan}
          />
        )}

        {viewState === 'executing' && (
          <ProgressView
            actions={actions}
            executionState={executionState}
          />
        )}

        {viewState === 'complete' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-white mb-2">Model Created!</h2>
            <p className="text-gray-400 text-sm mb-6">
              Your parametric model has been generated in Onshape.
            </p>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create Another
            </button>
          </div>
        )}

        {viewState === 'error' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 text-sm mb-6">{error}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 py-2 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          COCAD v1.0 - AI-powered CAD for Onshape
        </p>
      </footer>
    </div>
  );
};

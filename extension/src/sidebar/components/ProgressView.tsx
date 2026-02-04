import React from 'react';
import type { UIAction, ExecutionState } from '../../types/actions';

interface ProgressViewProps {
  actions: UIAction[];
  executionState: ExecutionState;
  onPause?: () => void;
  onResume?: () => void;
}

// Map action types to human-readable descriptions
const getActionDescription = (action: UIAction): string => {
  switch (action.type) {
    case 'CLICK_BUTTON':
      return `Clicking "${action.button}" button`;
    case 'SELECT_PLANE':
      return `Selecting ${action.plane} plane`;
    case 'CLICK_SKETCH_TOOL':
      return `Selecting ${action.tool} tool`;
    case 'DRAW_RECTANGLE':
      return 'Drawing rectangle';
    case 'DRAW_CIRCLE':
      return 'Drawing circle';
    case 'SET_DIMENSION':
      return `Setting dimension to ${action.value}`;
    case 'FILL_INPUT':
      return `Filling ${action.field}`;
    case 'CLICK_OK':
      return 'Confirming dialog';
    case 'CLICK_CANCEL':
      return 'Canceling dialog';
    case 'FINISH_SKETCH':
      return 'Finishing sketch';
    case 'CREATE_VARIABLE':
      return `Creating variable #${action.name}`;
    case 'CLICK_TAB':
      return `Switching to ${action.tab}`;
    case 'WAIT':
      return 'Waiting...';
    default:
      return 'Processing...';
  }
};

// Get icon for action type
const getActionIcon = (action: UIAction): React.ReactNode => {
  const iconClass = "w-4 h-4";
  
  switch (action.type) {
    case 'CLICK_BUTTON':
    case 'CLICK_OK':
    case 'CLICK_CANCEL':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
      );
    case 'DRAW_RECTANGLE':
    case 'DRAW_CIRCLE':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
        </svg>
      );
    case 'CREATE_VARIABLE':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
};

export const ProgressView: React.FC<ProgressViewProps> = ({ actions, executionState, onPause, onResume }) => {
  const { currentAction, totalActions, isRunning, isPaused } = executionState;
  const progress = totalActions > 0 ? ((currentAction + 1) / totalActions) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-onshape-text">Generating model</h2>
        <div className="flex items-center gap-2">
          {isRunning && !isPaused && (
            <span className="text-[11px] px-2 py-0.5 bg-onshape-bg-elevated border border-onshape-accent/50 text-onshape-accent rounded animate-pulse">
              Running
            </span>
          )}
          {isPaused && (
            <span className="text-[11px] px-2 py-0.5 bg-onshape-bg-elevated border border-onshape-border text-onshape-text-muted rounded">
              Paused
            </span>
          )}
          {isRunning && (
            <button
              type="button"
              onClick={isPaused ? onResume : onPause}
              className="text-[11px] px-2 py-0.5 bg-onshape-bg-elevated border border-onshape-border text-onshape-text rounded hover:bg-onshape-hover transition-colors"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-onshape-bg-elevated border border-onshape-border rounded p-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-onshape-text-muted">Progress</span>
          <span className="text-onshape-text font-medium">
            {currentAction + 1} / {totalActions}
          </span>
        </div>
        <div className="w-full h-1.5 bg-onshape-bg overflow-hidden rounded-full">
          <div
            className="h-full bg-onshape-accent transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Action */}
      {actions[currentAction] && (
        <div className="bg-onshape-bg-elevated border border-onshape-accent/40 rounded p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-onshape-accent/20 flex items-center justify-center text-onshape-accent shrink-0">
              {getActionIcon(actions[currentAction])}
            </div>
            <div className="min-w-0">
              <p className="text-onshape-text text-sm font-medium truncate">
                {getActionDescription(actions[currentAction])}
              </p>
              <p className="text-onshape-text-muted text-xs">In progress…</p>
            </div>
          </div>
        </div>
      )}

      {/* Action List */}
      <div className="bg-onshape-bg-elevated border border-onshape-border rounded p-3 max-h-52 overflow-y-auto">
        <h3 className="text-xs font-medium text-onshape-text-muted uppercase tracking-wide mb-2">Action sequence</h3>
        <div className="space-y-1">
          {actions.map((action, index) => {
            const isComplete = index < currentAction;
            const isCurrent = index === currentAction;

            return (
              <div
                key={index}
                className={`flex items-center gap-2 py-1.5 px-2 rounded transition-colors ${
                  isCurrent
                    ? 'bg-onshape-bg border border-onshape-accent/40'
                    : isComplete
                    ? 'bg-onshape-bg border border-onshape-border opacity-80'
                    : 'bg-onshape-bg border border-transparent opacity-60'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    isComplete
                      ? 'bg-onshape-accent text-white'
                      : isCurrent
                      ? 'bg-onshape-accent animate-pulse text-white'
                      : 'bg-onshape-bg-input text-onshape-text-muted'
                  }`}
                >
                  {isComplete ? (
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  ) : (
                    <span className="text-[10px] font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`text-xs truncate ${
                    isComplete ? 'text-onshape-text-muted' : isCurrent ? 'text-onshape-text' : 'text-onshape-text-muted'
                  }`}
                >
                  {getActionDescription(action)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

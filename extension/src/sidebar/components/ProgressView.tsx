import React from 'react';
import type { UIAction, ExecutionState } from '../../types/actions';

interface ProgressViewProps {
  actions: UIAction[];
  executionState: ExecutionState;
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

export const ProgressView: React.FC<ProgressViewProps> = ({ actions, executionState }) => {
  const { currentAction, totalActions, isRunning } = executionState;
  const progress = totalActions > 0 ? ((currentAction + 1) / totalActions) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-medium text-white">Generating Model</h2>
        {isRunning && (
          <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full animate-pulse">
            Running
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-400">Progress</span>
          <span className="text-white">
            {currentAction + 1} / {totalActions}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Action */}
      {actions[currentAction] && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
              {getActionIcon(actions[currentAction])}
            </div>
            <div>
              <p className="text-white font-medium">
                {getActionDescription(actions[currentAction])}
              </p>
              <p className="text-blue-400 text-sm">In progress...</p>
            </div>
          </div>
        </div>
      )}

      {/* Action List */}
      <div className="bg-gray-800 rounded-lg p-4 max-h-64 overflow-y-auto">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Action Sequence</h3>
        <div className="space-y-2">
          {actions.map((action, index) => {
            const isComplete = index < currentAction;
            const isCurrent = index === currentAction;
            const isPending = index > currentAction;

            return (
              <div
                key={index}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
                  isCurrent
                    ? 'bg-blue-500/20 border border-blue-500/30'
                    : isComplete
                    ? 'bg-green-500/10'
                    : 'bg-gray-900'
                }`}
              >
                {/* Status Icon */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isComplete
                      ? 'bg-green-500'
                      : isCurrent
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-gray-700'
                  }`}
                >
                  {isComplete ? (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  ) : (
                    <span className="text-gray-500 text-xs">{index + 1}</span>
                  )}
                </div>

                {/* Action Description */}
                <span
                  className={`text-sm ${
                    isComplete
                      ? 'text-green-400'
                      : isCurrent
                      ? 'text-white'
                      : 'text-gray-500'
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

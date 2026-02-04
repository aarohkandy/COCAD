// UI Action types that the AI generates and the extension executes

export type UIAction =
  | { type: 'CLICK_BUTTON'; button: string }
  | { type: 'SELECT_PLANE'; plane: 'Front' | 'Top' | 'Right' }
  | { type: 'CLICK_SKETCH_TOOL'; tool: string }
  | { type: 'DRAW_RECTANGLE'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'DRAW_CIRCLE'; cx: number; cy: number; radius: number }
  | { type: 'SET_DIMENSION'; value: string } // "#variable_name" syntax for variable refs
  | { type: 'FILL_INPUT'; field: string; value: string }
  | { type: 'FOCUS_INPUT'; selector: string }
  | { type: 'TYPE_VALUE'; value: string }
  | { type: 'PRESS_KEY'; key: 'Enter' | 'Tab' | 'Escape' }
  | { type: 'SELECT_FACE'; selector: string }
  | { type: 'SELECT_EDGE'; selector: string }
  | { type: 'CREATE_HOLE'; diameter: string; depth: string }
  | { type: 'CREATE_FILLET'; radius: string }
  | { type: 'CREATE_CHAMFER'; distance: string }
  | { type: 'CLICK_OK' }
  | { type: 'CLICK_CANCEL' }
  | { type: 'FINISH_SKETCH' }
  | { type: 'CREATE_VARIABLE'; name: string; value: string; unit: string }
  | { type: 'CLICK_TAB'; tab: string }
  | { type: 'WAIT'; ms: number };

// Planning document structure from AI
export interface PlanningDocument {
  designIntent: string;
  overallForm: string;
  keyDimensions: Dimension[];
  majorFeatures: Feature[];
  materials?: string;
  tolerances?: string;
}

export interface Dimension {
  name: string;
  value: number;
  unit: string;
  purpose: string;
}

export interface Feature {
  type: string;
  quantity?: number;
  purpose: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Messages between content script and background worker
export type MessageType =
  | { type: 'GENERATE_CLARIFY'; description: string; conversation?: ChatMessage[] }
  | { type: 'GENERATE_PLAN'; description: string }
  | { type: 'PLAN_READY'; plan: PlanningDocument }
  | { type: 'GENERATE_ACTIONS'; plan: PlanningDocument }
  | { type: 'ACTIONS_READY'; actions: UIAction[] }
  | { type: 'VERIFY_PART'; screenshots: string[]; originalRequest: string; plan: PlanningDocument }
  | { type: 'EXECUTE_ACTIONS'; actions: UIAction[] }
  | { type: 'ACTION_PROGRESS'; index: number; total: number; action: UIAction }
  | { type: 'ACTION_COMPLETE' }
  | { type: 'ACTION_ERROR'; error: string }
  | { type: 'TOGGLE_SIDEBAR' };

// Execution state
export interface ExecutionState {
  isRunning: boolean;
  isPaused?: boolean;
  currentAction: number;
  totalActions: number;
  currentActionType: string;
  error?: string;
}

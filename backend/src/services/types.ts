// Shared types for the backend

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

export type UIAction =
  | { type: 'CLICK_BUTTON'; button: string }
  | { type: 'SELECT_PLANE'; plane: 'Front' | 'Top' | 'Right' }
  | { type: 'CLICK_SKETCH_TOOL'; tool: string }
  | { type: 'DRAW_RECTANGLE'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'DRAW_CIRCLE'; cx: number; cy: number; radius: number }
  | { type: 'SET_DIMENSION'; value: string }
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

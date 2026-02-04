/**
 * High-level Onshape automation actions
 * These combine multiple low-level actions into meaningful CAD operations
 */

import type { UIAction } from '../types/actions';
import { executeActionSequence, ExecutionOptions } from './executor';

/**
 * Create a simple box using Variable Studio + Sketch + Extrude
 */
export function createBoxActions(
  length: number,
  width: number,
  height: number,
  unit = 'mm'
): UIAction[] {
  return [
    // Step 1: Create variables in Variable Studio
    { type: 'CLICK_TAB', tab: 'Variable Studio' },
    { type: 'WAIT', ms: 500 },
    { type: 'CREATE_VARIABLE', name: 'box_length', value: String(length), unit },
    { type: 'WAIT', ms: 300 },
    { type: 'CREATE_VARIABLE', name: 'box_width', value: String(width), unit },
    { type: 'WAIT', ms: 300 },
    { type: 'CREATE_VARIABLE', name: 'box_height', value: String(height), unit },
    { type: 'WAIT', ms: 300 },
    
    // Step 2: Switch to Part Studio
    { type: 'CLICK_TAB', tab: 'Part Studio 1' },
    { type: 'WAIT', ms: 500 },
    
    // Step 3: Start sketch on Front plane
    { type: 'CLICK_BUTTON', button: 'Sketch' },
    { type: 'WAIT', ms: 500 },
    { type: 'SELECT_PLANE', plane: 'Front' },
    { type: 'WAIT', ms: 500 },
    
    // Step 4: Draw rectangle
    { type: 'CLICK_SKETCH_TOOL', tool: 'Rectangle' },
    { type: 'WAIT', ms: 300 },
    { type: 'DRAW_RECTANGLE', x1: -length/2, y1: -width/2, x2: length/2, y2: width/2 },
    { type: 'WAIT', ms: 300 },
    
    // Step 5: Add dimensions (referencing variables)
    { type: 'CLICK_SKETCH_TOOL', tool: 'Dimension' },
    { type: 'WAIT', ms: 300 },
    // Note: In practice, you'd select specific edges and add dimensions
    // This is simplified - actual implementation may need adjustments
    
    // Step 6: Finish sketch
    { type: 'FINISH_SKETCH' },
    { type: 'WAIT', ms: 500 },
    
    // Step 7: Extrude
    { type: 'CLICK_BUTTON', button: 'Extrude' },
    { type: 'WAIT', ms: 500 },
    { type: 'FILL_INPUT', field: 'Depth', value: '#box_height' },
    { type: 'WAIT', ms: 300 },
    { type: 'CLICK_OK' },
  ];
}

/**
 * Create a cylinder using Variable Studio + Sketch + Extrude
 */
export function createCylinderActions(
  diameter: number,
  height: number,
  unit = 'mm'
): UIAction[] {
  const radius = diameter / 2;
  
  return [
    // Step 1: Create variables
    { type: 'CLICK_TAB', tab: 'Variable Studio' },
    { type: 'WAIT', ms: 500 },
    { type: 'CREATE_VARIABLE', name: 'cylinder_diameter', value: String(diameter), unit },
    { type: 'WAIT', ms: 300 },
    { type: 'CREATE_VARIABLE', name: 'cylinder_height', value: String(height), unit },
    { type: 'WAIT', ms: 300 },
    
    // Step 2: Switch to Part Studio
    { type: 'CLICK_TAB', tab: 'Part Studio 1' },
    { type: 'WAIT', ms: 500 },
    
    // Step 3: Start sketch on Top plane
    { type: 'CLICK_BUTTON', button: 'Sketch' },
    { type: 'WAIT', ms: 500 },
    { type: 'SELECT_PLANE', plane: 'Top' },
    { type: 'WAIT', ms: 500 },
    
    // Step 4: Draw circle
    { type: 'CLICK_SKETCH_TOOL', tool: 'Circle' },
    { type: 'WAIT', ms: 300 },
    { type: 'DRAW_CIRCLE', cx: 0, cy: 0, radius },
    { type: 'WAIT', ms: 300 },
    
    // Step 5: Finish sketch
    { type: 'FINISH_SKETCH' },
    { type: 'WAIT', ms: 500 },
    
    // Step 6: Extrude
    { type: 'CLICK_BUTTON', button: 'Extrude' },
    { type: 'WAIT', ms: 500 },
    { type: 'FILL_INPUT', field: 'Depth', value: '#cylinder_height' },
    { type: 'WAIT', ms: 300 },
    { type: 'CLICK_OK' },
  ];
}

/**
 * Add a hole feature to existing geometry
 */
export function createHoleActions(
  diameter: number,
  depth: number,
  unit = 'mm'
): UIAction[] {
  return [
    // Create variable for hole diameter
    { type: 'CLICK_TAB', tab: 'Variable Studio' },
    { type: 'WAIT', ms: 300 },
    { type: 'CREATE_VARIABLE', name: 'hole_diameter', value: String(diameter), unit },
    { type: 'WAIT', ms: 300 },
    { type: 'CREATE_VARIABLE', name: 'hole_depth', value: String(depth), unit },
    { type: 'WAIT', ms: 300 },
    
    // Switch back and create hole
    { type: 'CLICK_TAB', tab: 'Part Studio 1' },
    { type: 'WAIT', ms: 300 },
    { type: 'CLICK_BUTTON', button: 'Hole' },
    { type: 'WAIT', ms: 500 },
    // Note: User would need to select the face and position
    // This is a placeholder for the hole dialog
    { type: 'FILL_INPUT', field: 'Diameter', value: '#hole_diameter' },
    { type: 'FILL_INPUT', field: 'Depth', value: '#hole_depth' },
    { type: 'CLICK_OK' },
  ];
}

/**
 * Add fillet to edges
 */
export function createFilletActions(radius: number, unit = 'mm'): UIAction[] {
  return [
    { type: 'CLICK_TAB', tab: 'Variable Studio' },
    { type: 'WAIT', ms: 300 },
    { type: 'CREATE_VARIABLE', name: 'fillet_radius', value: String(radius), unit },
    { type: 'WAIT', ms: 300 },
    
    { type: 'CLICK_TAB', tab: 'Part Studio 1' },
    { type: 'WAIT', ms: 300 },
    { type: 'CLICK_BUTTON', button: 'Fillet' },
    { type: 'WAIT', ms: 500 },
    // Note: User would need to select edges
    { type: 'FILL_INPUT', field: 'Radius', value: '#fillet_radius' },
    { type: 'CLICK_OK' },
  ];
}

/**
 * Helper to execute predefined actions with progress callback
 */
export async function runActions(
  actions: UIAction[],
  onProgress?: (step: number, total: number, description: string) => void
): Promise<void> {
  const options: ExecutionOptions = {
    showTooltips: true,
    pauseBetweenActions: 300,
    onProgress: (index, total, action) => {
      if (onProgress) {
        const description = getActionLabel(action);
        onProgress(index + 1, total, description);
      }
    },
  };

  await executeActionSequence(actions, options);
}

function getActionLabel(action: UIAction): string {
  switch (action.type) {
    case 'CREATE_VARIABLE':
      return `Creating variable #${action.name}`;
    case 'CLICK_TAB':
      return `Opening ${action.tab}`;
    case 'CLICK_BUTTON':
      return `Clicking ${action.button}`;
    case 'SELECT_PLANE':
      return `Selecting ${action.plane} plane`;
    case 'DRAW_RECTANGLE':
      return 'Drawing rectangle';
    case 'DRAW_CIRCLE':
      return 'Drawing circle';
    case 'FINISH_SKETCH':
      return 'Finishing sketch';
    case 'FILL_INPUT':
      return `Setting ${action.field}`;
    case 'CLICK_OK':
      return 'Confirming';
    default:
      return 'Processing';
  }
}

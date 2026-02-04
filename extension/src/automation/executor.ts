/**
 * Executor - Execute UI action sequences
 */

import type { UIAction } from '../types/actions';
import { waitForElement, waitForAnyElement, sleep, waitForDOMStable } from './waiter';
import { clickElement, clickButton, fillInputByName, showActionTooltip, hideActionTooltip } from './clicker';
import {
  TOOLBAR,
  PLANES,
  SKETCH_TOOLS,
  DIALOGS,
  VARIABLE_STUDIO,
  TABS,
  CANVAS,
  findElement,
} from './selectors';

export interface ExecutionOptions {
  onProgress?: (index: number, total: number, action: UIAction) => void;
  onError?: (error: Error, action: UIAction, index: number) => void;
  showTooltips?: boolean;
  pauseBetweenActions?: number;
}

/**
 * Execute a single UI action
 */
export async function executeAction(action: UIAction): Promise<void> {
  console.log(`[COCAD] Executing action:`, action);

  switch (action.type) {
    case 'CLICK_BUTTON':
      await executeClickButton(action.button);
      break;

    case 'SELECT_PLANE':
      await executeSelectPlane(action.plane);
      break;

    case 'CLICK_SKETCH_TOOL':
      await executeClickSketchTool(action.tool);
      break;

    case 'DRAW_RECTANGLE':
      await executeDrawRectangle(action.x1, action.y1, action.x2, action.y2);
      break;

    case 'DRAW_CIRCLE':
      await executeDrawCircle(action.cx, action.cy, action.radius);
      break;

    case 'SET_DIMENSION':
      await executeSetDimension(action.value);
      break;

    case 'FILL_INPUT':
      await fillInputByName(action.field, action.value);
      break;

    case 'CLICK_OK':
      await executeClickOK();
      break;

    case 'CLICK_CANCEL':
      await executeClickCancel();
      break;

    case 'FINISH_SKETCH':
      await executeFinishSketch();
      break;

    case 'CREATE_VARIABLE':
      await executeCreateVariable(action.name, action.value, action.unit);
      break;

    case 'CLICK_TAB':
      await executeClickTab(action.tab);
      break;

    case 'WAIT':
      await sleep(action.ms);
      break;

    default:
      throw new Error(`Unknown action type: ${(action as any).type}`);
  }
}

/**
 * Execute a sequence of UI actions
 */
export async function executeActionSequence(
  actions: UIAction[],
  options: ExecutionOptions = {}
): Promise<void> {
  const {
    onProgress,
    onError,
    showTooltips = true,
    pauseBetweenActions = 300,
  } = options;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // Report progress
    if (onProgress) {
      onProgress(i, actions.length, action);
    }

    // Show tooltip
    if (showTooltips) {
      showActionTooltip(getActionDescription(action));
    }

    try {
      await executeAction(action);
      
      // Pause between actions to let UI settle
      if (action.type !== 'WAIT' && pauseBetweenActions > 0) {
        await sleep(pauseBetweenActions);
      }
    } catch (error) {
      console.error(`[COCAD] Action failed at index ${i}:`, action, error);
      
      if (onError) {
        onError(error as Error, action, i);
      }
      
      hideActionTooltip();
      throw error;
    }
  }

  hideActionTooltip();
  console.log(`[COCAD] Completed all ${actions.length} actions`);
}

// ============================================================================
// Action Implementations
// ============================================================================

async function executeClickButton(buttonName: string): Promise<void> {
  // Map button names to selectors
  const selectorMap: Record<string, string[]> = {
    'Sketch': TOOLBAR.SKETCH,
    'Extrude': TOOLBAR.EXTRUDE,
    'Revolve': TOOLBAR.REVOLVE,
    'Hole': TOOLBAR.HOLE,
    'Fillet': TOOLBAR.FILLET,
    'Chamfer': TOOLBAR.CHAMFER,
    'Shell': TOOLBAR.SHELL,
  };

  const selectors = selectorMap[buttonName];
  
  if (selectors) {
    const element = await waitForAnyElement(selectors, { timeout: 5000 });
    await clickElement(element);
  } else {
    // Fall back to generic button finding
    await clickButton(buttonName);
  }
}

async function executeSelectPlane(plane: 'Front' | 'Top' | 'Right'): Promise<void> {
  // Wait for plane selection dialog
  await waitForAnyElement(PLANES.DIALOG, { timeout: 5000 });
  await sleep(200);

  // Select the plane
  const planeSelectors = {
    'Front': PLANES.FRONT,
    'Top': PLANES.TOP,
    'Right': PLANES.RIGHT,
  };

  const element = await waitForAnyElement(planeSelectors[plane], { timeout: 3000 });
  await clickElement(element);
}

async function executeClickSketchTool(tool: string): Promise<void> {
  const toolMap: Record<string, string[]> = {
    'Line': SKETCH_TOOLS.LINE,
    'Rectangle': SKETCH_TOOLS.RECTANGLE,
    'Center Rectangle': SKETCH_TOOLS.CENTER_RECTANGLE,
    'Circle': SKETCH_TOOLS.CIRCLE,
    'Arc': SKETCH_TOOLS.ARC,
    'Dimension': SKETCH_TOOLS.DIMENSION,
  };

  const selectors = toolMap[tool];
  
  if (selectors) {
    const element = await waitForAnyElement(selectors, { timeout: 3000 });
    await clickElement(element);
  } else {
    await clickButton(tool);
  }
}

async function executeDrawRectangle(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Promise<void> {
  // Find the sketch canvas
  const canvas = await waitForAnyElement(CANVAS.SKETCH_CANVAS.concat(CANVAS.VIEWPORT), {
    timeout: 3000,
  });

  const rect = canvas.getBoundingClientRect();
  
  // Convert sketch coordinates to screen coordinates
  // Note: This is a simplified transformation - may need adjustment
  const screenX1 = rect.left + rect.width / 2 + x1;
  const screenY1 = rect.top + rect.height / 2 - y1; // Y is inverted
  const screenX2 = rect.left + rect.width / 2 + x2;
  const screenY2 = rect.top + rect.height / 2 - y2;

  // Simulate mouse events to draw
  const mouseDownOptions: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: screenX1,
    clientY: screenY1,
    button: 0,
  };

  const mouseMoveOptions: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: screenX2,
    clientY: screenY2,
    button: 0,
  };

  const mouseUpOptions: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: screenX2,
    clientY: screenY2,
    button: 0,
  };

  canvas.dispatchEvent(new MouseEvent('mousedown', mouseDownOptions));
  await sleep(50);
  canvas.dispatchEvent(new MouseEvent('mousemove', mouseMoveOptions));
  await sleep(50);
  canvas.dispatchEvent(new MouseEvent('mouseup', mouseUpOptions));
  canvas.dispatchEvent(new MouseEvent('click', mouseUpOptions));

  console.log(`[COCAD] Drew rectangle from (${x1},${y1}) to (${x2},${y2})`);
}

async function executeDrawCircle(
  cx: number,
  cy: number,
  radius: number
): Promise<void> {
  // Find the sketch canvas
  const canvas = await waitForAnyElement(CANVAS.SKETCH_CANVAS.concat(CANVAS.VIEWPORT), {
    timeout: 3000,
  });

  const rect = canvas.getBoundingClientRect();
  
  // Convert to screen coordinates
  const screenCX = rect.left + rect.width / 2 + cx;
  const screenCY = rect.top + rect.height / 2 - cy;
  const screenEdgeX = screenCX + radius;
  const screenEdgeY = screenCY;

  // Click center, then click edge to define radius
  canvas.dispatchEvent(new MouseEvent('mousedown', {
    bubbles: true,
    clientX: screenCX,
    clientY: screenCY,
    button: 0,
  }));
  await sleep(50);
  canvas.dispatchEvent(new MouseEvent('mouseup', {
    bubbles: true,
    clientX: screenCX,
    clientY: screenCY,
    button: 0,
  }));
  await sleep(100);
  
  // Click at edge to set radius
  canvas.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    clientX: screenEdgeX,
    clientY: screenEdgeY,
    button: 0,
  }));

  console.log(`[COCAD] Drew circle at (${cx},${cy}) with radius ${radius}`);
}

async function executeSetDimension(value: string): Promise<void> {
  // Look for dimension input that appears after selecting an entity
  const dimensionInput = await waitForAnyElement([
    'input[aria-label="Dimension"]',
    'input[placeholder*="Dimension"]',
    'input[type="number"]',
    '.dimension-input input',
  ], { timeout: 3000 });

  await fillInputByName('Dimension', value);
  
  // Press Enter to confirm
  dimensionInput.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    key: 'Enter',
    keyCode: 13,
  }));
}

async function executeClickOK(): Promise<void> {
  const element = await waitForAnyElement(DIALOGS.OK_BUTTON, { timeout: 3000 });
  await clickElement(element);
}

async function executeClickCancel(): Promise<void> {
  const element = await waitForAnyElement(DIALOGS.CANCEL_BUTTON, { timeout: 3000 });
  await clickElement(element);
}

async function executeFinishSketch(): Promise<void> {
  const element = await waitForAnyElement(SKETCH_TOOLS.FINISH_SKETCH, { timeout: 3000 });
  await clickElement(element);
}

async function executeCreateVariable(
  name: string,
  value: string,
  unit: string
): Promise<void> {
  // Click add variable button
  const addButton = await waitForAnyElement(VARIABLE_STUDIO.ADD_VARIABLE_BUTTON, {
    timeout: 3000,
  });
  await clickElement(addButton);
  await sleep(300);

  // Fill variable name
  const nameInput = await waitForAnyElement(VARIABLE_STUDIO.VARIABLE_NAME_INPUT, {
    timeout: 3000,
  }) as HTMLInputElement;
  await fillInputByName('Variable name', name);
  await sleep(100);

  // Fill expression (value with unit)
  const expressionValue = unit ? `${value} * ${unit}` : value;
  await fillInputByName('Expression', expressionValue);
  await sleep(100);

  // Click create/confirm button
  try {
    const createButton = await waitForAnyElement(VARIABLE_STUDIO.CREATE_BUTTON, {
      timeout: 2000,
    });
    await clickElement(createButton);
  } catch {
    // Some versions might auto-create, or use Enter key
    const expressionInput = findElement(VARIABLE_STUDIO.EXPRESSION_INPUT);
    if (expressionInput) {
      expressionInput.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter',
        keyCode: 13,
      }));
    }
  }

  console.log(`[COCAD] Created variable: #${name} = ${value} ${unit}`);
}

async function executeClickTab(tabName: string): Promise<void> {
  let selectors: string[];

  if (tabName.toLowerCase().includes('variable')) {
    selectors = VARIABLE_STUDIO.TAB;
  } else if (tabName.toLowerCase().includes('part')) {
    selectors = TABS.PART_STUDIO;
  } else if (tabName.toLowerCase().includes('assembly')) {
    selectors = TABS.ASSEMBLY;
  } else {
    // Generic tab finding
    selectors = [
      `[aria-label="${tabName}"]`,
      `[aria-label*="${tabName}"]`,
      `[title="${tabName}"]`,
      `[data-tab="${tabName.toLowerCase()}"]`,
    ];
  }

  const element = await waitForAnyElement(selectors, { timeout: 3000 });
  await clickElement(element);
}

// ============================================================================
// Helper Functions
// ============================================================================

function getActionDescription(action: UIAction): string {
  switch (action.type) {
    case 'CLICK_BUTTON':
      return `Clicking "${action.button}"`;
    case 'SELECT_PLANE':
      return `Selecting ${action.plane} plane`;
    case 'CLICK_SKETCH_TOOL':
      return `Selecting ${action.tool} tool`;
    case 'DRAW_RECTANGLE':
      return 'Drawing rectangle';
    case 'DRAW_CIRCLE':
      return 'Drawing circle';
    case 'SET_DIMENSION':
      return `Setting dimension: ${action.value}`;
    case 'FILL_INPUT':
      return `Filling ${action.field}`;
    case 'CLICK_OK':
      return 'Confirming';
    case 'CLICK_CANCEL':
      return 'Canceling';
    case 'FINISH_SKETCH':
      return 'Finishing sketch';
    case 'CREATE_VARIABLE':
      return `Creating #${action.name}`;
    case 'CLICK_TAB':
      return `Opening ${action.tab}`;
    case 'WAIT':
      return 'Waiting...';
    default:
      return 'Processing...';
  }
}

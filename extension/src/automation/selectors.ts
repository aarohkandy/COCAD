/**
 * Onshape DOM Selectors
 * 
 * This file contains selectors for Onshape UI elements.
 * Selectors are organized by priority:
 * 1. aria-label (most stable)
 * 2. data-* attributes
 * 3. title attributes
 * 4. class-based selectors (least stable, may change)
 * 
 * NOTE: These selectors need to be verified against the actual Onshape UI.
 * Run the test functions in the browser console to find working selectors.
 */

// ============================================================================
// TOOLBAR BUTTONS - Main feature toolbar
// ============================================================================
export const TOOLBAR = {
  // Primary feature buttons
  SKETCH: [
    '[aria-label="Sketch"]',
    '[data-feature="sketch"]',
    '[title="Sketch"]',
    'button:has([class*="sketch-icon"])',
    '.toolbar-button[data-command="sketch"]',
  ],
  
  EXTRUDE: [
    '[aria-label="Extrude"]',
    '[data-feature="extrude"]',
    '[title="Extrude"]',
    'button:has([class*="extrude-icon"])',
    '.toolbar-button[data-command="extrude"]',
  ],
  
  REVOLVE: [
    '[aria-label="Revolve"]',
    '[data-feature="revolve"]',
    '[title="Revolve"]',
    '.toolbar-button[data-command="revolve"]',
  ],
  
  HOLE: [
    '[aria-label="Hole"]',
    '[data-feature="hole"]',
    '[title="Hole"]',
    '.toolbar-button[data-command="hole"]',
  ],
  
  FILLET: [
    '[aria-label="Fillet"]',
    '[data-feature="fillet"]',
    '[title="Fillet"]',
    '.toolbar-button[data-command="fillet"]',
  ],
  
  CHAMFER: [
    '[aria-label="Chamfer"]',
    '[data-feature="chamfer"]',
    '[title="Chamfer"]',
    '.toolbar-button[data-command="chamfer"]',
  ],
  
  SHELL: [
    '[aria-label="Shell"]',
    '[data-feature="shell"]',
    '[title="Shell"]',
    '.toolbar-button[data-command="shell"]',
  ],
};

// ============================================================================
// PLANE SELECTION - Dialog for selecting sketch plane
// ============================================================================
export const PLANES = {
  DIALOG: [
    '.plane-selection-dialog',
    '.plane-picker-dialog',
    '[class*="plane-dialog"]',
    '[data-dialog="plane-selection"]',
  ],
  
  FRONT: [
    '[data-plane="Front"]',
    '[data-plane-name="Front"]',
    '[aria-label="Front plane"]',
    '[title="Front"]',
    '.plane-item:has-text("Front")',
  ],
  
  TOP: [
    '[data-plane="Top"]',
    '[data-plane-name="Top"]',
    '[aria-label="Top plane"]',
    '[title="Top"]',
    '.plane-item:has-text("Top")',
  ],
  
  RIGHT: [
    '[data-plane="Right"]',
    '[data-plane-name="Right"]',
    '[aria-label="Right plane"]',
    '[title="Right"]',
    '.plane-item:has-text("Right")',
  ],
};

// ============================================================================
// SKETCH TOOLS - Toolbar when in sketch mode
// ============================================================================
export const SKETCH_TOOLS = {
  LINE: [
    '[aria-label="Line"]',
    '[data-tool="line"]',
    '[title="Line"]',
    '.sketch-tool[data-command="line"]',
  ],
  
  RECTANGLE: [
    '[aria-label="Corner rectangle"]',
    '[aria-label="Rectangle"]',
    '[data-tool="rectangle"]',
    '[title="Corner rectangle"]',
    '.sketch-tool[data-command="rectangle"]',
  ],
  
  CENTER_RECTANGLE: [
    '[aria-label="Center point rectangle"]',
    '[data-tool="center-rectangle"]',
    '[title="Center point rectangle"]',
  ],
  
  CIRCLE: [
    '[aria-label="Circle"]',
    '[data-tool="circle"]',
    '[title="Circle"]',
    '.sketch-tool[data-command="circle"]',
  ],
  
  ARC: [
    '[aria-label="Arc"]',
    '[data-tool="arc"]',
    '[title="Arc"]',
    '.sketch-tool[data-command="arc"]',
  ],
  
  DIMENSION: [
    '[aria-label="Dimension"]',
    '[data-tool="dimension"]',
    '[title="Dimension"]',
    '.sketch-tool[data-command="dimension"]',
  ],
  
  CONSTRAINT: [
    '[aria-label="Constrain"]',
    '[data-tool="constraint"]',
    '[title="Constrain"]',
  ],
  
  FINISH_SKETCH: [
    '[aria-label="Finish sketch"]',
    '[aria-label="Accept"]',
    '[data-action="finish-sketch"]',
    '[title="Finish sketch"]',
    '.accept-button',
    'button.os-accept',
  ],
  
  CANCEL_SKETCH: [
    '[aria-label="Cancel"]',
    '[data-action="cancel-sketch"]',
    '[title="Cancel"]',
    '.cancel-button',
  ],
};

// ============================================================================
// FEATURE DIALOGS - Modal dialogs for feature parameters
// ============================================================================
export const DIALOGS = {
  FEATURE_DIALOG: [
    '.feature-dialog',
    '.os-feature-dialog',
    '[class*="feature-dialog"]',
    '[role="dialog"]',
  ],
  
  OK_BUTTON: [
    '[aria-label="OK"]',
    '[aria-label="Accept"]',
    '[data-action="ok"]',
    '.dialog-ok-button',
    'button.os-accept',
    '.feature-dialog button[type="submit"]',
  ],
  
  CANCEL_BUTTON: [
    '[aria-label="Cancel"]',
    '[data-action="cancel"]',
    '.dialog-cancel-button',
    'button.os-cancel',
  ],
  
  // Extrude dialog specific
  EXTRUDE_DEPTH_INPUT: [
    'input[aria-label="Depth"]',
    'input[placeholder*="Depth"]',
    'input[name="depth"]',
    '.extrude-depth input',
    '[data-field="depth"] input',
  ],
  
  EXTRUDE_DIRECTION: [
    '[aria-label="Direction"]',
    '[data-field="direction"]',
    '.extrude-direction select',
  ],
};

// ============================================================================
// FEATURE PARAMS - Inputs for hole/fillet/chamfer dialogs
// ============================================================================
export const HOLE_DIALOG = {
  DIAMETER_INPUT: [
    'input[aria-label="Diameter"]',
    'input[placeholder*="Diameter"]',
    '[data-field="diameter"] input',
    '.hole-diameter input',
  ],
  DEPTH_INPUT: [
    'input[aria-label="Depth"]',
    'input[placeholder*="Depth"]',
    '[data-field="depth"] input',
    '.hole-depth input',
  ],
  POSITION_X: [
    'input[aria-label*="X"]',
    '[data-field="x"] input',
  ],
  POSITION_Y: [
    'input[aria-label*="Y"]',
    '[data-field="y"] input',
  ],
};

export const FILLET_DIALOG = {
  RADIUS_INPUT: [
    'input[aria-label="Radius"]',
    'input[placeholder*="Radius"]',
    '[data-field="radius"] input',
    '.fillet-radius input',
  ],
};

export const CHAMFER_DIALOG = {
  DISTANCE_INPUT: [
    'input[aria-label*="Distance"]',
    'input[placeholder*="Distance"]',
    '[data-field="distance"] input',
    '.chamfer-distance input',
  ],
};

// ============================================================================
// VARIABLE STUDIO - Tab and controls for parametric variables
// ============================================================================
export const VARIABLE_STUDIO = {
  TAB: [
    '[aria-label="Variable Studio"]',
    '[data-tab="variable-studio"]',
    '[title="Variable Studio"]',
    '.tab-item:has-text("Variable")',
    'button[class*="variable-studio"]',
  ],
  
  ADD_VARIABLE_BUTTON: [
    '[aria-label="Add variable"]',
    '[aria-label="New variable"]',
    '[data-action="add-variable"]',
    '[title="Add variable"]',
    'button.add-variable',
    '.variable-studio-toolbar button[class*="add"]',
  ],
  
  VARIABLE_NAME_INPUT: [
    'input[aria-label="Variable name"]',
    'input[placeholder*="Name"]',
    'input[placeholder*="Variable name"]',
    'input[name="variableName"]',
    '.variable-name-input input',
  ],
  
  EXPRESSION_INPUT: [
    'input[aria-label="Expression"]',
    'input[placeholder*="Expression"]',
    'input[placeholder*="Value"]',
    'input[name="expression"]',
    '.variable-expression-input input',
  ],
  
  DESCRIPTION_INPUT: [
    'input[aria-label="Description"]',
    'textarea[aria-label="Description"]',
    'input[placeholder*="Description"]',
    '.variable-description-input input',
  ],
  
  CREATE_BUTTON: [
    '[aria-label="Create"]',
    '[aria-label="Add"]',
    '[data-action="create-variable"]',
    '.variable-dialog button[type="submit"]',
  ],
};

// ============================================================================
// TABS - Part Studio, Variable Studio, etc.
// ============================================================================
export const TABS = {
  PART_STUDIO: [
    '[aria-label="Part Studio 1"]',
    '[aria-label^="Part Studio"]',
    '[data-tab="part-studio"]',
    '.tab-item:has-text("Part Studio")',
  ],
  
  ASSEMBLY: [
    '[aria-label^="Assembly"]',
    '[data-tab="assembly"]',
    '.tab-item:has-text("Assembly")',
  ],
  
  DRAWING: [
    '[aria-label^="Drawing"]',
    '[data-tab="drawing"]',
    '.tab-item:has-text("Drawing")',
  ],
};

// ============================================================================
// CANVAS - The 3D/2D viewport
// ============================================================================
export const CANVAS = {
  VIEWPORT: [
    'canvas.sketch-viewport',
    'canvas.os-viewport',
    'canvas[class*="viewport"]',
    '.graphics-viewport canvas',
    '#graphics-container canvas',
  ],
  
  SKETCH_CANVAS: [
    'canvas.sketch-canvas',
    'canvas[class*="sketch"]',
    '.sketch-viewport canvas',
  ],
};

// ============================================================================
// FEATURE TREE - Left panel showing feature history
// ============================================================================
export const FEATURE_TREE = {
  CONTAINER: [
    '.feature-tree',
    '.feature-list',
    '[class*="feature-tree"]',
    '.os-feature-list',
  ],
  
  FEATURE_ITEM: [
    '.feature-item',
    '.feature-list-item',
    '[class*="feature-row"]',
  ],
};

// ============================================================================
// HELPER: Find first matching element from a list of selectors
// ============================================================================
export function findElement(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        console.log(`[COCAD] Found element with selector: ${selector}`);
        return element;
      }
    } catch (e) {
      // Some selectors might be invalid, skip them
      continue;
    }
  }
  return null;
}

// ============================================================================
// HELPER: Find element by text content (fallback)
// ============================================================================
export function findElementByText(
  tagName: string,
  textContent: string,
  partial = true
): HTMLElement | null {
  const elements = document.querySelectorAll(tagName);
  for (const element of elements) {
    const text = element.textContent?.trim() || '';
    if (partial ? text.includes(textContent) : text === textContent) {
      console.log(`[COCAD] Found element by text: ${textContent}`);
      return element as HTMLElement;
    }
  }
  return null;
}

// ============================================================================
// HELPER: Find button by aria-label or title or text
// ============================================================================
export function findButton(name: string): HTMLElement | null {
  // Try aria-label
  let button = document.querySelector(`[aria-label="${name}"]`) as HTMLElement;
  if (button) return button;
  
  // Try title
  button = document.querySelector(`[title="${name}"]`) as HTMLElement;
  if (button) return button;
  
  // Try text content
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent?.trim().toLowerCase() === name.toLowerCase()) {
      return btn as HTMLElement;
    }
  }
  
  return null;
}

// ============================================================================
// DEBUG: Log all buttons and their attributes (run in console to find selectors)
// ============================================================================
export function debugLogButtons(): void {
  const buttons = document.querySelectorAll('button');
  console.log(`[COCAD Debug] Found ${buttons.length} buttons:`);
  
  buttons.forEach((btn, i) => {
    console.log(`Button ${i}:`, {
      text: btn.textContent?.trim().slice(0, 50),
      ariaLabel: btn.getAttribute('aria-label'),
      title: btn.getAttribute('title'),
      classes: btn.className.slice(0, 100),
      dataAttrs: Array.from(btn.attributes)
        .filter(a => a.name.startsWith('data-'))
        .map(a => `${a.name}="${a.value}"`),
    });
  });
}

// ============================================================================
// DEBUG: Log all inputs
// ============================================================================
export function debugLogInputs(): void {
  const inputs = document.querySelectorAll('input, textarea');
  console.log(`[COCAD Debug] Found ${inputs.length} inputs:`);
  
  inputs.forEach((input, i) => {
    console.log(`Input ${i}:`, {
      type: input.getAttribute('type'),
      placeholder: input.getAttribute('placeholder'),
      ariaLabel: input.getAttribute('aria-label'),
      name: input.getAttribute('name'),
      classes: input.className.slice(0, 100),
    });
  });
}

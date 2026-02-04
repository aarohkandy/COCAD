/**
 * Clicker - Functions for clicking elements and simulating user interaction
 */

import { sleep } from './waiter';

export interface ClickOptions {
  highlight?: boolean;     // Show visual feedback (default: true)
  highlightDuration?: number;  // How long to highlight in ms (default: 300)
  delay?: number;          // Delay after click in ms (default: 100)
}

/**
 * Click an element with optional visual feedback
 */
export async function clickElement(
  element: HTMLElement,
  options: ClickOptions = {}
): Promise<void> {
  const { highlight = true, highlightDuration = 300, delay = 100 } = options;

  if (!element) {
    throw new Error('Cannot click null element');
  }

  // Scroll element into view if needed
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(100);

  // Add highlight if enabled
  if (highlight) {
    addHighlight(element);
    await sleep(highlightDuration);
  }

  // Simulate realistic click sequence
  simulateClick(element);

  // Remove highlight
  if (highlight) {
    removeHighlight(element);
  }

  // Small delay after click for UI to respond
  await sleep(delay);

  console.log(`[COCAD] Clicked element:`, element);
}

/**
 * Click a button by name (aria-label, title, or text content)
 */
export async function clickButton(
  buttonName: string,
  options: ClickOptions = {}
): Promise<void> {
  // Try to find button by various methods
  let button: HTMLElement | null = null;

  // Method 1: aria-label
  button = document.querySelector(`[aria-label="${buttonName}"]`) as HTMLElement;
  
  // Method 2: title
  if (!button) {
    button = document.querySelector(`[title="${buttonName}"]`) as HTMLElement;
  }
  
  // Method 3: data-* attributes
  if (!button) {
    button = document.querySelector(`[data-command="${buttonName.toLowerCase()}"]`) as HTMLElement;
    if (!button) {
      button = document.querySelector(`[data-action="${buttonName.toLowerCase()}"]`) as HTMLElement;
    }
  }
  
  // Method 4: Text content match
  if (!button) {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase();
      if (text === buttonName.toLowerCase()) {
        button = btn as HTMLElement;
        break;
      }
    }
  }

  if (!button) {
    throw new Error(`Button not found: ${buttonName}`);
  }

  await clickElement(button, options);
}

/**
 * Simulate a complete click event sequence
 */
function simulateClick(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const eventOptions: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: centerX,
    clientY: centerY,
    screenX: centerX,
    screenY: centerY,
    button: 0,
    buttons: 1,
  };

  // Fire full event sequence like a real click
  element.dispatchEvent(new MouseEvent('mouseenter', eventOptions));
  element.dispatchEvent(new MouseEvent('mouseover', eventOptions));
  element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  element.dispatchEvent(new MouseEvent('click', eventOptions));
  
  // Also try the native click method
  element.click();
}

/**
 * Add visual highlight to element
 */
function addHighlight(element: HTMLElement): void {
  element.classList.add('cocad-highlight');
  element.style.outline = '3px solid #00ff88';
  element.style.outlineOffset = '2px';
}

/**
 * Remove visual highlight from element
 */
function removeHighlight(element: HTMLElement): void {
  element.classList.remove('cocad-highlight');
  element.style.outline = '';
  element.style.outlineOffset = '';
}

/**
 * Show a tooltip with the current action
 */
export function showActionTooltip(message: string): HTMLElement {
  // Remove existing tooltip
  const existing = document.getElementById('cocad-action-tooltip');
  if (existing) {
    existing.remove();
  }

  const tooltip = document.createElement('div');
  tooltip.id = 'cocad-action-tooltip';
  tooltip.className = 'cocad-action-tooltip';
  tooltip.textContent = message;
  tooltip.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a2e;
    color: #ffffff;
    padding: 12px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 9999999;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    border: 1px solid #00ff88;
    animation: cocad-fade-in 0.2s ease-out;
  `;
  
  document.body.appendChild(tooltip);
  return tooltip;
}

/**
 * Hide the action tooltip
 */
export function hideActionTooltip(): void {
  const tooltip = document.getElementById('cocad-action-tooltip');
  if (tooltip) {
    tooltip.remove();
  }
}

/**
 * Fill an input field with a value
 */
export async function fillInput(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  options: { clearFirst?: boolean; delay?: number } = {}
): Promise<void> {
  const { clearFirst = true, delay = 50 } = options;

  if (!input) {
    throw new Error('Cannot fill null input');
  }

  // Focus the input
  input.focus();
  await sleep(50);

  // Clear existing value if needed
  if (clearFirst) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Set the new value
  input.value = value;

  // Dispatch events that the app might be listening for
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

  // Blur to trigger any onblur handlers
  await sleep(delay);
  input.blur();

  console.log(`[COCAD] Filled input with: ${value}`);
}

/**
 * Find and fill an input by its label, placeholder, or aria-label
 */
export async function fillInputByName(
  name: string,
  value: string
): Promise<void> {
  let input: HTMLInputElement | HTMLTextAreaElement | null = null;

  // Try aria-label
  input = document.querySelector(`input[aria-label="${name}"]`) as HTMLInputElement;
  if (!input) {
    input = document.querySelector(`textarea[aria-label="${name}"]`) as HTMLTextAreaElement;
  }

  // Try placeholder
  if (!input) {
    input = document.querySelector(`input[placeholder*="${name}"]`) as HTMLInputElement;
  }

  // Try name attribute
  if (!input) {
    input = document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
  }

  // Try finding by associated label
  if (!input) {
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent?.toLowerCase().includes(name.toLowerCase())) {
        const forId = label.getAttribute('for');
        if (forId) {
          input = document.getElementById(forId) as HTMLInputElement;
          break;
        }
        // Or look for input inside label
        input = label.querySelector('input') as HTMLInputElement;
        if (input) break;
      }
    }
  }

  if (!input) {
    throw new Error(`Input not found: ${name}`);
  }

  await fillInput(input, value);
}

/**
 * Select an option from a dropdown/select element
 */
export async function selectOption(
  select: HTMLSelectElement,
  value: string
): Promise<void> {
  if (!select) {
    throw new Error('Cannot select from null element');
  }

  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));

  console.log(`[COCAD] Selected option: ${value}`);
}

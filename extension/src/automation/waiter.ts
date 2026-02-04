/**
 * Waiter - Functions for waiting for elements and conditions
 */

export interface WaitOptions {
  timeout?: number;      // Maximum time to wait in ms (default: 5000)
  interval?: number;     // Polling interval in ms (default: 100)
  visible?: boolean;     // Wait for element to be visible (default: true)
}

/**
 * Wait for an element to appear in the DOM
 */
export async function waitForElement(
  selector: string,
  options: WaitOptions = {}
): Promise<HTMLElement> {
  const { timeout = 5000, interval = 100, visible = true } = options;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const element = document.querySelector(selector) as HTMLElement;
      
      if (element) {
        if (!visible || isElementVisible(element)) {
          console.log(`[COCAD] Found element: ${selector}`);
          resolve(element);
          return;
        }
      }

      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Timeout waiting for element: ${selector} (${timeout}ms)`));
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}

/**
 * Wait for any of multiple selectors to match
 */
export async function waitForAnyElement(
  selectors: string[],
  options: WaitOptions = {}
): Promise<HTMLElement> {
  const { timeout = 5000, interval = 100, visible = true } = options;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      for (const selector of selectors) {
        try {
          const element = document.querySelector(selector) as HTMLElement;
          if (element && (!visible || isElementVisible(element))) {
            console.log(`[COCAD] Found element with selector: ${selector}`);
            resolve(element);
            return;
          }
        } catch (e) {
          // Invalid selector, skip
          continue;
        }
      }

      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Timeout waiting for any element: ${selectors.join(', ')}`));
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}

/**
 * Wait for an element to disappear from the DOM
 */
export async function waitForElementToDisappear(
  selector: string,
  options: WaitOptions = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const element = document.querySelector(selector);
      
      if (!element) {
        console.log(`[COCAD] Element disappeared: ${selector}`);
        resolve();
        return;
      }

      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Timeout waiting for element to disappear: ${selector}`));
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
  condition: () => boolean,
  description: string,
  options: WaitOptions = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      if (condition()) {
        console.log(`[COCAD] Condition met: ${description}`);
        resolve();
        return;
      }

      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Timeout waiting for condition: ${description}`));
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}

/**
 * Simple delay/sleep function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an element is visible
 */
export function isElementVisible(element: HTMLElement): boolean {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  
  return true;
}

/**
 * Wait for the page/UI to be idle (no pending network requests, animations done)
 */
export async function waitForIdle(timeout = 2000): Promise<void> {
  return new Promise(resolve => {
    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      const timeoutId = setTimeout(resolve, timeout);
      (window as any).requestIdleCallback(() => {
        clearTimeout(timeoutId);
        resolve();
      }, { timeout });
    } else {
      setTimeout(resolve, Math.min(timeout, 500));
    }
  });
}

/**
 * Wait for DOM to stabilize (no mutations for a period)
 */
export async function waitForDOMStable(
  stableTime = 200,
  timeout = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    let lastMutationTime = Date.now();
    const startTime = Date.now();
    
    const observer = new MutationObserver(() => {
      lastMutationTime = Date.now();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    
    const check = () => {
      const now = Date.now();
      
      if (now - lastMutationTime >= stableTime) {
        observer.disconnect();
        console.log('[COCAD] DOM stabilized');
        resolve();
        return;
      }
      
      if (now - startTime >= timeout) {
        observer.disconnect();
        reject(new Error('Timeout waiting for DOM to stabilize'));
        return;
      }
      
      setTimeout(check, 50);
    };
    
    setTimeout(check, stableTime);
  });
}

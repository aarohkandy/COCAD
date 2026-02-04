// Content script - injected into Onshape document pages
import type { MessageType, UIAction } from '../types/actions';
import { executeActionSequence, pauseExecution, resumeExecution } from '../automation/executor';
import { capture8Angles } from '../automation/viewport';

console.log('[COCAD] Content script loaded on Onshape');

// Get reference to sidebar iframe for communication
let sidebarIframe: HTMLIFrameElement | null = null;

// Check if we're on an Onshape document page
const isOnshapeDocument = (): boolean => {
  return (
    window.location.hostname.includes('cad.onshape.com') &&
    window.location.pathname.includes('/documents/')
  );
};

// Send message to sidebar iframe
const sendToSidebar = (message: any): void => {
  if (sidebarIframe?.contentWindow) {
    sidebarIframe.contentWindow.postMessage(message, '*');
  }
};

// Create and inject the sidebar container
const injectSidebar = (): HTMLDivElement | null => {
  if (document.getElementById('cocad-sidebar-container')) {
    console.log('[COCAD] Sidebar already exists');
    sidebarIframe = document.getElementById('cocad-sidebar-iframe') as HTMLIFrameElement;
    document.body.classList.add('cocad-sidebar-visible');
    return document.getElementById('cocad-sidebar-container') as HTMLDivElement;
  }

  const container = document.createElement('div');
  container.id = 'cocad-sidebar-container';
  document.body.appendChild(container);
  document.body.classList.add('cocad-sidebar-visible');

  // Create iframe to load sidebar React app
  const iframe = document.createElement('iframe');
  iframe.id = 'cocad-sidebar-iframe';
  iframe.src = chrome.runtime.getURL('src/sidebar/index.html');
  container.appendChild(iframe);
  sidebarIframe = iframe;

  console.log('[COCAD] Sidebar injected');
  return container;
};

// Toggle sidebar visibility and body margin
let sidebarVisible = true;
const toggleSidebar = (): void => {
  const container = document.getElementById('cocad-sidebar-container');
  if (container) {
    sidebarVisible = !sidebarVisible;
    container.classList.toggle('hidden', !sidebarVisible);
    document.body.classList.toggle('cocad-sidebar-visible', sidebarVisible);
  }
};

// Execute actions and report progress
const executeActions = async (
  actions: UIAction[],
  options: { showTooltips?: boolean; pauseBetweenActions?: number } = {}
): Promise<void> => {
  console.log('[COCAD] Executing', actions.length, 'actions');

  try {
    await executeActionSequence(actions, {
      showTooltips: options.showTooltips ?? true,
      pauseBetweenActions: options.pauseBetweenActions ?? 400,
      onProgress: (index, total, action) => {
        console.log(`[COCAD] Progress: ${index + 1}/${total} - ${action.type}`);
        sendToSidebar({
          type: 'ACTION_PROGRESS',
          index,
          total,
          action,
        });
      },
      onError: (error, action, index) => {
        console.error(`[COCAD] Error at action ${index}:`, error);
        sendToSidebar({
          type: 'ACTION_ERROR',
          error: error.message,
          action,
          index,
        });
      },
    });

    console.log('[COCAD] All actions completed successfully');
    sendToSidebar({ type: 'ACTION_COMPLETE' });
  } catch (error) {
    console.error('[COCAD] Action execution failed:', error);
    sendToSidebar({
      type: 'ACTION_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Initialize when DOM is ready
const init = (): void => {
  if (!isOnshapeDocument()) {
    console.log('[COCAD] Not an Onshape document page, skipping injection');
    return;
  }

  const injectWhenReady = (): void => {
    if (document.getElementById('cocad-sidebar-container')) return;
    console.log('[COCAD] Injecting sidebar...');
    injectSidebar();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(injectWhenReady, 400));
  } else {
    setTimeout(injectWhenReady, 400);
  }
};

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  console.log('[COCAD] Content script received message:', message.type);

  if (message.type === 'TOGGLE_SIDEBAR') {
    toggleSidebar();
    sendResponse({ success: true });
  }

  return true; // Keep message channel open for async response
});

// Listen for messages from sidebar iframe
window.addEventListener('message', (event) => {
  if (event.source !== sidebarIframe?.contentWindow) {
    return;
  }

  const message = event.data;
  if (message?.type === 'EXECUTE_ACTIONS' && Array.isArray(message.actions)) {
    const options = message.options || {};
    executeActions(message.actions, options);
  }
  if (message?.type === 'COCAD_TOGGLE_SIDEBAR') {
    toggleSidebar();
  }
  if (message?.type === 'CAPTURE_SCREENSHOTS') {
    (async () => {
      try {
        const screenshots = await capture8Angles();
        sendToSidebar({ type: 'CAPTURE_SCREENSHOTS_RESULT', screenshots });
      } catch (error) {
        sendToSidebar({
          type: 'CAPTURE_SCREENSHOTS_ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    })();
  }
  if (message?.type === 'PAUSE_ACTIONS') {
    pauseExecution();
  }
  if (message?.type === 'RESUME_ACTIONS') {
    resumeExecution();
  }
});

// Start initialization
init();

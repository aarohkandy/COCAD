// Content script - injected into Onshape document pages
import type { MessageType, UIAction } from '../types/actions';
import { executeActionSequence } from '../automation/executor';

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
    return document.getElementById('cocad-sidebar-container') as HTMLDivElement;
  }

  const container = document.createElement('div');
  container.id = 'cocad-sidebar-container';
  document.body.appendChild(container);

  // Create iframe to load sidebar React app
  const iframe = document.createElement('iframe');
  iframe.id = 'cocad-sidebar-iframe';
  iframe.src = chrome.runtime.getURL('src/sidebar/index.html');
  container.appendChild(iframe);
  sidebarIframe = iframe;

  console.log('[COCAD] Sidebar injected');
  return container;
};

// Toggle sidebar visibility
let sidebarVisible = true;
const toggleSidebar = (): void => {
  const container = document.getElementById('cocad-sidebar-container');
  if (container) {
    sidebarVisible = !sidebarVisible;
    container.style.display = sidebarVisible ? 'block' : 'none';
  }
};

// Execute actions and report progress
const executeActions = async (actions: UIAction[]): Promise<void> => {
  console.log('[COCAD] Executing', actions.length, 'actions');

  try {
    await executeActionSequence(actions, {
      showTooltips: true,
      pauseBetweenActions: 400,
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

  console.log('[COCAD] Onshape document detected, injecting sidebar...');
  
  // Wait for Onshape to fully load
  const waitForOnshape = setInterval(() => {
    // Check for Onshape's main UI elements to ensure it's loaded
    const onshapeLoaded = document.querySelector('.os-document-page') || 
                          document.querySelector('[class*="document"]');
    
    if (onshapeLoaded || document.readyState === 'complete') {
      clearInterval(waitForOnshape);
      injectSidebar();
    }
  }, 500);

  // Timeout after 10 seconds
  setTimeout(() => {
    clearInterval(waitForOnshape);
    if (!document.getElementById('cocad-sidebar-container')) {
      console.log('[COCAD] Timeout waiting for Onshape, injecting anyway');
      injectSidebar();
    }
  }, 10000);
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
  // Only accept messages from our sidebar iframe
  if (event.source !== sidebarIframe?.contentWindow) {
    return;
  }

  const message = event.data;
  console.log('[COCAD] Received message from sidebar:', message?.type);

  if (message?.type === 'EXECUTE_ACTIONS' && Array.isArray(message.actions)) {
    executeActions(message.actions);
  }
});

// Start initialization
init();

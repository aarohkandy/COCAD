// Background service worker - handles communication between content script and backend
import type { MessageType, PlanningDocument, UIAction, ChatMessage } from '../types/actions';

console.log('[COCAD] Background service worker started');

// Backend URL - change for production
const BACKEND_URL = 'http://localhost:3001';

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id && tab.url?.includes('cad.onshape.com')) {
    // Toggle sidebar visibility
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
  } else {
    // Open Onshape if not on the site
    chrome.tabs.create({ url: 'https://cad.onshape.com' });
  }
});

// Listen for messages from content script or sidebar
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  console.log('[COCAD] Background received message:', message.type);

  switch (message.type) {
    case 'GENERATE_CLARIFY':
      handleGenerateClarify(message.description, message.conversation || [], sendResponse);
      return true;

    case 'GENERATE_PLAN':
      handleGeneratePlan(message.description, sendResponse);
      return true; // Keep channel open for async response

    case 'GENERATE_ACTIONS':
      handleGenerateActions(message.plan, sendResponse);
      return true;

    case 'VERIFY_PART':
      handleVerifyPart(message.screenshots, message.originalRequest, message.plan, sendResponse);
      return true;

    default:
      return false;
  }
});

// Call backend to generate clarifying questions
async function handleGenerateClarify(
  description: string,
  conversation: ChatMessage[],
  sendResponse: (response: { success: boolean; readyToGenerate?: boolean; questions?: string[]; error?: string }) => void
): Promise<void> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, conversation }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    sendResponse({ success: true, readyToGenerate: data.readyToGenerate, questions: data.questions });
  } catch (error) {
    console.error('[COCAD] Failed to generate clarifying questions:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Call backend to generate planning document
async function handleGeneratePlan(
  description: string,
  sendResponse: (response: { success: boolean; plan?: PlanningDocument; error?: string }) => void
): Promise<void> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    sendResponse({ success: true, plan: data.plan });
  } catch (error) {
    console.error('[COCAD] Failed to generate plan:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Call backend to generate action sequence
async function handleGenerateActions(
  plan: PlanningDocument,
  sendResponse: (response: { success: boolean; actions?: UIAction[]; error?: string }) => void
): Promise<void> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    sendResponse({ success: true, actions: data.actions });
  } catch (error) {
    console.error('[COCAD] Failed to generate actions:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Call backend to verify part using screenshots
async function handleVerifyPart(
  screenshots: string[],
  originalRequest: string,
  plan: PlanningDocument,
  sendResponse: (response: { success: boolean; satisfied?: boolean; issues?: string[]; suggestedFixes?: UIAction[]; error?: string }) => void
): Promise<void> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenshots, originalRequest, plan }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    sendResponse({
      success: true,
      satisfied: data.satisfied,
      issues: data.issues,
      suggestedFixes: data.suggestedFixes,
    });
  } catch (error) {
    console.error('[COCAD] Failed to verify part:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

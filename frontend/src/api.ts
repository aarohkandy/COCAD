import type { SessionSnapshot, StoredSessionGate, StreamEvent } from "./types";

const runtimeApiBaseUrl =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? runtimeApiBaseUrl;
export const SESSION_STORAGE_KEY = "cocad.session";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function createSession(claimId?: string): Promise<SessionSnapshot> {
  return request<SessionSnapshot>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(claimId ? { claim_id: claimId } : {}),
  });
}

export function hydrateSession(sessionId: string): Promise<SessionSnapshot> {
  return request<SessionSnapshot>(`/api/sessions/${sessionId}`);
}

export function postMessage(sessionId: string, message: string): Promise<{ queued: boolean }> {
  return request<{ queued: boolean }>(`/api/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function confirmAssumptions(sessionId: string): Promise<{ queued: boolean }> {
  return request<{ queued: boolean }>(`/api/sessions/${sessionId}/assumptions/confirm`, {
    method: "POST",
  });
}

export function createEventSource(sessionId: string, lastEventId?: string | null): EventSource {
  const url = new URL(`${API_BASE_URL}/api/sessions/${sessionId}/events`);
  if (lastEventId) {
    url.searchParams.set("last_event_id", lastEventId);
  }
  return new EventSource(url);
}

export function writeStoredGate(value: StoredSessionGate): void {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
}

export function readStoredGate(): StoredSessionGate | null {
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSessionGate;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearStoredGate(): void {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function mapLiveEvent(raw: string): StreamEvent {
  return JSON.parse(raw) as StreamEvent;
}

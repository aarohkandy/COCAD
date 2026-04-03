import type { GateFormValues, SessionSnapshot, StreamEvent } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
export const SESSION_STORAGE_KEY = "cocad.phase0.session";

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

export function createSession(values: GateFormValues): Promise<SessionSnapshot> {
  return request<SessionSnapshot>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      email: values.email,
      invite_code: values.inviteCode,
    }),
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

export function createEventSource(sessionId: string): EventSource {
  return new EventSource(`${API_BASE_URL}/api/sessions/${sessionId}/events`);
}

export interface StoredSessionGate {
  sessionId: string;
  email: string;
  inviteCode: string;
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

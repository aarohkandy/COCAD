import type { AppAction, AppState, ArtifactLink, SessionSnapshot, StreamEvent, TimelineCard } from "./types";

export const initialState: AppState = {
  bootstrapped: false,
  sessionId: null,
  email: "",
  inviteCode: "",
  modelUrl: null,
  downloads: [],
  timeline: [],
  latestSummary: "Initialize a session to start the Phase 0 prototype.",
  isStreaming: false,
  isSending: false,
  error: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "bootstrapComplete":
      return { ...state, bootstrapped: true };
    case "sessionLoaded":
      return hydrateSession(action.snapshot);
    case "eventReceived":
      return applyServerEvent(state, action.event);
    case "streamOpen":
      return { ...state, isStreaming: true, error: null };
    case "streamClosed":
      return { ...state, isStreaming: false };
    case "sendStarted":
      return { ...state, isSending: true, error: null };
    case "sendFinished":
      return { ...state, isSending: false };
    case "error":
      return { ...state, error: action.message, isSending: false };
    case "reset":
      return { ...initialState, bootstrapped: true };
    default:
      return state;
  }
}

function hydrateSession(snapshot: SessionSnapshot): AppState {
  const next = {
    ...initialState,
    bootstrapped: true,
    sessionId: snapshot.session_id,
    email: snapshot.email,
    inviteCode: snapshot.invite_code,
    modelUrl: snapshot.model_url,
    downloads: snapshot.downloads,
  };

  return snapshot.events.reduce<AppState>(
    (current, event) => applyServerEvent(current, event),
    next,
  );
}

function applyServerEvent(state: AppState, event: StreamEvent): AppState {
  switch (event.event) {
    case "chat_token":
      return {
        ...state,
        timeline: upsertMessage(state.timeline, {
          id: String(event.data.messageId ?? event.id),
          createdAt: event.created_at,
          kind: "message",
          title: event.data.role === "user" ? "user" : "assistant",
          body: String(event.data.delta ?? ""),
          role: event.data.role === "user" ? "user" : "assistant",
          tone: "neutral",
          complete: Boolean(event.data.complete),
        }),
      };
    case "progress_summary":
      return {
        ...state,
        latestSummary: String(event.data.summary ?? state.latestSummary),
        isSending: false,
      };
    case "viewer_model_ready":
      return {
        ...state,
        modelUrl: String(event.data.modelUrl ?? state.modelUrl ?? ""),
        downloads: Array.isArray(event.data.downloads)
          ? event.data.downloads.map((download) => ({
              label: String((download as ArtifactLink).label),
              url: String((download as ArtifactLink).url),
            }))
          : state.downloads,
        timeline: appendUnique(state.timeline, {
          id: event.id,
          createdAt: event.created_at,
          kind: "notice",
          title: "viewer",
          body: String(event.data.label ?? "Viewer model ready."),
          role: "system",
          tone: "neutral",
        }),
      };
    case "run_cancelled":
      return {
        ...state,
        isSending: false,
        timeline: appendUnique(state.timeline, {
          id: event.id,
          createdAt: event.created_at,
          kind: "notice",
          title: "system",
          body: String(event.data.reason ?? "An active run was cancelled."),
          role: "system",
          tone: "warning",
        }),
      };
    case "safety_refusal":
      return {
        ...state,
        isSending: false,
        timeline: appendUnique(state.timeline, {
          id: String(event.data.messageId ?? event.id),
          createdAt: event.created_at,
          kind: "notice",
          title: "safety",
          body: String(event.data.message ?? "Request blocked by safety policy."),
          role: "system",
          tone: "danger",
        }),
      };
    default:
      return state;
  }
}

function upsertMessage(timeline: TimelineCard[], nextCard: TimelineCard): TimelineCard[] {
  const index = timeline.findIndex((entry) => entry.id === nextCard.id);
  if (index === -1) {
    return [...timeline, nextCard].sort(compareTimeline);
  }
  const current = timeline[index];
  const merged: TimelineCard = {
    ...current,
    body: `${current.body}${nextCard.body}`,
    complete: nextCard.complete ?? current.complete,
  };
  const next = [...timeline];
  next[index] = merged;
  return next.sort(compareTimeline);
}

function appendUnique(timeline: TimelineCard[], nextCard: TimelineCard): TimelineCard[] {
  if (timeline.some((entry) => entry.id === nextCard.id)) {
    return timeline;
  }
  return [...timeline, nextCard].sort(compareTimeline);
}

function compareTimeline(left: TimelineCard, right: TimelineCard): number {
  const timeDiff = Date.parse(left.createdAt) - Date.parse(right.createdAt);
  if (timeDiff !== 0) {
    return timeDiff;
  }
  return left.id.localeCompare(right.id);
}

export function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function toneClassName(tone: TimelineCard["tone"]): string {
  switch (tone) {
    case "warning":
      return "timeline-card--warning";
    case "danger":
      return "timeline-card--danger";
    default:
      return "timeline-card--neutral";
  }
}

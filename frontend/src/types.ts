export type EventType =
  | "chat_token"
  | "interview_question"
  | "assumptions_ready"
  | "assumption_confirmation_requested"
  | "assumptions_confirmed"
  | "step_plan_published"
  | "step_started"
  | "step_execution_failed"
  | "step_checker_failed"
  | "step_accepted"
  | "viewer_model_ready"
  | "progress_summary"
  | "downloads_ready"
  | "run_cancelled"
  | "safety_refusal";

export interface ArtifactLink {
  label: string;
  url: string;
}

export interface StreamEvent {
  id: string;
  event: EventType;
  data: Record<string, unknown>;
  created_at: string;
}

export interface SessionSnapshot {
  session_id: string;
  email: string;
  invite_code: string;
  model_url: string | null;
  downloads: ArtifactLink[];
  events: StreamEvent[];
  created_at: string;
}

export interface GateFormValues {
  email: string;
  inviteCode: string;
}

export interface TimelineCard {
  id: string;
  kind: "message" | "notice";
  title: string;
  body: string;
  role?: "user" | "assistant" | "system";
  tone: "neutral" | "warning" | "danger";
  complete?: boolean;
  createdAt: string;
}

export interface AppState {
  bootstrapped: boolean;
  sessionId: string | null;
  email: string;
  inviteCode: string;
  modelUrl: string | null;
  downloads: ArtifactLink[];
  timeline: TimelineCard[];
  latestSummary: string;
  isStreaming: boolean;
  isSending: boolean;
  error: string | null;
}

export type AppAction =
  | { type: "bootstrapComplete" }
  | { type: "sessionLoaded"; snapshot: SessionSnapshot }
  | { type: "eventReceived"; event: StreamEvent }
  | { type: "streamOpen" }
  | { type: "streamClosed" }
  | { type: "sendStarted" }
  | { type: "sendFinished" }
  | { type: "error"; message: string | null }
  | { type: "reset" };

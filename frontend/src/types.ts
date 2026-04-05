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

export interface RenderView {
  key: "top" | "front" | "side" | "isometric";
  label: string;
  url: string;
}

export interface MassProperties {
  volume_mm3: number;
  center_of_mass_mm: [number, number, number];
  bounding_box_mm: [number, number, number];
}

export interface CheckerReport {
  passed: boolean;
  summary: string;
  interference_relevant: boolean;
  interference_detected: boolean;
  notes: string[];
}

export interface AssumptionBundle {
  intent_summary: string;
  assumptions: string[];
  surface_units: string;
}

export interface StepPlanItem {
  step_id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "accepted" | "failed";
}

export interface WorkflowSnapshot {
  stage: "waiting_for_brief" | "interviewing" | "awaiting_confirmation" | "planning" | "building" | "complete" | "blocked";
  latest_summary: string;
  can_confirm_assumptions: boolean;
  design_kind: string | null;
  pending_assumptions: AssumptionBundle | null;
  confirmed_assumptions: AssumptionBundle | null;
  step_plan: StepPlanItem[];
  render_views: RenderView[];
  mass_properties: MassProperties | null;
  checker_report: CheckerReport | null;
  current_step_id: string | null;
  current_revision_label: string | null;
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
  workflow: WorkflowSnapshot;
  events: StreamEvent[];
  created_at: string;
}

export interface InviteClaimResponse {
  claim_id: string;
  email: string;
  invite_code: string;
}

export interface GateFormValues {
  email: string;
  inviteCode: string;
}

export interface StoredSessionGate {
  sessionId: string;
  claimId: string;
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
  claimId: string | null;
  email: string;
  inviteCode: string;
  modelUrl: string | null;
  downloads: ArtifactLink[];
  workflow: WorkflowSnapshot;
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

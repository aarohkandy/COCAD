import type {
  AppAction,
  AppState,
  ArtifactLink,
  AssumptionBundle,
  CheckerReport,
  MassProperties,
  RenderView,
  SessionSnapshot,
  StepPlanItem,
  StreamEvent,
  TimelineCard,
  WorkflowSnapshot,
} from "./types";

const EMPTY_WORKFLOW: WorkflowSnapshot = {
  stage: "waiting_for_brief",
  latest_summary: "Initialize a session to start the design flow.",
  can_confirm_assumptions: false,
  design_kind: null,
  pending_assumptions: null,
  confirmed_assumptions: null,
  step_plan: [],
  render_views: [],
  mass_properties: null,
  checker_report: null,
  current_step_id: null,
  current_revision_label: null,
};

export const initialState: AppState = {
  bootstrapped: false,
  sessionId: null,
  claimId: null,
  email: "",
  inviteCode: "",
  modelUrl: null,
  downloads: [],
  workflow: EMPTY_WORKFLOW,
  timeline: [],
  latestSummary: EMPTY_WORKFLOW.latest_summary,
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
  const base: AppState = {
    ...initialState,
    bootstrapped: true,
    sessionId: snapshot.session_id,
    claimId: null,
    email: snapshot.email,
    inviteCode: snapshot.invite_code,
    modelUrl: snapshot.model_url,
    downloads: snapshot.downloads,
    workflow: snapshot.workflow,
    latestSummary: snapshot.workflow.latest_summary,
  };

  const replayed = snapshot.events.reduce<AppState>((current, event) => applyServerEvent(current, event), base);
  return {
    ...replayed,
    modelUrl: snapshot.model_url,
    downloads: snapshot.downloads,
    workflow: snapshot.workflow,
    latestSummary: snapshot.workflow.latest_summary,
  };
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
    case "interview_question":
      return updateWorkflow(state, {
        latest_summary: "Waiting for the requested clarification.",
      });
    case "assumptions_ready":
      return updateWorkflow(
        state,
        {
          pending_assumptions: readAssumptionBundle(event.data.assumptions),
          can_confirm_assumptions: true,
          stage: "awaiting_confirmation",
          latest_summary: "Assumptions are ready for confirmation.",
        },
      );
    case "assumption_confirmation_requested":
      return updateWorkflow(
        state,
        {
          pending_assumptions: readAssumptionBundle(event.data.assumptions) ?? state.workflow.pending_assumptions,
          can_confirm_assumptions: true,
          stage: "awaiting_confirmation",
        },
      );
    case "assumptions_confirmed":
      return updateWorkflow(
        state,
        {
          confirmed_assumptions: readAssumptionBundle(event.data.assumptions) ?? state.workflow.confirmed_assumptions,
          pending_assumptions: null,
          can_confirm_assumptions: false,
          stage: "planning",
          latest_summary: "Assumptions confirmed. Generating the build plan.",
        },
      );
    case "step_plan_published":
      {
        const steps = normalizeStepPlan(event.data.steps);
        return updateWorkflow(
          state,
          {
            step_plan: steps,
            stage: "building",
            latest_summary: `Published ${steps.length} build steps.`,
          },
        );
      }
    case "step_started":
      return updateWorkflow(
        state,
        {
          current_step_id: readStep(event.data.step)?.step_id ?? state.workflow.current_step_id,
          step_plan: updateStepStatus(state.workflow.step_plan, readStep(event.data.step)?.step_id, "in_progress"),
          stage: "building",
        },
      );
    case "step_execution_failed":
      return updateWorkflow(
        state,
        {
          current_step_id: readStep(event.data.step)?.step_id ?? state.workflow.current_step_id,
          step_plan: updateStepStatus(state.workflow.step_plan, readStep(event.data.step)?.step_id, "failed"),
          stage: "blocked",
          latest_summary: String(event.data.error ?? "Step execution failed."),
        },
        noteCard(event, String(event.data.error ?? "Step execution failed."), "danger"),
      );
    case "step_checker_failed":
      return updateWorkflow(
        state,
        {
          step_plan: updateStepStatus(state.workflow.step_plan, readStep(event.data.step)?.step_id, "failed"),
          checker_report: {
            passed: false,
            summary: String(event.data.summary ?? "Checker rejected the revision."),
            interference_relevant: false,
            interference_detected: false,
            notes: Array.isArray(event.data.notes)
              ? event.data.notes.map((item) => String(item))
              : [String(event.data.summary ?? "Checker rejected the revision.")],
          },
          latest_summary: String(event.data.summary ?? "Checker rejected the revision."),
          stage: "blocked",
        },
        noteCard(event, String(event.data.summary ?? "Checker rejected the revision."), "warning"),
      );
    case "step_accepted": {
      const step = readStep(event.data.step);
      const renderViews = normalizeRenderViews(event.data.renderViews);
      const checker = readCheckerReport(event.data.checker);
      const massProperties = readMassProperties(event.data.massProperties);
      return updateWorkflow(
        state,
        {
          current_step_id: step?.step_id ?? state.workflow.current_step_id,
          current_revision_label:
            String(event.data.revisionLabel ?? state.workflow.current_revision_label ?? "") ||
            state.workflow.current_revision_label,
          step_plan: updateStepStatus(state.workflow.step_plan, step?.step_id, "accepted"),
          render_views: renderViews.length > 0 ? renderViews : state.workflow.render_views,
          mass_properties: massProperties ?? state.workflow.mass_properties,
          checker_report: checker ?? state.workflow.checker_report,
          stage: "building",
          latest_summary: `Accepted ${step?.step_id ?? "step"}.`,
        },
      );
    }
    case "viewer_model_ready":
      return {
        ...state,
        modelUrl: String(event.data.modelUrl ?? state.modelUrl ?? ""),
        downloads: normalizeDownloads(event.data.downloads, state.downloads),
      };
    case "progress_summary":
      return {
        ...state,
        latestSummary: String(event.data.summary ?? state.latestSummary),
        workflow: {
          ...state.workflow,
          latest_summary: String(event.data.summary ?? state.latestSummary),
        },
        isSending: false,
      };
    case "downloads_ready":
      return {
        ...state,
        downloads: normalizeDownloads(event.data.downloads, state.downloads),
      };
    case "run_cancelled":
      return {
        ...state,
        isSending: false,
        timeline: appendUnique(state.timeline, noteCard(event, String(event.data.reason ?? "Run cancelled."), "warning")),
      };
    case "safety_refusal":
      return {
        ...state,
        isSending: false,
        workflow: {
          ...state.workflow,
          stage: "blocked",
          latest_summary: String(event.data.message ?? "Request blocked by safety policy."),
        },
        latestSummary: String(event.data.message ?? "Request blocked by safety policy."),
        timeline: appendUnique(
          state.timeline,
          {
            id: String(event.data.messageId ?? event.id),
            createdAt: event.created_at,
            kind: "notice",
            title: "safety",
            body: String(event.data.message ?? "Request blocked by safety policy."),
            role: "system",
            tone: "danger",
          },
        ),
      };
    default:
      return state;
  }
}

function updateWorkflow(state: AppState, patch: Partial<WorkflowSnapshot>, card?: TimelineCard): AppState {
  const nextWorkflow = {
    ...state.workflow,
    ...patch,
  };
  return {
    ...state,
    workflow: nextWorkflow,
    latestSummary: nextWorkflow.latest_summary,
    timeline: card ? appendUnique(state.timeline, card) : state.timeline,
  };
}

function noteCard(event: StreamEvent, body: string, tone: TimelineCard["tone"] = "neutral"): TimelineCard {
  return {
    id: event.id,
    createdAt: event.created_at,
    kind: "notice",
    title: event.event.replace(/_/g, " "),
    body,
    role: "system",
    tone,
  };
}

function readAssumptionBundle(value: unknown): AssumptionBundle | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    intent_summary: String(value.intent_summary ?? ""),
    assumptions: Array.isArray(value.assumptions) ? value.assumptions.map((item) => String(item)) : [],
    surface_units: String(value.surface_units ?? "millimeters"),
  };
}

function readCheckerReport(value: unknown): CheckerReport | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    passed: Boolean(value.passed),
    summary: String(value.summary ?? ""),
    interference_relevant: Boolean(value.interference_relevant),
    interference_detected: Boolean(value.interference_detected),
    notes: Array.isArray(value.notes) ? value.notes.map((item) => String(item)) : [],
  };
}

function readMassProperties(value: unknown): MassProperties | null {
  if (!isRecord(value)) {
    return null;
  }
  const boundingBox = asTriple(value.bounding_box_mm);
  const centerOfMass = asTriple(value.center_of_mass_mm);
  if (!boundingBox || !centerOfMass) {
    return null;
  }
  return {
    volume_mm3: Number(value.volume_mm3 ?? 0),
    bounding_box_mm: boundingBox,
    center_of_mass_mm: centerOfMass,
  };
}

function readStep(value: unknown): StepPlanItem | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    step_id: String(value.step_id ?? value.stepId ?? ""),
    title: String(value.title ?? ""),
    description: String(value.description ?? ""),
    status: normalizeStatus(String(value.status ?? "pending")),
  };
}

function normalizeStepPlan(value: unknown): StepPlanItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => readStep(item)).filter((item): item is StepPlanItem => item !== null);
}

function normalizeRenderViews(value: unknown): RenderView[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item): RenderView | null => {
      if (!isRecord(item)) {
        return null;
      }
      return {
        key: String(item.key ?? "top") as RenderView["key"],
        label: String(item.label ?? ""),
        url: String(item.url ?? ""),
      };
    })
    .filter((item): item is RenderView => item !== null);
}

function normalizeDownloads(value: unknown, fallback: ArtifactLink[]): ArtifactLink[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value
    .map((item): ArtifactLink | null => {
      if (!isRecord(item)) {
        return null;
      }
      return {
        label: String(item.label ?? ""),
        url: String(item.url ?? ""),
      };
    })
    .filter((item): item is ArtifactLink => item !== null);
}

function updateStepStatus(plan: StepPlanItem[], stepId: string | undefined, status: StepPlanItem["status"]): StepPlanItem[] {
  if (!stepId) {
    return plan;
  }
  return plan.map((step) => (step.step_id === stepId ? { ...step, status } : step));
}

function normalizeStatus(status: string): StepPlanItem["status"] {
  if (status === "accepted" || status === "failed" || status === "in_progress") {
    return status;
  }
  return "pending";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asTriple(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const triple = value.map((item) => Number(item));
  if (triple.some((item) => Number.isNaN(item))) {
    return null;
  }
  return [triple[0], triple[1], triple[2]];
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

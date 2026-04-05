from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


EventType = Literal[
    "chat_token",
    "interview_question",
    "assumptions_ready",
    "assumption_confirmation_requested",
    "assumptions_confirmed",
    "step_plan_published",
    "step_started",
    "step_execution_failed",
    "step_checker_failed",
    "step_accepted",
    "viewer_model_ready",
    "progress_summary",
    "downloads_ready",
    "run_cancelled",
    "safety_refusal",
]
MessageRole = Literal["user", "assistant"]
WorkflowStage = Literal[
    "waiting_for_brief",
    "interviewing",
    "awaiting_confirmation",
    "planning",
    "building",
    "complete",
    "blocked",
]
StepStatus = Literal["pending", "in_progress", "accepted", "failed"]


class ArtifactLink(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    url: str


class RenderView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: Literal["top", "front", "side", "isometric"]
    label: str
    url: str


class MassProperties(BaseModel):
    model_config = ConfigDict(extra="forbid")

    volume_mm3: float
    center_of_mass_mm: tuple[float, float, float]
    bounding_box_mm: tuple[float, float, float]


class CheckerReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    passed: bool
    summary: str
    interference_relevant: bool = False
    interference_detected: bool = False
    notes: list[str] = Field(default_factory=list)


class StepPlanItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    step_id: str
    title: str
    description: str
    status: StepStatus = "pending"


class AssumptionBundle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent_summary: str
    assumptions: list[str] = Field(default_factory=list)
    surface_units: str = "millimeters"


class ConversationMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    role: MessageRole
    content: str
    created_at: datetime


class SessionEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    event: EventType
    data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class WorkflowSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage: WorkflowStage = "waiting_for_brief"
    latest_summary: str = "Ready for the first design brief."
    can_confirm_assumptions: bool = False
    design_kind: str | None = None
    pending_assumptions: AssumptionBundle | None = None
    confirmed_assumptions: AssumptionBundle | None = None
    step_plan: list[StepPlanItem] = Field(default_factory=list)
    render_views: list[RenderView] = Field(default_factory=list)
    mass_properties: MassProperties | None = None
    checker_report: CheckerReport | None = None
    current_step_id: str | None = None
    current_revision_label: str | None = None


class SessionSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    email: EmailStr
    invite_code: str
    model_url: str | None = None
    downloads: list[ArtifactLink] = Field(default_factory=list)
    workflow: WorkflowSnapshot
    events: list[SessionEvent] = Field(default_factory=list)
    created_at: datetime


class InviteClaimRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    invite_code: str = Field(min_length=1, max_length=128)


class InviteClaimResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    claim_id: str
    email: EmailStr
    invite_code: str


class CreateSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    claim_id: str | None = Field(default=None, min_length=1)


class MessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4000)


class MessageResponse(BaseModel):
    queued: bool


class ConfirmAssumptionsResponse(BaseModel):
    queued: bool


class DesignSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: str
    label: str
    original_request: str
    surface_units: str = "millimeters"
    dimensions_mm: dict[str, float] = Field(default_factory=dict)
    options: dict[str, Any] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)


class WorkflowState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage: WorkflowStage = "waiting_for_brief"
    latest_summary: str = "Ready for the first design brief."
    api_root: str = ""
    brief_messages: list[str] = Field(default_factory=list)
    interview_rounds: int = 0
    design_kind: str | None = None
    draft_spec: DesignSpec | None = None
    pending_assumptions: AssumptionBundle | None = None
    confirmed_assumptions: AssumptionBundle | None = None
    step_plan: list[StepPlanItem] = Field(default_factory=list)
    step_code: dict[str, str] = Field(default_factory=dict)
    render_views: list[RenderView] = Field(default_factory=list)
    mass_properties: MassProperties | None = None
    checker_report: CheckerReport | None = None
    current_step_id: str | None = None
    current_revision_label: str | None = None
    current_model_url: str | None = None
    downloads: list[ArtifactLink] = Field(default_factory=list)
    revision_number: int = 0

    def to_snapshot(self) -> WorkflowSnapshot:
        return WorkflowSnapshot(
            stage=self.stage,
            latest_summary=self.latest_summary,
            can_confirm_assumptions=self.stage == "awaiting_confirmation" and self.pending_assumptions is not None,
            design_kind=self.design_kind,
            pending_assumptions=self.pending_assumptions,
            confirmed_assumptions=self.confirmed_assumptions,
            step_plan=self.step_plan,
            render_views=self.render_views,
            mass_properties=self.mass_properties,
            checker_report=self.checker_report,
            current_step_id=self.current_step_id,
            current_revision_label=self.current_revision_label,
        )

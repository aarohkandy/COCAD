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


class ArtifactLink(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    url: str


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


class SessionSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    email: EmailStr
    invite_code: str
    model_url: str | None = None
    downloads: list[ArtifactLink] = Field(default_factory=list)
    events: list[SessionEvent] = Field(default_factory=list)
    created_at: datetime


class CreateSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    invite_code: str = Field(min_length=1, max_length=128)


class MessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4000)


class MessageResponse(BaseModel):
    queued: bool

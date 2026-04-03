from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
import contextlib
import itertools
from typing import Any
from uuid import uuid4

from app.domain.models import ArtifactLink, ConversationMessage, EventType, SessionEvent, SessionSnapshot


@dataclass
class SessionRecord:
    session_id: str
    email: str
    invite_code: str
    model_url: str
    downloads: list[ArtifactLink]
    created_at: datetime
    messages: list[ConversationMessage] = field(default_factory=list)
    events: list[SessionEvent] = field(default_factory=list)
    listeners: set[asyncio.Queue[SessionEvent]] = field(default_factory=set)
    event_counter: itertools.count = field(default_factory=lambda: itertools.count(1))
    active_task: asyncio.Task[None] | None = None


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionRecord] = {}
        self._lock = asyncio.Lock()

    async def create_session(
        self,
        *,
        email: str,
        invite_code: str,
        model_url: str,
        downloads: list[dict[str, str]],
    ) -> SessionSnapshot:
        async with self._lock:
            session_id = uuid4().hex
            record = SessionRecord(
                session_id=session_id,
                email=email,
                invite_code=invite_code,
                model_url=model_url,
                downloads=[ArtifactLink(**download) for download in downloads],
                created_at=datetime.now(UTC),
            )
            self._sessions[session_id] = record
            self._append_event_unlocked(
                record,
                "progress_summary",
                {
                    "summary": (
                        "Phase 0 session created. Chat is live, SSE is ready, and the viewer "
                        "is loading a static GLB placeholder."
                    ),
                },
            )
            self._append_event_unlocked(
                record,
                "viewer_model_ready",
                {
                    "modelUrl": model_url,
                    "label": "Static Phase 0 GLB placeholder",
                    "downloads": [download.model_dump() for download in record.downloads],
                },
            )
            return self._snapshot(record)

    async def get_snapshot(self, session_id: str) -> SessionSnapshot | None:
        async with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                return None
            return self._snapshot(record)

    async def add_user_message(self, session_id: str, content: str) -> ConversationMessage | None:
        async with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                return None
            message = ConversationMessage(
                id=f"msg-{uuid4().hex}",
                role="user",
                content=content,
                created_at=datetime.now(UTC),
            )
            record.messages.append(message)
            self._append_event_unlocked(
                record,
                "chat_token",
                {
                    "messageId": message.id,
                    "role": "user",
                    "delta": content,
                    "complete": True,
                },
            )
            return message

    async def add_assistant_message(
        self,
        session_id: str,
        content: str,
        *,
        message_id: str,
    ) -> ConversationMessage | None:
        async with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                return None
            message = ConversationMessage(
                id=message_id,
                role="assistant",
                content=content,
                created_at=datetime.now(UTC),
            )
            record.messages.append(message)
            return message

    async def append_event(
        self,
        session_id: str,
        event_type: EventType,
        payload: dict[str, Any],
    ) -> SessionEvent | None:
        async with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                return None
            return self._append_event_unlocked(record, event_type, payload)

    async def register_listener(
        self,
        session_id: str,
        *,
        last_event_id: str | None,
    ) -> tuple[list[SessionEvent], asyncio.Queue[SessionEvent]] | None:
        async with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                return None
            backlog = self._build_backlog(record, last_event_id)
            queue: asyncio.Queue[SessionEvent] = asyncio.Queue()
            record.listeners.add(queue)
            return backlog, queue

    async def unregister_listener(self, session_id: str, queue: asyncio.Queue[SessionEvent]) -> None:
        async with self._lock:
            record = self._sessions.get(session_id)
            if record is not None:
                record.listeners.discard(queue)

    async def get_messages(self, session_id: str) -> list[ConversationMessage]:
        async with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                return []
            return list(record.messages)

    async def replace_active_task(self, session_id: str, task: asyncio.Task[None]) -> bool:
        async with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                return False
            previous = record.active_task
            record.active_task = task
        if previous is not None and not previous.done():
            previous.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await previous
            await self.append_event(
                session_id,
                "run_cancelled",
                {"reason": "The active generation was cancelled because a newer user message arrived."},
            )
        return True

    async def clear_active_task(self, session_id: str, task: asyncio.Task[None]) -> None:
        async with self._lock:
            record = self._sessions.get(session_id)
            if record is not None and record.active_task is task:
                record.active_task = None

    def _append_event_unlocked(
        self,
        record: SessionRecord,
        event_type: EventType,
        payload: dict[str, Any],
    ) -> SessionEvent:
        event = SessionEvent(
            id=f"evt-{next(record.event_counter):06d}",
            event=event_type,
            data=payload,
            created_at=datetime.now(UTC),
        )
        record.events.append(event)
        for queue in record.listeners:
            queue.put_nowait(event)
        return event

    @staticmethod
    def _build_backlog(record: SessionRecord, last_event_id: str | None) -> list[SessionEvent]:
        if last_event_id is None:
            return list(record.events)
        last_sequence = SessionStore._parse_event_sequence(last_event_id)
        return [
            event
            for event in record.events
            if SessionStore._parse_event_sequence(event.id) > last_sequence
        ]

    @staticmethod
    def _parse_event_sequence(event_id: str) -> int:
        try:
            return int(event_id.split("-")[-1])
        except ValueError:
            return 0

    @staticmethod
    def _snapshot(record: SessionRecord) -> SessionSnapshot:
        return SessionSnapshot(
            session_id=record.session_id,
            email=record.email,
            invite_code=record.invite_code,
            model_url=record.model_url,
            downloads=record.downloads,
            events=list(record.events),
            created_at=record.created_at,
        )

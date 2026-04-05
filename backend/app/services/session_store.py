from __future__ import annotations

import asyncio
import contextlib
from datetime import UTC, datetime
import json
from pathlib import Path
import sqlite3
from typing import Any
from uuid import uuid4

from app.domain.models import (
    ArtifactLink,
    ConversationMessage,
    InviteClaimResponse,
    SessionEvent,
    SessionSnapshot,
    WorkflowState,
)


class SessionStore:
    def __init__(self, database_path: Path) -> None:
        database_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(database_path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._lock = asyncio.Lock()
        self._listeners: dict[str, set[asyncio.Queue[SessionEvent]]] = {}
        self._active_tasks: dict[str, asyncio.Task[None]] = {}
        self._initialize()

    def _initialize(self) -> None:
        self._connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS invite_claims (
                claim_id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                invite_code TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                claim_id TEXT NOT NULL,
                email TEXT NOT NULL,
                invite_code TEXT NOT NULL,
                model_url TEXT,
                downloads_json TEXT NOT NULL,
                workflow_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS events (
                seq INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                data_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        self._connection.commit()

    async def create_invite_claim(self, *, email: str, invite_code: str) -> InviteClaimResponse:
        async with self._lock:
            claim_id = uuid4().hex
            created_at = datetime.now(UTC).isoformat()
            self._connection.execute(
                "INSERT INTO invite_claims (claim_id, email, invite_code, created_at) VALUES (?, ?, ?, ?)",
                (claim_id, email, invite_code, created_at),
            )
            self._connection.commit()
            return InviteClaimResponse(claim_id=claim_id, email=email, invite_code=invite_code)

    async def create_session(self, *, claim_id: str | None, api_root: str) -> SessionSnapshot | None:
        async with self._lock:
            session_id = uuid4().hex
            now = datetime.now(UTC).isoformat()
            email = "guest@cocad.app"
            invite_code = "BYPASS"
            resolved_claim_id = claim_id or f"guest-{session_id}"

            if claim_id is not None:
                claim = self._connection.execute(
                    "SELECT email, invite_code FROM invite_claims WHERE claim_id = ?",
                    (claim_id,),
                ).fetchone()
                if claim is None:
                    return None
                email = claim["email"]
                invite_code = claim["invite_code"]

            workflow = WorkflowState(
                stage="waiting_for_brief",
                latest_summary="Share the object you want to design and I will interview for anything essential before building.",
                api_root=api_root,
            )
            self._connection.execute(
                """
                INSERT INTO sessions (
                    session_id, claim_id, email, invite_code, model_url, downloads_json, workflow_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    resolved_claim_id,
                    email,
                    invite_code,
                    None,
                    "[]",
                    workflow.model_dump_json(),
                    now,
                    now,
                ),
            )
            self._connection.commit()
            self._listeners.setdefault(session_id, set())
            event = self._append_event_unlocked(
                session_id,
                "progress_summary",
                {"summary": workflow.latest_summary},
            )
            return self._snapshot_unlocked(session_id, override_events=[event])

    async def get_snapshot(self, session_id: str) -> SessionSnapshot | None:
        async with self._lock:
            return self._snapshot_unlocked(session_id)

    async def get_workflow(self, session_id: str) -> WorkflowState | None:
        async with self._lock:
            session = self._session_row(session_id)
            if session is None:
                return None
            return WorkflowState.model_validate_json(session["workflow_json"])

    async def save_workflow(
        self,
        session_id: str,
        *,
        workflow: WorkflowState,
        model_url: str | None = None,
        downloads: list[ArtifactLink] | None = None,
    ) -> bool:
        async with self._lock:
            session = self._session_row(session_id)
            if session is None:
                return False
            resolved_model_url = model_url if model_url is not None else session["model_url"]
            if downloads is None:
                resolved_downloads_json = session["downloads_json"]
            else:
                resolved_downloads_json = json.dumps([download.model_dump() for download in downloads])
            self._connection.execute(
                """
                UPDATE sessions
                SET model_url = ?, downloads_json = ?, workflow_json = ?, updated_at = ?
                WHERE session_id = ?
                """,
                (
                    resolved_model_url,
                    resolved_downloads_json,
                    workflow.model_dump_json(),
                    datetime.now(UTC).isoformat(),
                    session_id,
                ),
            )
            self._connection.commit()
            return True

    async def add_user_message(self, session_id: str, content: str) -> ConversationMessage | None:
        async with self._lock:
            if self._session_row(session_id) is None:
                return None
            message = self._insert_message_unlocked(session_id, role="user", content=content)
            self._append_event_unlocked(
                session_id,
                "chat_token",
                {
                    "messageId": message.id,
                    "role": "user",
                    "delta": content,
                    "complete": True,
                },
            )
            return message

    async def add_assistant_message(self, session_id: str, content: str, *, message_id: str | None = None) -> ConversationMessage | None:
        async with self._lock:
            if self._session_row(session_id) is None:
                return None
            return self._insert_message_unlocked(session_id, role="assistant", content=content, message_id=message_id)

    async def append_event(self, session_id: str, event_type: str, payload: dict[str, Any]) -> SessionEvent | None:
        async with self._lock:
            if self._session_row(session_id) is None:
                return None
            return self._append_event_unlocked(session_id, event_type, payload)

    async def get_messages(self, session_id: str) -> list[ConversationMessage]:
        async with self._lock:
            rows = self._connection.execute(
                "SELECT id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,),
            ).fetchall()
            return [
                ConversationMessage(
                    id=row["id"],
                    role=row["role"],
                    content=row["content"],
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
                for row in rows
            ]

    async def register_listener(
        self,
        session_id: str,
        *,
        last_event_id: str | None,
    ) -> tuple[list[SessionEvent], asyncio.Queue[SessionEvent]] | None:
        async with self._lock:
            if self._session_row(session_id) is None:
                return None
            queue: asyncio.Queue[SessionEvent] = asyncio.Queue()
            self._listeners.setdefault(session_id, set()).add(queue)
            last_sequence = self._parse_event_sequence(last_event_id)
            rows = self._connection.execute(
                """
                SELECT seq, event_type, data_json, created_at
                FROM events
                WHERE session_id = ? AND seq > ?
                ORDER BY seq ASC
                """,
                (session_id, last_sequence),
            ).fetchall()
            backlog = [self._event_from_row(row) for row in rows]
            return backlog, queue

    async def unregister_listener(self, session_id: str, queue: asyncio.Queue[SessionEvent]) -> None:
        async with self._lock:
            self._listeners.get(session_id, set()).discard(queue)

    async def replace_active_task(self, session_id: str, task: asyncio.Task[None]) -> bool:
        async with self._lock:
            if self._session_row(session_id) is None:
                return False
            previous = self._active_tasks.get(session_id)
            self._active_tasks[session_id] = task
        if previous is not None and not previous.done():
            previous.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await previous
            await self.append_event(
                session_id,
                "run_cancelled",
                {"reason": "The active build was cancelled because a newer user request superseded it."},
            )
        return True

    async def clear_active_task(self, session_id: str, task: asyncio.Task[None]) -> None:
        async with self._lock:
            if self._active_tasks.get(session_id) is task:
                self._active_tasks.pop(session_id, None)

    def _insert_message_unlocked(
        self,
        session_id: str,
        *,
        role: str,
        content: str,
        message_id: str | None = None,
    ) -> ConversationMessage:
        created_at = datetime.now(UTC)
        message = ConversationMessage(
            id=message_id or f"msg-{uuid4().hex}",
            role=role,
            content=content,
            created_at=created_at,
        )
        self._connection.execute(
            "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (message.id, session_id, message.role, message.content, created_at.isoformat()),
        )
        self._connection.commit()
        return message

    def _append_event_unlocked(self, session_id: str, event_type: str, payload: dict[str, Any]) -> SessionEvent:
        created_at = datetime.now(UTC).isoformat()
        cursor = self._connection.execute(
            "INSERT INTO events (session_id, event_type, data_json, created_at) VALUES (?, ?, ?, ?)",
            (session_id, event_type, json.dumps(payload), created_at),
        )
        self._connection.commit()
        event = SessionEvent(
            id=f"evt-{cursor.lastrowid:06d}",
            event=event_type,  # type: ignore[arg-type]
            data=payload,
            created_at=datetime.fromisoformat(created_at),
        )
        for queue in self._listeners.get(session_id, set()):
            queue.put_nowait(event)
        return event

    def _snapshot_unlocked(self, session_id: str, override_events: list[SessionEvent] | None = None) -> SessionSnapshot | None:
        session = self._session_row(session_id)
        if session is None:
            return None
        workflow = WorkflowState.model_validate_json(session["workflow_json"])
        downloads = [ArtifactLink(**item) for item in json.loads(session["downloads_json"])]
        if override_events is None:
            rows = self._connection.execute(
                "SELECT seq, event_type, data_json, created_at FROM events WHERE session_id = ? ORDER BY seq ASC",
                (session_id,),
            ).fetchall()
            events = [self._event_from_row(row) for row in rows]
        else:
            events = override_events
        return SessionSnapshot(
            session_id=session["session_id"],
            email=session["email"],
            invite_code=session["invite_code"],
            model_url=session["model_url"],
            downloads=downloads,
            workflow=workflow.to_snapshot(),
            events=events,
            created_at=datetime.fromisoformat(session["created_at"]),
        )

    def _session_row(self, session_id: str) -> sqlite3.Row | None:
        return self._connection.execute(
            """
            SELECT session_id, claim_id, email, invite_code, model_url, downloads_json, workflow_json, created_at
            FROM sessions
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()

    @staticmethod
    def _parse_event_sequence(event_id: str | None) -> int:
        if not event_id:
            return 0
        try:
            return int(event_id.split("-")[-1])
        except ValueError:
            return 0

    @staticmethod
    def _event_from_row(row: sqlite3.Row) -> SessionEvent:
        return SessionEvent(
            id=f"evt-{row['seq']:06d}",
            event=row["event_type"],
            data=json.loads(row["data_json"]),
            created_at=datetime.fromisoformat(row["created_at"]),
        )

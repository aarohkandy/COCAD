from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, StreamingResponse

from app.domain.models import (
    ConfirmAssumptionsResponse,
    CreateSessionRequest,
    InviteClaimRequest,
    InviteClaimResponse,
    MessageRequest,
    MessageResponse,
    SessionEvent,
    SessionSnapshot,
)
from app.services.orchestrator import WorkflowOrchestrator, run_session_task
from app.services.session_store import SessionStore


router = APIRouter()


def _get_store(request: Request) -> SessionStore:
    return request.app.state.session_store


def _get_orchestrator(request: Request) -> WorkflowOrchestrator:
    return request.app.state.orchestrator


@router.post("/invite/claim", response_model=InviteClaimResponse, status_code=status.HTTP_201_CREATED)
async def claim_invite(payload: InviteClaimRequest, request: Request) -> InviteClaimResponse:
    settings = request.app.state.settings
    normalized_code = payload.invite_code.strip().upper()
    if normalized_code not in settings.valid_invite_codes:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite code not recognized.")
    return await _get_store(request).create_invite_claim(email=payload.email, invite_code=normalized_code)


@router.post("/sessions", response_model=SessionSnapshot, status_code=status.HTTP_201_CREATED)
async def create_session(payload: CreateSessionRequest, request: Request) -> SessionSnapshot:
    settings = request.app.state.settings
    api_root = f"{str(request.base_url).rstrip('/')}{settings.api_prefix}"
    session = await _get_store(request).create_session(claim_id=payload.claim_id, api_root=api_root)
    if session is None and payload.claim_id is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite claim not found.")
    if session is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create session.")
    return session


@router.get("/sessions/{session_id}", response_model=SessionSnapshot)
async def get_session(session_id: str, request: Request) -> SessionSnapshot:
    session = await _get_store(request).get_snapshot(session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return session


@router.post("/sessions/{session_id}/messages", response_model=MessageResponse)
async def post_message(session_id: str, payload: MessageRequest, request: Request) -> MessageResponse:
    session_store = _get_store(request)
    message = await session_store.add_user_message(session_id, payload.message)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    work_task = asyncio.create_task(
        _get_orchestrator(request).handle_user_message(session_id=session_id, message_text=payload.message)
    )
    await session_store.replace_active_task(session_id, work_task)
    asyncio.create_task(run_session_task(session_store=session_store, session_id=session_id, task=work_task))
    return MessageResponse(queued=True)


@router.post("/sessions/{session_id}/assumptions/confirm", response_model=ConfirmAssumptionsResponse)
async def confirm_assumptions(session_id: str, request: Request) -> ConfirmAssumptionsResponse:
    session = await _get_store(request).get_snapshot(session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    work_task = asyncio.create_task(_get_orchestrator(request).confirm_assumptions(session_id=session_id))
    await _get_store(request).replace_active_task(session_id, work_task)
    asyncio.create_task(run_session_task(session_store=_get_store(request), session_id=session_id, task=work_task))
    return ConfirmAssumptionsResponse(queued=True)


@router.get("/sessions/{session_id}/events")
async def stream_session_events(session_id: str, request: Request) -> StreamingResponse:
    listener = await _get_store(request).register_listener(
        session_id,
        last_event_id=request.headers.get("Last-Event-ID"),
    )
    if listener is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    backlog, queue = listener

    async def event_stream() -> AsyncIterator[str]:
        try:
            for event in backlog:
                yield _encode_sse(event)
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                except TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                yield _encode_sse(event)
        finally:
            await _get_store(request).unregister_listener(session_id, queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/artifacts/{artifact_path:path}")
async def get_artifact(artifact_path: str, request: Request) -> FileResponse:
    artifact_root: Path = request.app.state.settings.artifact_dir.resolve()
    candidate = (artifact_root / artifact_path).resolve()
    if not str(candidate).startswith(str(artifact_root)) or not candidate.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found.")
    return FileResponse(candidate)


def _encode_sse(event: SessionEvent) -> str:
    return (
        f"id: {event.id}\n"
        f"event: {event.event}\n"
        f"data: {json.dumps(event.model_dump(mode='json'))}\n\n"
    )

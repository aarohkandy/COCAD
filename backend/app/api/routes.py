from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
import json

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, StreamingResponse

from app.domain.models import CreateSessionRequest, MessageRequest, MessageResponse, SessionEvent, SessionSnapshot
from app.services.orchestrator import Phase0Orchestrator, run_session_task
from app.services.session_store import SessionStore


router = APIRouter()


def _get_store(request: Request) -> SessionStore:
    return request.app.state.session_store


def _get_orchestrator(request: Request) -> Phase0Orchestrator:
    return request.app.state.orchestrator


@router.post("/sessions", response_model=SessionSnapshot, status_code=status.HTTP_201_CREATED)
async def create_session(payload: CreateSessionRequest, request: Request) -> SessionSnapshot:
    settings = request.app.state.settings
    api_root = f"{str(request.base_url).rstrip('/')}{settings.api_prefix}"
    return await _get_store(request).create_session(
        email=payload.email,
        invite_code=payload.invite_code,
        model_url=f"{api_root}/artifacts/{settings.phase0_glb_artifact_id}",
        downloads=[
            {"label": "Download GLB", "url": f"{api_root}/artifacts/{settings.phase0_glb_artifact_id}"},
            {"label": "Download STL", "url": f"{api_root}/artifacts/{settings.phase0_stl_artifact_id}"},
            {"label": "Download STEP", "url": f"{api_root}/artifacts/{settings.phase0_step_artifact_id}"},
        ],
    )


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

    orchestrator = _get_orchestrator(request)
    work_task = asyncio.create_task(
        orchestrator.handle_user_message(session_id=session_id, message_text=payload.message)
    )
    await session_store.replace_active_task(session_id, work_task)
    asyncio.create_task(run_session_task(session_store=session_store, session_id=session_id, task=work_task))
    return MessageResponse(queued=True)


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


@router.get("/artifacts/{artifact_id}")
async def get_artifact(artifact_id: str, request: Request) -> FileResponse:
    artifact_path = request.app.state.artifact_registry.get(artifact_id)
    if artifact_path is None or not artifact_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found.")
    return FileResponse(artifact_path)


def _encode_sse(event: SessionEvent) -> str:
    return (
        f"id: {event.id}\n"
        f"event: {event.event}\n"
        f"data: {json.dumps(event.model_dump(mode='json'))}\n\n"
    )

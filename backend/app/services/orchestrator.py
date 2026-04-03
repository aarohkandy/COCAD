from __future__ import annotations

import asyncio
import contextlib
from uuid import uuid4

from app.llm.providers.base import StreamingChatProvider
from app.services.prompt_loader import PromptLoader
from app.services.safety import SafetyService
from app.services.session_store import SessionStore


class Phase0Orchestrator:
    def __init__(
        self,
        *,
        session_store: SessionStore,
        prompt_loader: PromptLoader,
        safety_service: SafetyService,
        llm_provider: StreamingChatProvider,
        model_name: str,
    ) -> None:
        self._session_store = session_store
        self._prompt_loader = prompt_loader
        self._safety_service = safety_service
        self._llm_provider = llm_provider
        self._model_name = model_name

    async def handle_user_message(self, *, session_id: str, message_text: str) -> None:
        violation = self._safety_service.check(message_text)
        if violation:
            await self._session_store.append_event(
                session_id,
                "safety_refusal",
                {
                    "messageId": f"msg-{uuid4().hex}",
                    "message": violation,
                },
            )
            await self._session_store.append_event(
                session_id,
                "progress_summary",
                {"summary": "Request blocked by the placeholder safety policy."},
            )
            return

        await self._session_store.append_event(
            session_id,
            "progress_summary",
            {"summary": "Phase 0 round-trip started."},
        )

        history = await self._session_store.get_messages(session_id)
        system_prompt = self._prompt_loader.build_main_prompt()
        assistant_chunks: list[str] = []
        assistant_message_id = f"msg-{uuid4().hex}"

        try:
            async for chunk in self._llm_provider.stream_chat(
                model=self._model_name,
                system_prompt=system_prompt,
                messages=history,
            ):
                assistant_chunks.append(chunk)
                await self._session_store.append_event(
                    session_id,
                    "chat_token",
                    {
                        "messageId": assistant_message_id,
                        "role": "assistant",
                        "delta": chunk,
                        "complete": False,
                    },
                )
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            fallback = (
                "The Phase 0 assistant could not reach the configured model endpoint. "
                f"Details: {exc}"
            )
            await self._session_store.add_assistant_message(
                session_id,
                fallback,
                message_id=assistant_message_id,
            )
            await self._session_store.append_event(
                session_id,
                "chat_token",
                {
                    "messageId": assistant_message_id,
                    "role": "assistant",
                    "delta": fallback,
                    "complete": True,
                },
            )
            await self._session_store.append_event(
                session_id,
                "progress_summary",
                {"summary": "Phase 0 could not reach the configured model endpoint."},
            )
            return

        final_response = "".join(assistant_chunks).strip()
        if not final_response:
            final_response = "The configured main model returned an empty response."

        await self._session_store.add_assistant_message(
            session_id,
            final_response,
            message_id=assistant_message_id,
        )
        await self._session_store.append_event(
            session_id,
            "chat_token",
            {
                "messageId": assistant_message_id,
                "role": "assistant",
                "delta": "",
                "complete": True,
            },
        )
        await self._session_store.append_event(
            session_id,
            "progress_summary",
            {
                "summary": (
                    "Phase 0 response completed. Assumption confirmation, step plans, and live "
                    "CadQuery execution land in the next phase."
                ),
            },
        )


async def run_session_task(*, session_store: SessionStore, session_id: str, task: asyncio.Task[None]) -> None:
    try:
        await task
    finally:
        with contextlib.suppress(Exception):
            await session_store.clear_active_task(session_id, task)

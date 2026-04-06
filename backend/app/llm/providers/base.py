from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Protocol

from app.domain.models import ConversationMessage


@dataclass(frozen=True)
class ImageInput:
    label: str
    mime_type: str
    data_base64: str


class StreamingChatProvider(Protocol):
    async def list_models(self) -> list[str]:
        """Return the list of model identifiers currently available."""

    async def stream_chat(
        self,
        *,
        model: str,
        system_prompt: str,
        messages: Sequence[ConversationMessage],
    ) -> AsyncIterator[str]:
        """Yield text chunks from a streamed chat completion."""

    async def complete(
        self,
        *,
        model: str,
        system_prompt: str,
        user_prompt: str,
        images: Sequence[ImageInput] | None = None,
    ) -> str:
        """Return a single assistant completion."""

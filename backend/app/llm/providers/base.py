from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from typing import Protocol

from app.domain.models import ConversationMessage


class StreamingChatProvider(Protocol):
    async def stream_chat(
        self,
        *,
        model: str,
        system_prompt: str,
        messages: Sequence[ConversationMessage],
    ) -> AsyncIterator[str]:
        """Yield text chunks from a streamed chat completion."""

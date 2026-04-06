from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
import json

import httpx

from app.domain.models import ConversationMessage
from app.llm.providers.base import ImageInput


class OpenAICompatibleProvider:
    def __init__(self, *, base_url: str, api_key: str, timeout_seconds: float = 45.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def list_models(self) -> list[str]:
        timeout = httpx.Timeout(connect=10.0, read=self._timeout, write=30.0, pool=30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(
                f"{self._base_url}/models",
                headers=self._headers,
            )
            response.raise_for_status()
        data = response.json()
        models = data.get("data")
        if not isinstance(models, list):
            return []
        resolved: list[str] = []
        for item in models:
            if not isinstance(item, dict):
                continue
            identifier = item.get("id")
            if isinstance(identifier, str):
                resolved.append(identifier)
        return resolved

    async def stream_chat(
        self,
        *,
        model: str,
        system_prompt: str,
        messages: Sequence[ConversationMessage],
    ) -> AsyncIterator[str]:
        payload = {
            "model": model,
            "stream": True,
            "messages": [
                {"role": "system", "content": system_prompt},
                *[
                    {"role": message.role, "content": message.content}
                    for message in messages
                ],
            ],
        }
        timeout = httpx.Timeout(connect=10.0, read=self._timeout, write=30.0, pool=30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/chat/completions",
                headers=self._headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    raw_data = line[5:].strip()
                    if raw_data == "[DONE]":
                        break
                    try:
                        data = json.loads(raw_data)
                    except json.JSONDecodeError:
                        continue
                    chunk = self._extract_content(data)
                    if chunk:
                        yield chunk

    async def complete(
        self,
        *,
        model: str,
        system_prompt: str,
        user_prompt: str,
        images: Sequence[ImageInput] | None = None,
    ) -> str:
        payload = {
            "model": model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": self._build_user_content(user_prompt=user_prompt, images=images),
                },
            ],
        }
        timeout = httpx.Timeout(connect=10.0, read=self._timeout, write=30.0, pool=30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers,
                json=payload,
            )
            response.raise_for_status()
        data = response.json()
        return self._extract_message_content(data)

    @staticmethod
    def _build_user_content(*, user_prompt: str, images: Sequence[ImageInput] | None) -> str | list[dict[str, object]]:
        if not images:
            return user_prompt
        content: list[dict[str, object]] = [{"type": "text", "text": user_prompt}]
        for image in images:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{image.mime_type};base64,{image.data_base64}",
                    },
                }
            )
        return content

    @staticmethod
    def _extract_message_content(data: dict[str, object]) -> str:
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            return ""
        choice = choices[0]
        if not isinstance(choice, dict):
            return ""
        message = choice.get("message")
        if not isinstance(message, dict):
            return ""
        content = message.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str):
                        parts.append(text)
            return "".join(parts)
        return ""

    @staticmethod
    def _extract_content(data: dict[str, object]) -> str:
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            return ""
        choice = choices[0]
        if not isinstance(choice, dict):
            return ""
        delta = choice.get("delta")
        if not isinstance(delta, dict):
            return ""
        content = delta.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str):
                        parts.append(text)
            return "".join(parts)
        return ""

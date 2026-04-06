from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
import json
import re

from app.domain.models import ConversationMessage
from app.llm.providers.base import ImageInput
from app.services.design_engine import DesignEngine


class StaticTestProvider:
    def __init__(self) -> None:
        self._design_engine = DesignEngine()

    async def list_models(self) -> list[str]:
        return ["qwen2.5vl:7b"]

    async def stream_chat(
        self,
        *,
        model: str,
        system_prompt: str,
        messages: Sequence[ConversationMessage],
    ) -> AsyncIterator[str]:
        del model, system_prompt, messages
        if False:
            yield ""

    async def complete(
        self,
        *,
        model: str,
        system_prompt: str,
        user_prompt: str,
        images: Sequence[ImageInput] | None = None,
    ) -> str:
        del model
        system = system_prompt.lower()
        if "independent checker ai" in system:
            return json.dumps(
                {
                    "passed": True,
                    "summary": "Static checker accepted the revision.",
                    "notes": [f"Attached views: {len(images or [])}."],
                    "interference_relevant": False,
                    "interference_detected": False,
                }
            )
        if "produce a named step list" in system:
            scaffold = self._extract_json_array(user_prompt, "Scaffold:\n")
            return json.dumps({"steps": scaffold})
        if "main design interviewer" in system:
            messages = self._extract_transcript(user_prompt)
            interview_rounds = self._extract_integer(user_prompt, "Interview rounds already used: ")
            spec = self._design_engine.build_spec(messages)
            assumptions = self._design_engine.build_assumptions(spec)
            needs = self._design_engine.needs_clarification(spec, interview_rounds)
            question = self._design_engine.interview_question(spec) if needs else None
            return json.dumps(
                {
                    "needs_clarification": needs,
                    "clarification_question": question,
                    "intent_summary": assumptions.intent_summary,
                    "design_kind": spec.kind,
                    "surface_units": spec.surface_units,
                    "dimensions_mm": spec.dimensions_mm,
                    "options": spec.options,
                    "assumptions": assumptions.assumptions,
                }
            )
        return "{}"

    @staticmethod
    def _extract_integer(text: str, prefix: str) -> int:
        match = re.search(re.escape(prefix) + r"(\d+)", text)
        if match is None:
            return 0
        return int(match.group(1))

    @staticmethod
    def _extract_transcript(text: str) -> list[str]:
        marker = "User transcript:\n"
        if marker not in text:
            return []
        transcript = text.split(marker, maxsplit=1)[1]
        messages: list[str] = []
        for line in transcript.splitlines():
            stripped = line.strip()
            if stripped.startswith("- "):
                messages.append(stripped[2:])
        return messages

    @staticmethod
    def _extract_json_array(text: str, marker: str) -> list[dict[str, object]]:
        if marker not in text:
            return []
        candidate = text.split(marker, maxsplit=1)[1].strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            return []

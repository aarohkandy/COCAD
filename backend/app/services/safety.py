from __future__ import annotations

from collections.abc import Iterable
import re


DEFAULT_BLOCKED_TERMS = (
    "weapon",
    "glock",
    "firearm",
    "gun",
    "knife",
    "suppressor",
    "grenade",
    "explosive",
    "bomb",
    "medical device",
    "implant",
    "regulated",
)


class SafetyService:
    def __init__(self, *, blocked_terms: Iterable[str] | None = None) -> None:
        terms = tuple(term.strip() for term in (blocked_terms or DEFAULT_BLOCKED_TERMS) if term.strip())
        escaped_patterns = [rf"\b{re.escape(term)}\b" for term in terms]
        pattern = "|".join(escaped_patterns) if escaped_patterns else r"$^"
        self._pattern = re.compile(pattern, re.IGNORECASE)

    def check(self, message: str) -> str | None:
        match = self._pattern.search(message)
        if not match:
            return None
        return f"Blocked by the safety policy on term '{match.group(0)}'."

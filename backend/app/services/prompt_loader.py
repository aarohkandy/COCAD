from __future__ import annotations

from functools import lru_cache
from pathlib import Path


class PromptLoader:
    def __init__(self, prompt_dir: Path) -> None:
        self._prompt_dir = prompt_dir

    @lru_cache(maxsize=32)
    def load(self, name: str) -> str:
        return (self._prompt_dir / name).read_text(encoding="utf-8").strip()

    def build_main_prompt(self) -> str:
        parts = [
            self.load("shared_safety.md"),
            self.load("phase0.md"),
            self.load("main_interviewer.md"),
        ]
        return "\n\n".join(part for part in parts if part)

    def build_role_prompt(self, prompt_name: str) -> str:
        parts = [
            self.load("shared_safety.md"),
            self.load(prompt_name),
        ]
        return "\n\n".join(part for part in parts if part)

from __future__ import annotations

from pathlib import Path


class ArtifactRegistry:
    def __init__(self, artifact_root: Path) -> None:
        self._artifact_root = artifact_root
        self._artifacts: dict[str, Path] = {}

    def register(self, artifact_id: str, relative_path: str) -> None:
        self._artifacts[artifact_id] = self._artifact_root / relative_path

    def get(self, artifact_id: str) -> Path | None:
        return self._artifacts.get(artifact_id)

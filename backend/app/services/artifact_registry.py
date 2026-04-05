from __future__ import annotations

from pathlib import Path


class ArtifactRegistry:
    def __init__(self, artifact_root: Path) -> None:
        self._artifact_root = artifact_root
        self._artifact_root.mkdir(parents=True, exist_ok=True)
        self._artifacts: dict[str, Path] = {}

    def register(self, artifact_id: str, relative_path: str) -> Path:
        path = self._artifact_root / relative_path
        self._artifacts[artifact_id] = path
        return path

    def register_path(self, artifact_id: str, path: Path) -> None:
        self._artifacts[artifact_id] = path

    def get(self, artifact_id: str) -> Path | None:
        return self._artifacts.get(artifact_id)

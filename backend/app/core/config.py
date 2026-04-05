from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import os


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_env: str
    api_prefix: str
    public_api_base_url: str
    frontend_origins: tuple[str, ...]
    llm_base_url: str
    llm_api_key: str
    llm_main_model: str
    llm_checker_model: str
    valid_invite_codes: tuple[str, ...]
    safety_blocklist: tuple[str, ...]
    prompt_dir: Path
    artifact_dir: Path
    database_path: Path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    project_root = Path(__file__).resolve().parents[2]
    safety_terms = tuple(
        term.strip()
        for term in os.getenv(
            "SAFETY_BLOCKLIST",
            "weapon,firearm,gun,knife,explosive,bomb,suppressor,grenade,medical device,implant,regulated",
        ).split(",")
        if term.strip()
    )
    invite_codes = tuple(
        code.strip().upper()
        for code in os.getenv("VALID_INVITE_CODES", "PHASE0,PHASE1,COCAD").split(",")
        if code.strip()
    )
    frontend_origins = _resolve_frontend_origins()
    return Settings(
        app_name="COCAD Backend",
        app_env=os.getenv("APP_ENV", "development"),
        api_prefix="/api",
        public_api_base_url=os.getenv("PUBLIC_API_BASE_URL", "http://localhost:8000/api"),
        frontend_origins=frontend_origins,
        llm_base_url=os.getenv("LLM_BASE_URL", "http://localhost:11434/v1"),
        llm_api_key=os.getenv("LLM_API_KEY", "ollama"),
        llm_main_model=os.getenv("LLM_MAIN_MODEL", "qwen2.5vl:32b"),
        llm_checker_model=os.getenv("LLM_CHECKER_MODEL", "qwen2.5vl:7b"),
        valid_invite_codes=invite_codes,
        safety_blocklist=safety_terms,
        prompt_dir=project_root / "prompts",
        artifact_dir=project_root / "artifacts",
        database_path=project_root / "data" / "cocad.sqlite3",
    )


def _resolve_frontend_origins() -> tuple[str, ...]:
    configured = os.getenv("FRONTEND_ORIGINS", "")
    raw_origins = [origin.strip() for origin in configured.split(",") if origin.strip()]

    legacy_origin = os.getenv("FRONTEND_ORIGIN", "").strip()
    if legacy_origin:
        raw_origins.append(legacy_origin)

    if not raw_origins:
        raw_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

    normalized: list[str] = []
    for origin in raw_origins:
        for candidate in _with_loopback_variants(origin):
            if candidate not in normalized:
                normalized.append(candidate)
    return tuple(normalized)


def _with_loopback_variants(origin: str) -> tuple[str, ...]:
    if "://localhost:" in origin:
        return (origin, origin.replace("://localhost:", "://127.0.0.1:", 1))
    if "://127.0.0.1:" in origin:
        return (origin, origin.replace("://127.0.0.1:", "://localhost:", 1))
    return (origin,)

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import Settings, get_settings
from app.llm.providers.openai_compatible import OpenAICompatibleProvider
from app.services.artifact_registry import ArtifactRegistry
from app.services.orchestrator import Phase0Orchestrator
from app.services.prompt_loader import PromptLoader
from app.services.safety import SafetyService
from app.services.session_store import SessionStore


def create_app(
    *,
    settings: Settings | None = None,
    provider: OpenAICompatibleProvider | None = None,
) -> FastAPI:
    resolved_settings = settings or get_settings()
    artifact_registry = ArtifactRegistry(resolved_settings.artifact_dir)
    artifact_registry.register(
        resolved_settings.phase0_glb_artifact_id,
        "phase0/cocad-phase0.glb",
    )
    artifact_registry.register(
        resolved_settings.phase0_stl_artifact_id,
        "phase0/cocad-phase0.stl",
    )
    artifact_registry.register(
        resolved_settings.phase0_step_artifact_id,
        "phase0/cocad-phase0.step",
    )

    app = FastAPI(title=resolved_settings.app_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[resolved_settings.frontend_origin],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    session_store = SessionStore()
    prompt_loader = PromptLoader(resolved_settings.prompt_dir)
    safety_service = SafetyService(blocked_terms=resolved_settings.safety_blocklist)
    llm_provider = provider or OpenAICompatibleProvider(
        base_url=resolved_settings.llm_base_url,
        api_key=resolved_settings.llm_api_key,
    )
    orchestrator = Phase0Orchestrator(
        session_store=session_store,
        prompt_loader=prompt_loader,
        safety_service=safety_service,
        llm_provider=llm_provider,
        model_name=resolved_settings.llm_main_model,
    )

    app.state.settings = resolved_settings
    app.state.session_store = session_store
    app.state.orchestrator = orchestrator
    app.state.artifact_registry = artifact_registry
    app.include_router(router, prefix=resolved_settings.api_prefix)

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok", "environment": resolved_settings.app_env}

    return app


app = create_app()

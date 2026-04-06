from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import Settings, get_settings
from app.llm.providers.openai_compatible import OpenAICompatibleProvider
from app.llm.providers.static_test import StaticTestProvider
from app.services.cad_service import CadService
from app.services.design_brain import DesignBrain
from app.services.design_engine import DesignEngine
from app.services.orchestrator import WorkflowOrchestrator
from app.services.prompt_loader import PromptLoader
from app.services.safety import SafetyService
from app.services.session_store import SessionStore


def create_app(*, settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()

    app = FastAPI(title=resolved_settings.app_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.frontend_origins),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    session_store = SessionStore(resolved_settings.database_path)
    design_engine = DesignEngine()
    if resolved_settings.app_env == "test":
        llm_provider = StaticTestProvider()
    else:
        llm_provider = OpenAICompatibleProvider(
            base_url=resolved_settings.llm_base_url,
            api_key=resolved_settings.llm_api_key,
            timeout_seconds=300.0,
        )
    design_brain = DesignBrain(
        provider=llm_provider,
        prompt_loader=PromptLoader(resolved_settings.prompt_dir),
        design_engine=design_engine,
        preferred_main_model=resolved_settings.llm_main_model,
        preferred_checker_model=resolved_settings.llm_checker_model,
    )
    orchestrator = WorkflowOrchestrator(
        session_store=session_store,
        design_engine=design_engine,
        design_brain=design_brain,
        cad_service=CadService(resolved_settings.artifact_dir),
        safety_service=SafetyService(blocked_terms=resolved_settings.safety_blocklist),
    )

    app.state.settings = resolved_settings
    app.state.session_store = session_store
    app.state.orchestrator = orchestrator
    app.include_router(router, prefix=resolved_settings.api_prefix)

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok", "environment": resolved_settings.app_env}

    return app


app = create_app()

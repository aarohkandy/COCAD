from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import Settings, get_settings
from app.services.cad_service import CadService
from app.services.design_engine import DesignEngine
from app.services.orchestrator import WorkflowOrchestrator
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
    orchestrator = WorkflowOrchestrator(
        session_store=session_store,
        design_engine=DesignEngine(),
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

# COCAD Backend

FastAPI backend for the COCAD browser app.

## Current slice

- Invite claims stored in SQLite.
- Session/workflow state stored in SQLite with reload-safe hydration.
- Typed SSE event stream for chat, assumptions, step plans, accepted revisions, and downloads.
- Deterministic design engine that interviews once when required, publishes assumptions, requires confirmation, and then generates a real step plan.
- CadQuery-backed artifact generation for `GLB`, `STL`, `STEP`, plus rendered review images.

## Key files

- `app/api/routes.py`: HTTP and SSE endpoints.
- `app/services/session_store.py`: SQLite persistence and live listener management.
- `app/services/orchestrator.py`: interview/confirmation/build state machine.
- `app/services/design_engine.py`: deterministic spec + plan + step-code generation.
- `app/services/cad_service.py`: CadQuery execution, export, and rendered review views.

# COCAD

Working vertical slice of the COCAD web rebuild.

## What works now

- Automatic guest session bootstrap on load.
- Session persistence in SQLite.
- SSE-backed chat timeline with reload hydration.
- Interview -> assumptions -> explicit confirmation -> step plan -> accepted build revisions.
- Real CadQuery-backed `GLB`, `STL`, and `STEP` exports per accepted step.
- Four rendered review views per accepted step: top, front, side, and isometric.
- Accepted-only viewer updates and downloadable artifacts.
- Safety refusal for weapons and regulated-object requests.

## Services

- `frontend/`: React + Vite + TypeScript app with the chat, step plan, render gallery, and Three.js viewer.
- `backend/`: FastAPI app with SQLite persistence, SSE streaming, deterministic orchestration, and CadQuery artifact generation.

## Local development

### Backend

```powershell
python -m pip install -e .\backend[dev]
python -m uvicorn app.main:app --app-dir .\backend --reload --host 127.0.0.1 --port 8000
```

### Frontend

```powershell
cd .\frontend
npm install
npm run dev
```

### Docker

`docker-compose.yml` preserves the intended two-service local topology. Docker was not executed in this environment during implementation, so the compose setup should still be treated as unverified here.

## Main backend flow

1. `POST /api/invite/claim`
2. `POST /api/sessions`
3. `GET /api/sessions/{id}/events`
4. `POST /api/sessions/{id}/messages`
5. `POST /api/sessions/{id}/assumptions/confirm`

Artifacts are served from `GET /api/artifacts/{artifact_path}`.

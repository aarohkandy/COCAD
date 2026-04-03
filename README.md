# COCAD

Phase 0 skeleton for the COCAD web rebuild.

## Services

- `frontend/`: React + Vite + TypeScript app with a split chat/viewer layout.
- `backend/`: FastAPI app with session bootstrap, SSE event streaming, prompt loading, and an OpenAI-compatible LLM provider wired for Ollama by default.

## Local development

### Backend

```powershell
python -m pip install -e .\backend
python -m uvicorn app.main:app --app-dir .\backend --reload --host 127.0.0.1 --port 8000
```

### Frontend

```powershell
cd .\frontend
npm install
npm run dev
```

### Docker

`docker-compose.yml` defines the intended local runtime shape, but Docker was not available in this environment during implementation so it was not executed here.

## Phase 0 behavior

- Placeholder invite gate captures email + code but does not enforce real invite logic yet.
- Sessions survive reload through local storage + `GET /api/sessions/{id}` hydration.
- `POST /api/sessions/{id}/messages` streams assistant text through the SSE channel.
- Viewer loads a static sample `GLB` served by the backend.
- Safety refusal is a keyword placeholder and not the final policy engine.


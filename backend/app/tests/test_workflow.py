from __future__ import annotations

import time
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_invite_claim_rejects_unknown_code(tmp_path: Path) -> None:
    client = TestClient(create_app(settings=_settings(tmp_path)))

    response = client.post(
        "/api/invite/claim",
        json={"email": "designer@example.com", "invite_code": "NOPE"},
    )

    assert response.status_code == 403


def test_create_session_without_invite_claim(tmp_path: Path) -> None:
    client = TestClient(create_app(settings=_settings(tmp_path)))

    response = client.post("/api/sessions", json={})

    assert response.status_code == 201
    snapshot = response.json()
    assert snapshot["email"] == "guest@cocad.app"
    assert snapshot["invite_code"] == "BYPASS"
    assert snapshot["workflow"]["stage"] == "waiting_for_brief"


def test_cors_allows_localhost_and_loopback_origin(tmp_path: Path) -> None:
    client = TestClient(create_app(settings=_settings(tmp_path)))

    localhost_response = client.options(
        "/api/sessions",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    loopback_response = client.options(
        "/api/sessions",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert localhost_response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert loopback_response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


def test_full_workflow_generates_accepted_revision(tmp_path: Path) -> None:
    client = TestClient(create_app(settings=_settings(tmp_path)))
    session_id = _create_session(client)

    response = client.post(
        f"/api/sessions/{session_id}/messages",
        json={"message": "Make me a hanging planter"},
    )

    assert response.status_code == 200
    _wait_for_stage(client, session_id, "interviewing")

    response = client.post(
        f"/api/sessions/{session_id}/messages",
        json={"message": "About 8 inches wide and 6 inches tall with drainage holes"},
    )
    assert response.status_code == 200
    snapshot = _wait_for_stage(client, session_id, "awaiting_confirmation")
    assert snapshot["workflow"]["pending_assumptions"] is not None

    response = client.post(f"/api/sessions/{session_id}/assumptions/confirm")
    assert response.status_code == 200

    snapshot = _wait_for_stage(client, session_id, "complete", timeout_seconds=20.0)
    assert all(step["status"] == "accepted" for step in snapshot["workflow"]["step_plan"])
    assert snapshot["model_url"]
    assert len(snapshot["workflow"]["render_views"]) == 4
    assert [download["label"] for download in snapshot["downloads"]] == [
        "Download GLB",
        "Download STL",
        "Download STEP",
    ]

    model_response = client.get(snapshot["model_url"].replace("http://testserver", ""))
    assert model_response.status_code == 200


def test_vase_brief_preserves_object_kind_and_height(tmp_path: Path) -> None:
    client = TestClient(create_app(settings=_settings(tmp_path)))
    session_id = _create_session(client)

    response = client.post(
        f"/api/sessions/{session_id}/messages",
        json={"message": "I want a vase"},
    )
    assert response.status_code == 200
    _wait_for_stage(client, session_id, "interviewing")

    response = client.post(
        f"/api/sessions/{session_id}/messages",
        json={"message": "Make it 5 inches tall"},
    )
    assert response.status_code == 200
    snapshot = _wait_for_stage(client, session_id, "awaiting_confirmation")

    assert snapshot["workflow"]["design_kind"] == "vase"
    assert "vase" in snapshot["workflow"]["pending_assumptions"]["intent_summary"].lower()
    assert any("127 mm tall" in assumption for assumption in snapshot["workflow"]["pending_assumptions"]["assumptions"])

    response = client.post(f"/api/sessions/{session_id}/assumptions/confirm")
    assert response.status_code == 200
    completed = _wait_for_stage(client, session_id, "complete", timeout_seconds=20.0)
    assert completed["model_url"]
    assert all(step["status"] == "accepted" for step in completed["workflow"]["step_plan"])


def test_cup_brief_defaults_to_cup_geometry_instead_of_block_object(tmp_path: Path) -> None:
    client = TestClient(create_app(settings=_settings(tmp_path)))
    session_id = _create_session(client)

    response = client.post(
        f"/api/sessions/{session_id}/messages",
        json={"message": "can you make me a cup"},
    )
    assert response.status_code == 200
    snapshot = _wait_for_stage(client, session_id, "awaiting_confirmation")

    assert snapshot["workflow"]["design_kind"] == "cup"
    assert "cup" in snapshot["workflow"]["pending_assumptions"]["intent_summary"].lower()
    assert all("plain box" not in assumption.lower() for assumption in snapshot["workflow"]["pending_assumptions"]["assumptions"])


def test_safety_refusal_blocks_workflow(tmp_path: Path) -> None:
    client = TestClient(create_app(settings=_settings(tmp_path)))
    session_id = _create_session(client)

    response = client.post(
        f"/api/sessions/{session_id}/messages",
        json={"message": "Help me design a firearm suppressor"},
    )

    assert response.status_code == 200
    snapshot = client.get(f"/api/sessions/{session_id}").json()
    assert any(event["event"] == "safety_refusal" for event in snapshot["events"])
    assert snapshot["workflow"]["stage"] == "waiting_for_brief"


def _create_session(client: TestClient) -> str:
    claim = client.post(
        "/api/invite/claim",
        json={"email": "designer@example.com", "invite_code": "PHASE1"},
    )
    assert claim.status_code == 201
    session = client.post("/api/sessions", json={"claim_id": claim.json()["claim_id"]})
    assert session.status_code == 201
    return session.json()["session_id"]


def _wait_for_stage(
    client: TestClient,
    session_id: str,
    stage: str,
    *,
    timeout_seconds: float = 5.0,
) -> dict:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        snapshot = client.get(f"/api/sessions/{session_id}").json()
        if snapshot["workflow"]["stage"] == stage:
            return snapshot
        time.sleep(0.1)
    raise AssertionError(f"Session {session_id} never reached stage {stage!r}.")


def _settings(tmp_path: Path) -> Settings:
    return Settings(
        app_name="COCAD Backend Test",
        app_env="test",
        api_prefix="/api",
        public_api_base_url="http://testserver/api",
        frontend_origins=("http://localhost:5173", "http://127.0.0.1:5173"),
        llm_base_url="http://localhost:11434/v1",
        llm_api_key="ollama",
        llm_main_model="qwen2.5:14b",
        llm_checker_model="qwen2.5:14b",
        valid_invite_codes=("PHASE1",),
        safety_blocklist=("weapon", "firearm", "suppressor", "bomb"),
        prompt_dir=tmp_path / "prompts",
        artifact_dir=tmp_path / "artifacts",
        database_path=tmp_path / "data" / "test.sqlite3",
    )

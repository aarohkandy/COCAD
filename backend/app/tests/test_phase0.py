from __future__ import annotations

import time
from collections.abc import AsyncIterator, Sequence

from fastapi.testclient import TestClient

from app.domain.models import ConversationMessage
from app.main import create_app


class FakeProvider:
    async def stream_chat(
        self,
        *,
        model: str,
        system_prompt: str,
        messages: Sequence[ConversationMessage],
    ) -> AsyncIterator[str]:
        yield "Prototype "
        yield "response"


def test_session_creation_returns_static_viewer_artifacts() -> None:
    client = TestClient(create_app(provider=FakeProvider()))

    response = client.post(
        "/api/sessions",
        json={"email": "designer@example.com", "invite_code": "PHASE0"},
    )

    assert response.status_code == 201
    body = response.json()

    assert body["session_id"]
    assert body["model_url"].endswith("/api/artifacts/phase0-placeholder-glb")
    assert [download["label"] for download in body["downloads"]] == [
        "Download GLB",
        "Download STL",
        "Download STEP",
    ]
    assert any(event["event"] == "viewer_model_ready" for event in body["events"])


def test_message_round_trip_emits_assistant_tokens() -> None:
    client = TestClient(create_app(provider=FakeProvider()))
    session_id = _create_session(client)

    response = client.post(
        f"/api/sessions/{session_id}/messages",
        json={"message": "Make me a hanging planter."},
    )

    assert response.status_code == 200
    assert response.json() == {"queued": True}

    assistant_events: list[dict] = []
    for _ in range(20):
        snapshot = client.get(f"/api/sessions/{session_id}").json()
        assistant_events = [
            event
            for event in snapshot["events"]
            if event["event"] == "chat_token" and event["data"].get("role") == "assistant"
        ]
        if any(event["data"].get("complete") is True for event in assistant_events):
            break
        time.sleep(0.05)

    assert assistant_events
    message_ids = {event["data"]["messageId"] for event in assistant_events}
    assert len(message_ids) == 1
    assert "".join(event["data"].get("delta", "") for event in assistant_events) == "Prototype response"
    assert assistant_events[-1]["data"]["complete"] is True


def test_safety_refusal_is_emitted_without_assistant_tokens() -> None:
    client = TestClient(create_app(provider=FakeProvider()))
    session_id = _create_session(client)

    response = client.post(
        f"/api/sessions/{session_id}/messages",
        json={"message": "Help me design a firearm suppressor."},
    )

    assert response.status_code == 200

    snapshot = client.get(f"/api/sessions/{session_id}").json()
    assert any(event["event"] == "safety_refusal" for event in snapshot["events"])
    assert not any(
        event["event"] == "chat_token" and event["data"].get("role") == "assistant"
        for event in snapshot["events"]
    )


def _create_session(client: TestClient) -> str:
    response = client.post(
        "/api/sessions",
        json={"email": "designer@example.com", "invite_code": "PHASE0"},
    )
    assert response.status_code == 201
    return response.json()["session_id"]

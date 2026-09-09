"""Regression tests for server-authoritative chat persistence."""

from __future__ import annotations

import pytest
from types import SimpleNamespace

from app.api.dependencies import get_agent
from app.main import app


def _login_headers(client, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/token", data={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_failed_generation_does_not_persist_half_a_chat_turn(client):
    """A retry after login must not reveal an orphan user message."""
    client.post(
        "/api/auth/register",
        json={"username": "atomicuser", "email": "atomic@example.com", "password": "testpass123"},
    )
    headers = _login_headers(client, "atomicuser", "testpass123")
    conversation = client.post(
        "/api/chat/conversations", json={"title": "Atomic chat"}, headers=headers
    ).json()

    class FailingAgent:
        settings = SimpleNamespace(default_alpha=0.55, default_top_k=20, default_rerank_top_n=6)

        def invoke(self, *_args, **_kwargs):
            raise RuntimeError("model provider unavailable")

    previous_override = app.dependency_overrides[get_agent]
    app.dependency_overrides[get_agent] = lambda: FailingAgent()
    try:
        with pytest.raises(RuntimeError, match="model provider unavailable"):
            client.post(
                f"/api/chat/conversations/{conversation['id']}/message",
                json={"question": "What is hypertension?"},
                headers=headers,
            )
    finally:
        app.dependency_overrides[get_agent] = previous_override

    restored = client.get(f"/api/chat/conversations/{conversation['id']}", headers=headers)
    assert restored.status_code == 200
    assert restored.json()["messages"] == []

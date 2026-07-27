"""Integration test for registration, profile persistence, and chat history.

This test verifies the core user journey the public-facing app must support:
1. A new user registers.
2. The user updates their profile (name, email, date of birth, notes, vitals).
3. The updated profile is returned by /users/me.
4. The user creates a conversation and sends a message.
5. The conversation and message survive a subsequent login.

All data lives server-side, so the same profile + history are available from
any device/session once the user authenticates.
"""

from __future__ import annotations


def _register_user(client, username: str, email: str, password: str):
    return client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": password},
    )


def _login(client, username: str, password: str):
    return client.post(
        "/api/auth/token",
        data={"username": username, "password": password},
    )


def _auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


class TestProfileChatIntegration:
    def test_registration_stores_user_in_database(self, client):
        """New users can register and their account is persisted."""
        response = _register_user(client, "persistuser", "persist@example.com", "testpass123")
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "persistuser"
        assert data["email"] == "persist@example.com"
        assert "id" in data
        assert data["is_active"] is True

    def test_profile_updates_persist_and_are_returned(self, client):
        """Profile updates (name, email, DOB, notes) survive and are returned by /users/me."""
        _register_user(client, "profileuser", "profile@example.com", "testpass123")
        login = _login(client, "profileuser", "testpass123")
        assert login.status_code == 200
        token = login.json()["access_token"]
        headers = _auth_header(token)

        profile_update = {
            "full_name": "Dr. Jane Doe",
            "email": "updated@example.com",
            "date_of_birth": "1985-04-12",
            "notes": "[{\"id\":\"note-1\",\"text\":\"Initial consultation\",\"created_at\":\"2026-07-27T00:00:00Z\"}]",
        }

        update_resp = client.put("/api/auth/users/me", json=profile_update, headers=headers)
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["full_name"] == "Dr. Jane Doe"
        assert updated["email"] == "updated@example.com"
        assert updated["date_of_birth"] == "1985-04-12"
        assert updated["notes"] == profile_update["notes"]

        me_resp = client.get("/api/auth/users/me", headers=headers)
        assert me_resp.status_code == 200
        me = me_resp.json()
        assert me["full_name"] == "Dr. Jane Doe"
        assert me["email"] == "updated@example.com"
        assert me["date_of_birth"] == "1985-04-12"
        assert me["notes"] == profile_update["notes"]

    def test_health_vitals_persist_across_re_login(self, client):
        """Health vitals saved via the BMI calculator persist across sessions."""
        _register_user(client, "vitalsuser", "vitals@example.com", "testpass123")
        login = _login(client, "vitalsuser", "testpass123")
        token = login.json()["access_token"]
        headers = _auth_header(token)

        vitals = {
            "height_cm": 170,
            "weight_kg": 70,
            "bmi": 24.2,
            "category": "Normal Weight",
            "unit_system": "metric",
            "updated_at": "2026-07-27T00:00:00Z",
        }
        update_resp = client.put("/api/auth/users/me", json={"health_vitals": vitals}, headers=headers)
        assert update_resp.status_code == 200
        assert update_resp.json()["health_vitals"] == vitals

        # Simulate re-login from another device/session
        login2 = _login(client, "vitalsuser", "testpass123")
        token2 = login2.json()["access_token"]
        headers2 = _auth_header(token2)
        me_resp = client.get("/api/auth/users/me", headers=headers2)
        assert me_resp.status_code == 200
        assert me_resp.json()["health_vitals"] == vitals

    def test_email_update_rejects_duplicate(self, client):
        """Changing email to another user's email is rejected."""
        _register_user(client, "emailuser1", "email1@example.com", "testpass123")
        _register_user(client, "emailuser2", "email2@example.com", "testpass123")
        login = _login(client, "emailuser1", "testpass123")
        token = login.json()["access_token"]
        headers = _auth_header(token)

        resp = client.put(
            "/api/auth/users/me",
            json={"email": "email2@example.com"},
            headers=headers,
        )
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"].lower()

    def test_chat_history_survives_re_login(self, client):
        """Conversations and messages are available after logout + login."""
        username = "chathistoryuser"
        _register_user(client, username, "chat@example.com", "testpass123")
        login = _login(client, username, "testpass123")
        token = login.json()["access_token"]
        headers = _auth_header(token)

        conv_resp = client.post(
            "/api/chat/conversations",
            json={"title": "My Clinical Chat"},
            headers=headers,
        )
        assert conv_resp.status_code == 201
        conv_id = conv_resp.json()["id"]

        msg_resp = client.post(
            f"/api/chat/conversations/{conv_id}/message",
            json={"question": "What is hypertension?"},
            headers=headers,
        )
        assert msg_resp.status_code == 200
        msg = msg_resp.json()
        assert msg["role"] == "assistant"
        assert msg["conversation_id"] == conv_id
        assert "id" in msg
        assert "content" in msg

        # Simulate re-login with a new token (cross-device / new session)
        login2 = _login(client, username, "testpass123")
        token2 = login2.json()["access_token"]
        headers2 = _auth_header(token2)

        # Profile must still be accessible with the new token
        me_resp = client.get("/api/auth/users/me", headers=headers2)
        assert me_resp.status_code == 200
        assert me_resp.json()["username"] == username

        # Conversation list and messages must survive the new session
        list_resp = client.get("/api/chat/conversations", headers=headers2)
        assert list_resp.status_code == 200
        conversations = list_resp.json()
        assert len(conversations) == 1
        assert conversations[0]["title"] == "My Clinical Chat"

        get_resp = client.get(f"/api/chat/conversations/{conv_id}", headers=headers2)
        assert get_resp.status_code == 200
        conv = get_resp.json()
        assert conv["id"] == conv_id
        assert len(conv["messages"]) >= 2  # user + assistant

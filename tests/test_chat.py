import pytest
from app.chat.repository import chat_repository
from app.db import SessionLocal


@pytest.fixture
def auth_token(client):
    """Create a test user and return auth token."""
    client.post(
        "/api/auth/register",
        json={
            "username": "chatuser",
            "email": "chat@example.com",
            "password": "testpass123",
        },
    )
    login_response = client.post(
        "/api/auth/token",
        data={"username": "chatuser", "password": "testpass123"},
    )
    return login_response.json()["access_token"]


@pytest.fixture
def headers(auth_token):
    """Return headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}"}


class TestChatConversations:
    def test_create_conversation(self, headers, client):
        response = client.post(
            "/api/chat/conversations",
            json={"title": "Test Conversation"},
            headers=headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test Conversation"
        assert "id" in data
        assert "created_at" in data

    def test_create_conversation_without_title(self, headers, client):
        response = client.post(
            "/api/chat/conversations",
            json={},
            headers=headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert "title" in data
        assert "New Chat" in data["title"]

    def test_list_conversations(self, headers, client):
        client.post(
            "/api/chat/conversations",
            json={"title": "First Chat"},
            headers=headers,
        )
        response = client.get("/api/chat/conversations", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert any(conv["title"] == "First Chat" for conv in data)

    def test_get_conversation(self, headers, client):
        create_response = client.post(
            "/api/chat/conversations",
            json={"title": "Get Test"},
            headers=headers,
        )
        conv_id = create_response.json()["id"]
        response = client.get(f"/api/chat/conversations/{conv_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == conv_id
        assert data["title"] == "Get Test"

    def test_get_nonexistent_conversation(self, headers, client):
        response = client.get("/api/chat/conversations/nonexistent", headers=headers)
        assert response.status_code == 404

    def test_update_conversation_title(self, headers, client):
        create_response = client.post(
            "/api/chat/conversations",
            json={"title": "Original Title"},
            headers=headers,
        )
        conv_id = create_response.json()["id"]
        response = client.put(
            f"/api/chat/conversations/{conv_id}",
            json={"title": "Updated Title"},
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"

    def test_delete_conversation(self, headers, client):
        create_response = client.post(
            "/api/chat/conversations",
            json={"title": "Delete Test"},
            headers=headers,
        )
        conv_id = create_response.json()["id"]
        response = client.delete(f"/api/chat/conversations/{conv_id}", headers=headers)
        assert response.status_code == 204
        get_response = client.get(f"/api/chat/conversations/{conv_id}", headers=headers)
        assert get_response.status_code == 404

    def test_delete_nonexistent_conversation(self, headers, client):
        response = client.delete("/api/chat/conversations/nonexistent", headers=headers)
        assert response.status_code == 404


class TestChatMessages:
    def test_add_message_to_conversation(self, headers, client):
        create_response = client.post(
            "/api/chat/conversations",
            json={"title": "Message Test"},
            headers=headers,
        )
        conv_id = create_response.json()["id"]
        response = client.post(
            f"/api/chat/conversations/{conv_id}/message",
            json={"question": "What is hypertension?"},
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "assistant"
        assert "answer" in data["content"] or len(data["content"]) > 0

    def test_add_message_to_nonexistent_conversation(self, headers, client):
        response = client.post(
            "/api/chat/conversations/nonexistent/message",
            json={"question": "Test question"},
            headers=headers,
        )
        assert response.status_code == 404

    def test_add_message_with_case_id(self, headers, client):
        create_response = client.post(
            "/api/chat/conversations",
            json={"title": "Case Test"},
            headers=headers,
        )
        conv_id = create_response.json()["id"]
        response = client.post(
            f"/api/chat/conversations/{conv_id}/message",
            json={
                "question": "What are the care gaps for this patient?",
                "case_id": "htn-001",
            },
            headers=headers,
        )
        assert response.status_code == 200

    def test_add_message_with_mode(self, headers, client):
        create_response = client.post(
            "/api/chat/conversations",
            json={"title": "Mode Test"},
            headers=headers,
        )
        conv_id = create_response.json()["id"]
        response = client.post(
            f"/api/chat/conversations/{conv_id}/message",
            json={
                "question": "What is the BP target for CKD patients?",
                "mode": "clinician",
            },
            headers=headers,
        )
        assert response.status_code == 200


class TestChatAuthentication:
    def test_chat_endpoints_require_authentication(self, client):
        response = client.post(
            "/api/chat/conversations",
            json={"title": "No Auth Test"},
        )
        assert response.status_code == 401
        response = client.get("/api/chat/conversations")
        assert response.status_code == 401

    def test_chat_endpoints_require_valid_token(self, client):
        response = client.post(
            "/api/chat/conversations",
            json={"title": "Invalid Token Test"},
            headers={"Authorization": "Bearer invalid_token"},
        )
        assert response.status_code == 401


class TestChatRepository:
    def test_repository_create_conversation(self):
        with SessionLocal() as db:
            conv = chat_repository.create_conversation(db, "user123", "Test Conv")
        assert conv.id is not None
        assert conv.title == "Test Conv"
        assert conv.user_id == "user123"

    def test_repository_list_conversations(self):
        user_id = "user456"
        with SessionLocal() as db:
            chat_repository.create_conversation(db, user_id, "Conv 1")
            chat_repository.create_conversation(db, user_id, "Conv 2")
            convs = chat_repository.list_conversations(db, user_id)
        assert len(convs) >= 2

    def test_repository_get_conversation(self):
        with SessionLocal() as db:
            conv = chat_repository.create_conversation(db, "user789", "Get Test")
            retrieved = chat_repository.get_conversation(db, conv.id, "user789")
        assert retrieved is not None
        assert retrieved.id == conv.id

    def test_repository_get_conversation_wrong_user(self):
        with SessionLocal() as db:
            conv = chat_repository.create_conversation(db, "user_a", "Private Conv")
            retrieved = chat_repository.get_conversation(db, conv.id, "user_b")
        assert retrieved is None

    def test_repository_delete_conversation(self):
        with SessionLocal() as db:
            conv = chat_repository.create_conversation(db, "user_del", "To Delete")
            result = chat_repository.delete_conversation(db, conv.id, "user_del")
            retrieved = chat_repository.get_conversation(db, conv.id, "user_del")
        assert result is True
        assert retrieved is None

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth.security import get_password_hash, verify_password, create_access_token
from app.auth.models import UserRole

client = TestClient(app)


class TestPasswordHashing:
    def test_password_hashing(self):
        """Test that passwords are hashed and verified correctly."""
        password = "test_password_123"
        hashed = get_password_hash(password)
        assert hashed != password
        assert verify_password(password, hashed)

    def test_password_verification_fails_with_wrong_password(self):
        """Test that verification fails with wrong password."""
        password = "test_password_123"
        hashed = get_password_hash(password)
        assert not verify_password("wrong_password", hashed)


class TestTokenGeneration:
    def test_create_access_token(self):
        """Test that access tokens are created correctly."""
        data = {"sub": "testuser"}
        token = create_access_token(data)
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0


class TestAuthenticationEndpoints:
    def test_register_user(self):
        """Test user registration."""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "testpass123",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"
        assert "hashed_password" in data

    def test_register_duplicate_user(self):
        """Test that registering duplicate username fails."""
        # First registration
        client.post(
            "/api/auth/register",
            json={
                "username": "duplicateuser",
                "email": "dup@example.com",
                "password": "testpass123",
            },
        )
        # Second registration with same username
        response = client.post(
            "/api/auth/register",
            json={
                "username": "duplicateuser",
                "email": "dup2@example.com",
                "password": "testpass123",
            },
        )
        assert response.status_code == 400

    def test_login_user(self):
        """Test user login."""
        # Register first
        client.post(
            "/api/auth/register",
            json={
                "username": "loginuser",
                "email": "login@example.com",
                "password": "testpass123",
            },
        )
        # Login
        response = client.post(
            "/api/auth/token",
            data={"username": "loginuser", "password": "testpass123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_with_wrong_password(self):
        """Test login with wrong password."""
        # Register first
        client.post(
            "/api/auth/register",
            json={
                "username": "wrongpassuser",
                "email": "wrong@example.com",
                "password": "testpass123",
            },
        )
        # Login with wrong password
        response = client.post(
            "/api/auth/token",
            data={"username": "wrongpassuser", "password": "wrongpass"},
        )
        assert response.status_code == 401

    def test_get_current_user(self):
        """Test getting current user info."""
        # Register and login
        client.post(
            "/api/auth/register",
            json={
                "username": "currentuser",
                "email": "current@example.com",
                "password": "testpass123",
            },
        )
        login_response = client.post(
            "/api/auth/token",
            data={"username": "currentuser", "password": "testpass123"},
        )
        token = login_response.json()["access_token"]

        # Get current user
        response = client.get(
            "/api/auth/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "currentuser"
        assert data["email"] == "current@example.com"

    def test_get_current_user_without_token(self):
        """Test getting current user without token."""
        response = client.get("/api/auth/users/me")
        assert response.status_code == 403

    def test_get_current_user_with_invalid_token(self):
        """Test getting current user with invalid token."""
        response = client.get(
            "/api/auth/users/me",
            headers={"Authorization": "Bearer invalid_token"},
        )
        assert response.status_code == 401


class TestUserRoles:
    def test_user_default_role_is_patient(self):
        """Test that newly registered users have patient role by default."""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "roleuser",
                "email": "role@example.com",
                "password": "testpass123",
            },
        )
        data = response.json()
        assert "patient" in [role for role in data["roles"]]

    def test_clinician_endpoint_requires_clinician_role(self):
        """Test that clinician endpoint requires clinician role."""
        # Register patient
        client.post(
            "/api/auth/register",
            json={
                "username": "patientuser",
                "email": "patient@example.com",
                "password": "testpass123",
            },
        )
        login_response = client.post(
            "/api/auth/token",
            data={"username": "patientuser", "password": "testpass123"},
        )
        token = login_response.json()["access_token"]

        # Try to access clinician endpoint
        response = client.get(
            "/api/auth/users/me/clinician",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

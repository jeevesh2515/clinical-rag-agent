"""Pydantic models for authentication and user profile."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field
from enum import Enum


class UserRole(str, Enum):
    clinician = "clinician"
    patient = "patient"
    admin = "admin"
    care_coordinator = "care_coordinator"


class User(BaseModel):
    id: str = Field(..., description="Unique identifier for the user")
    username: str = Field(..., description="Username for login")
    email: str = Field(..., description="User's email address")
    hashed_password: str = Field(..., description="Hashed password for security")
    roles: List[UserRole] = Field(default_factory=list, description="List of roles assigned to the user")
    is_active: bool = Field(True, description="Whether the user account is active")
    full_name: Optional[str] = Field(None, description="Display name (optional)")
    primary_role: str = Field("patient", description="Primary role used for routing and gating")
    date_of_birth: Optional[str] = Field(None, description="Date of birth (YYYY-MM-DD, patient profiles)")
    notes: Optional[str] = Field(None, description="Free-form profile notes")
    created_at: Optional[str] = Field(None, description="Account creation timestamp (ISO-8601)")


class UserInDB(User):
    """Alias kept for backward compatibility with existing imports."""
    pass


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: Optional[str] = None


class RegisterUser(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, description="Desired username")
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., min_length=8, max_length=128, description="Desired password (min 8 chars)")
    full_name: Optional[str] = Field(None, max_length=255)
    role: UserRole = Field(
        UserRole.patient,
        description="Whether this account is a patient or a clinician. Determines UI gating.",
    )


class LoginUser(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    """Partial update for the /users/me PUT endpoint."""
    full_name: Optional[str] = Field(None, max_length=255)
    email: Optional[EmailStr] = None
    date_of_birth: Optional[str] = Field(None, description="YYYY-MM-DD")
    notes: Optional[str] = None
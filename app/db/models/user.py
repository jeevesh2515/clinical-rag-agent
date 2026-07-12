"""User ORM model."""

from __future__ import annotations
import json
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, utcnow

if TYPE_CHECKING:
    from app.db.models.conversation import Conversation
    from app.db.models.upload import Upload


def _roles_to_json(value: list[str]) -> str:
    return json.dumps(value) if value else "[]"


def _json_to_roles(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return [str(r) for r in parsed] if isinstance(parsed, list) else []
    except (ValueError, TypeError):
        return []


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    roles_json: Mapped[str] = mapped_column(String(255), default="[]")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    primary_role: Mapped[str] = mapped_column(String(32), default="patient")
    date_of_birth: Mapped[str | None] = mapped_column(String(10), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    uploads: Mapped[list["Upload"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def roles(self) -> list[str]:
        return _json_to_roles(self.roles_json) or ([self.primary_role] if self.primary_role else [])

    @roles.setter
    def roles(self, value: list[str]) -> None:
        self.roles_json = _roles_to_json(value)

    def to_public_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "roles": self.roles,
            "primary_role": self.primary_role,
            "is_active": self.is_active,
            "full_name": self.full_name,
            "date_of_birth": self.date_of_birth,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

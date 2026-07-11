"""Database engine + SQLAlchemy ORM models for the application.

Single source of truth for persistence. Replaces the previous in-memory stores
(``USERS_DB`` in ``app/auth/routes.py`` and ``ChatRepository`` in
``app/chat/repository.py``) so that user accounts, conversations, and uploads
survive process restarts and can be shared across workers (e.g. on Vercel).

The schema is intentionally small — we only model what the app needs:

* ``User`` — account credentials + role + profile fields.
* ``Conversation`` — chat thread owned by one user.
* ``Message`` — single user or assistant turn inside a conversation.
* ``Upload`` — file uploaded by a user (prescription, doctor's note, image).
  Files themselves live on disk under ``data/uploads/<user_id>/<upload_id>/``;
  this row stores metadata + extracted text for retrieval.

The default URL is ``sqlite:///./clinical_demo.db`` (from
``Settings.database_url``). For production, swap to Postgres by setting the
``DATABASE_URL`` env var — no other change required.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)

from app.core.config import get_settings


# ─── Engine + Session factory ─────────────────────────────────────────────────


class Base(DeclarativeBase):
    """Common SQLAlchemy declarative base."""


def _engine_kwargs(url: str) -> dict:
    """SQLite needs ``check_same_thread=False`` when used by FastAPI tests."""
    if url.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}, "pool_pre_ping": True}
    return {"pool_pre_ping": True}


def get_engine():
    """Create (and cache) the SQLAlchemy engine for the configured database."""
    settings = get_settings()
    url = settings.database_url
    # Ensure the parent directory exists for SQLite file URLs.
    if url.startswith("sqlite:///./"):
        db_path = Path(url.replace("sqlite:///./", "", 1))
        db_path.parent.mkdir(parents=True, exist_ok=True)
    elif url.startswith("sqlite:////"):
        db_path = Path(url.replace("sqlite:////", "/", 1))
        db_path.parent.mkdir(parents=True, exist_ok=True)
    return create_engine(url, **_engine_kwargs(url))


# Module-level lazy singletons. ``ENGINE`` / ``SessionLocal`` are recreated
# when ``reset_engine_for_tests()`` is called by tests, so each test fixture
# can point at a different SQLite file without restarting the process.
_ENGINE = None
_SessionLocal = None


def _build_engine():
    settings = get_settings()
    return create_engine(settings.database_url, **_engine_kwargs(settings.database_url))


def _get_engine():
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = _build_engine()
    return _ENGINE


def _get_session_local():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=_get_engine(), autoflush=False, autocommit=False)
    return _SessionLocal


def reset_engine_for_tests(database_url: str | None = None) -> None:
    """Tear down and rebuild the engine + session factory.

    Used by ``tests/conftest.py`` so each test that overrides the
    ``database_url`` setting actually points at a fresh SQLite file.
    """
    global _ENGINE, _SessionLocal
    if _ENGINE is not None:
        _ENGINE.dispose()
    _ENGINE = None
    _SessionLocal = None
    if database_url is not None:
        # Patch settings.database_url in-place so the next ``get_settings()``
        # call returns our overridden URL.
        import os
        os.environ["DATABASE_URL"] = database_url
        from app.core.config import get_settings as _gs
        _gs.cache_clear()


def init_db() -> None:
    """Create all tables. Safe to call multiple times."""
    Base.metadata.create_all(_get_engine())


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields a request-scoped session."""
    db = _get_session_local()()
    try:
        yield db
    finally:
        db.close()


from contextlib import contextmanager  # noqa: E402  (local import for tidiness)


@contextmanager
def _session_scope():
    db = _get_session_local()()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def session_scope():
    """Context manager that yields a session and closes it on exit.

    Use as ``with session_scope() as db:``. Commits on clean exit, rolls
    back on exception, and always closes.
    """
    return _session_scope()


class _SessionLocalFactory:
    """Callable + context-manager factory that mirrors ``sessionmaker``.

    Used so legacy call sites that do ``SessionLocal()`` or
    ``with SessionLocal() as db:`` keep working while we route through the
    lazy engine.
    """

    def __call__(self) -> Session:
        return _get_session_local()()

    def __enter__(self) -> Session:
        self._ctx = _session_scope()
        self._session = self._ctx.__enter__()
        return self._session

    def __exit__(self, exc_type, exc, tb):
        return self._ctx.__exit__(exc_type, exc, tb)


SessionLocal = _SessionLocalFactory()


# ─── Helpers ──────────────────────────────────────────────────────────────────


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _roles_to_json(value: list[str] | str | None) -> str:
    if value is None:
        return json.dumps([])
    if isinstance(value, str):
        return value
    return json.dumps(list(value))


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


# ─── Models ───────────────────────────────────────────────────────────────────


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
    # Patient-only profile bits (kept optional so clinician profiles stay clean).
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


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user: Mapped[User] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text)
    citations_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_trace_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    safety_flags_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    knowledge_path_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    rephrased_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # "prescription" | "doctor_note" | "lab_report" | "image" | "other"
    category: Mapped[str] = mapped_column(String(32), default="other")
    # "pdf" | "image"
    kind: Mapped[str] = mapped_column(String(16))
    original_filename: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(String(512))
    mime_type: Mapped[str] = mapped_column(String(128))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    # Free-text note the user attached to the upload (always indexed).
    user_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Extracted text from the file (PDF pypdf output; for images this stays null
    # until an OCR backend is wired).
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Title shown in citations / sidebar.
    display_title: Mapped[str] = mapped_column(String(255))
    # Number of chunks produced for retrieval (denormalised for fast UI).
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="uploads")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "category": self.category,
            "kind": self.kind,
            "original_filename": self.original_filename,
            "mime_type": self.mime_type,
            "size_bytes": self.size_bytes,
            "user_note": self.user_note,
            "extracted_text_length": len(self.extracted_text) if self.extracted_text else 0,
            "display_title": self.display_title,
            "chunk_count": self.chunk_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ─── Init hook ────────────────────────────────────────────────────────────────


def bootstrap() -> None:
    """Idempotent init: ensures tables exist and the upload directory is ready.

    Note: On Vercel serverless the filesystem is read-only except ``/tmp``.
    This function swallows directory-creation errors so the app can still
    serve API requests in that environment (upload features simply won't
    work until ``UPLOAD_DIR`` is pointed at a writable path).
    """
    init_db()
    
    # Idempotently add the new fields to existing message tables if they are missing
    engine = _get_engine()
    from sqlalchemy import text
    with engine.connect() as conn:
        for column, col_type in [("rephrased_question", "TEXT"), ("model_used", "VARCHAR(128)")]:
            try:
                conn.execute(text(f"ALTER TABLE messages ADD COLUMN {column} {col_type}"))
                conn.commit()
            except Exception:
                # Column likely already exists or table is empty
                pass

    upload_dir = os.environ.get("UPLOAD_DIR", "data/uploads")
    try:
        Path(upload_dir).mkdir(parents=True, exist_ok=True)
    except (OSError, PermissionError):
        pass
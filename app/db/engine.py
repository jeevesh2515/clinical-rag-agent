"""SQLAlchemy engine factory, session management, and bootstrap.

Functions here should be imported through ``app.db`` (the package ``__init__``)
rather than imported directly from this module.
"""

from __future__ import annotations

import os
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.models import Base


# ─── Module-level lazy singletons ────────────────────────────────────────────
# These are recreated by ``reset_engine_for_tests()`` so each test can use
# a fresh SQLite file without restarting the process.

_ENGINE = None
_SessionLocal = None


def _engine_kwargs(url: str) -> dict:
    if url.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}, "pool_pre_ping": True}
    return {"pool_pre_ping": True}


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
    global _ENGINE, _SessionLocal, _TABLES_INITIALIZED
    if _ENGINE is not None:
        _ENGINE.dispose()
    _ENGINE = None
    _SessionLocal = None
    _TABLES_INITIALIZED = False
    if database_url is not None:
        os.environ["DATABASE_URL"] = database_url
        from app.core.config import get_settings as _gs

        _gs.cache_clear()


def init_db() -> None:
    """Create all tables. Safe to call multiple times."""
    Base.metadata.create_all(_get_engine())


# Process-level guard so ``init_db()`` is only executed once per worker. In
# serverless environments (e.g. Vercel) FastAPI lifespan events may not run on
# every cold start; this safety net prevents ``ProgrammingError`` for missing
# tables on the first request without adding per-request overhead.
_ensure_tables_lock = threading.Lock()
_TABLES_INITIALIZED = False


def _ensure_tables() -> None:
    global _TABLES_INITIALIZED
    if _TABLES_INITIALIZED:
        return
    with _ensure_tables_lock:
        if not _TABLES_INITIALIZED:
            init_db()
            _TABLES_INITIALIZED = True


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields a request-scoped session."""
    _ensure_tables()
    db = _get_session_local()()
    try:
        yield db
    finally:
        db.close()


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


# ─── Bootstrap ────────────────────────────────────────────────────────────────


def _add_column_if_missing(engine, table: str, column: str, col_type: str) -> None:
    """Best-effort ALTER TABLE ... ADD COLUMN IF NOT EXISTS."""
    try:
        with engine.connect() as conn:
            with conn.begin():
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_type}"))
    except Exception:
        # Already exists, unsupported syntax, or no privileges — ignore safely.
        pass


def bootstrap() -> None:
    """Idempotent init: ensures tables exist and migration patches are applied.

    Note: On Vercel serverless the filesystem is read-only except ``/tmp``.
    This function swallows directory-creation errors so the app can still
    serve API requests in that environment.
    """
    init_db()

    engine = _get_engine()

    # Idempotently add columns that may not exist on older databases.
    # Each column addition uses its own connection + transaction block so a PostgreSQL
    # column-exists exception won't abort the transaction for subsequent operations.
    for column, col_type in [("rephrased_question", "TEXT"), ("model_used", "VARCHAR(128)")]:
        _add_column_if_missing(engine, "messages", column, col_type)

    # Older deployments may have a users table from before the profile/vitals/roles
    # expansions. Add missing columns so registration and profile updates don't fail.
    users_columns = [
        ("roles_json", "VARCHAR(255) DEFAULT '[]'"),
        ("is_active", "BOOLEAN DEFAULT TRUE"),
        ("full_name", "VARCHAR(255)"),
        ("primary_role", "VARCHAR(32) DEFAULT 'patient'"),
        ("date_of_birth", "VARCHAR(10)"),
        ("notes", "TEXT"),
        ("health_vitals_json", "TEXT"),
        ("created_at", "TIMESTAMP WITH TIME ZONE DEFAULT NOW()"),
        ("updated_at", "TIMESTAMP WITH TIME ZONE DEFAULT NOW()"),
    ]
    for column, col_type in users_columns:
        _add_column_if_missing(engine, "users", column, col_type)

    upload_dir = os.environ.get("UPLOAD_DIR", "data/uploads")
    try:
        Path(upload_dir).mkdir(parents=True, exist_ok=True)
    except (OSError, PermissionError):
        pass

"""Database layer — re-exports everything needed by the rest of the app.

Usage::

    from app.db import get_db, SessionLocal, User, Conversation
    from app.db import bootstrap, reset_engine_for_tests, utcnow

"""

from app.db.engine import (
    SessionLocal,
    bootstrap,
    get_db,
    init_db,
    reset_engine_for_tests,
    session_scope,
)
from app.db.models import Base, Conversation, Message, Upload, User, utcnow

__all__ = [
    "Base",
    "bootstrap",
    "Conversation",
    "get_db",
    "init_db",
    "Message",
    "reset_engine_for_tests",
    "session_scope",
    "SessionLocal",
    "Upload",
    "User",
    "utcnow",
]

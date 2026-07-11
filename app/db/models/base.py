"""Base SQLAlchemy declarative base and shared helpers.

Split out from ``app/db.py`` so model files can import ``Base`` without
creating circular dependencies with the engine setup.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)

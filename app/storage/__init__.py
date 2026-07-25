"""Storage abstraction — Day 28 implementation.

Re-exports `build_storage` so callers can do ``from app.storage import build_storage``
without knowing which backend is in use (local, S3, or no-op).
"""
from app.storage.factory import build_storage

__all__ = ["build_storage"]

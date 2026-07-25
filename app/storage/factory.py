"""Storage backend factory — Day 28 implementation.

Picks between `LocalStorage` (default, no AWS credentials needed) and
`S3Storage` (production) based on the `STORAGE_BACKEND` env var.

Both backends implement the same interface so callers don't depend on
which one is in use.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def build_storage(
    backend: str | None = None,
    *,
    s3_bucket: str | None = None,
    s3_region: str = "us-east-1",
    local_root: str = "/tmp/clinical-rag-uploads",
) -> object:
    """Build a storage backend.

    The backend implements put, get, delete, presigned_url.

    Parameters
    ----------
    backend:
        "local" (default) or "s3". Auto-detected from `STORAGE_BACKEND` env.
    s3_bucket:
        Required when backend == "s3".
    """
    choice = (backend or os.getenv("STORAGE_BACKEND") or "local").lower()
    if choice == "s3":
        if not s3_bucket:
            logger.warning("storage_backend_disabled reason=S3_BUCKET_unset falling_back=local")
            return _local_factory(local_root)
        from app.storage.s3 import S3Storage

        return S3Storage(bucket=s3_bucket, region=s3_region)
    return _local_factory(local_root)


def _local_factory(local_root: str) -> object:
    from app.storage.local import LocalStorage

    return LocalStorage(root=local_root)

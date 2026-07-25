"""Day 28 — Unit tests for storage backends."""
from __future__ import annotations

from pathlib import Path

import pytest

from app.storage.factory import build_storage
from app.storage.local import LocalStorage


def test_local_storage_put_get_delete(tmp_path: Path) -> None:
    store = LocalStorage(root=str(tmp_path))
    url = store.put("uploads/foo.pdf", b"hello world", content_type="application/pdf")
    assert url.endswith("uploads/foo.pdf")
    assert store.get("uploads/foo.pdf") == b"hello world"
    assert store.exists("uploads/foo.pdf")
    assert store.delete("uploads/foo.pdf") is True
    assert not store.exists("uploads/foo.pdf")


def test_local_storage_presigned_url() -> None:
    store = LocalStorage(root="/tmp/test-clinical-rag")
    url = store.presigned_url("uploads/foo.pdf")
    assert url.startswith("file://")
    assert "uploads/foo.pdf" in url


def test_factory_returns_local_by_default() -> None:
    import os

    os.environ.pop("STORAGE_BACKEND", None)
    store = build_storage(backend=None, local_root="/tmp/test-factory")
    assert isinstance(store, LocalStorage)


def test_factory_returns_local_when_s3_bucket_missing() -> None:
    store = build_storage(backend="s3", s3_bucket=None, local_root="/tmp/test-factory-2")
    # Falls back to local with a warning rather than crashing.
    assert isinstance(store, LocalStorage)


def test_factory_returns_s3_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify the factory picks S3Storage when backend='s3' and bucket is set."""
    # Stub out boto3 so we don't need real AWS credentials.
    class _StubClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def put_object(self, **kwargs: object) -> None:  # noqa: D401
            return None

        def get_object(self, **kwargs: object) -> dict[str, object]:
            return {"Body": _Bytes(b"contents")}

        def delete_object(self, **kwargs: object) -> None:
            return None

        def generate_presigned_url(self, *args: object, **kwargs: object) -> str:
            return "https://example.com/presigned"

        def head_object(self, **kwargs: object) -> None:
            return None

    class _Bytes:
        def __init__(self, data: bytes) -> None:
            self._data = data

        def read(self) -> bytes:
            return self._data

    import sys

    boto3_stub = type(sys)("boto3")
    boto3_stub.client = _StubClient  # type: ignore[attr-defined]
    sys.modules["boto3"] = boto3_stub

    store = build_storage(
        backend="s3",
        s3_bucket="test-bucket",
        s3_region="us-east-1",
    )
    from app.storage.s3 import S3Storage

    assert isinstance(store, S3Storage)
    assert store.bucket == "test-bucket"
    url = store.put("key", b"data", content_type="text/plain")
    assert url == "s3://test-bucket/key"
    assert store.get("key") == b"contents"
    assert store.presigned_url("key") == "https://example.com/presigned"
    assert store.exists("key") is True
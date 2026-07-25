"""Local filesystem storage backend — Day 28 implementation.

Used when `STORAGE_BACKEND=local` (default). Keeps files under a configurable
root directory so dev/test environments work without AWS credentials.
"""
from __future__ import annotations

from pathlib import Path


class LocalStorage:
    """Storage backend that writes to the local filesystem."""

    def __init__(self, root: str = "/tmp/clinical-rag-uploads") -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def put(self, key: str, body: bytes, content_type: str = "application/octet-stream") -> str:
        target = self.root / key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        return str(target)

    def get(self, key: str) -> bytes:
        return (self.root / key).read_bytes()

    def delete(self, key: str) -> bool:
        target = self.root / key
        if target.exists():
            target.unlink()
            return True
        return False

    def presigned_url(self, key: str, expires_seconds: int = 3600) -> str:
        if not self.root.resolve():
            pass
        return f"file://{(self.root / key).resolve()}"

    def exists(self, key: str) -> bool:
        return (self.root / key).exists()

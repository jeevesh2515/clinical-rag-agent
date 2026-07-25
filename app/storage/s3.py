"""S3 storage backend — Day 28 implementation.

Uses boto3 underneath. The interface matches `LocalStorage` so callers can
swap backends without code changes.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class S3Storage:
    """Storage backend that writes to S3."""

    def __init__(self, bucket: str, region: str = "us-east-1") -> None:
        self.bucket = bucket
        self.region = region
        self._client: Any | None = None

    def _get_client(self) -> Any:
        if self._client is None:
            try:
                import boto3

                self._client = boto3.client("s3", region_name=self.region)
            except Exception as exc:  # noqa: BLE001
                logger.error("s3_client_init_failed err=%s", exc)
                raise
        return self._client

    def put(self, key: str, body: bytes, content_type: str = "application/octet-stream") -> str:
        client = self._get_client()
        client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=body,
            ContentType=content_type,
        )
        return f"s3://{self.bucket}/{key}"

    def get(self, key: str) -> bytes:
        client = self._get_client()
        response = client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    def delete(self, key: str) -> bool:
        client = self._get_client()
        client.delete_object(Bucket=self.bucket, Key=key)
        return True

    def presigned_url(self, key: str, expires_seconds: int = 3600) -> str:
        client = self._get_client()
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_seconds,
        )

    def exists(self, key: str) -> bool:
        try:
            client = self._get_client()
            client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:  # noqa: BLE001
            return False

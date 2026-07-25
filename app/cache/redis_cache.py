"""Day 27 — Redis LLM response cache with graceful no-op fallback.

Key design (see .planning/daily_learnings/day-27-redis-cache-layer.md):

- Cache key = sha256(normalized_question + sorted(reranked_chunk_ids))
  so invalidation on /api/ingest is mechanical: delete every entry whose
  chunk-set overlaps with the new ingest.
- TTL: 24h (guidelines change slowly; "review-required" disclaimer covers
  the residual risk).
- Refusals are NOT cached (they include request IDs for audit).
- Graceful fallback: if Redis is unreachable, log a warning and compute
  the response. Cache must never break the request path.
- Stats: increments llm_cache_hits_total / llm_cache_misses_total.
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Awaitable, Callable

from app.observability.metrics import (
    LLM_CACHE_HITS_TOTAL,
    LLM_CACHE_MISSES_TOTAL,
)

logger = logging.getLogger(__name__)

CACHE_PREFIX = "clinical-rag:cache:llm"
CACHE_TTL_SECONDS = 60 * 60 * 24  # 24h


class RedisLLMCache:
    """Async LLM response cache with fallback to a no-op."""

    def __init__(self, redis_client: Any | None = None) -> None:
        self._redis = redis_client
        self._enabled = redis_client is not None

    @property
    def enabled(self) -> bool:
        return self._enabled

    def _key(self, question: str, reranked_chunk_ids: list[str]) -> str:
        normalized = " ".join(question.lower().split())
        chunk_part = ",".join(sorted(reranked_chunk_ids))
        digest = hashlib.sha256(f"{normalized}::{chunk_part}".encode()).hexdigest()
        return f"{CACHE_PREFIX}:{digest}"

    async def get_or_compute(
        self,
        question: str,
        reranked_chunk_ids: list[str],
        compute_fn: Callable[[], Awaitable[Any]],
    ) -> tuple[Any, bool]:
        """Return (value, hit). On Redis failure, fall back to compute_fn."""
        if not self._enabled:
            LLM_CACHE_MISSES_TOTAL.labels(cache="disabled").inc()
            return await compute_fn(), False

        key = self._key(question, reranked_chunk_ids)
        try:
            cached = await self._redis.get(key)
            if cached is not None:
                LLM_CACHE_HITS_TOTAL.labels(cache="redis").inc()
                return json.loads(cached), True
        except Exception as exc:  # noqa: BLE001 — never break the request path
            logger.warning("redis_cache_get_failed key=%s err=%s", key, exc)

        LLM_CACHE_MISSES_TOTAL.labels(cache="redis").inc()
        value = await compute_fn()
        try:
            await self._redis.set(key, json.dumps(value, default=str), ex=CACHE_TTL_SECONDS)
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_cache_set_failed key=%s err=%s", key, exc)
        return value, False

    async def invalidate_by_chunk_ids(self, chunk_ids: list[str]) -> int:
        """Delete every cache entry whose chunk-set overlaps with the given chunk IDs.

        Implementation: SCAN the cache namespace and DEL any entry whose
        stored chunk-set includes one of the given IDs. Returns the count
        of entries deleted.
        """
        if not self._enabled or not chunk_ids:
            return 0
        deleted = 0
        try:
            keys = []
            async for key in self._redis.scan_iter(match=f"{CACHE_PREFIX}:*"):
                keys.append(key)
            if not keys:
                return 0
            values = await self._redis.mget(keys)
            to_delete: list[str] = []
            target_set = set(chunk_ids)
            for key, raw in zip(keys, values, strict=True):
                if not raw:
                    continue
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    to_delete.append(key)
                    continue
                stored_ids = set(payload.get("chunk_ids") or [])
                if stored_ids & target_set:
                    to_delete.append(key)
            if to_delete:
                deleted = await self._redis.delete(*to_delete)
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_cache_invalidate_failed err=%s", exc)
        return deleted

    async def invalidate_all(self) -> int:
        """Drop the entire cache namespace. Used by admin endpoints."""
        if not self._enabled:
            return 0
        try:
            keys = [k async for k in self._redis.scan_iter(match=f"{CACHE_PREFIX}:*")]
            if not keys:
                return 0
            return await self._redis.delete(*keys)
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_cache_invalidate_all_failed err=%s", exc)
            return 0


def build_cache(redis_url: str | None) -> RedisLLMCache:
    """Factory: build a RedisLLMCache or a no-op when REDIS_URL is unset.

    Failures to connect to Redis are swallowed and logged: the cache layer
    must never break the request path.
    """
    if not redis_url:
        logger.info("cache_disabled reason=REDIS_URL_unset")
        return RedisLLMCache(redis_client=None)
    try:
        import redis.asyncio as redis_asyncio  # type: ignore[import-not-found]

        client = redis_asyncio.from_url(redis_url, max_connections=50)
        return RedisLLMCache(redis_client=client)
    except Exception as exc:  # noqa: BLE001
        logger.warning("redis_init_failed url=%s err=%s — falling back to no-op", redis_url, exc)
        return RedisLLMCache(redis_client=None)

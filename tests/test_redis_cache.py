"""Day 27 — Unit tests for RedisLLMCache.

Tests the cache key derivation, hit/miss behaviour, and invalidation logic
without requiring a real Redis server (uses fakeredis).
"""
from __future__ import annotations

import asyncio

import pytest

from app.cache.redis_cache import CACHE_PREFIX, RedisLLMCache

fakeredis = pytest.importorskip("fakeredis")


def _make_cache() -> RedisLLMCache:
    client = fakeredis.FakeAsyncRedis()
    return RedisLLMCache(redis_client=client)


def test_key_derivation_stable() -> None:
    cache = _make_cache()
    k1 = cache._key("What is stage 1 hypertension?", ["chunk_1", "chunk_2"])
    k2 = cache._key("What is stage 1 hypertension?", ["chunk_1", "chunk_2"])
    assert k1 == k2
    assert k1.startswith(f"{CACHE_PREFIX}:")


def test_key_derivation_normalises_whitespace_and_case() -> None:
    cache = _make_cache()
    k1 = cache._key("WHAT  IS  STAGE 1  HYPERTENSION?", ["chunk_1"])
    k2 = cache._key("what is stage 1 hypertension?", ["chunk_1"])
    assert k1 == k2


def test_key_derivation_differs_for_different_chunks() -> None:
    cache = _make_cache()
    k1 = cache._key("question", ["chunk_1"])
    k2 = cache._key("question", ["chunk_2"])
    assert k1 != k2


def test_disabled_cache_returns_compute_result() -> None:
    cache = RedisLLMCache(redis_client=None)

    async def runner() -> None:
        called = 0

        async def compute() -> dict:
            nonlocal called
            called += 1
            return {"answer": "fresh"}

        value, hit = await cache.get_or_compute("question", ["chunk_1"], compute)
        assert value == {"answer": "fresh"}
        assert hit is False
        assert called == 1

    asyncio.run(runner())


def test_hit_returns_cached_value() -> None:
    cache = _make_cache()

    async def runner() -> None:
        async def compute() -> dict:
            return {"answer": "first", "chunk_ids": ["chunk_1"]}

        v1, hit1 = await cache.get_or_compute("question", ["chunk_1"], compute)
        assert v1 == {"answer": "first", "chunk_ids": ["chunk_1"]}
        assert hit1 is False

        v2, hit2 = await cache.get_or_compute("question", ["chunk_1"], compute)
        assert v2 == {"answer": "first", "chunk_ids": ["chunk_1"]}
        assert hit2 is True

    asyncio.run(runner())


def test_invalidate_by_chunk_ids_overlap() -> None:
    cache = _make_cache()

    async def runner() -> int:
        async def compute_a() -> dict:
            return {"answer": "A", "chunk_ids": ["chunk_1", "chunk_2"]}

        async def compute_b() -> dict:
            return {"answer": "B", "chunk_ids": ["chunk_3"]}

        # Seed both entries
        await cache.get_or_compute("q1", ["chunk_1", "chunk_2"], compute_a)
        await cache.get_or_compute("q2", ["chunk_3"], compute_b)

        # Invalidate anything overlapping chunk_2 — q1's entry should die, q2 survives.
        return await cache.invalidate_by_chunk_ids(["chunk_2"])

    deleted = asyncio.run(runner())
    assert deleted == 1


def test_invalidate_all() -> None:
    cache = _make_cache()

    async def runner() -> int:
        async def compute() -> dict:
            return {"answer": "x", "chunk_ids": ["chunk_1"]}

        await cache.get_or_compute("q1", ["chunk_1"], compute)
        await cache.get_or_compute("q2", ["chunk_1"], compute)
        return await cache.invalidate_all()

    deleted = asyncio.run(runner())
    assert deleted >= 2
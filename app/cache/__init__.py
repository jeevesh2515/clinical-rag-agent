"""Cache package — Day 27 implementation.

Re-exports the singleton `cache` instance so callers can do
``from app.cache import cache`` without needing to know whether the underlying
backend is Redis, fakeredis (tests), or a no-op.
"""
from app.cache.redis_cache import RedisLLMCache, build_cache

__all__ = ["RedisLLMCache", "build_cache"]

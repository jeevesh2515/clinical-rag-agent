"""Prometheus metrics package — Day 25 implementation.

Defines the RED-method HTTP metrics, LLM domain metrics, retrieval histograms,
and the in-flight HTTP request gauge. Every other package imports metrics from
here so labels stay consistent across the codebase.
"""
from app.observability.metrics import (
    HTTP_REQUESTS_IN_FLIGHT,
    HTTP_REQUEST_DURATION_SECONDS,
    LLM_CACHE_HITS_TOTAL,
    LLM_CACHE_MISSES_TOTAL,
    LLM_FAILURES_TOTAL,
    LLM_REQUEST_DURATION_SECONDS,
    LLM_TOKENS_TOTAL,
    RETRIEVAL_CHUNKS_RETURNED,
    SAFETY_REFUSAL_TOTAL,
    record_http_in_flight,
)

__all__ = [
    "HTTP_REQUESTS_IN_FLIGHT",
    "HTTP_REQUEST_DURATION_SECONDS",
    "LLM_CACHE_HITS_TOTAL",
    "LLM_CACHE_MISSES_TOTAL",
    "LLM_FAILURES_TOTAL",
    "LLM_REQUEST_DURATION_SECONDS",
    "LLM_TOKENS_TOTAL",
    "RETRIEVAL_CHUNKS_RETURNED",
    "SAFETY_REFUSAL_TOTAL",
    "record_http_in_flight",
]

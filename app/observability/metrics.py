"""Central metric definitions — Day 25 implementation.

Single source of truth for all Prometheus metrics. Histogram buckets are tuned
for LLM workloads (default Prometheus buckets cap at 10s but OpenRouter calls
can run 60-120 seconds) and for embedding/retrieval latency (typically 5-50ms).

RED method baseline (Tom Wilkie, Weaveworks):

    R - http_requests_total (Counter)         — request rate
    E - http_request_failures_total (Counter) — error rate
    D - http_request_duration_seconds (Histogram) — p95/p99 latency

LLM domain extensions:

    llm_tokens_total{model, direction}              — token spend
    llm_request_duration_seconds{model}             — generation wall time
    llm_failures_total{model, reason}               — provider outages
    llm_cache_hits_total / llm_cache_misses_total   — cache effectiveness
    safety_refusal_total{reason}                    — production refusal rate

Retrieval:

    retrieval_chunks_returned (Histogram) — distribution of result-set sizes
    http_requests_in_flight{endpoint} (Gauge) — current load for KEDA scaling
"""
from __future__ import annotations

import time
import warnings
from contextlib import contextmanager

try:
    from prometheus_client import Counter, Gauge, Histogram  # type: ignore
except ImportError:  # pragma: no cover - e.g. Vercel serverless runtime
    warnings.warn("prometheus_client not installed; metrics will be no-ops", stacklevel=2)

    class _NoOpMetric:
        """No-op metric fallback when prometheus_client is unavailable."""

        def __init__(self, *args, **kwargs):
            pass

        def labels(self, *args, **kwargs) -> "_NoOpMetric":
            return self

        def inc(self, *args, **kwargs) -> None:
            pass

        def dec(self, *args, **kwargs) -> None:
            pass

        def observe(self, *args, **kwargs) -> None:
            pass

    Counter = _NoOpMetric  # type: ignore
    Gauge = _NoOpMetric  # type: ignore
    Histogram = _NoOpMetric  # type: ignore

# Buckets tuned for LLM workloads: long-tail up to 120s for OpenRouter free tier.
_LLM_BUCKETS = (0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0)
# Buckets tuned for HTTP request duration: typical web-app p95 < 2s.
_HTTP_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
# Buckets for retrieval/embedding: typically 5-50ms.
_RETRIEVAL_BUCKETS = (0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5)

# ───── RED method baseline ─────
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds (RED method Duration).",
    labelnames=("method", "endpoint", "status"),
    buckets=_HTTP_BUCKETS,
)

HTTP_REQUESTS_IN_FLIGHT = Gauge(
    "http_requests_in_flight",
    "Number of HTTP requests currently being processed (RED method rate proxy).",
    labelnames=("method", "endpoint"),
)

# ───── LLM domain metrics ─────
LLM_TOKENS_TOTAL = Counter(
    "llm_tokens_total",
    "Total tokens consumed by the LLM provider.",
    labelnames=("model", "direction"),  # direction = prompt | completion
)

LLM_REQUEST_DURATION_SECONDS = Histogram(
    "llm_request_duration_seconds",
    "Duration of LLM provider API calls in seconds.",
    labelnames=("model",),
    buckets=_LLM_BUCKETS,
)

LLM_FAILURES_TOTAL = Counter(
    "llm_failures_total",
    "Count of LLM provider call failures.",
    labelnames=("model", "reason"),  # reason = timeout | unauthorized | rate_limit | other
)

LLM_CACHE_HITS_TOTAL = Counter(
    "llm_cache_hits_total",
    "Count of LLM response cache hits (served from cache, no provider call).",
    labelnames=("cache",),
)

LLM_CACHE_MISSES_TOTAL = Counter(
    "llm_cache_misses_total",
    "Count of LLM response cache misses (provider call required).",
    labelnames=("cache",),
)

SAFETY_REFUSAL_TOTAL = Counter(
    "safety_refusal_total",
    "Count of safety refusals before LLM generation.",
    labelnames=("reason",),  # reason = prescribing_request | diagnosis_request | ...
)

# ───── Retrieval metrics ─────
RETRIEVAL_CHUNKS_RETURNED = Histogram(
    "retrieval_chunks_returned",
    "Distribution of chunks returned per retrieval query.",
    buckets=(0, 1, 2, 5, 10, 20, 50, 100),
)


@contextmanager
def record_http_in_flight(method: str, endpoint: str):
    """Context manager that increments/decrements the in-flight gauge."""
    HTTP_REQUESTS_IN_FLIGHT.labels(method=method, endpoint=endpoint).inc()
    start = time.perf_counter()
    try:
        yield
    finally:
        duration = time.perf_counter() - start
        HTTP_REQUESTS_IN_FLIGHT.labels(method=method, endpoint=endpoint).dec()
        HTTP_REQUEST_DURATION_SECONDS.labels(
            method=method,
            endpoint=endpoint,
            status="completed",
        ).observe(duration)


def observe_retrieval_chunks(num_chunks: int) -> None:
    """Record the result-set size of a retrieval call."""
    RETRIEVAL_CHUNKS_RETURNED.observe(num_chunks)


def record_llm_call(
    model: str,
    *,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    duration_seconds: float = 0.0,
    success: bool = True,
    failure_reason: str = "",
) -> None:
    """Record token usage + duration for a single LLM provider call."""
    if prompt_tokens > 0:
        LLM_TOKENS_TOTAL.labels(model=model, direction="prompt").inc(prompt_tokens)
    if completion_tokens > 0:
        LLM_TOKENS_TOTAL.labels(model=model, direction="completion").inc(completion_tokens)
    if duration_seconds > 0:
        LLM_REQUEST_DURATION_SECONDS.labels(model=model).observe(duration_seconds)
    if not success:
        LLM_FAILURES_TOTAL.labels(model=model, reason=failure_reason or "other").inc()


def record_safety_refusal(reason: str) -> None:
    SAFETY_REFUSAL_TOTAL.labels(reason=reason).inc()

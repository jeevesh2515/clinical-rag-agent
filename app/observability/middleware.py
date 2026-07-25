"""HTTP request observability middleware — Day 25 implementation (post-review fix).

Wraps every HTTP request:
- Increments `http_requests_in_flight` on entry, decrements on exit.
- Observes `http_request_duration_seconds` exactly ONCE with the real
  response status code.

The endpoint label is derived from `request.scope["route"].path` so high­
cardinality paths (`/api/query/<uuid>` etc.) collapse to a single bucket.

Review fix (Day 25): the previous version did a second histogram observation
with `_last_request_duration_seconds(request)` which read from
`request.state._observability_start_time` — a key that was never set.
The result was a duplicate observation of duration=0.0 for every request,
which polluted p95/p99 dashboards. This version observes exactly once.
"""
from __future__ import annotations

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.observability.metrics import (
    HTTP_REQUEST_DURATION_SECONDS,
    HTTP_REQUESTS_IN_FLIGHT,
)


class HttpInFlightMiddleware(BaseHTTPMiddleware):
    """Track in-flight + per-request duration for production observability."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Collapse high-cardinality paths to the route template when available.
        route = request.scope.get("route")
        endpoint = getattr(route, "path", request.url.path)
        method = request.method

        import time

        gauge = HTTP_REQUESTS_IN_FLIGHT.labels(method=method, endpoint=endpoint)
        gauge.inc()
        start = time.perf_counter()
        try:
            response = await call_next(request)
            status = str(response.status_code)
        except Exception:
            # Record duration for the exception path too so 500 latency is
            # visible in the histogram (otherwise p95 silently misses it).
            duration = max(0.0, time.perf_counter() - start)
            gauge.dec()
            HTTP_REQUEST_DURATION_SECONDS.labels(
                method=method,
                endpoint=endpoint,
                status="500",
            ).observe(duration)
            raise
        duration = max(0.0, time.perf_counter() - start)
        gauge.dec()
        HTTP_REQUEST_DURATION_SECONDS.labels(
            method=method,
            endpoint=endpoint,
            status=status,
        ).observe(duration)
        return response
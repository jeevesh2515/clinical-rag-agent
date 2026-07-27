"""Metrics HTTP endpoint — Day 25 implementation.

Exposes `GET /metrics` as plain text in Prometheus exposition format. The
endpoint must be mounted BEFORE the SPA fallback route so Prometheus scrapes
always succeed even when the frontend bundle is broken in a particular pod.
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import Response

try:
    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest  # type: ignore
except ImportError:  # pragma: no cover - e.g. Vercel serverless runtime
    generate_latest = None  # type: ignore

router = APIRouter()


@router.api_route("/metrics", methods=["GET", "HEAD"], include_in_schema=False)
def metrics() -> Response:
    """Return Prometheus exposition (openmetrics text format).

    Falls back to a 204 No Content response if ``prometheus_client`` is not
    installed, which is common in serverless runtimes where pull-based scraping
    is not meaningful.
    """
    if generate_latest is None:
        return Response(status_code=204)
    payload = generate_latest()
    return Response(content=payload, media_type=CONTENT_TYPE_LATEST)

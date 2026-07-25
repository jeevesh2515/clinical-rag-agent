"""Metrics HTTP endpoint — Day 25 implementation.

Exposes `GET /metrics` as plain text in Prometheus exposition format. The
endpoint must be mounted BEFORE the SPA fallback route so Prometheus scrapes
always succeed even when the frontend bundle is broken in a particular pod.
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

router = APIRouter()


@router.get("/metrics", include_in_schema=False)
def metrics() -> Response:
    """Return Prometheus exposition (openmetrics text format)."""
    payload = generate_latest()
    return Response(content=payload, media_type=CONTENT_TYPE_LATEST)

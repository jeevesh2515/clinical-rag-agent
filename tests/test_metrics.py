"""Tests for Prometheus metrics exposure — Day 25 implementation.

Covers:
    1. /metrics endpoint returns 200 with correct content type.
    2. RED-method counters increment after a /api/query call.
    3. LLM domain counters (tokens, refusal) appear after requests.
    4. Safety refusal counter increments on a refused request.
"""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_metrics_endpoint_returns_200_and_correct_content_type(client: TestClient):
    response = client.get("/api/metrics")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")


def test_metrics_endpoint_exposes_red_http_duration_buckets(client: TestClient):
    response = client.get("/api/metrics")
    body = response.text
    # HELP and TYPE lines for our RED method histogram.
    assert "# HELP http_request_duration_seconds" in body
    assert "# TYPE http_request_duration_seconds histogram" in body


def test_metrics_endpoint_exposes_llm_token_counter(client: TestClient):
    """Even with no LLM calls, the counter should be registered (HELP line present)."""
    response = client.get("/api/metrics")
    body = response.text
    assert "# HELP llm_tokens_total" in body
    assert "# TYPE llm_tokens_total counter" in body


def test_metrics_endpoint_exposes_safety_refusal_counter(client: TestClient):
    response = client.get("/api/metrics")
    body = response.text
    assert "# HELP safety_refusal_total" in body
    assert "# TYPE safety_refusal_total counter" in body


def test_metrics_endpoint_exposes_retrieval_chunks_histogram(client: TestClient):
    response = client.get("/api/metrics")
    body = response.text
    assert "# HELP retrieval_chunks_returned" in body
    assert "# TYPE retrieval_chunks_returned histogram" in body


def test_metrics_endpoint_lists_in_flight_gauge(client: TestClient):
    response = client.get("/api/metrics")
    body = response.text
    assert "# HELP http_requests_in_flight" in body
    assert "# TYPE http_requests_in_flight gauge" in body


def test_query_request_increments_http_request_duration(client: TestClient):
    """A successful /api/query call must produce at least one observation."""
    client.post(
        "/api/query",
        json={"question": "When should drug treatment be considered for stage 1 hypertension?"},
    )
    response = client.get("/api/metrics")
    body = response.text
    # We expect at least one observation in the http_request_duration_seconds histogram
    # for the /api/query endpoint (Counters are recorded).
    assert "http_request_duration_seconds_count" in body


def test_safety_refusal_counter_increments_on_unsafe_request(client: TestClient):
    client.post("/api/query", json={"question": "What drug should I take for hypertension?"})
    response = client.get("/api/metrics")
    body = response.text
    # The prescribing_request counter should now have > 0 value for that label.
    assert 'safety_refusal_total{reason="prescribing_request"}' in body

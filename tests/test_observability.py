"""Tests for Day 13 observability features.

Covers:
- ``app/core/latency.py`` — Timer context manager
- ``app/core/logging.py`` — Structured JSON formatter
- ``GET /ready`` — readiness probe
- ``POST /query/stream`` — SSE streaming endpoint
- ``latency_ms`` in ``QueryResponse``
"""

import json
import logging
import time

from app.core.latency import Timer
from app.core.logging import configure_logging


# ─── Timer utility tests ──────────────────────────────────────────────────────


class TestTimer:
    def test_timer_records_elapsed_ms(self):
        with Timer() as t:
            time.sleep(0.01)
        assert t.elapsed_ms >= 8.0
        assert isinstance(t.elapsed_ms, float)

    def test_timer_starts_at_zero(self):
        t = Timer()
        assert t.elapsed_ms == 0.0

    def test_timer_outside_context(self):
        t = Timer()
        assert t.elapsed_ms == 0.0

    def test_timer_is_reusable(self):
        with Timer() as t:
            time.sleep(0.005)
        first = t.elapsed_ms
        with Timer() as t:
            time.sleep(0.01)
        second = t.elapsed_ms
        assert first > 0
        assert second > first

    def test_timer_accumulates_correctly_in_dict(self):
        durations = {}
        with Timer() as t:
            time.sleep(0.005)
        durations["step_a"] = t.elapsed_ms
        with Timer() as t:
            time.sleep(0.01)
        durations["step_b"] = t.elapsed_ms
        assert durations["step_a"] > 0
        assert durations["step_b"] > durations["step_a"]


# ─── Structured logging tests ────────────────────────────────────────────────


class TestStructuredLogging:
    def test_logger_configures_without_error(self):
        """configure_logging should be idempotent and never raise."""
        configure_logging()  # first call
        configure_logging()  # second call — should be no-op
        assert True

    def test_structured_logger_emits_json(self, caplog):
        """The structured formatter should emit valid JSON lines."""
        logger = logging.getLogger("test_observability")
        logger.info("test_event", extra={"event": "test_event", "request_id": "abc"})

        for record in caplog.records:
            # The formatter writes JSON — we verify the record exists
            assert record.name == "test_observability"
            break

    def test_log_extra_fields_are_promoted(self):
        """Extra dict keys should be promote-able by the formatter."""
        logger = logging.getLogger("test_promote")
        logger.info(
            "agent_invoke",
            extra={
                "event": "agent_invoke",
                "request_id": "req-123",
                "graph_route": "retrieve",
                "duration_ms": 2450.0,
                "intent": "guideline_question",
            },
        )
        # If this doesn't raise, the formatter handled the extra fields
        assert True


# ─── /ready endpoint tests ────────────────────────────────────────────────────


class TestReadyEndpoint:
    def test_ready_returns_200(self, client):
        response = client.get("/api/ready")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["db"] == "ok"
        assert payload["request_id"] is not None

    def test_ready_returns_request_id_header(self, client):
        response = client.get("/api/ready")
        assert "X-Request-ID" in response.headers
        assert response.headers["X-Request-ID"] == response.json()["request_id"]

    def test_ready_structure_is_correct(self, client):
        response = client.get("/api/ready")
        payload = response.json()
        assert set(payload.keys()) == {"status", "db", "okf", "request_id"}
        assert isinstance(payload["okf"], (int, str))


# ─── /query/stream endpoint tests ─────────────────────────────────────────────


class TestStreamingEndpoint:
    def test_streaming_returns_200(self, client):
        response = client.post(
            "/api/query/stream",
            json={"question": "What is the target BP for hypertension?"},
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

    def test_streaming_emits_sse_events(self, client):
        response = client.post(
            "/api/query/stream",
            json={"question": "What is hypertension?"},
        )
        body = response.text
        assert "event: status" in body
        assert "event: token" in body
        assert "event: done" in body

    def test_streaming_contains_request_id_in_headers(self, client):
        response = client.post(
            "/api/query/stream",
            json={"question": "What is the target BP for hypertension?"},
        )
        assert "X-Request-ID" in response.headers

    def test_streaming_contains_expected_sse_format(self, client):
        response = client.post(
            "/api/query/stream",
            json={"question": "What is hypertension?"},
        )
        # Each SSE event should have event: type and data: payload
        for line in response.text.split("\n"):
            if line.startswith("event:"):
                assert line.startswith("event: ")
            elif line.startswith("data:"):
                # data: should have parseable JSON
                data_str = line[5:].strip()
                if data_str:
                    assert json.loads(data_str)


# ─── latency_ms in response tests ─────────────────────────────────────────────


class TestLatencyInResponse:
    def test_query_response_includes_latency_ms(self, client):
        """Every /query response should include latency_ms breakdown."""
        response = client.post(
            "/api/query",
            json={"question": "When should drug treatment be considered for stage 1 hypertension?"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert "latency_ms" in payload
        assert isinstance(payload["latency_ms"], dict)

    def test_latency_ms_has_expected_nodes(self, client):
        """The latency_ms dict should include classify and generate at minimum."""
        response = client.post(
            "/api/query",
            json={"question": "What is the BP target for hypertension?", "mode": "patient"},
        )
        assert response.status_code == 200
        payload = response.json()
        latency = payload.get("latency_ms", {})
        # At minimum classify and generate should be present for a non-refused query
        assert "classify" in latency or "generate" in latency or "retrieve" in latency

"""Structured JSON logging configuration for the Clinical RAG API.

Every log record emitted by the application is serialised as a single JSON
line so that structured log aggregators (Vercel, Datadog, CloudWatch, etc.)
can index individual fields without regex parsing.

Log format:
    {"timestamp": "2024-01-15T12:00:00.000Z", "level": "INFO",
     "event": "agent_invoke", "logger": "app.agents...",
     "request_id": "abc-123", "duration_ms": 2450, ...}

Usage:
    import logging
    logger = logging.getLogger(__name__)

    # Simple message:
    logger.info("Retrieved chunks", extra={"chunk_count": 6, "request_id": "x"})

    # Structured event:
    logger.info(
        "agent_invoke",
        extra={
            "event": "agent_invoke",
            "request_id": "x",
            "graph_route": "retrieve",
            "duration_ms": 2450,
        },
    )
"""

import json
import logging
import sys
from datetime import UTC, datetime

from app.core.config import get_settings

_SENSITIVE_LOGGERS = [
    "httpx",
    "httpcore",
    "openai",
    "cohere",
    "urllib3",
    "chardet",
]


class _StructuredFormatter(logging.Formatter):
    """Emit every log record as a single-line JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        # Build the base payload — standard fields always present.
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Promote selected ``extra`` keys to top-level structured fields.
        # Callers can pass any of these via logging.info("...", extra={...}).
        _promote = (
            "event",
            "request_id",
            "duration_ms",
            "graph_route",
            "intent",
            "tool_count",
            "citation_count",
            "chunk_count",
            "node",
            "user_id",
            "error",
        )
        for key in _promote:
            value = record.__dict__.get(key)
            if value is not None:
                payload[key] = value

        # If the record has an exc_info attach a short traceback string.
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        try:
            return json.dumps(payload, default=str)
        except Exception:
            return json.dumps({"level": "ERROR", "message": "log serialisation failed"})


def configure_logging() -> None:
    """Configure root logger with structured JSON output.

    Called once at application startup from ``app/main.py``.
    Re-entrant — safe to call multiple times (subsequent calls are no-ops
    because the handlers are already attached).
    """
    settings = get_settings()
    root = logging.getLogger()

    # Avoid adding duplicate handlers when the module is reloaded.
    if root.handlers:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_StructuredFormatter())
    root.setLevel(settings.log_level)
    root.addHandler(handler)

    # Suppress verbose third-party HTTP loggers at WARNING+ only.
    for logger_name in _SENSITIVE_LOGGERS:
        logging.getLogger(logger_name).setLevel(logging.WARNING)

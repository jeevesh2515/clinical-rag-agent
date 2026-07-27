"""Regression test for LangSmith tracing being disabled in tests."""

import os

from app.core.config import Settings, get_settings


def test_langsmith_tracing_disabled_in_tests():
    """Settings instantiated in the test environment must not enable LangSmith tracing.

    The project's ``.env`` file may enable LangSmith tracing for local
    development, but the test ``conftest.py`` fixture overrides the tracing
    flags to ``false`` and removes the API keys so that tests never send
    traces to LangSmith and hit rate limits.
    """
    # Settings reads .env, but env vars take precedence, so the fixture's
    # override to "false" is what disables tracing here.
    settings = Settings()
    assert settings.langchain_tracing_v2 is False
    # langsmith_tracing is either None or a string; when it is a string it
    # should not be the literal "true".
    if settings.langsmith_tracing:
        assert settings.langsmith_tracing.lower() != "true"

    # get_settings() should also leave the env var disabled.
    get_settings.cache_clear()
    get_settings()
    assert os.environ.get("LANGCHAIN_TRACING_V2") in (None, "false", "False")

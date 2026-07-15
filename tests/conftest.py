"""Pytest configuration.

The application's database lives in SQLite (``app.db``). Tests must not pollute
the persistent file (``clinical_demo.db``) and must not leak engine state
between one another — particularly because the auth + chat tests use a
module-level ``TestClient(app)`` that points at whatever engine the lazy
``SessionLocal`` is currently bound to.

This conftest solves both problems:

1. A session-scope autouse fixture that, **before every test**, resets the
   SQLAlchemy engine back to the project default, deletes the persistent
   SQLite file, and re-bootstraps the schema. This gives every test — even
   those that don't request the ``client`` fixture — a clean DB.

2. A per-test ``client`` fixture that swaps the engine to a per-test
   ``tmp_path`` SQLite file (and bootstraps the schema there) for tests
   that need HTTP isolation. After the test, the autouse fixture for the
   *next* test will reset everything anyway.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.agents.clinical_rag_agent import ClinicalRAGAgent
from app.api.dependencies import get_agent, get_store
from app.core.config import Settings
from app.core.rate_limiter import limiter
from app.db import bootstrap, reset_engine_for_tests
from app.ingestion.chunker import chunk_page
from app.main import app
from app.retrieval.store import HybridStore

# Disable rate limiting for all unit/integration tests
limiter.enabled = False



def _resolve_persistent_db_path() -> Path | None:
    """Find the persistent SQLite file path the project is configured to use."""
    # Honour any test-time override first, then fall back to the default.
    url = os.environ.get("DATABASE_URL", "")
    if url.startswith("sqlite"):
        if url.startswith("sqlite:////"):
            return Path(url.replace("sqlite:////", "/", 1))
        if url.startswith("sqlite:///"):
            # ``sqlite:///./foo.db`` → cwd/foo.db
            return Path.cwd() / url.replace("sqlite:///", "", 1)
    # Project default: ``sqlite:///./clinical_demo.db`` (see app/core/config.py).
    return Path.cwd() / "clinical_demo.db"


@pytest.fixture(autouse=True)
def _clean_db_per_test():
    """Reset the SQLAlchemy engine and clear the persistent DB before each test.

    Order of operations:
    1. Drop any in-flight ``DATABASE_URL`` override from a previous test.
    2. Dispose + null the cached engine so ``SessionLocal`` rebuilds against
       the default URL.
    3. Delete the persistent SQLite file (if any).
    4. Re-bootstrap tables so the default DB is ready.
    """
    # Force SQLite for all tests — the .env file may contain a PostgreSQL URL.
    os.environ["DATABASE_URL"] = "sqlite:///./test_clinical_demo.db"
    # Clear the lru_cache on ``get_settings`` so the next call re-reads env.
    from app.core.config import get_settings

    get_settings.cache_clear()
    reset_engine_for_tests()

    db_path = _resolve_persistent_db_path()
    if db_path is not None and db_path.exists():
        try:
            db_path.unlink()
        except IsADirectoryError:
            pass
    # Also clean the test DB if it exists
    test_db = Path.cwd() / "test_clinical_demo.db"
    if test_db.exists():
        test_db.unlink()

    bootstrap()
    yield


@pytest.fixture
def settings(tmp_path):
    """Per-test settings pointing at a fresh tmp_path SQLite database.

    Tests that need the FastAPI app + per-test DB isolation request this
    fixture (typically transitively via ``client``). The autouse
    ``_clean_db_per_test`` fixture handles teardown of the *persistent* DB;
    tmp_path is cleaned up by pytest itself.
    """
    db_url = f"sqlite:///{tmp_path}/demo.db"
    reset_engine_for_tests(database_url=db_url)
    bootstrap()
    return Settings(
        cohere_api_key=None,
        openrouter_api_key=None,
        openai_api_key=None,
        anthropic_api_key=None,
        google_api_key=None,
        tavily_api_key=None,
        database_url=db_url,
        langsmith_tracing=None,
        langchain_tracing_v2=False,
    )


@pytest.fixture
def store(settings):
    store = HybridStore(settings)
    chunks = chunk_page(
        source_id="nice-ng136",
        title="Hypertension in adults: diagnosis and management",
        source_url="https://example.test/nice.pdf",
        page=12,
        text=(
            "Stage 1 hypertension\n\n"
            "Offer lifestyle advice. Consider drug treatment for adults under 80 with target organ "
            "damage, cardiovascular disease, renal disease, diabetes, or a 10-year cardiovascular "
            "risk of 10 percent or more."
        ),
    )
    store.upsert_chunks(chunks)
    return store


@pytest.fixture
def client(settings, store):
    def override_store():
        return store

    def override_agent():
        return ClinicalRAGAgent(settings, store)

    app.dependency_overrides[get_store] = override_store
    app.dependency_overrides[get_agent] = override_agent
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

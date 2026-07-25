"""Day 28 (post-review) — Factory-selection unit tests for create_store().

Verifies that ``app.retrieval.store.create_store(settings)`` picks the right
backend based on the ``VECTOR_STORE`` env var (``auto`` / ``memory`` / ``pgvector``)
and the ``DATABASE_URL`` scheme — without requiring a live PostgreSQL connection.

Strategy: ``monkeypatch.setattr`` swaps ``app.retrieval.pgvector_store.PgVectorStore``
with a stub class whose ``__init__`` is a no-op and which exposes a
``.last_settings`` attribute for assertion. This lets us exercise the factory
selection logic in CI without a Postgres container.

Test matrix:
    vector_store=\"auto\"     + postgresql URL  → PgVectorStore
    vector_store=\"auto\"     + sqlite URL       → HybridStore
    vector_store=\"auto\"     + legacy postgres:// URL → PgVectorStore
    vector_store=\"pgvector\" + sqlite URL       → PgVectorStore (forced)
    vector_store=\"memory\"   + postgresql URL   → HybridStore (forced)
"""
from __future__ import annotations

from typing import Any

import pytest

from app.core.config import Settings
from app.retrieval.store import HybridStore, create_store


class _StubPgVectorStore:
    """Drop-in replacement for PgVectorStore that does not open a DB connection.

    Records the settings object passed to ``__init__`` so tests can assert
    that the factory passed the correct settings (or None) to the backend.
    """

    last_settings: Settings | None = None
    init_calls: int = 0

    def __init__(self, settings: Settings) -> None:
        _StubPgVectorStore.last_settings = settings
        _StubPgVectorStore.init_calls += 1


@pytest.fixture(autouse=True)
def _reset_stub_state() -> None:
    """Clear the stub class's mutable state between tests."""
    _StubPgVectorStore.last_settings = None
    _StubPgVectorStore.init_calls = 0


@pytest.fixture
def patched_pgvector(monkeypatch: pytest.MonkeyPatch) -> Any:
    """Swap PgVectorStore with the stub for the duration of a test."""
    monkeypatch.setattr(
        "app.retrieval.pgvector_store.PgVectorStore", _StubPgVectorStore
    )
    # create_store() does ``from app.retrieval.pgvector_store import PgVectorStore``
    # lazily inside the function, so patching the source module is enough.
    return _StubPgVectorStore


def _make_settings(database_url: str, vector_store: str) -> Settings:
    """Construct a Settings with custom DATABASE_URL + VECTOR_STORE.

    Uses ``Settings.model_construct(...)`` (no full validation) so the test
    can override the URL prefix without triggering the ``postgres://`` →
    ``postgresql://`` rewrite in ``Settings.__init__``.
    """
    return Settings.model_construct(
        database_url=database_url,
        vector_store=vector_store,
        app_env="test",
        log_level="INFO",
        cors_origins="*",
        embedding_model="embed-v4.0",
        embedding_dim=1536,
        rerank_model="rerank-v3.5",
        generation_model="command-a-03-2025",
        default_alpha=0.55,
        default_top_k=20,
        default_rerank_top_n=6,
        langchain_tracing_v2=False,
        langchain_endpoint="https://api.smith.langchain.com",
        langchain_project="clinical-rag-agent",
        redis_url=None,
        redis_max_connections=50,
        storage_backend="local",
        s3_region="us-east-1",
        uploads_local_root="/tmp/test-uploads",
    )


# ─── auto mode picks based on DATABASE_URL scheme ────────────────────────────

def test_auto_mode_picks_pgvector_for_postgresql_url(patched_pgvector: Any) -> None:
    settings = _make_settings(
        database_url="postgresql://user:pass@localhost:5432/db",
        vector_store="auto",
    )
    store = create_store(settings)
    assert isinstance(store, _StubPgVectorStore)
    assert _StubPgVectorStore.last_settings is settings
    assert _StubPgVectorStore.init_calls == 1


def test_auto_mode_picks_hybridstore_for_sqlite_url(patched_pgvector: Any) -> None:
    settings = _make_settings(
        database_url="sqlite:///./test.db",
        vector_store="auto",
    )
    store = create_store(settings)
    assert isinstance(store, HybridStore)
    assert _StubPgVectorStore.init_calls == 0  # PgVectorStore never constructed


def test_auto_mode_handles_legacy_postgres_prefix(patched_pgvector: Any) -> None:
    """`postgres://` (no 'ql') is the old SQLAlchemy/Heroku prefix; treat as pgvector."""
    settings = _make_settings(
        database_url="postgres://user:pass@localhost:5432/db",
        vector_store="auto",
    )
    store = create_store(settings)
    assert isinstance(store, _StubPgVectorStore)


# ─── explicit mode overrides the URL detection ───────────────────────────────

def test_pgvector_mode_forces_pgvector_even_with_sqlite(patched_pgvector: Any) -> None:
    """``VECTOR_STORE=pgvector`` overrides URL detection — useful for CI."""
    settings = _make_settings(
        database_url="sqlite:///./test.db",
        vector_store="pgvector",
    )
    store = create_store(settings)
    assert isinstance(store, _StubPgVectorStore)


def test_memory_mode_forces_in_memory_even_with_postgres(patched_pgvector: Any) -> None:
    """``VECTOR_STORE=memory`` disables pgvector even when DATABASE_URL is postgres."""
    settings = _make_settings(
        database_url="postgresql://user:pass@localhost:5432/db",
        vector_store="memory",
    )
    store = create_store(settings)
    assert isinstance(store, HybridStore)
    assert _StubPgVectorStore.init_calls == 0


# ─── factory is a pure function of settings ─────────────────────────────────

def test_factory_passes_settings_to_pgvector_backend(patched_pgvector: Any) -> None:
    """Each call hands the same Settings object to the new PgVectorStore.

    This is the actual contract: the factory is a pure function of
    ``settings`` (no caching, no hidden state) and forwards the settings
    to the backend verbatim. Verifying the ``.last_settings`` reference
    proves the backend received the same object the factory chose on.
    """
    settings = _make_settings(
        database_url="postgresql://user:pass@localhost:5432/db",
        vector_store="auto",
    )
    create_store(settings)
    create_store(settings)
    # Both calls should have constructed a fresh PgVectorStore backed by the
    # same settings reference — proving no caching and no settings mutation.
    assert _StubPgVectorStore.init_calls == 2
    assert _StubPgVectorStore.last_settings is settings


def test_factory_supports_unknown_vector_store_value(patched_pgvector: Any) -> None:
    """Unknown values fall back to in-memory HybridStore (safe default)."""
    settings = _make_settings(
        database_url="sqlite:///./test.db",
        vector_store="future-backend",  # unknown
    )
    store = create_store(settings)
    assert isinstance(store, HybridStore)
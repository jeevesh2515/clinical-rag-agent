import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_agent, get_store
from app.core.config import Settings
from app.ingestion.chunker import chunk_page
from app.main import app
from app.retrieval.store import HybridStore
from app.agents.clinical_rag_agent import ClinicalRAGAgent


@pytest.fixture
def settings(tmp_path):
    return Settings(
        cohere_api_key=None,
        pinecone_api_key=None,
        database_url=f"sqlite:///{tmp_path}/demo.db",
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

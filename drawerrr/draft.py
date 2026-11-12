"""Build the synthetic portal draft using the existing Clinical RAG graph."""

from langsmith import tracing_context

from app.agents.clinical_rag_agent import ClinicalRAGAgent
from app.core.config import Settings
from app.ingestion.chunker import chunk_page
from app.retrieval.store import HybridStore

CASE_ID = "htn-002"
QUESTION = "Review this patient's hypertension management."


def draft_evidence(retrieved_text: str | None = None) -> tuple[str, str]:
    """Return the draft and the text of the chunks selected by the graph."""
    settings = Settings(_env_file=None, cohere_api_key=None, database_url="sqlite://")
    store = HybridStore(settings)
    chunks = chunk_page(
        source_id="drawerrr-synthetic",
        title="Synthetic hypertension follow-up notes",
        source_url="https://example.test/htn-follow-up",
        page=1,
        text=retrieved_text if retrieved_text is not None else (
            "Hypertension management follow-up includes a blood pressure review, "
            "medication reconciliation, and review of recent kidney labs."
        ),
    )
    store.upsert_chunks(chunks)
    with tracing_context(enabled=False):
        response = ClinicalRAGAgent(settings, store).invoke(
            QUESTION, alpha=0.55, top_k=5, rerank_top_n=2, case_id=CASE_ID,
        )
    if response.safety.refusal_triggered or len(response.follow_up_plan) < 3:
        raise RuntimeError("Clinical RAG did not produce the synthetic follow-up plan")

    # The opening three plan items are stable across reference dates. The
    # later care-gap details can change when the fixture becomes overdue.
    agenda = "\n".join(f"- {item}" for item in response.follow_up_plan[:3])
    body = f"Synthetic follow-up draft for clinician review\n\n{agenda}"
    selected = {item.chunk_id for item in response.retrieval.results}
    context = "\n".join(chunk.text for chunk in chunks if chunk.chunk_id in selected)
    return body, context


def draft_message(retrieved_text: str | None = None) -> str:
    return draft_evidence(retrieved_text)[0]

from app.agents.citation_validator import build_citations, unsupported_claims_detected
from app.models import Citation


def test_citation_validator_rejects_unsupported_clinical_claims():
    assert unsupported_claims_detected("Treat hypertension with medication.", []) is True


def test_citation_validator_accepts_supported_claims():
    citation = Citation(source_id="s", title="t", page=1, chunk_id="c", quote="q")
    assert unsupported_claims_detected("Treat hypertension with medication.", [citation]) is False


def test_citation_builder_preserves_provenance_metadata():
    candidates = [
        {
            "chunk_id": "nice-ng136:p3:c001",
            "text": "Offer lifestyle advice before initiating drug treatment.",
            "metadata": {
                "source_id": "nice-ng136",
                "title": "Hypertension in adults",
                "page": 3,
                "publication_year": 2019,
                "organization": "NICE",
            },
        }
    ]
    citations = build_citations(candidates, max_quotes=1)
    assert len(citations) == 1
    assert citations[0].chunk_id == "nice-ng136:p3:c001"
    assert citations[0].title == "Hypertension in adults"
    assert citations[0].quote.startswith("Offer lifestyle advice")
    assert citations[0].publication_year == 2019
    assert citations[0].organization == "NICE"
    assert citations[0].source_id == "nice-ng136"
    assert citations[0].page == 3


def test_citation_builder_handles_missing_provenance():
    candidates = [
        {
            "chunk_id": "legacy-doc:p1:c001",
            "text": "Some clinical text without provenance.",
            "metadata": {
                "source_id": "legacy-doc",
                "title": "Legacy Document",
                "page": 1,
            },
        }
    ]
    citations = build_citations(candidates, max_quotes=1)
    assert len(citations) == 1
    assert citations[0].publication_year is None
    assert citations[0].organization == ""


def test_agent_returns_cited_answer(store, settings):
    from app.agents.clinical_rag_agent import ClinicalRAGAgent

    agent = ClinicalRAGAgent(settings, store)
    response = agent.invoke(
        "When should drug treatment be considered for stage 1 hypertension?",
        alpha=0.55,
        top_k=5,
        rerank_top_n=2,
    )
    assert response.citations
    assert response.retrieval.results
    assert response.safety.medical_disclaimer is True
    retrieval_ids = {result.chunk_id for result in response.retrieval.results}
    for citation in response.citations:
        assert citation.chunk_id in retrieval_ids
        assert citation.source_id
        assert citation.title
        assert citation.page > 0
        assert citation.quote
    for result in response.retrieval.results:
        assert isinstance(result.rerank_score, float)


def test_agent_extractive_answer_includes_chunk_references(store, settings):
    from app.agents.clinical_rag_agent import ClinicalRAGAgent

    agent = ClinicalRAGAgent(settings, store)
    response = agent.invoke(
        "When should drug treatment be considered for stage 1 hypertension?",
        alpha=0.55,
        top_k=5,
        rerank_top_n=2,
    )
    assert response.citations
    assert any("[" in response.answer and "]" in response.answer for _ in [0])
    assert response.safety.unsupported_claims_detected is False


def test_agent_routes_guideline_through_retrieve_path(store, settings):
    from app.agents.clinical_rag_agent import ClinicalRAGAgent

    agent = ClinicalRAGAgent(settings, store)
    response = agent.invoke(
        "What are the blood pressure thresholds for stage 2 hypertension?",
        alpha=0.55, top_k=5, rerank_top_n=2,
    )
    assert response.graph_route == "retrieve"
    assert response.intent == "guideline_question"
    assert response.citations
    assert response.retrieval.results


def test_agent_routes_workflow_through_retrieve_path(store, settings):
    from app.agents.clinical_rag_agent import ClinicalRAGAgent

    agent = ClinicalRAGAgent(settings, store)
    response = agent.invoke(
        "What follow-up workflow should be prepared after a BP review?",
        alpha=0.55, top_k=5, rerank_top_n=2,
    )
    assert response.graph_route == "retrieve"
    assert response.intent == "workflow_question"


def test_agent_routes_calculator_through_fast_path(store, settings):
    from app.agents.clinical_rag_agent import ClinicalRAGAgent

    agent = ClinicalRAGAgent(settings, store)
    response = agent.invoke(
        "Calculate BMI for 82 kg and 1.75 m.",
        alpha=0.55, top_k=5, rerank_top_n=2,
    )
    assert response.graph_route == "calculator_fast_path"
    assert response.intent == "calculator_question"
    assert "calculator" in response.tools_used


def test_agent_routes_unsafe_request_to_refuse(store, settings):
    from app.agents.clinical_rag_agent import ClinicalRAGAgent

    agent = ClinicalRAGAgent(settings, store)
    response = agent.invoke(
        "What drug should I take for hypertension?",
        alpha=0.55, top_k=5, rerank_top_n=2,
    )
    assert response.graph_route == "refuse"
    assert response.intent == "unsafe_medical_advice_request"
    assert response.refusal_reason is not None
    assert response.citations == []
    assert response.retrieval.results == []


def test_agent_routes_out_of_domain_to_insufficient(store, settings):
    from app.agents.clinical_rag_agent import ClinicalRAGAgent

    agent = ClinicalRAGAgent(settings, store)
    response = agent.invoke(
        "Who won the world cup?",
        alpha=0.55, top_k=5, rerank_top_n=2,
    )
    assert response.graph_route == "insufficient"
    assert response.intent == "out_of_domain"
    assert response.citations == []
    assert "enough evidence" in response.answer.lower()


def test_agent_tool_trace_respects_cap(store, settings):
    from app.agents.clinical_rag_agent import ClinicalRAGAgent

    agent = ClinicalRAGAgent(settings, store)
    response = agent.invoke(
        "What follow-up workflow after BP review?",
        alpha=0.55, top_k=5, rerank_top_n=2,
    )
    assert len(response.tool_trace) <= 20


def test_agent_validate_claims_node_produces_unsupported_flag(store, settings):
    from app.agents.clinical_rag_agent import ClinicalRAGAgent

    agent = ClinicalRAGAgent(settings, store)
    response = agent.invoke(
        "When should drug treatment be considered for stage 1 hypertension?",
        alpha=0.55, top_k=5, rerank_top_n=2,
    )
    assert response.safety.unsupported_claims_detected is False
    assert response.claim_support


def test_agent_validate_claims_node_skipped_for_refusal(store, settings):
    from app.agents.clinical_rag_agent import ClinicalRAGAgent

    agent = ClinicalRAGAgent(settings, store)
    response = agent.invoke(
        "What drug should I take for hypertension?",
        alpha=0.55, top_k=5, rerank_top_n=2,
    )
    assert response.safety.unsupported_claims_detected is False
    assert response.safety.refusal_triggered is True

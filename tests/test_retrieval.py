from app.ingestion.chunker import TextChunk
from app.retrieval.bm25 import BM25SparseEncoder
from app.retrieval.reranker import Reranker
from app.retrieval.store import HybridStore, minmax_normalize


def _chunk(chunk_id: str, text: str) -> TextChunk:
    return TextChunk(
        chunk_id=chunk_id,
        source_id="test-source",
        title="Test Source",
        page=1,
        section=None,
        text=text,
        source_url="https://example.test/doc.pdf",
        chunk_index=1,
    )


def test_sparse_encoder_is_stable():
    encoder = BM25SparseEncoder().fit(["hypertension drug treatment", "community referral"])
    first = encoder.encode_query("hypertension treatment")
    second = encoder.encode_query("hypertension treatment")
    assert first == second
    assert first["indices"]
    assert first["values"]


def test_minmax_normalize_scales_within_query_set():
    assert minmax_normalize([1.0, 3.0, 5.0]) == [0.0, 0.5, 1.0]
    assert minmax_normalize([2.0, 2.0, 2.0]) == [1.0, 1.0, 1.0]
    assert minmax_normalize([0.0, 0.0, 0.0]) == [0.0, 0.0, 0.0]
    assert minmax_normalize([]) == []


def test_reranker_orders_candidates(settings):
    reranker = Reranker(settings)
    candidates = [
        {"chunk_id": "a", "text": "community referral and lifestyle support"},
        {"chunk_id": "b", "text": "hypertension drug treatment threshold"},
    ]
    results = reranker.rerank("hypertension treatment", candidates, top_n=2)
    assert results[0]["chunk_id"] == "b"
    assert reranker.rerank("x", [], top_n=2) == []


def test_reranker_preserves_upstream_scores(settings):
    reranker = Reranker(settings)
    candidates = [
        {
            "chunk_id": "a",
            "text": "community referral and lifestyle support",
            "dense_score": 0.42,
            "sparse_score": 0.18,
            "hybrid_score": 0.31,
            "metadata": {"source_id": "test"},
        },
        {
            "chunk_id": "b",
            "text": "hypertension drug treatment threshold",
            "dense_score": 0.55,
            "sparse_score": 0.72,
            "hybrid_score": 0.61,
            "metadata": {"source_id": "test"},
        },
    ]
    results = reranker.rerank("hypertension treatment", candidates, top_n=2)
    assert results[0]["chunk_id"] == "b"
    assert results[0]["dense_score"] == 0.55
    assert results[0]["sparse_score"] == 0.72
    assert results[0]["hybrid_score"] == 0.61
    assert results[0]["metadata"]["source_id"] == "test"
    assert isinstance(results[0]["rerank_score"], float)


def test_reranker_limits_top_n(settings):
    reranker = Reranker(settings)
    candidates = [
        {"chunk_id": "a", "text": "hypertension treatment threshold"},
        {"chunk_id": "b", "text": "hypertension drug treatment review"},
        {"chunk_id": "c", "text": "community referral support"},
    ]
    results = reranker.rerank("hypertension treatment", candidates, top_n=1)
    assert len(results) == 1


def test_keyword_query_prefers_exact_term_chunk(settings):
    store = HybridStore(settings)
    store.upsert_chunks(
        [
            _chunk(
                "exact",
                "NICE NG136 stage 1 hypertension drug treatment threshold for adults.",
            ),
            _chunk(
                "generic",
                "Community lifestyle referral and walking program support services.",
            ),
        ]
    )

    results = store.query("NICE NG136 stage 1 hypertension", alpha=0.0, top_k=2)

    assert results[0]["chunk_id"] == "exact"
    assert results[0]["sparse_score"] >= results[1]["sparse_score"]


def test_paraphrase_query_retrieves_relevant_chunk(settings):
    store = HybridStore(settings)
    store.upsert_chunks(
        [
            _chunk(
                "follow-up",
                "Blood pressure follow-up monitoring schedule for adult hypertension review.",
            ),
            _chunk(
                "unrelated",
                "Community walking group referral and nutrition counseling brochure.",
            ),
        ]
    )

    results = store.query("high blood pressure follow-up monitoring", alpha=0.55, top_k=2)

    assert results[0]["chunk_id"] == "follow-up"
    assert results[0]["hybrid_score"] >= results[1]["hybrid_score"]


def test_alpha_changes_ranking_when_dense_and_sparse_disagree(settings):
    store = HybridStore(settings)
    store.upsert_chunks(
        [
            _chunk(
                "keyword-heavy",
                "NG136 NG136 NG136 NG136 stage 1 hypertension threshold criteria.",
            ),
            _chunk(
                "dense-friendly",
                "Blood pressure follow-up monitoring review schedule for adult patients.",
            ),
        ]
    )

    query = "NG136 hypertension follow-up monitoring"
    sparse_first = store.query(query, alpha=0.0, top_k=2)
    dense_first = store.query(query, alpha=1.0, top_k=2)

    assert sparse_first[0]["chunk_id"] == "dense-friendly"
    assert dense_first[0]["chunk_id"] == "keyword-heavy"
    assert sparse_first[0]["chunk_id"] != dense_first[0]["chunk_id"]


def test_retrieval_trace_fields_are_populated(settings):
    store = HybridStore(settings)
    store.upsert_chunks(
        [
            _chunk("a", "Stage 1 hypertension drug treatment threshold."),
            _chunk("b", "Community referral and lifestyle support."),
        ]
    )

    first = store.query("hypertension treatment", alpha=0.55, top_k=2)
    second = store.query("hypertension treatment", alpha=0.55, top_k=2)

    assert first == second
    for result in first:
        assert result["chunk_id"]
        assert isinstance(result["dense_score"], float)
        assert isinstance(result["sparse_score"], float)
        assert isinstance(result["hybrid_score"], float)
        assert 0.0 <= result["hybrid_score"] <= 1.0


def test_bm25_refit_uses_full_corpus_after_incremental_upsert(settings):
    store = HybridStore(settings)
    store.upsert_chunks([_chunk("first", "hypertension stage 1 treatment threshold")])
    store.upsert_chunks([_chunk("second", "community referral lifestyle support")])

    assert store.chunk_count == 2
    results = store.query("community referral", alpha=0.0, top_k=2)
    assert results[0]["chunk_id"] == "second"


def test_hybrid_query_is_deterministic(settings):
    store = HybridStore(settings)
    store.upsert_chunks(
        [
            _chunk("a", "Stage 1 hypertension drug treatment threshold."),
            _chunk("b", "Community referral and lifestyle support."),
        ]
    )

    first = store.query("When should drug treatment be considered?", alpha=0.55, top_k=2)
    second = store.query("When should drug treatment be considered?", alpha=0.55, top_k=2)

    assert [item["chunk_id"] for item in first] == [item["chunk_id"] for item in second]
    assert [item["hybrid_score"] for item in first] == [item["hybrid_score"] for item in second]

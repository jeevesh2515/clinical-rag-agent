def test_ingest_endpoint_returns_manifest_and_indexes_chunks(client, monkeypatch, tmp_path):
    from app.ingestion.chunker import chunk_page
    from app.ingestion.manifest import IngestionManifest, ManifestEntry
    from app.ingestion.pdf_loader import IngestResult

    chunks = chunk_page(
        source_id="test-guideline",
        title="Test Guideline",
        source_url="https://example.test/guideline.pdf",
        page=2,
        text="Stage 2 hypertension requires medication review.",
        organization="Test Org",
        publication_year=2024,
    )
    entries = [
        ManifestEntry(
            source_id="test-guideline",
            title="Test Guideline",
            url="https://example.test/guideline.pdf",
            organization="Test Org",
            publication_year=2024,
            version="v1",
            page_count=1,
            chunk_count=len(chunks),
            content_hash="abc123def456",
            ingested_at="2026-06-29T12:00:00+00:00",
        )
    ]
    saved_manifests: list[IngestionManifest] = []

    def fake_ingest(sources):
        assert len(sources) == 1
        assert sources[0].source_id == "test-guideline"
        return IngestResult(chunks=chunks, entries=entries)

    def capture_manifest(manifest, manifest_dir=tmp_path):
        saved_manifests.append(manifest)
        manifest_dir.mkdir(parents=True, exist_ok=True)
        from app.ingestion.manifest import save_manifest as real_save

        return real_save(manifest, manifest_dir=manifest_dir)

    monkeypatch.setattr("app.api.routes.ingest_sources", fake_ingest)
    monkeypatch.setattr("app.api.routes.build_manifest_id", lambda: "ingest-20260629T120000")
    monkeypatch.setattr("app.api.routes.save_manifest", capture_manifest)

    response = client.post(
        "/ingest",
        json={
            "use_default_sources": False,
            "sources": [
                {
                    "source_id": "test-guideline",
                    "title": "Test Guideline",
                    "url": "https://example.test/guideline.pdf",
                    "organization": "Test Org",
                    "publication_year": 2024,
                    "version": "v1",
                }
            ],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["manifest_id"] == "ingest-20260629T120000"
    assert payload["chunks"] >= 1
    assert "test-guideline" in payload["source_ids"]
    assert len(saved_manifests) == 1
    assert saved_manifests[0].total_chunks == len(chunks)
    assert saved_manifests[0].entries[0].source_id == "test-guideline"
    assert saved_manifests[0].entries[0].chunk_count == len(chunks)


def test_query_citations_trace_to_retrieval_results(client):
    response = client.post(
        "/query",
        json={"question": "When should drug treatment be considered for stage 1 hypertension?"},
    )
    assert response.status_code == 200
    payload = response.json()
    retrieval_ids = {result["chunk_id"] for result in payload["retrieval"]["results"]}
    assert payload["citations"]
    for citation in payload["citations"]:
        assert citation["chunk_id"] in retrieval_ids
        assert citation["source_id"]
        assert citation["title"]
        assert citation["page"] > 0
        assert citation["quote"]


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_documents_endpoint(client):
    response = client.get("/documents")
    assert response.status_code == 200
    assert response.json()["documents"]


def test_sources_endpoint(client):
    response = client.get("/sources")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] >= 3
    assert payload["indexed_count"] >= 1
    source_ids = {source["source_id"] for source in payload["sources"]}
    assert "nice-ng136" in source_ids
    indexed = [source for source in payload["sources"] if source["source_id"] == "nice-ng136"][0]
    assert indexed["indexed"] is True
    assert indexed["chunk_count"] >= 1
    assert indexed["source_type"] == "clinical_guideline"
    assert indexed["title"]


def test_query_rerank_scores_populated(client):
    response = client.post(
        "/query",
        json={
            "question": "When should drug treatment be considered for stage 1 hypertension?",
            "top_k": 5,
            "rerank_top_n": 2,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["retrieval"]["results"]
    assert len(payload["retrieval"]["results"]) <= 2
    for result in payload["retrieval"]["results"]:
        assert result["rerank_score"] >= 0.0
    assert payload["safety"]["unsupported_claims_detected"] is False


def test_query_endpoint_contract(client):
    response = client.post(
        "/query",
        json={"question": "When should drug treatment be considered for stage 1 hypertension?"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"]
    assert payload["citations"]
    assert payload["retrieval"]["alpha"] == 0.55
    assert payload["safety"]["medical_disclaimer"] is True


def test_calculator_tool(client):
    response = client.post("/query", json={"question": "Calculate BMI for 82 kg and 1.75 m."})
    assert response.status_code == 200
    payload = response.json()
    assert "calculator" in payload["tools_used"]
    assert "calculator" in [trace["name"] for trace in payload["tool_trace"]]
    assert payload["intent"] == "calculator_question"
    assert "26.8" in payload["answer"]


def test_query_endpoint_includes_structured_sprint_one_fields(client):
    response = client.post(
        "/query",
        json={
            "question": "When should drug treatment be considered for stage 1 hypertension?",
            "mode": "clinician",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "clinician"
    assert payload["intent"] == "guideline_question"
    assert payload["request_id"]
    assert payload["confidence"] in {"high", "medium", "low", "none"}
    assert payload["claim_support"]
    assert payload["safety"]["consult_licensed_clinician"] is True


def test_query_refuses_prescribing_request(client):
    response = client.post("/query", json={"question": "What drug should I take for hypertension?"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["intent"] == "unsafe_medical_advice_request"
    assert payload["refusal_reason"] == "prescribing_request"
    assert payload["safety"]["refusal_triggered"] is True
    assert payload["safety"]["unsafe_request"] is True
    assert payload["citations"] == []
    assert payload["retrieval"]["results"] == []
    assert "cannot prescribe" in payload["answer"].lower()


def test_query_retrieval_trace_includes_hybrid_scores(client):
    response = client.post(
        "/query",
        json={
            "question": "When should drug treatment be considered for stage 1 hypertension?",
            "alpha": 0.55,
            "top_k": 5,
            "rerank_top_n": 3,
        },
    )
    assert response.status_code == 200
    results = response.json()["retrieval"]["results"]
    assert results
    for result in results:
        assert result["chunk_id"]
        assert isinstance(result["dense_score"], float)
        assert isinstance(result["sparse_score"], float)
        assert isinstance(result["hybrid_score"], float)
        assert isinstance(result["rerank_score"], float)


def test_query_refuses_emergency_triage_request(client):
    response = client.post("/query", json={"question": "Should this patient go to the ER?"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["refusal_reason"] == "emergency_triage_request"
    assert payload["safety"]["refusal_triggered"] is True
    assert "emergency triage" in payload["answer"].lower()

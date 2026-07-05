from app.models import Citation, QueryResponse

CITATION_PROVENANCE_FIELDS = {
    "source_url",
    "source_type",
    "source_version",
    "retrieved_at",
    "review_date",
    "effective_date",
    "license_notes",
}

QUERY_CONTRACT_KEYS = {
    "answer",
    "citations",
    "retrieval",
    "tools_used",
    "safety",
    "mode",
    "intent",
    "refusal_reason",
    "evidence_summary",
    "workflow_considerations",
    "care_gaps",
    "follow_up_plan",
    "patient_education_draft",
    "claim_support",
    "confidence",
    "tool_trace",
    "knowledge_path",
    "request_id",
    "graph_route",
}


def test_query_response_matches_public_contract(client):
    response = client.post(
        "/api/query",
        json={"question": "When should drug treatment be considered for stage 1 hypertension?"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == QUERY_CONTRACT_KEYS
    assert response.headers["X-Request-ID"] == payload["request_id"]

    validated = QueryResponse.model_validate(payload)
    assert validated.answer
    assert validated.request_id
    assert validated.safety.consult_licensed_clinician is True

    if validated.citations:
        for citation in validated.citations:
            citation_dict = citation.model_dump()
            for field in CITATION_PROVENANCE_FIELDS:
                assert field in citation_dict, f"Citation missing provenance field: {field}"

    # Verify Citation model serializes all provenance fields
    citation = Citation(
        source_id="test",
        title="Test",
        source_url="https://example.com",
        page=1,
        chunk_id="chunk-1",
        quote="test quote",
        source_type="clinical_guideline",
        source_version="v1",
        retrieved_at="2026-07-05T00:00:00Z",
        review_date="2026-01-01",
        effective_date="2026-01-01",
        license_notes="CC-BY",
    )
    citation_dict = citation.model_dump()
    for field in CITATION_PROVENANCE_FIELDS:
        assert field in citation_dict and citation_dict[field], f"Citation provenance field not set: {field}"


def test_query_accepts_caller_request_id(client):
    request_id = "contract-test-request-id"

    response = client.post(
        "/api/query",
        headers={"X-Request-ID": request_id},
        json={"question": "When should drug treatment be considered for stage 1 hypertension?"},
    )

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == request_id
    assert response.json()["request_id"] == request_id


def test_query_validation_errors_are_structured_and_traceable(client):
    response = client.post("/api/query", json={"question": ""})

    assert response.status_code == 422
    payload = response.json()
    assert set(payload) == {"error"}
    assert payload["error"]["code"] == "validation_error"
    assert payload["error"]["message"] == "Request validation failed."
    assert payload["error"]["request_id"] == response.headers["X-Request-ID"]
    assert payload["error"]["details"]
    assert payload["error"]["details"][0]["field"].startswith("body.question")


def test_query_rejects_unknown_request_fields(client):
    response = client.post(
        "/api/query",
        json={
            "question": "When should drug treatment be considered for stage 1 hypertension?",
            "unknown_frontend_field": True,
        },
    )

    assert response.status_code == 422
    detail = response.json()["error"]["details"][0]
    assert detail["field"] == "body.unknown_frontend_field"
    assert detail["type"] == "extra_forbidden"


def test_query_rejects_rerank_top_n_greater_than_top_k(client):
    response = client.post(
        "/api/query",
        json={
            "question": "When should drug treatment be considered for stage 1 hypertension?",
            "top_k": 3,
            "rerank_top_n": 4,
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["type"] == "value_error"


def test_openapi_documents_public_contracts(client):
    response = client.get("/openapi.json")

    assert response.status_code == 200
    schemas = response.json()["components"]["schemas"]
    for schema_name in [
        "QueryRequest",
        "QueryResponse",
        "Citation",
        "RetrievalTrace",
        "SafetyFlags",
        "ToolTrace",
        "ClaimSupport",
        "ApiErrorResponse",
    ]:
        assert schema_name in schemas


def test_docs_endpoint_loads(client):
    response = client.get("/docs")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]

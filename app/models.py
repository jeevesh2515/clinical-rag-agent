from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

QueryMode = Literal["patient", "clinician"]
QueryIntentLabel = Literal[
    "guideline_question",
    "workflow_question",
    "calculator_question",
    "unsafe_medical_advice_request",
    "insufficient_evidence",
    "out_of_domain",
]
OKFSourceType = Literal["okf", "rag"]
ClaimSupportType = Literal[
    "direct_guideline_support", "inferred_workflow_suggestion", "unsupported_claim"
]
ConfidenceLabel = Literal["high", "medium", "low", "none"]
ApiErrorCode = Literal["validation_error"]


class Citation(BaseModel):
    source_id: str = Field(description="Stable source identifier for the cited document.")
    title: str = Field(description="Human-readable source title.")
    page: int = Field(description="Page number where the cited quote appears.")
    chunk_id: str = Field(description="Stable retrieval chunk identifier backing the citation.")
    quote: str = Field(description="Exact source quote used to support the answer.")
    publication_year: int | None = Field(
        default=None,
        description="Year the source document was published (for provenance tracking).",
    )
    organization: str = Field(
        default="",
        description="Publishing organization name (for provenance tracking).",
    )


class RetrievalResultModel(BaseModel):
    chunk_id: str = Field(description="Retrieved chunk identifier.")
    dense_score: float = Field(default=0.0, description="Dense/vector retrieval score.")
    sparse_score: float = Field(default=0.0, description="Sparse/BM25 retrieval score.")
    hybrid_score: float = Field(
        default=0.0,
        description="Combined hybrid score after per-query min-max normalization.",
    )
    rerank_score: float = Field(default=0.0, description="Final reranker score.")


class RetrievalTrace(BaseModel):
    alpha: float = Field(description="Hybrid retrieval weighting used for this request.")
    top_k: int = Field(description="Number of initial retrieval candidates requested.")
    rerank_top_n: int = Field(description="Number of candidates retained after reranking.")
    results: list[RetrievalResultModel] = Field(
        default_factory=list,
        description="Reranked retrieval results exposed for traceability.",
    )


class SafetyFlags(BaseModel):
    medical_disclaimer: bool = Field(
        default=True,
        description="Whether the response includes educational-use medical disclaimer behavior.",
    )
    consult_licensed_clinician: bool = Field(
        default=True,
        description="Whether the response requires consulting a licensed clinician.",
    )
    requires_clinician_review: bool = Field(
        default=True,
        description="Whether the response requires clinician review before care decisions.",
    )
    unsupported_claims_detected: bool = Field(
        default=False,
        description="Whether the claim/citation validator detected unsupported clinical claims.",
    )
    unsafe_request: bool = Field(
        default=False,
        description="Whether the request asked for unsafe medical advice.",
    )
    refusal_triggered: bool = Field(
        default=False,
        description="Whether the safety policy produced a refusal response.",
    )
    prompt_injection_detected: bool = Field(
        default=False,
        description="Whether prompt-injection-like instructions were detected.",
    )


class ToolTrace(BaseModel):
    name: str = Field(description="Deterministic tool name.")
    input_summary: str = Field(description="Short summary of the tool input.")
    output_summary: str = Field(description="Short summary of the tool output.")


class ClaimSupport(BaseModel):
    claim: str = Field(description="Summary of the answer claim being labeled.")
    support_type: ClaimSupportType = Field(
        description="Whether the claim is directly supported, inferred from workflow tooling, or unsupported."
    )
    citation_chunk_ids: list[str] = Field(
        default_factory=list,
        description="Chunk IDs supporting this claim when available.",
    )
    rationale: str = Field(description="Explanation for the support label.")


class QueryRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        json_schema_extra={
            "examples": [
                {
                    "question": "When should drug treatment be considered for stage 1 hypertension?",
                    "mode": "patient",
                    "case_id": None,
                    "include_patient_education": False,
                    "alpha": 0.55,
                    "top_k": 20,
                    "rerank_top_n": 6,
                }
            ]
        },
    )

    question: str = Field(
        min_length=2,
        max_length=2000,
        description="Clinical workflow or guideline question. Do not include real PHI in the demo app.",
        examples=["When should drug treatment be considered for stage 1 hypertension?"],
    )
    mode: QueryMode = Field(
        default="patient",
        description="Response style: plain-language patient education or clinician/care-team summary.",
    )
    case_id: str | None = Field(
        default=None,
        max_length=120,
        description="Synthetic case identifier. Real patient identifiers are not supported in the demo.",
    )
    include_patient_education: bool = Field(
        default=False,
        description="Whether to include a patient education draft for clinician review.",
    )
    alpha: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Optional hybrid retrieval alpha override. Uses service default when omitted.",
    )
    top_k: int | None = Field(
        default=None,
        ge=1,
        le=100,
        description="Optional number of initial retrieval candidates. Uses service default when omitted.",
    )
    rerank_top_n: int | None = Field(
        default=None,
        ge=1,
        le=20,
        description="Optional number of results to keep after reranking. Uses service default when omitted.",
    )

    @model_validator(mode="after")
    def validate_rerank_limit(self) -> "QueryRequest":
        if self.top_k is not None and self.rerank_top_n is not None:
            if self.rerank_top_n > self.top_k:
                raise ValueError("rerank_top_n must be less than or equal to top_k")
        return self


class OKFConceptRef(BaseModel):
    source_path: str = Field(description="OKF concept file path")
    title: str = Field(default="", description="Concept title")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    citation_url: str = Field(default="", description="Canonical source URL")
    source_type: OKFSourceType = Field(default="okf")


class KnowledgePathInfo(BaseModel):
    path: str = Field(description="Routing path: okf, rag, or okf_then_rag")
    reason: str = Field(default="", description="Routing rationale")
    okf_concepts: list[OKFConceptRef] = Field(default_factory=list)
    rag_sources: list[str] = Field(default_factory=list)


class QueryResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "answer": "Educational workflow support answer with citations.",
                    "citations": [],
                    "retrieval": {"alpha": 0.55, "top_k": 20, "rerank_top_n": 6, "results": []},
                    "tools_used": [],
                    "safety": {
                        "medical_disclaimer": True,
                        "consult_licensed_clinician": True,
                        "requires_clinician_review": True,
                        "unsupported_claims_detected": False,
                        "unsafe_request": False,
                        "refusal_triggered": False,
                        "prompt_injection_detected": False,
                    },
                    "mode": "patient",
                    "intent": "guideline_question",
                    "refusal_reason": None,
                    "evidence_summary": None,
                    "workflow_considerations": [],
                    "care_gaps": [],
                    "follow_up_plan": [],
                    "patient_education_draft": None,
                    "claim_support": [],
                    "confidence": "medium",
                    "tool_trace": [],
                    "request_id": "00000000-0000-0000-0000-000000000000",
                }
            ]
        }
    )

    answer: str = Field(description="Final educational or workflow-support response.")
    citations: list[Citation] = Field(description="Cited source passages supporting the answer.")
    retrieval: RetrievalTrace = Field(description="Retrieval and reranking trace for auditability.")
    tools_used: list[str] = Field(
        description="Names of deterministic tools used during the request."
    )
    safety: SafetyFlags = Field(description="Safety and refusal flags for the response.")
    mode: QueryMode = Field(default="patient", description="Response mode used for generation.")
    intent: QueryIntentLabel = Field(
        default="guideline_question",
        description="Safety/intent classification assigned before retrieval or generation.",
    )
    refusal_reason: str | None = Field(
        default=None,
        description="Machine-readable refusal reason when a safety refusal is triggered.",
    )
    evidence_summary: str | None = Field(
        default=None,
        description="Short summary of retrieved evidence used for the answer.",
    )
    workflow_considerations: list[str] = Field(
        default_factory=list,
        description="Care-team workflow considerations inferred from evidence and tools.",
    )
    care_gaps: list[str] = Field(
        default_factory=list,
        description="Detected care gaps. Populated by later synthetic-case phases.",
    )
    follow_up_plan: list[str] = Field(
        default_factory=list,
        description="Suggested follow-up preparation steps. Must remain clinician-review required.",
    )
    patient_education_draft: str | None = Field(
        default=None,
        description="Optional plain-language draft intended for clinician review before patient use.",
    )
    claim_support: list[ClaimSupport] = Field(
        default_factory=list,
        description="Claim-level support labels for answer auditability.",
    )
    confidence: ConfidenceLabel = Field(
        default="medium",
        description="Coarse confidence label based on retrieved support, tool output, and safety checks.",
    )
    tool_trace: list[ToolTrace] = Field(
        default_factory=list,
        description="Visible deterministic tool trace for debugging and auditability.",
    )
    knowledge_path: KnowledgePathInfo | None = Field(
        default=None,
        description="OKF vs RAG knowledge routing info.",
    )
    request_id: str | None = Field(
        default=None,
        description="Trace identifier assigned at the API boundary.",
    )
    graph_route: str | None = Field(
        default=None,
        description="LangGraph routing path taken for this request (refuse, insufficient, retrieve, calculator_fast_path).",
    )


class ApiErrorDetail(BaseModel):
    field: str = Field(description="Dot-separated request field path that failed validation.")
    message: str = Field(description="Human-readable validation error message.")
    type: str = Field(description="Pydantic/FastAPI validation error type.")


class ApiError(BaseModel):
    code: ApiErrorCode = Field(description="Machine-readable API error code.")
    message: str = Field(description="Human-readable API error summary.")
    details: list[ApiErrorDetail] = Field(description="Field-level validation errors.")
    request_id: str = Field(description="Trace identifier for this failed request.")


class ApiErrorResponse(BaseModel):
    error: ApiError = Field(description="Structured API error payload.")


class IngestSource(BaseModel):
    source_id: str
    title: str
    url: str
    organization: str = Field(
        default="",
        description="Publishing organization responsible for the source document.",
    )
    publication_year: int | None = Field(
        default=None,
        description="Year the source document was published.",
    )
    version: str | None = Field(
        default=None,
        description="Document version or edition identifier.",
    )


class IngestRequest(BaseModel):
    use_default_sources: bool = True
    sources: list[IngestSource] = Field(default_factory=list)


class IngestResponse(BaseModel):
    documents: int
    chunks: int
    source_ids: list[str]
    manifest_id: str | None = Field(
        default=None,
        description="Ingestion manifest identifier for audit trail lookup.",
    )


class SourceMetadata(BaseModel):
    source_id: str = Field(description="Stable source identifier.")
    title: str = Field(description="Human-readable source title.")
    source_url: str = Field(default="", description="Canonical public URL for the source document.")
    domain: str = Field(default="", description="Source domain extracted from the URL.")
    source_type: str = Field(
        default="clinical_guideline",
        description="Source category such as clinical_guideline or synthetic_note.",
    )
    publication_year: int | None = Field(default=None, description="Year the source was published.")
    guideline_version: str | None = Field(
        default=None,
        description="Guideline version or edition identifier when available.",
    )
    organization: str = Field(default="", description="Publishing organization.")
    indexed: bool = Field(
        default=False,
        description="Whether the source currently has chunks in the retrieval index.",
    )
    chunk_count: int = Field(default=0, description="Number of indexed chunks for this source.")
    page_count: int | None = Field(default=None, description="Page count from the latest ingest manifest.")
    content_hash: str | None = Field(
        default=None,
        description="SHA-256 hash of the raw document from the latest ingest manifest.",
    )
    last_ingested_at: str | None = Field(
        default=None,
        description="Timestamp of the most recent successful ingest for this source.",
    )
    last_manifest_id: str | None = Field(
        default=None,
        description="Manifest identifier for the most recent ingest of this source.",
    )
    license_notes: str | None = Field(
        default=None,
        description="License or redistribution notes for auditability.",
    )


class SourcesResponse(BaseModel):
    sources: list[SourceMetadata] = Field(description="Registered and indexed clinical knowledge sources.")
    total: int = Field(description="Total number of sources returned.")
    indexed_count: int = Field(description="Number of sources with at least one indexed chunk.")

import json
from pathlib import Path

from fastapi import APIRouter, Depends, Request

from app.agents.clinical_rag_agent import ClinicalRAGAgent
from app.api.dependencies import get_agent, get_knowledge_interface, get_store
from app.cases.synthetic_cases import list_cases
from app.core.config import get_settings
from app.evaluation.run import run_full_evaluation
from app.ingestion.manifest import IngestionManifest, build_manifest_id, save_manifest
from app.ingestion.pdf_loader import ingest_sources
from app.ingestion.source_registry import build_source_registry
from app.ingestion.sources import DEFAULT_SOURCES
from app.models import ApiErrorResponse, IngestRequest, IngestResponse, QueryRequest, QueryResponse, SourcesResponse
from app.okf.interface import KnowledgeInterface
from app.retrieval.store import HybridStore

router = APIRouter()


def request_id_from(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


@router.get("/health", tags=["system"])
def health(
    request: Request,
    store: HybridStore = Depends(get_store),
    knowledge: KnowledgeInterface | None = Depends(get_knowledge_interface),
) -> dict:
    okf_info = None
    if knowledge:
        okf_info = {
            "available": True,
            "concepts": len(knowledge._okf.get_concept_map()),
        }
    return {
        "status": "ok",
        "documents": store.document_count,
        "chunks": store.chunk_count,
        "okf": okf_info or {"available": False},
        "request_id": request_id_from(request),
    }


@router.post("/ingest", response_model=IngestResponse, tags=["ingestion"])
def ingest(request: IngestRequest, store: HybridStore = Depends(get_store)) -> IngestResponse:
    sources = list(request.sources)
    if request.use_default_sources:
        sources.extend(DEFAULT_SOURCES)
    result = ingest_sources(sources)
    store.upsert_chunks(result.chunks)

    manifest_id = build_manifest_id()
    manifest = IngestionManifest(
        manifest_id=manifest_id,
        ingested_at=result.entries[0].ingested_at if result.entries else "",
        entries=result.entries,
        total_chunks=len(result.chunks),
        total_documents=len({chunk.source_id for chunk in result.chunks}),
    )
    save_manifest(manifest)

    return IngestResponse(
        documents=len({chunk.source_id for chunk in result.chunks}),
        chunks=len(result.chunks),
        source_ids=sorted({chunk.source_id for chunk in result.chunks}),
        manifest_id=manifest_id,
    )


@router.post(
    "/query",
    response_model=QueryResponse,
    tags=["query"],
    responses={
        422: {
            "model": ApiErrorResponse,
            "description": "Structured request validation error.",
        }
    },
    summary="Ask a guideline-grounded clinical workflow question.",
)
def query(
    payload: QueryRequest,
    request: Request,
    agent: ClinicalRAGAgent = Depends(get_agent),
) -> QueryResponse:
    settings = get_settings()
    return agent.invoke(
        payload.question,
        alpha=payload.alpha if payload.alpha is not None else settings.default_alpha,
        top_k=payload.top_k if payload.top_k is not None else settings.default_top_k,
        rerank_top_n=(
            payload.rerank_top_n
            if payload.rerank_top_n is not None
            else settings.default_rerank_top_n
        ),
        mode=payload.mode,
        case_id=payload.case_id,
        include_patient_education=payload.include_patient_education,
        request_id=request_id_from(request),
    )


@router.get("/documents", tags=["documents"])
def documents(store: HybridStore = Depends(get_store)) -> dict:
    return {"documents": store.list_documents()}


@router.get("/sources", response_model=SourcesResponse, tags=["documents"])
def sources(store: HybridStore = Depends(get_store)) -> SourcesResponse:
    registry = build_source_registry(store)
    indexed_count = sum(1 for source in registry if source.indexed)
    return SourcesResponse(sources=registry, total=len(registry), indexed_count=indexed_count)


@router.post("/eval/run", tags=["evaluation"])
def eval_run() -> dict:
    output_path = Path("data/eval/results.json")
    result = run_full_evaluation(output_path, ingest_defaults=False)
    return result


@router.get("/eval/results", tags=["evaluation"])
def eval_results() -> dict:
    path = Path("data/eval/results.json")
    if not path.exists():
        return {"status": "missing", "results": None}
    return {"status": "ok", "results": json.loads(path.read_text())}


@router.get("/cases", tags=["cases"])
def list_all_cases() -> dict:
    return {"cases": list_cases(), "total": len(list_cases())}

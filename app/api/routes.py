import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from app.auth.routes import router as auth_router
from app.chat.routes import router as chat_router
from app.uploads.routes import router as uploads_router

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
from app.llm import DEFAULT_MODEL_ID, list_models_for_api
from app.core.rate_limiter import limiter

router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
router.include_router(chat_router, prefix="/chat", tags=["Chat"])
router.include_router(uploads_router, prefix="", tags=["Uploads"])


def request_id_from(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


@router.get("/warmup", tags=["system"])
async def warmup(request: Request):
    """Vercel CRON keep-warm endpoint.

    Pinging this periodically keeps the serverless function from cold-starting
    as often, which means the SQLite database stays alive longer.
    """
    return {"status": "warm", "request_id": request_id_from(request)}


@router.get("/health", tags=["system"])
def health(
    request: Request,
    store: object = Depends(get_store),
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


@router.get("/ready", tags=["system"])
def ready(
    request: Request,
    store: object = Depends(get_store),
    knowledge: KnowledgeInterface | None = Depends(get_knowledge_interface),
) -> dict:
    """Readiness probe for deployment platforms (Vercel, K8s).

    Returns 200 when the DB is initialised and the OKF bundle is loaded.
    Returns 503 with a details dict when either is unavailable.
    """
    from fastapi.responses import JSONResponse

    issues: list[str] = []

    # DB check — confirm we can execute a trivial query
    try:
        from app.db import SessionLocal
        with SessionLocal() as db:
            db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:
        db_status = f"error: {exc}"
        issues.append("db")

    # OKF check — confirm at least one concept is loaded
    okf_count = 0
    if knowledge:
        try:
            okf_count = len(knowledge._okf.get_concept_map())
        except Exception:
            pass
    okf_status = okf_count if okf_count else "unavailable"
    if okf_count == 0:
        issues.append("okf")

    payload = {
        "status": "ready" if not issues else "not_ready",
        "db": db_status,
        "okf": okf_status,
        "request_id": request_id_from(request),
    }
    if issues:
        return JSONResponse(status_code=503, content=payload)
    return payload


@router.post("/ingest", response_model=IngestResponse, tags=["ingestion"])
@limiter.limit("10/minute")
def ingest(request: Request, ingest_request: IngestRequest, store: object = Depends(get_store)) -> IngestResponse:
    sources = list(ingest_request.sources)
    if ingest_request.use_default_sources:
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
@limiter.limit("30/minute")
def query(
    payload: QueryRequest,
    request: Request,
    agent: ClinicalRAGAgent = Depends(get_agent),
) -> QueryResponse:
    settings = get_settings()
    # Personalisation: only available for authenticated callers.
    user_id = getattr(request.state, "user_id", None)
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
        user_id=user_id,
        model_id=payload.model_id,
    )

@router.post(
    "/query/stream",
    tags=["query"],
    summary="Streaming variant of /query that emits SSE events for progressive UX.",
    response_class=StreamingResponse,
)
@limiter.limit("20/minute")
def query_stream(
    payload: QueryRequest,
    request: Request,
    agent: ClinicalRAGAgent = Depends(get_agent),
) -> StreamingResponse:
    """Run the clinical RAG pipeline and stream the result as Server-Sent Events.

    Event types emitted:
    - ``status``     — pipeline started
    - ``token``      — the final answer text (emitted as a single chunk when ready)
    - ``citation``   — one JSON-serialised Citation per cited source
    - ``tool_trace`` — tool call summary
    - ``latency``    — per-node latency breakdown
    - ``done``       — terminal event with request_id and graph_route
    """
    _log = logging.getLogger(__name__)
    settings = get_settings()
    user_id = getattr(request.state, "user_id", None)
    request_id = request_id_from(request)

    def _event(event_type: str, data: object) -> str:
        return f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"

    def generate():
        yield _event("status", {"status": "processing", "request_id": request_id})
        try:
            response = agent.invoke(
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
                request_id=request_id,
                user_id=user_id,
                model_id=payload.model_id,
            )
            yield _event("token", {"text": response.answer})
            for citation in response.citations:
                yield _event("citation", citation.model_dump())
            for tool in response.tool_trace:
                yield _event("tool_trace", tool.model_dump())
            if response.latency_ms:
                yield _event("latency", response.latency_ms)
            yield _event(
                "done",
                {
                    "request_id": response.request_id,
                    "graph_route": response.graph_route,
                    "intent": response.intent,
                    "confidence": response.confidence,
                },
            )
        except Exception as exc:
            _log.exception("stream_error request_id=%s", request_id)
            yield _event("error", {"message": str(exc), "request_id": request_id})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Request-ID": request_id or "",
        },
    )



@router.get("/documents", tags=["documents"])
def documents(store: object = Depends(get_store)) -> dict:
    return {"documents": store.list_documents()}


@router.get("/sources", response_model=SourcesResponse, tags=["documents"])
def sources(store: object = Depends(get_store)) -> SourcesResponse:
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


@router.get("/models", tags=["models"])
def list_available_models() -> dict:
    """Return the catalogue of LLM models the frontend can pick from.

    Each entry includes an ``is_configured`` flag so the UI can show "Set
    OPENAI_API_KEY to enable" hints when a provider isn't usable on the
    current deployment.
    """
    settings = get_settings()
    return {
        "models": list_models_for_api(settings),
        "default_model": DEFAULT_MODEL_ID,
    }

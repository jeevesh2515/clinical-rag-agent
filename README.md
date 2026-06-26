# Clinical Evidence RAG Agent

A production-style HealthTech RAG backend that ingests real clinical guideline PDFs, chunks them with citation metadata, stores dense and sparse retrieval signals, performs hybrid search, reranks with Cohere, and answers with grounded citations.

This is a portfolio project. It does not provide medical advice and must not be used as a clinical decision-support system with real patients.

## Stack

- FastAPI API service
- LangGraph agent workflow
- LangChain-compatible document processing
- Pinecone hybrid retrieval
- BM25 sparse retrieval
- Cohere `embed-v4.0`, `rerank-v3.5`, and Command model generation
- RAGAS evaluation harness and notebook
- Tool layer: web search, calculator, and demo clinical workflow DB lookup

## Quick Start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs`.

Without API keys, the app runs in local demo mode with deterministic embeddings, in-memory retrieval, lexical reranking, and extractive answers. With keys, it uses Pinecone and Cohere.

## Local Source Documents

Downloaded guideline PDFs are kept local by default and are not committed to the repository until redistribution licenses are explicitly verified.

Canonical local raw-document folder:

```text
data/source_documents/raw/
```

Generated/derived ingestion outputs should use:

```text
data/source_documents/processed/
data/source_documents/manifests/
```

These folders are ignored by Git, except for lightweight placeholders and documentation. The source registry and ingestion code should be tracked; raw downloaded PDFs should remain local unless their license clearly permits redistribution.

The legacy `data/pdfs/` path remains ignored as a safety net, but new ingestion/cache behavior uses `data/source_documents/raw/`.

## Environment

```bash
PINECONE_API_KEY=
PINECONE_INDEX_NAME=clinical-rag-hybrid
COHERE_API_KEY=
TAVILY_API_KEY=
DATABASE_URL=sqlite:///./clinical_demo.db
CORS_ORIGINS=            # Comma-separated allowed origins; empty = no cross-origin
```

## Security Features

- **API key protection**: All credential fields (`cohere_api_key`, `pinecone_api_key`, `tavily_api_key`, `database_url`) use `repr=False` in Pydantic settings to prevent leakage in logs and error traces.
- **CORS**: Config-driven via `CORS_ORIGINS` env var. Empty by default — no cross-origin requests allowed until explicitly configured.
- **Request body limit**: 256 KB default with structured 413 response for oversized payloads.
- **SSRF prevention**: PDF download URLs are validated against private/reserved IP ranges and localhost before connection. Scheme is restricted to HTTPS.
- **Download size cap**: PDF downloads are limited to 100 MB with pre-flight `Content-Length` check and streaming byte counter.
- **Logging safety**: Third-party HTTP/SDK loggers (`httpx`, `httpcore`, `openai`, `cohere`, `urllib3`) are suppressed to `WARNING` to avoid leaking API keys or request bodies in debug output.
- **Container security**: Dockerfile runs as a non-root `app` user with Python 3.12-slim base.
- **Prompt-injection defense**: Agent generation prompts explicitly mark retrieved context and tool notes as untrusted data.

## Ingestion Metadata and Audit Trail

Each `/ingest` call writes a manifest JSON to `data/source_documents/manifests/ingest-{timestamp}.json` containing:

- Per-source metadata (`organization`, `publication_year`, `version`)
- SHA-256 content hash of each downloaded PDF
- Page count and chunk count per source
- Ingestion timestamp

Default sources are enriched with publishing organization and year:

| Source | Organization | Year |
|---|---|---|
| NICE NG136 | National Institute for Health and Care Excellence | 2019 |
| WHO pharmacological treatment | World Health Organization | 2021 |
| CDC community-clinical linkages | U.S. Centers for Disease Control and Prevention | 2020 |

Citation responses include `publication_year` and `organization` fields for provenance tracking.

## Hybrid Retrieval

The retrieval layer combines dense (embedding) and sparse (BM25) signals:

```text
hybrid_score = alpha * dense_norm + (1 - alpha) * sparse_norm
```

- **Dense retrieval** matches meaning and paraphrases (e.g. “high blood pressure follow-up” → “hypertension review”).
- **Sparse retrieval** matches exact clinical terms, acronyms, and guideline IDs (e.g. “NICE NG136”).
- **Per-query min-max normalization** makes dense and sparse scores comparable before fusion.
- Default `alpha=0.55` balances both signals; override via `/query` request body.

`/query` retrieval traces expose `dense_score`, `sparse_score`, `hybrid_score`, and `rerank_score` per chunk for debugging.

Example alpha comparison:

```bash
# Sparse-heavy (keyword matching)
curl -X POST http://127.0.0.1:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What does NICE NG136 say about stage 1 hypertension?", "alpha": 0.0}'

# Dense-heavy (semantic matching)
curl -X POST http://127.0.0.1:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What follow-up workflow should be prepared after a BP review?", "alpha": 1.0}'
```

Without API keys, deterministic local embeddings and in-memory BM25 keep retrieval testable in CI.

## Reranking And Grounded Generation

Two-stage retrieval narrows hybrid candidates before generation:

```text
Hybrid retrieval (top_k) → Reranker (rerank_top_n) → Grounded generation
```

- **Cohere rerank-v3.5** scores query-document relevance when `COHERE_API_KEY` is set.
- **Local lexical fallback** uses token overlap — deterministic and CI-friendly.
- **Cohere Command generation** produces cited answers from `<retrieved_context>` when keys are available.
- **Extractive fallback** concatenates top reranked snippets with `[chunk_id]` references.

Citation validation flags:

- clinical language without citations
- recommendation language without `[chunk_id]` references in the answer text

## Source Registry

`GET /sources` returns auditable metadata for all registered clinical guideline sources:

- organization, publication year, guideline version
- indexed status and chunk count from the live retrieval store
- last ingest timestamp and manifest ID from ingestion manifests

The frontend **Sources** tab displays this registry with indexing status and provenance.

```bash
curl http://127.0.0.1:8000/sources
```

## Demo Flow

```bash
# Ingest returns manifest_id for audit trail lookup
curl -X POST http://127.0.0.1:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"use_default_sources": true}'

curl -X POST http://127.0.0.1:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "When should drug treatment be considered for stage 1 hypertension?", "mode": "patient"}'
```

`/query` now supports a safety-first structured request:

```json
{
  "question": "What follow up workflow should be prepared after a BP review?",
  "mode": "patient",
  "case_id": null,
  "include_patient_education": false
}
```

Supported modes are `patient` and `clinician`. The agent classifies each query before retrieval/generation as one of: `guideline_question`, `workflow_question`, `calculator_question`, `unsafe_medical_advice_request`, `insufficient_evidence`, or `out_of_domain`.

## Safety-First Behavior

The agent refuses unsafe medical-advice requests before retrieval or generation, including requests to diagnose, prescribe, recommend medication doses, provide emergency triage, ignore symptoms, or bypass safety guardrails.

Example refusal demo:

```bash
curl -X POST http://127.0.0.1:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What drug should I take for hypertension?"}'
```

Structured responses include the original answer/citation fields plus `mode`, `intent`, `refusal_reason`, `confidence`, `claim_support`, `tool_trace`, `request_id`, and expanded `safety` flags. Every clinical answer remains educational workflow support and includes a consult-licensed-clinician boundary.

## Evaluation

```bash
python -m app.evaluation.run \
  --dataset data/eval/golden_questions.jsonl \
  --out data/eval/results.json
```

The RAGAS path is used when evaluator dependencies and model credentials are available. Otherwise, the harness writes deterministic lexical proxy metrics so the project remains testable locally.

To ingest the default public PDFs and evaluate in one command:

```bash
python -m app.evaluation.run \
  --dataset data/eval/golden_questions.jsonl \
  --out data/eval/results.json \
  --ingest-defaults
```

## Initial Public Sources

- NICE NG136: Hypertension in adults
- WHO: Pharmacological treatment of hypertension in adults
- CDC: Community-clinical linkages practitioner guide

## Frontend

A polished React + Vite + TypeScript + Tailwind CSS frontend is included in `frontend/`.

### Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server automatically proxies API calls to the backend at `http://127.0.0.1:8000`.

Make sure the backend CORS allows `http://localhost:5173` (default in `.env.example`).

### Frontend Features

- **Dark-mode first** medical-grade UI with glassmorphism panels
- **Patient / Clinician mode** toggle with tailored responses
- **Synthetic case selector** for demo workflows
- **Rich citations panel** with expandable source quotes and provenance
- **Tool trace visualization** showing agent reasoning steps
- **Safety flags dashboard** with real-time refusal detection
- **Retrieval telemetry** showing dense, sparse, hybrid, and rerank scores
- **Source registry panel** with indexing status and provenance metadata
- **Evaluation dashboard** for RAGAS quality metrics

## Tests

Recommended local validation:

```bash
.venv/bin/python -m pytest
.venv/bin/python -m ruff check .
uvx pyright
```

If you are not using `uv`, install the project with dev extras first:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest
```

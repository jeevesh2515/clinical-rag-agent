<div align="center">

# 🏥 Clinical Workflows

**Production-Grade Agentic RAG for Hypertension Care**

Evidence-based clinical workflow assistant — combining hybrid retrieval, curated knowledge, LangGraph orchestration, and safety-first guardrails.

---

[![Live Demo](https://img.shields.io/badge/demo-clinical--workflows.vercel.app-0ea5e9?style=for-the-badge&logo=vercel&logoColor=white)](https://clinical-workflows.vercel.app)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![LangGraph](https://img.shields.io/badge/LangGraph-✓-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraph)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

[![Tests](https://img.shields.io/badge/tests-199%20passing-22c55e?style=flat-square&logo=pytest&logoColor=white)](https://github.com/)
[![Ruff](https://img.shields.io/badge/linting-ruff-ffb703?style=flat-square&logo=ruff&logoColor=white)]()
[![Pyright](https://img.shields.io/badge/type%20check-pyright-3178C6?style=flat-square&logo=python&logoColor=white)]()
[![OKF](https://img.shields.io/badge/OKF-27%20concepts-8b5cf6?style=flat-square&logo=markdown&logoColor=white)]()
[![Vercel](https://img.shields.io/badge/deployed-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)]()
[![License](https://img.shields.io/badge/license-MIT-64748b?style=flat-square&logo=open-source-initiative&logoColor=white)](LICENSE)

</div>

---

## Overview

Clinical Workflows is an **agentic RAG system** purpose-built for hypertension chronic-care follow-up. It ingests public clinical guidelines (NICE, WHO, CDC), chunks them with full citation provenance, and answers questions through a LangGraph agent that routes between a curated OKF knowledge spine and hybrid retrieval. Every claim is traced to a source, every unsafe request is refused before generation, and every response is structured for frontend rendering and evaluation.

**Live demo**: [https://clinical-workflows.vercel.app](https://clinical-workflows.vercel.app)

---

## Quick Start

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
make run-backend
```

Open `http://127.0.0.1:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` calls to the backend automatically.

Without API keys, the app runs in **local demo mode** with deterministic embeddings, in-memory retrieval, lexical reranking, and extractive answers. With keys, it uses Pinecone and Cohere for production-grade retrieval and generation.

---

## Architecture

```
Client / Frontend (React + Vite + Tailwind)
  -> Auth + RBAC middleware (JWT / OAuth2)
  -> Request validation + PHI boundary
  -> FastAPI API server
    -> LangGraph ClinicalRAGAgent
      -> validate_request
      -> classify_intent / safety policy
      -> refuse unsafe requests early
      -> KnowledgeInterface (OKF + Hybrid RAG)
      -> deterministic tool router
      -> reranker
      -> grounded generation
      -> claim / citation validator
      -> output validator
    -> Structured response
  -> citations + trace + safety + care_gaps
```

### Stack

| Layer | Technology |
|---|---|
| API | FastAPI |
| Workflow | LangGraph |
| Dense retrieval | Cohere `embed-v4.0` + local fallback |
| Sparse retrieval | BM25 with per-corpus refit |
| Hybrid fusion | Weighted alpha (default 0.55) with min-max normalization |
| Reranking | Cohere `rerank-v3.5` + lexical fallback |
| Generation | Cohere Command + extractive fallback |
| Curated knowledge | OKF (27 concept files, tag-based, wikilink graph) |
| Tools | Clinical calculators, case lookup, care gap checker, document version checker |
| Evaluation | Deterministic metrics + CI threshold gates |
| Frontend | React 18 + TypeScript + Tailwind CSS + Lucide icons |
| Auth | JWT + OAuth2 + bcrypt |
| CI | pytest (199 tests), ruff, pyright, make okf-check |
| Deployment | Vercel (Python serverless + static frontend) |

---

## Features

### AI Chat Interface (Claude-like)

Professional three-panel chat interface with:
- **Sliding sidebar** with conversation history grouped by date (today, this week, earlier)
- **Dark/light mode** support for comfortable use in any environment
- **Patient / Clinician mode** toggle for tailored response tone and detail
- **Synthetic case selector** (5 hypertension cases) for workflow demos
- **Evidence panel** showing citations, tool traces, safety flags, and knowledge routing path
- **Suggested questions** for quick exploration
- **Responsive design** that works on desktop and tablet

### Safety-First Agentic RAG

The LangGraph agent classifies every query before routing. Unsafe requests (diagnosis, prescribing, dosing, emergency triage, symptom disregard) are **refused before retrieval or generation**:

```
validate -> classify
  -> refuse (unsafe) -> format -> END
  -> insufficient -> format -> END
  -> calculator_fast_path -> tools -> rerank -> generate -> validate_claims -> format -> END
  -> retrieve -> tools -> rerank -> generate -> validate_claims -> format -> END
```

### Open Knowledge Format (OKF)

A curated, git-versioned knowledge spine of 27 concept files with YAML frontmatter and `[[wikilinks]]` knowledge graph. The OKF layer sits **in front of** RAG, providing deterministic answers for canonical clinical facts (BP categories, drug classes, treatment protocols) without depending on embedding quality.

### Full Citation Provenance

Every citation carries: `source_url`, `source_version`, `source_type`, `retrieved_at`, `review_date`, `effective_date`, `license_notes` — traceable from API response back to source document, version, and license terms.

### Authentication & Personalization

- JWT-based authentication with secure password hashing (bcrypt)
- Role-based access control (Clinician, Patient, Admin, Care Coordinator)
- Persistent chat history with conversation CRUD
- User profiles for personalized experience

### Evaluation & LLMOps

Multi-dataset evaluation with deterministic proxy metrics and CI quality gates:

| Gate | Metric | Threshold |
|------|--------|-----------|
| Refusal correctness | % of unsafe requests correctly refused | >= 0.95 |
| Tool selection accuracy | % of tool routing queries with correct tool call | >= 0.90 |
| Citation presence | % of answerable questions with >= 1 citation | >= 0.95 |
| Intent accuracy | % of queries with correct intent label | >= 0.90 |
| Prompt injection detection | % of injection attempts detected | >= 0.95 |
| Care gap detection | % of expected care gaps detected | >= 0.80 |

**55 evaluation questions** across 6 datasets. Run with `python -m app.evaluation.run`.

---

## Environment Variables

```env
PINECONE_API_KEY=           # Optional: for production vector store
PINECONE_INDEX_NAME=        # Optional: Pinecone index name
COHERE_API_KEY=             # Optional: for Cohere embeddings/reranking/generation
TAVILY_API_KEY=             # Optional: for web search tool
DATABASE_URL=sqlite:///./clinical_demo.db
APP_ENV=local               # local or production
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:5173,https://clinical-workflows.vercel.app
JWT_SECRET_KEY=             # Strong random key for production
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | System health, document/chunk counts, OKF status |
| POST | `/ingest` | Ingest guideline sources |
| POST | `/query` | Ask a clinical question (supports mode, case_id) |
| GET | `/documents` | List indexed documents |
| GET | `/sources` | Source registry with provenance metadata |
| POST | `/eval/run` | Run evaluation suite |
| GET | `/eval/results` | Get latest evaluation results |
| GET | `/cases` | List synthetic patient cases |
| POST | `/auth/register` | Register a new user |
| POST | `/auth/token` | Login (OAuth2 password flow) |
| GET | `/auth/users/me` | Current user profile |
| POST | `/chat/conversations` | Create a new conversation |
| GET | `/chat/conversations` | List user conversations |
| GET | `/chat/conversations/{id}` | Get conversation with messages |
| POST | `/chat/conversations/{id}/message` | Send message and get agent response |
| DELETE | `/chat/conversations/{id}` | Delete a conversation |

---

## Safety & Limitations

- **Not a clinical decision-support system.** All answers are educational workflow support and require clinician review.
- **Synthetic data only.** No real patient information is used in the demo.
- **Refusal categories:** diagnosis, prescribing, dosing, emergency triage, symptom disregard, out-of-domain, insufficient evidence.
- **Every response includes** a medical disclaimer and consult-licensed-clinician boundary.

---

## Demo Script

1. **Ingest guidelines:** `curl -X POST http://127.0.0.1:8000/ingest -H "Content-Type: application/json" -d '{"use_default_sources": true}'`
2. **Ask a guideline question:** `curl -X POST http://127.0.0.1:8000/query -H "Content-Type: application/json" -d '{"question": "When should drug treatment be considered for stage 1 hypertension?", "mode": "patient"}'`
3. **Ask a workflow question with case context:** `curl -X POST http://127.0.0.1:8000/query -H "Content-Type: application/json" -d '{"question": "What follow-up is needed for this patient?", "mode": "clinician", "case_id": "htn-002"}'`
4. **Test safety refusal:** `curl -X POST http://127.0.0.1:8000/query -H "Content-Type: application/json" -d '{"question": "What drug should I prescribe for hypertension?"}'`
5. **Explore the frontend:** Open `http://localhost:5173`, register, and try the suggested questions.

---

## Project Structure

```
├── api/index.py               # Vercel Python serverless entry
├── app/                       # Python backend
│   ├── agents/                # LangGraph agent, citation validator
│   ├── api/                   # FastAPI routes, dependencies
│   ├── auth/                  # JWT auth, RBAC
│   ├── cases/                 # Synthetic patient cases
│   ├── chat/                  # Chat history, conversations
│   ├── core/                  # Config, logging
│   ├── evaluation/            # Evaluation harness, metrics
│   ├── ingestion/             # PDF loader, chunker, manifest, source registry
│   ├── models.py              # Pydantic schemas
│   ├── okf/                   # Open Knowledge Format module
│   ├── retrieval/             # Hybrid store, embeddings, reranker
│   ├── safety/                # Intent classifier, refusals
│   └── tools/                 # Calculators, case lookup, care gap checker
├── data/                      # Source documents, evaluation datasets, manifests
├── frontend/                  # React + Vite + TypeScript + Tailwind
│   └── src/
│       ├── components/        # Reusable UI components
│       ├── hooks/             # API, auth, chat hooks
│       └── types/             # TypeScript type definitions
├── hypertension-okf/          # 27 OKF concept files with wikilinks
├── tests/                     # 199 passing tests
├── .env.example               # Environment variable template
├── vercel.json                # Vercel deployment config
└── Makefile                   # Common commands (run-backend, okf-check, etc.)
```

---

## License

MIT. This project is for educational and portfolio purposes. It is not intended for clinical use. Clinical guidelines referenced (NICE, WHO, CDC) carry their own license terms — see their respective websites for redistribution permissions.

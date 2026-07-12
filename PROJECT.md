# PROJECT.md — Clinical Workflows

## 1. What This Is

Clinical Workflows is an **open-source clinical RAG chatbot for hypertension guidelines**. It combines a LangGraph agent with hybrid search and a curated knowledge spine to answer questions in two modes:

- **Patient mode** — warm health educator, grade 6–8 reading level
- **Clinician mode** — clinical decision support with precise thresholds and drug classes

The agent flow is: `validate → classify → (refuse | converse | calculator_fast_path | retrieve) → rerank → generate → validate_claims → check_gaps → format`

Hybrid search uses BM25 + Cohere embeddings with min-max normalization. OKF (Open Knowledge Format) provides 27 curated concept files as a high-trust knowledge layer in front of RAG. Calculator tools (BMI, eGFR, MAP, pulse pressure) and care gap detection round out the workflow capabilities.

## 2. Architecture

```
Frontend (React 18 + Vite 5 + TypeScript + Tailwind 3)
  └── /api/* → Vercel proxy → Backend
Backend (FastAPI + LangGraph agent)
  ├── app/agents/clinical_rag_agent.py — LangGraph graph
  ├── app/retrieval/store.py — HybridStore (BM25 + dense)
  ├── app/retrieval/pgvector_store.py — PostgreSQL + pgvector
  ├── app/okf/ — Knowledge spine interface
  ├── app/auth/ — JWT + bcrypt auth, RBAC
  ├── app/chat/ — Conversation CRUD
  └── app/safety/ — Intent classifier + refusal engine
Database (SQLite dev / PostgreSQL+pgvector prod)
Vector store (HybridStore in-memory / PgVectorStore)
LLM (OpenRouter free models, Cohere for embeddings/reranking)
```

### Deployment options

| Option | Setup |
|--------|-------|
| **Dev** | `make run-backend` + `make run-frontend` |
| **Free production** | Vercel (frontend) + Render/Neon (PostgreSQL) + OpenRouter free models |
| **Paid production (1M+ MAU)** | AWS ECS Fargate + RDS + pgvector — see PRODUCTION_ARCHITECTURE.md |
| **Current deploy** | Vercel serverless via `api/index.py` |

## 3. Key Files

| File | What |
|------|------|
| `app/agents/clinical_rag_agent.py` (1017 lines) | LangGraph agent — heart of the system |
| `app/retrieval/store.py` | HybridStore factory (in-memory BM25+dense) |
| `app/retrieval/pgvector_store.py` | PostgreSQL+pgvector backend |
| `app/retrieval/reranker.py` | Cohere reranking wrapper |
| `app/core/config.py` | Pydantic Settings from env vars |
| `app/api/routes.py` | All API endpoints |
| `app/api/dependencies.py` | FastAPI deps (store, agent, knowledge) |
| `app/safety/classifier.py` | Deterministic intent classifier + refusal |
| `app/okf/interface.py` | OKF + RAG unified search |
| `app/tools/calculator.py` | BMI, eGFR, MAP, pulse pressure |
| `app/tools/care_gap_checker.py` | Rule-based gap detection |
| `frontend/src/App.tsx` | Main React component |
| `frontend/src/hooks/useAuth.ts` | Auth API hooks |
| `frontend/src/hooks/useChat.ts` | Chat API hooks |

## 4. Agent Flow

```
validate → load_case → classify → route
  ├── refuse → format → END
  ├── converse (general chat/out-of-domain) → format → END
  ├── insufficient → format → END
  ├── calculator_fast_path → tools → rerank → generate → validate_claims → check_gaps → format → END
  └── retrieve (query_analyzer → retrieve with personal fallback → tools) → rerank → generate → validate_claims → check_gaps → format → END
```

Routes: `refuse`, `converse`, `insufficient`, `calculator_fast_path`, `retrieve`

## 5. What's Been Built

- Full LangGraph agent with 5 routes, safety-first design (refuses diagnosis/prescribing/emergency triage)
- Hybrid search with BM25 + Cohere embeddings + min-max normalization
- OKF curated knowledge layer (27 concept files on hypertension)
- Patient + clinician mode with distinct prompts
- Calculator tools (BMI, eGFR, MAP, pulse pressure)
- Citation validator (checks claims against retrieved chunks)
- Care gap detection (5 synthetic patient cases)
- Web search tool (Tavily)
- JWT auth with RBAC (Clinician, Patient, Admin, Care Coordinator)
- Chat history with CRUD, profile editing, date-grouped conversation sidebar
- Personalization (user uploads merged into answers via personal index)
- Extractive summarization fallback (no LLM needed)
- Model registry (OpenRouter, Cohere, OpenAI, Anthropic, Gemini)
- Query analyzer (clinical abbreviation expansion)
- 222 tests

## 6. Deployment Options

### Dev
```bash
source .venv/bin/activate && make run-backend  # :8000
cd frontend && npm run dev                      # :5173
```

### Free production
- Frontend → Vercel (vercel.json routes /api/* → api/index.py)
- Backend → Render free tier or Vercel serverless
- Database → Neon/Supabase (free PostgreSQL + pgvector)
- Models → OpenRouter free tier

### Paid production (1M+ MAU)
- AWS ECS Fargate + RDS PostgreSQL + pgvector + ElastiCache Redis + S3
- Blue/green deploys via CodeDeploy
- Multi-AZ with DR in us-west-2
- See PRODUCTION_ARCHITECTURE.md for full specs and cost estimates (~$524/mo at 10K MAU)

## 7. Roadmap / What's Left

- [ ] pgvector migration (code written, needs production deployment)
- [ ] Multi-user tenant isolation
- [ ] Real patient case management UI
- [ ] Evaluation dashboard for quality monitoring
- [ ] Benchmarking against human clinicians
- [ ] Mobile app
- [ ] Streaming token-by-token generation in frontend
- [ ] asyncpg for better concurrency

## 8. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5, Vite 6, Tailwind CSS 4 |
| Backend | FastAPI, Uvicorn, Python 3.12 |
| Agent | LangGraph (StateGraph) |
| Dense retrieval | Cohere embed-v4.0 (1536-dim) |
| Sparse retrieval | BM25 |
| Fusion | Weighted alpha (0.55) + min-max normalization |
| Reranking | Cohere rerank-v3.5 |
| Generation | OpenRouter / Cohere Command / OpenAI / Anthropic / Gemini |
| Knowledge spine | OKF (27 concept files, YAML + wikilinks) |
| Vector store | In-memory HybridStore or pgvector |
| Auth | JWT + OAuth2 password flow, bcrypt, python-jose |
| Database | SQLite (dev) / PostgreSQL + pgvector (prod) |
| Evaluation | 55 questions, 6 datasets, 6 proxy metrics |
| Tests | 222 pytest tests, asyncio_mode=auto |
| CI | GitHub Actions (lint + test + build frontend) |
| Deploy | Vercel (serverless Python + static SPA) |

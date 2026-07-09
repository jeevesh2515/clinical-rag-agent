# AGENTS.md

## Quick start

```bash
python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env
make run-backend          # uvicorn app.main:app --reload --port 8000

# separate terminal:
cd frontend && npm install && npm run dev   # Vite on :5173, proxies /api -> :8000
```

## Python

- Python **3.12** only (`.python-version`, `pyproject.toml` requires `>=3.12,<3.14`).
- venv is `.venv/`, deps via `pip install -r requirements.txt`. No Python lockfile (`uv.lock` is gitignored).
- `pyproject.toml` is the build config; `pip install -e .` is available for editable install.

## Key commands

| What | How |
|---|---|
| Run all tests | `make test` (aliases `python -m pytest tests/ -v --tb=short`) |
| Lint | `make lint` (ruff with `--ignore E501 \|\| true` — errors non-fatal) |
| Type check | `pyright` (no Makefile target, but `pyrightconfig.json` exists) |
| OKF validation | `make okf-check` (`python3 scripts/validate_okf.py`) |
| Run evaluation | `python -m app.evaluation.run` |
| Run backend | `make run-backend` |
| Run frontend | `make run-frontend` |
| Full CI | `make ci` (= lint + test + build-frontend) |
| Docker | `docker compose up` (builds + runs on port 8000) |

## Testing

- DB is **reset before every test** via `conftest.py` (`_clean_db_per_test`). Test data uses `tmp_path` SQLite files — no persistent DB pollution.
- `asyncio_mode = auto` in pyproject.toml — async fixtures work without marker.
- `TestClient(app)` with `dependency_overrides` for injecting test store/agent.
- No frontend tests in this repo.
- 199 tests across 22 test files.

## Linting and types

- Ruff: line-length 100, target py312, **E501 ignored**.
- CI runs `ruff check app/ tests/ --ignore E501 || true` (passes even if ruff finds issues).
- Pyright is configured (strict-ish via `pyrightconfig.json`) but **not run in CI**.
- Ruff errors do not block anything — check both if you want clean output.

## OKF (Open Knowledge Format)

27 curated concept files in `hypertension-okf/`. YAML frontmatter with `type` field required. [[wikilinks]] must resolve to other files in the bundle. Validate with `make okf-check`.

## Frontend

- React 18 + Vite 5 + TypeScript 5 + Tailwind 3.
- `npm run build` = `tsc && vite build` (typecheck is part of build).
- `vite.config.ts` proxies `/api/*` to `http://127.0.0.1:8000` during dev.
- CSS dark mode via Tailwind `darkMode: 'class'`.
- No frontend test framework installed.

## Deployment (Vercel)

- `vercel.json`: `/api/(.*)` → `api/index.py` (Python serverless). Everything else → `frontend/dist/` SPA.
- Assets get immutable cache (1 year). vite.svg gets 1 day.
- `api/index.py` is the serverless entry (`from app.main import app`).
- `app/main.py` bootstraps SQLite + personal index at **import time** — this runs on every serverless cold start.
- Frontend must be built (`npm run build`) before deploy.

## App architecture

- FastAPI app at `app/main.py`, sub-routers under `app/api/routes.py` (ingestion, query, auth, chat, eval, cases).
- LangGraph agent at `app/agents/clinical_rag_agent.py` with safety-first routing: `validate → classify → (refuse | calculator_fast_path | retrieve) → rerank → generate → validate_claims → format`.
- `app/retrieval/store.py` is the `HybridStore` — single source of truth for all retrieval. No global in-memory stores.
- SQLAlchemy ORM models in `app/db.py` (User, Conversation, Message, Upload). Switch to Postgres at production by setting `DATABASE_URL`.
- `app/core/config.py` has `Settings` via pydantic-settings, read from `.env`. LRU-cached via `get_settings()`.
- `app/api/dependencies.py` provides `get_store()`, `get_knowledge_interface()`, `get_agent()` as FastAPI deps. Test overrides hook into these.
- `app/okf/` is the curated knowledge spine layer that sits **in front of** RAG retrieval.

## Evaluation

- 55 questions across 6 datasets in `data/eval/` (JSONL format).
- Deterministic proxy metrics: intent accuracy, refusal correctness, tool selection, citation presence, care gap detection, prompt injection detection.
- Threshold gates in `app/evaluation/metrics.py`. CI doesn't currently gate on these.
- Run: `python -m app.evaluation.run --ingest-defaults`.
- Single dataset: `python -m app.evaluation.run --dataset data/eval/golden_guideline_questions.jsonl`.

## Auth

- JWT + OAuth2 password flow (`/api/auth/token`), bcrypt hashing, python-jose.
- RBAC roles: Clinician, Patient, Admin, Care Coordinator.
- `JWT_SECRET_KEY` env var required for production.

## Safety

- Safety-first design: unsafe requests are **refused before retrieval or generation**.
- Refusal categories: diagnosis, prescribing, dosing, emergency triage, symptom disregard, out-of-domain, insufficient evidence.
- Every response includes educational disclaimer + consult-licensed-clinician boundary.

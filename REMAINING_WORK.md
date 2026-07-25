# Remaining Work — Days 32–36+ Completion Plan

> Continuation of the 31-day learning plan. Days 1–31 are complete and the
> project is live at https://clinical-workflows.vercel.app with 251 passing
> tests, Prometheus observability, Redis caching, pgvector + S3 storage,
> Kubernetes manifests, Docker CD pipeline, and a healthy production
> deployment. The remaining work covers loose ends, deployment parity,
> documentation hygiene, and the final compliance/legal layer.

---

## Current project state (Day 31 baseline)

| Metric | Value |
|---|---|
| Backend tests | **251 passed**, 9 skipped |
| Frontend typecheck | ✅ Clean |
| Frontend build | ✅ Successful (production) |
| Ruff lint | ✅ Passing |
| Production deployment | ✅ Vercel — `200 OK` on `/api/health`, `/api/models` |
| Production secrets on Vercel | `OPENROUTER_API_KEY`, `COHERE_API_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`, `APP_ENV`, `TAVILY_API_KEY`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT` |
| Git status | ✅ Clean, up to date with `origin/main` |
| Prometheus import | ✅ Optional fallback for serverless |
| Vercel cold-start | ✅ Fixed via lifespan refactor |
| Legal pages | `PRIVACY.md`, `TERMS.md` created |
| Footer links | ✅ No placeholders |

### What Days 1–31 delivered

```text
Days 1-10   — Safety policy, FastAPI contracts, ingestion pipeline,
              hybrid retrieval (dense+sparse), reranking, grounded generation,
              LangGraph agent orchestration, OKF knowledge layer,
              clinical calculators, synthetic patient cases, care gap checker,
              structured response schemas, claim support labels
Days 11-20  — Source registry, version checker, auth/RBAC/JWT,
              frontend UI/UX redesign, Vercel deployment, rate limiting,
              production hardening, secrets audit, free-tier deployment,
              full verification & security push
Days 21-24  — Production monitoring, LangSmith evaluation setup,
              Kubernetes manifests (deployment, HPA, ingress, PDB,
              NetworkPolicy, ServiceAccount, Kyverno policies),
              Docker CD pipeline (GitHub Actions → GHCR),
              mobile UX refinement (double-decker header, responsive layout)
Days 25-31  — Prometheus metrics + observability, KEDA custom HPA,
              Redis cache layer, pgvector HNSW + S3 storage,
              Pod Security Admission + Kyverno policies,
              CI secret guard + image digest pinning,
              load test + end-to-end validation
```

---

## Remaining items overview

| Priority | Item | Day |
|---|---|---|
| 🔴 High | README test badge stale (shows 219, actual 251) | Day 32 |
| 🔴 High | Render deployment not configured | Day 32 |
| 🔴 High | Corpus not seeded (need `POST /api/ingest`) | Day 32 |
| 🟡 Medium | `.env` placeholders (`LANGSMITH_ENDPOINT`, `LANGCHAIN_ENDPOINT`, `LOG_LEVEL`, `LANGSMITH_TRACING`) | Day 33 |
| 🟡 Medium | Load test `_TBD_` values in `docs/LOAD_TEST_RESULTS.md` | Day 33 |
| 🟡 Medium | Neon Auth flow end-to-end verification | Day 34 |
| 🔵 Low | OKF knowledge base completeness review | Day 34 |
| 🔵 Low | Dedicated `ETHICS.md` and `GDPR.md` pages | Day 35 |
| 🔵 Low | README docs sweep (badges, architecture, getting started) | Day 35 |
| 🟢 Nice-to-have | Neon Auth integration test | Day 36 |

---

# Day 32 — Production Finish & Render Deployment

## Goal

Complete the final production-deployment gap (Render) and fix the visible
documentation inaccuracies (stale badge + empty corpus).

## Dependency

None — independent of other days.

## Scope

### 1. Fix README test badge

- `README.md` line 13: `https://img.shields.io/badge/tests-219%20passing-22c55e`
  → change to `https://img.shields.io/badge/tests-251%20passing-22c55e`
- Update any other stale badge references (test count, build status, etc.)

**Files**: `README.md`

### 2. Configure Render deployment

- Go to https://dashboard.render.com
- Create a new **Web Service** pointed at the same GitHub repo
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port 10000`
- Set environment variables (same as Vercel):

```env
OPENROUTER_API_KEY=<same value>
COHERE_API_KEY=<same value>
JWT_SECRET_KEY=<same value>
DATABASE_URL=<same value>
APP_ENV=production
TAVILY_API_KEY=<same value>
LANGSMITH_API_KEY=<same value>
LANGSMITH_PROJECT=<same value>
CORS_ORIGINS=https://clinical-workflows.vercel.app,https://clinical-workflows.onrender.com
```

- Verify: `curl https://clinical-workflows.onrender.com/api/health`
- Update `render.yaml` if needed to match the production start command

**Files**: `render.yaml`, Render dashboard

### 3. Seed the knowledge corpus

- After Render or Vercel deployment is confirmed healthy, seed the database:
  ```bash
  curl -X POST https://clinical-workflows.vercel.app/api/ingest
  ```
- Verify chunks are populated:
  ```bash
  curl -s https://clinical-workflows.vercel.app/api/ready | jq '.chunks'
  # Expected: > 0
  ```
- Then test a query:
  ```bash
  curl -X POST https://clinical-workflows.vercel.app/api/query \
    -H "Content-Type: application/json" \
    -d '{"question": "What is the target BP for a diabetic patient?"}'
  ```

**Reference**: `DEPLOYMENT_GUIDE.md` (Data Ingestion section)

### 4. Fix `.env` for local development

- Set `LOG_LEVEL=INFO`
- Update `LANGSMITH_ENDPOINT` and `LANGCHAIN_ENDPOINT` from `TODO` to actual
  LangSmith endpoint: `https://api.smith.langchain.com`
- Set `LANGSMITH_TRACING=true`

**Files**: `.env`

## Acceptance criteria

- [ ] README badge shows 251 passing
- [ ] Render deployment returns 200 on `/api/health`
- [ ] Render has all required env vars
- [ ] `POST /api/ingest` returns 200 and `chunks > 0`
- [ ] `.env` has `LOG_LEVEL=INFO` and no remaining placeholders

## Estimated effort

1 session (~2 hours) — straightforward configuration, no code changes.

---

# Day 33 — Staging Load Test Execution

## Goal

Run the k6 baseline + burst tests against a staging environment and populate
the `_TBD_` values in `docs/LOAD_TEST_RESULTS.md`.

## Dependency

Requires a staging environment with:
- Neon PostgreSQL (with pgvector extension enabled)
- K8s cluster with KEDA + Prometheus installed
- App deployed with `kubectl apply -k k8s/`

## Scope

### 1. Prerequisites: staging infrastructure

If not already available, provision:
- **Neon PostgreSQL** — free tier at https://neon.tech
  ```sql
  psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
  ```
- **Kind/Minikube** local cluster or existing staging K8s
- **KEDA** installation:
  ```bash
  helm repo add kedacore https://kedacore.github.io/charts
  helm install keda kedacore/keda --namespace keda --create-namespace
  ```

### 2. Deploy to staging

```bash
kubectl create secret generic clinical-app-secrets \
  --from-literal=JWT_SECRET_KEY="$JWT_SECRET" \
  --from-literal=OPENROUTER_API_KEY="$OPENROUTER_KEY" \
  --from-literal=COHERE_API_KEY="$COHERE_KEY" \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --namespace=clinical-workflows
kubectl apply -k k8s/
```

### 3. Run preflight check

```bash
export STAGING_URL=<staging-url>
export KUBE_CONTEXT=<context>
export KUBE_NAMESPACE=clinical-workflows
make load-test:preflight
```

### 4. Run baseline (50 RPS × 10 min)

```bash
make load-test:baseline
```

### 5. Cooldown + burst (200 RPS × 2 min)

```bash
sleep 300
make load-test:burst
```

### 6. Capture metrics + parse results

```bash
bash ./scripts/capture_metrics.sh
python3 scripts/parse_k6_results.py
```

### 7. Commit populated `docs/LOAD_TEST_RESULTS.md`

The `_TBD_` values should now be replaced with real measured values.

> **Note on infrastructure**: If a full K8s staging cluster is not available,
> the same k6 scripts can be run locally against `docker-compose.pgvector.yml`
> (see `scripts/smoke_load_test.sh`). The local smoke test validates the
> orchestration; only the staging run fills the Neon + KEDA pass criteria
> columns. Existing `k8s/` manifests and `docker-compose.pgvector.yml` serve
> as reference for both paths.

## Acceptance criteria

- [ ] Baseline passes: p95 < 18s, error rate < 0.5%, cache hits > 30%
- [ ] Burst passes: p95 < 25s, error rate < 1%, scale-up < 90s
- [ ] Peak replica count ≥ 4
- [ ] `docs/LOAD_TEST_RESULTS.md` has no remaining `_TBD_` cells

## Estimated effort

1 session (~3 hours including infrastructure setup).

---

# Day 34 — Knowledge Completeness & Auth Verification

## Goal

Verify two critical production paths: the knowledge base is complete (OKF
documents cover the full hypertension domain) and the Neon Auth integration
works end-to-end.

## Dependency

None — can run in parallel after Day 32.

## Scope

### 1. OKF knowledge base completeness review

Walk through each file under `hypertension-okf/` and verify:

| File / Area | Status check |
|---|---|
| `guidelines/acc-aha-2017-summary.md` | Up to date with 2026 guidelines? |
| `guidelines/jnc8-summary.md` | Archived / superseded? Mark if so. |
| `guidelines/esc-esh-2023-summary.md` | Any 2025 revisions to add? |
| `guidelines/nice-ng136-summary.md` | NICE updated in 2024 — check current version |
| `diagnosis/bp-categories.md` | Thresholds match latest ACC/AHA? |
| `diagnosis/diagnostic-thresholds.md` | Office vs home vs ambulatory thresholds |
| `diagnosis/secondary-htn-red-flags.md` | Add sleep apnea, renal artery stenosis? |
| `pharmacology/first-line-drug-classes.md` | Check for new drug classes |
| `pharmacology/thiazide-diuretics.md` | Verify dosing recommendations |
| `comorbidities/` | All 5 comorbidity files reviewed |
| `emergencies/` | Crisis management protocols |
| `monitoring/` | Home BP monitoring, follow-up cadence |
| `protocols/` | Stage 1, Stage 2, resistant HTN protocols |

Create a gap report and file any missing topics as issues.

**This is a content audit only** — no code changes to the knowledge files.

### 2. Neon Auth flow end-to-end test

With the `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, and `NEON_API_KEY`
configured in `.env`:

- **Signup flow**: `POST /api/auth/signup` with valid email + password
- **Login flow**: `POST /api/auth/login` → returns JWT token
- **Token verification**: `GET /api/auth/me` with JWT → returns user profile
- **Protected route**: `POST /api/query` with JWT → returns response
- **Unauthenticated access**: `POST /api/query` without JWT → returns 401
- **Invalid token**: `POST /api/query` with expired/bad JWT → returns 401

Verify all flows against the live Vercel deployment.

### 3. Add auth flow test file

Add `tests/test_auth_flow.py` — a lightweight HTTP integration test that:
- Signs up a test user (or uses a seeded test user via fixture)
- Logs in and captures the JWT
- Makes an authenticated query
- Verifies the response includes user context
- Tests unauthenticated access returns 401

```python
def test_auth_signup_login_query(client):
    # POST /api/auth/signup
    # POST /api/auth/login -> token
    # POST /api/query with Authorization header -> 200
    # POST /api/query without header -> 401
```

## Acceptance criteria

- [ ] All OKF documents reviewed, gap report filed
- [ ] Neon Auth signup → login → query flow works end-to-end
- [ ] Auth flow test added and passing
- [ ] Protected routes return 401 without valid JWT

## Estimated effort

1 session (~2 hours).

---

# Day 35 — Final Compliance, Legal Pages & Documentation

## Goal

Complete the compliance layer with dedicated legal pages, fix documentation
gaps in README, and ensure the project is fully documented for open-source
consumption.

## Dependency

Day 34 (auth/knowledge review) should be done first to capture any findings
in the documentation.

## Scope

### 1. Create dedicated ETHICS.md

Create `ETHICS.md` covering:
- Clinical disclaimer (no substitute for professional medical advice)
- Intended use (educational demo only)
- Limitations of the system
- Data privacy commitment
- No PHI policy
- Responsible AI principles
- Contact for concerns

### 2. Create dedicated GDPR.md

Create `GDPR.md` covering:
- Data controller information
- Legal basis for processing
- Data retention policy
- User rights (access, rectification, erasure, portability)
- Cookie policy (if applicable)
- International data transfers
- Supervisory authority contact

### 3. Update footer links

After creating the new pages, update `frontend/src/components/LandingPage.tsx`
footer to link:
- `GDPR Compliance` → `/GDPR.md` (instead of `/PRIVACY.md`)
- `Ethics Statement` → `/ETHICS.md` (instead of README anchor)

### 4. README documentation sweep

- Update architecture diagram if the system has changed
- Ensure "Getting Started" section has accurate clone → install → run steps
- Verify all external links are live
- Update test count badge to the correct number
- Add a "Limitations" section
- Add a "Live Demo" section with the Vercel URL
- Verify the tech stack table is accurate
- Add a "Deployment" section summarizing Vercel + Render setup

### 5. Update DEPLOYMENT_GUIDE.md

- Ensure Render deployment steps are accurate
- Verify Vercel deployment steps match the current `vercel.json`
- Add the correct `CORS_ORIGINS` value for production
- Add a "Post-deployment checklist" section

## Acceptance criteria

- [ ] `ETHICS.md` exists and is linked from footer
- [ ] `GDPR.md` exists and is linked from footer
- [ ] Frontend typecheck passes after link updates
- [ ] README is fully accurate (badges, links, instructions)
- [ ] `DEPLOYMENT_GUIDE.md` matches current deployment setup
- [ ] All external links in documentation are live

## Estimated effort

1 session (~2 hours).

---

# Day 36 — End-to-End Smoke Test & Final Sign-Off

## Goal

Run the complete user journey against the live production deployment, verify
every critical path, and declare the project complete.

## Dependency

Days 32–35 complete.

## Scope

### 1. Full production smoke test

Walk through every endpoint against the live Vercel deployment:

```bash
# Health
curl -s https://clinical-workflows.vercel.app/api/health | jq .
# Expected: {"status":"ok","db":"connected","okf":true,"chunks":27}

# Models
curl -s https://clinical-workflows.vercel.app/api/models | jq '.models[].id'
# Expected: 6 models listed

# Ready
curl -s https://clinical-workflows.vercel.app/api/ready | jq '.chunks'
# Expected: 27 (or the correct ingested count)

# Query (extractive fallback — no real API key needed)
curl -s -X POST https://clinical-workflows.vercel.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"What BP target for diabetes?"}' | jq '.answer'

# Query with LLM key
curl -s -X POST https://clinical-workflows.vercel.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"What BP target for diabetes?"}' | jq '.answer, .citations[0].source'
```

### 2. Browser smoke test

Open the live site at https://clinical-workflows.vercel.app and verify:
- [ ] Landing page loads with no console errors
- [ ] Theme toggle works (light ↔ dark)
- [ ] Login page renders correctly
- [ ] Signup page renders correctly
- [ ] Footer links are correct (Privacy, Terms, GDPR, Ethics all point to real pages)
- [ ] Scroll-linked animations work on the landing page
- [ ] All sections are visible (hero, features, architecture, footer)

### 3. Run full test suite one final time

```bash
python3 -m pytest tests/ -q --tb=short
# Expected: 251 passed, 9 skipped
```

### 4. Verify CI/CD pipeline

- [ ] `make ci` passes locally (lint, typecheck, test, build)
- [ ] Pre-commit hooks run without error (`pre-commit run --all-files`)
- [ ] GitHub Actions workflow runs successfully on push (check the latest run)

### 5. Final sign-off checklist

```text
- [ ] Production Vercel deployment: ✅ HEALTHY (200 on /api/health)
- [ ] Render deployment: ✅ HEALTHY (200 on /api/health)
- [ ] Backend tests: 251 passed, 9 skipped
- [ ] Frontend typecheck: ✅ CLEAN
- [ ] Frontend build: ✅ SUCCESSFUL
- [ ] Ruff lint: ✅ PASSING
- [ ] Pre-commit hooks: ✅ PASSING
- [ ] Secrets: ✅ NONE committed (verify_secrets.py clean)
- [ ] Load test results: ✅ _TBD_ VALUES POPULATED
- [ ] Legal pages: ✅ PRIVACY.md, TERMS.md, ETHICS.md, GDPR.md
- [ ] Footer links: ✅ NO PLACEHOLDERS
- [ ] Knowledge base: ✅ INGESTED (chunks > 0)
- [ ] Auth flow: ✅ SIGNUP → LOGIN → QUERY WORKS
- [ ] Documentation: ✅ README, DEPLOYMENT_GUIDE current
- [ ] Git: ✅ UP TO DATE with origin/main
```

## Acceptance criteria

- [ ] All 16 sign-off checklist items checked
- [ ] No `_TBD_` or `FIXME` or `TODO` placeholders remain in tracked files
- [ ] No console errors on the live site
- [ ] Full test suite passes

## Estimated effort

1 session (~1.5 hours).

---

## Dependency graph

```text
Day 32 (Production Finish) ────────┐
                                    │
Day 33 (Load Test) ── staging infra ├── Day 35 (Compliance + Docs)
                                    │
Day 34 (Knowledge + Auth) ─────────┤
                                    │
Day 36 (Smoke Test + Sign-Off) ────┴── depends on Days 32-35
```

## Parallelisation windows

| Window | Days that can run in parallel | Notes |
|---|---|---|
| Window A | Day 32, Day 34 | No shared dependencies; can be done by separate people |
| Window B (after A) | Day 33, Day 35 | Day 33 requires staging infra; Day 35 is docs-only |
| Window C (final) | Day 36 only | Smoke test validates everything |

A single engineer working serially would take ~5 days. Two engineers
working in parallel could finish in 3 days.

---

## Tracking checklist

```markdown
- [ ] Day 32 — Production Finish & Render Deployment
- [ ] Day 33 — Staging Load Test Execution
- [ ] Day 34 — Knowledge Completeness & Auth Verification
- [ ] Day 35 — Final Compliance, Legal Pages & Documentation
- [ ] Day 36 — End-to-End Smoke Test & Final Sign-Off
```

> **Note**: After completing each day, update `PRIVATE_LEARNING_PLAN.md`
> with the implementation notes following the existing day-entry format.
> This keeps the full learning journal contiguous from Day 1 through Day 36.

---

## Reference

- `.planning/ROADMAP.md` — Phase-level roadmap (Phase 0–14)
- `PRIVATE_LEARNING_PLAN.md` — Day-by-day learning journal (Days 1–24)
- `.planning/daily_learnings/DAYS_25-31_ROADMAP.md` — Days 25–31 roadmap
- `.planning/PHASE_HISTORY.md` — Implementation audit trail
- `DEPLOYMENT_GUIDE.md` — Deployment instructions
- `docs/LOAD_TEST_RESULTS.md` — Load test results

# Remaining Work — Days 32–36+ Completion Plan

> Continuation of the 31-day learning plan. Days 1–31 are complete and the
> project is live at https://clinical-workflows.vercel.app with 251 passing
> tests, Prometheus observability, Redis caching, pgvector + S3 storage,
> Kubernetes manifests, Docker CD pipeline, and a healthy production
> deployment. The remaining work covers loose ends, deployment parity,
> documentation hygiene, and the final compliance/legal layer.

---

## Current project state (post-Day 35 — 2026-07-26)

| Metric | Value |
|---|---|
| Backend tests | **251 passed**, 9 skipped |
| Frontend typecheck | ✅ Clean |
| Frontend build | ✅ Successful (437KB bundle, down from 516KB) |
| Ruff lint | ✅ Passing |
| Production deployment | ✅ Vercel — `200 OK` on `/api/health`, `/api/models` · 🟡 Render blueprint documented in `render.yaml`, service provisioning blocked on user-run dashboard clicks (see Day 32) |
| Production secrets on Vercel | `OPENROUTER_API_KEY`, `COHERE_API_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`, `APP_ENV`, `TAVILY_API_KEY`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT` |
| Git status | ✅ Clean, up to date with `origin/main` |
| Prometheus import | ✅ Optional fallback for serverless |
| Vercel cold-start | ✅ Fixed via lifespan refactor |
| Corpus seeded | ✅ 159 chunks from 3 clinical guidelines (NICE NG136, WHO, CDC) |
| Legal pages | `PRIVACY.md`, `TERMS.md`, `ETHICS.md`, `GDPR.md` created |
| Footer links | ✅ Linked to GDPR.md & ETHICS.md |

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

| Priority | Item | Day | Status |
|---|---|---|---|
| 🔴 High | Render deployment not configured | Day 32 | 🟡 **User-in-the-loop** (see below) |
| 🟡 Medium | `.env` placeholders (`LANGSMITH_ENDPOINT`, `LANGCHAIN_ENDPOINT`, `LOG_LEVEL`, `LANGSMITH_TRACING`) | Day 33 | ⏳ Pending |
| 🟡 Medium | Load test `_TBD_` values in `docs/LOAD_TEST_RESULTS.md` | Day 33 | 🟡 Needs Docker / K8s |
| 🟡 Medium | Neon Auth flow end-to-end verification | Day 34 | ⏳ Pending |
| 🔵 Low | OKF knowledge base completeness review | Day 34 | ⏳ Pending |
| 🟢 Nice-to-have | Neon Auth integration test | Day 36 | ⏳ Pending |

### ✅ Completed today (2026-07-26)

| Item | What was done |
|---|---|
| README test badge | Already showed 251 — verified |
| ETHICS.md & GDPR.md | Created with 9 and 12 sections respectively |
| Footer links | Updated LandingPage.tsx → links to GDPR.md & ETHICS.md |
| Corpus seeded | 159 chunks from 3 guidelines in production Neon DB |
| JS bundle size | Reduced 516KB → 437KB via React.lazy() on 4 components |
| pgvector store bug | Fixed `:embedding::vector` → `CAST(:embedding AS vector)` syntax error |
| ApiError code bug | Added `"internal_error"` to `ApiErrorCode` literal in `app/models.py` |
| README docs sweep | Updated project structure, security section, compliance links |

---

# Day 32 — Production Finish & Render Deployment

## Goal

Complete the final production-deployment gap (Render) and verify the corpus
is seeded.

## Dependency

None — independent of other days.

## Scope

### 1. README test badge

Already showing 251 — no change needed.

### 2. Configure Render deployment

The blueprint `render.yaml` at the repo root already declares every value
the Web Service needs (Python 3.12, `pip install -r requirements.txt`,
`bash bin/start.sh`, health check `/api/health`, env vars including
`generate: true` for `JWT_SECRET_KEY` and `sync: false` for the
account-scoped keys). **Manual steps required — see "AI Delegation
Limits" section below.**

### 3. Corpus seeded

✅ Already done — 159 chunks from 3 clinical guidelines in production Neon DB.

### 4. Fix `.env` for local development

- Set `LOG_LEVEL=INFO`
- Update `LANGSMITH_ENDPOINT` and `LANGCHAIN_ENDPOINT` from `TODO` to actual
  LangSmith endpoint: `https://api.smith.langchain.com`
- Set `LANGSMITH_TRACING=true`

**Files**: `.env`

## Verified deploy-state baseline (post-Day-32.ai-attempt)

Probes recorded by the AI during the post-Day-32 audit against the canonical hosts:

| URL | HTTP | Body / Notes |
|---|---|---|
| `https://clinical-workflows.vercel.app/api/health` | **200** | `{"status":"ok",...}` — production parity confirmed |
| `https://clinical-workflows.onrender.com/api/health` | **404** | host resolves but no service is responding at the prefix |
| `https://clinical-workflows.onrender.com/` | **404** | root path also 404 — no Render Web Service has been provisioned yet |
| `https://clinical-workflows.onrender.com/api/ready` | **404** | same — confirms no app listening, not just a bad path |

**Files reviewed for Day 32 readiness**: `render.yaml` ✅ (already valid
Blueprint spec, `bin/start.sh` ✅ (proper port-bindability check + `exec
uvicorn` against `$PORT`), `Dockerfile` ✅ (multi-stage, non-root UID 10001,
uvicorn on `0.0.0.0:8000`), `.env.example` ✅ (documented env vars). No
repo-side change required for Day 32 to ship — only the dashboard action.

## AI Delegation Limits

Provisioning the Render Web Service requires either:

* **(A)** A `RENDER_API_KEY` env var scoped to the user's Render account,
  or
* **(B)** User-driven OAuth through Render Dashboard at
  `https://dashboard.render.com` (Blueprint click-to-deploy creates a
  resource but needs the user to consent to the GitHub repo read access).

Neither was available when this audit was run. **Out of caution —
provisioning cloud-side resources that create billing exposure and
require account-scoped credentials — the AI verified state, documented
config, and is asking the user to run the dashboard steps below.** Day 32
is therefore **🟡 User-in-the-loop**, not ✅ Completed.

If the user later grants a `RENDER_API_KEY` (plus the workspace `ownerId`,
which the agent would fetch via a separate `GET /v1/owners` call — the
create-service endpoint requires both, plus `repo` and `branch`), the
agent can POST to `https://api.render.com/v1/services` and automate
this. Until then, the manual path is the recommended one.

## Manual Provisioning Steps (recommended)

> If you prefer a **one-off Manual Web Service** (skip Blueprint), see
> `DEPLOYMENT_GUIDE.md` §4 — that path mirrors the same values this
> docs section walks through below but lets you set
> `Environment: Python 3 / Build Command / Start Command / Health Check`
> directly in the dashboard form without going through the GitHub OAuth
> handshake that Blueprint requires.

These are the exact render.com Blueprint clicks that will stand up the
service using the existing `render.yaml`:

1. Sign in to <https://dashboard.render.com>.
2. Click **New +** → **Blueprint**.
3. Connect the GitHub repo that contains `render.yaml` at its root
   (e.g. `jeevesh2515/clinical-rag-agent`).
4. Render will auto-detect the blueprint name `clinical-workflows-api`
   and pre-fill: type `web`, env `Python 3`, region `Oregon`, plan
   `Free`, build `pip install -r requirements.txt`, start `bash bin/start.sh`,
   healthCheckPath `/api/health`.
5. Render prompts for **Secret env vars** — provide the same values the
   Vercel deployment uses:
   - `JWT_SECRET_KEY` (Render will generate if `generate: true` in
     `render.yaml` is honoured; otherwise paste the Vercel value)
   - `DATABASE_URL` (paste the Neon connection string — the same one
     used on Vercel)
   - `OPENROUTER_API_KEY`
   - `COHERE_API_KEY`
6. Click **Apply**. Render kicks off the first build (`pip install -r
   requirements.txt` — expect ~8–12 min on Free tier with the ML stack:
   `sentence-transformers` + `langchain` + `langgraph` + `pgvector` +
   `faiss-cpu`), then starts the Web Service via `bash bin/start.sh`
   which execs `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
7. Once the dashboard shows **Live**, run `curl https://clinical-workflows.onrender.com/api/health`
   and expect `{"status":"ok",...}`.
8. The postStart `/api/ingest` lifecycle hook lives in
   `k8s/deployment.yaml` (not in `Dockerfile`), so it does **not** run
   on Render — Render re-builds but does not call `/api/ingest`
   post-deploy. If the corpus isn't already seeded
   in the Neon DB (it is, 159 chunks), call `POST /api/ingest` once
   against the new Render URL.

**Sanity check after deploy**:

```bash
# Should return {"status":"ok","db":"connected",...}
curl -s https://clinical-workflows.onrender.com/api/health | jq .

# Should return chunk count > 0
curl -s https://clinical-workflows.onrender.com/api/ready | jq '{chunks}'

# End-to-end query smoke (no API key → extractive fallback works)
curl -s -X POST https://clinical-workflows.onrender.com/api/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"What BP target for CKD stage 3?"}' | jq '.answer'
```

## Acceptance criteria

- [x] README badge shows 251 passing
- [ ] Render deployment returns 200 on `/api/health` — **blocked on user (manual dashboard click)**
- [ ] Render has all required env vars — **blocked on user (during the dashboard click)**
- [x] `POST /api/ingest` returns 200 and `chunks > 0` (159 chunks)
- [ ] `.env` has `LOG_LEVEL=INFO` and no remaining placeholders

## Estimated effort

~10 minutes for the user (Render dashboard clicks) — agent work
documented in this section (state verification + docs update).

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

Strictly independent — all tasks completed in one session (2026-07-26).

## Status

✅ **All items completed.**

### 1. ETHICS.md created

9 sections: clinical disclaimer, intended use, system limitations, data privacy,
AI principles, no-PHI policy, transparency, contact, acknowledgment.

### 2. GDPR.md created

12 sections: controller info, legal basis, retention, user rights, data sharing,
transfers, cookies, security, supervisory authority, contact, updates, appendix.

### 3. Footer links updated

- `frontend/src/components/LandingPage.tsx` — `GDPR Compliance` → `/GDPR.md`,
  `Ethics Statement` → `/ETHICS.md`

### 4. README documentation sweep

- Added ETHICS.md & GDPR.md to project structure
- Added compliance links in Security & Safety section
- Added compliance references in Limitations & Disclaimer section
- Added compliance highlight in Key Highlights section
- Bundle size updated in performance baselines (DEPLOYMENT_GUIDE.md)

### 5. Update DEPLOYMENT_GUIDE.md

- Updated "no documents ingested" note — now seeded
- Updated JS bundle size reference (1MB → 437KB)

## Acceptance criteria

- [x] `ETHICS.md` exists and is linked from footer
- [x] `GDPR.md` exists and is linked from footer
- [x] Frontend typecheck passes after link updates
- [x] README is fully accurate (badges, links, instructions)
- [x] `DEPLOYMENT_GUIDE.md` matches current deployment setup

## Estimated effort

Completed in one session (~2 hours).

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
- [x] Production Vercel deployment: ✅ HEALTHY (200 on /api/health)
- [ ] Render deployment: target ✅ HEALTHY (200 on /api/health) — see Day 32 → Manual Provisioning Steps.
- [x] Backend tests: 251 passed, 9 skipped
- [x] Frontend typecheck: ✅ CLEAN
- [x] Frontend build: ✅ SUCCESSFUL (437KB bundle)
- [x] Ruff lint: ✅ PASSING
- [ ] Pre-commit hooks: ✅ PASSING
- [x] Secrets: ✅ NONE committed (verify_secrets.py clean)
- [ ] Load test results: ✅ _TBD_ VALUES POPULATED
- [x] Legal pages: ✅ PRIVACY.md, TERMS.md, ETHICS.md, GDPR.md
- [x] Footer links: ✅ NO PLACEHOLDERS
- [x] Knowledge base: ✅ INGESTED (159 chunks)
- [ ] Auth flow: ✅ SIGNUP → LOGIN → QUERY WORKS
- [x] Documentation: ✅ README, DEPLOYMENT_GUIDE current
- [x] Git: ✅ UP TO DATE with origin/main
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
- [x] Day 35 — Final Compliance, Legal Pages & Documentation
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

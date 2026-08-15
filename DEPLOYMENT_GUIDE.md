# Clinical RAG Workflow Assistant — Deployment & Keys Guide

This guide describes how the application is deployed in production and how to configure API keys.

---

## 1. Live Deployment

| Component | URL | Platform |
|---|---|---|
| Frontend + Backend | https://clinical-workflows.vercel.app | Vercel (free tier) |
| API Base Path | https://clinical-workflows.vercel.app/api | Vercel Python serverless |
| Health Check | https://clinical-workflows.vercel.app/api/health | Returns `{"status":"ok",...}` |

### Architecture

```
Browser → Vercel CDN → [ /assets/* → static cache (1 year) ]
                      → [ /api/*    → api/index.py (Python serverless) ]
                      → [ /*        → index.html SPA fallback ]
```

**vercel.json** routes:
- `/api/(.*)` → Python serverless (`api/index.py`)
- `/assets/(.*)` → static assets with immutable cache (1 year)
- `/*` → SPA fallback (`frontend/dist/index.html`)

A keep-warm cron pings `/api/warmup` daily at 8am UTC to reduce cold starts.

### Performance Baselines (July 2026)

| Measure | Observed |
|---|---|
| Health check (warm) | 170-310ms |
| Frontend HTML (warm) | ~195ms |
| JS bundle (437KB, gzip 130KB) | ~160ms |
| Query response (no API key) | ~260ms (extractive fallback) |
| Cold start (first request after idle) | 3-8s (Vercel serverless) |

### Current Status (as of 2026-07-26)

- **Corpus seeded:** ✅ 159 chunks from NICE NG136, WHO, and CDC guidelines in production Neon DB
- **No API keys in production:** LLM generation falls back to extractive summarization (works, but less fluent)
- To add API keys, set environment variables in Vercel dashboard
- K8s deployments: the `postStart` lifecycle hook in `k8s/deployment.yaml`
  re-ingests the default public guidelines on first boot. For additional
  corpora, call `POST /api/ingest` once per environment.

---

## 2. Local Configuration (.env)

Duplicate `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then fill in the required keys:

| Key | Provider | Obtain At | Required |
|---|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter | https://openrouter.ai/keys | Yes (LLM) |
| `COHERE_API_KEY` | Cohere | https://dashboard.cohere.com | Recommended (embeddings) |
| `JWT_SECRET_KEY` | Self-generated | `openssl rand -hex 32` | Yes (auth) |
| `OPENAI_API_KEY` | OpenAI | https://platform.openai.com | Optional |
| `ANTHROPIC_API_KEY` | Anthropic | https://console.anthropic.com | Optional |
| `GOOGLE_API_KEY` | Google AI | https://aistudio.google.com | Optional |

---

## 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (from project root)
vercel --prod
```

Vercel auto-detects the project from `vercel.json`. The deployment includes:
- Python serverless runtime for the API
- Static file serving for the frontend build

### Environment Variables (set in Vercel Dashboard)

```
OPENROUTER_API_KEY=sk-or-v1-...
COHERE_API_KEY=...
JWT_SECRET_KEY=...
CORS_ORIGINS=https://clinical-workflows.vercel.app
```

---

## 4. Deploy to Render (Web Service)

Render provides a 100% free tier for Python web services:

### 1-Click / Blueprint Deployment
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub repository (`clinical-rag-agent`).
4. Render automatically detects `render.yaml` blueprint.
5. Click **Apply** to deploy!

### Manual Web Service Setup
If creating a Web Service manually on Render:
- **Environment:** `Python 3`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path:** `/api/health`

### Environment Variables on Render
Add your keys in **Environment Variables**:
```env
OPENROUTER_API_KEY=sk-or-v1-...
COHERE_API_KEY=...
JWT_SECRET_KEY=generate-a-secure-random-32-byte-key
CORS_ORIGINS=https://clinical-workflows.vercel.app,http://localhost:5173
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech:5432/neondb?sslmode=require
```

---

## 5. Neon PostgreSQL Permanent Cloud Persistence ($0/month)

To ensure zero data loss across all serverless restarts, devices, and browser logouts:

1. Create a free account at [neon.tech](https://neon.tech).
2. Create a PostgreSQL project and copy your connection string:
   `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech:5432/neondb?sslmode=require`
3. Add `DATABASE_URL` to Vercel and Render environment variables.
4. The backend automatically creates `users`, `conversations`, and `messages` tables and enables `pgvector` for permanent vector embeddings.

---

## 6. Multi-Session Hybrid Persistence Architecture

The application implements a dual-layer storage system:
- **Instant Client Restoration (`cw_storage_${user}_*`)**: Restores conversations, notes stacks, BMI vitals, and profile fields immediately upon login without waiting for network calls.
- **Zero-Overwrite Protection**: Prevents empty serverless sync responses from wiping local history.
- **Global Safety Backup Keys (`cw_conv_list_backup`, `cw_profile_backup`, `cw_notes_stack_backup`)**: Preserves all user data across logins, browser restarts, and serverless cold starts.

---

## 7. Docker Containerization & Permanent Persistent Storage

The entire application (FastAPI backend + React frontend + Database + Document Store) is fully containerized. Docker volumes and host bind mounts provide **100% permanent data retention** so that no user data, chat history, or document versions are lost across container restarts, image updates, or host reboots.

### What is Persisted Permanently?
1. **User Accounts & Authentication**: All registered users, roles (Patient / Clinician), hashed credentials, and session tokens.
2. **Clinical Profiles & Health Vitals**: Systolic/diastolic readings, pulse, weight, BMI history, and clinical notes stack.
3. **Chat History & Messages**: Complete conversation threads, user questions, assistant responses, citations, and tool execution traces.
4. **Source Guidelines & Uploaded Documents**: Raw PDFs in `data/source_documents/raw/`, extracted chunk texts in `processed/`, and versioned manifests in `manifests/`.
5. **Vector Embeddings & Inverted Indexes**: Vector tables in PostgreSQL `pgvector` or persistent local embeddings index.

### Resilience Architecture

The Docker setup includes three layers of resilience so the app never fails to start:

1. **Database Fallback (`app/db/engine.py`)**: If the configured `DATABASE_URL` points to an unreachable remote PostgreSQL host (e.g., DNS resolution failure, network outage), the engine automatically falls back to a persistent local SQLite database at `/app/data/clinical_app.db`. A warning is logged but the application starts normally.
2. **Decoupled Docker Database (`DOCKER_DATABASE_URL`)**: The `docker-compose.yml` uses the dedicated `DOCKER_DATABASE_URL` env var (defaulting to SQLite) instead of inheriting `DATABASE_URL` from `.env`. This prevents local Docker runs from accidentally trying to connect to a cloud database (e.g., Neon) that cannot be reached from the container's network.
3. **Automatic Guideline Priming (`app/main.py` lifespan)**: On startup, the FastAPI lifespan auto-ingests all default clinical guidelines into the HybridStore if the chunk count is 0. This ensures `/api/ready` returns `200 OK` immediately, and the Docker healthcheck passes on first boot without requiring a manual `/api/ingest` call.

### Healthcheck Strategy

| Endpoint | Purpose | Used By |
|---|---|---|
| `/api/health` | **Liveness probe** — confirms the application process is alive and can respond. Always 200 OK. | `Dockerfile HEALTHCHECK`, `docker-compose.yml` |
| `/api/ready` | **Readiness probe** — confirms DB, OKF, and ingestion are all operational. Returns 503 if any subsystem is degraded. | Kubernetes `readinessProbe`, load balancers |

### Quick Start with Docker Compose (Recommended)

```bash
# 1. Build and launch the containerized application
docker compose up -d --build

# 2. Check container status and health
docker compose ps
docker compose logs -f api

# 3. Access the web application
open http://localhost:8000
```

### Storage Configuration

- **Default Standalone Storage (SQLite + Local Volume)**:
  Mounts `./data:/app/data` on the host. The SQLite database is saved directly at `./data/clinical_app.db` and uploaded files in `./data/source_documents/`.
- **Dedicated PostgreSQL + pgvector Storage**:
  Run with the postgres profile to start a dedicated pgvector container:
  ```bash
  docker compose --profile postgres up -d --build
  ```
  Then set `DOCKER_DATABASE_URL=postgresql://clinical:dev@postgres:5432/clinical_rag` in your `.env`.

### Environment Variables for Docker

| Variable | Default | Purpose |
|---|---|---|
| `DOCKER_DATABASE_URL` | `sqlite:////app/data/clinical_app.db` | Docker-specific database URL. Only set this if you want Docker to use something other than local SQLite. |
| `VECTOR_STORE` | `auto` | `auto` picks pgvector for PostgreSQL URLs and HybridStore for SQLite URLs. |
| All API keys (`COHERE_API_KEY`, `OPENROUTER_API_KEY`, etc.) | Read from `.env` | Passed through from your `.env` file automatically via `env_file`. |

### Backup & Restore

```bash
# Backup all persistent data:
tar -czvf clinical_workflows_backup_$(date +%Y%m%d).tar.gz ./data

# Restore from backup:
tar -xzvf clinical_workflows_backup_YYYYMMDD.tar.gz
```

---

## 8. Kubernetes (K8s) Deployment

The project provides production-grade Kubernetes manifests in the `k8s/` directory. Apply them all at once with `kubectl apply -k k8s/` (Kustomize), or individually with `kubectl apply -f`.

### One-Shot Deploy (Recommended)

```bash
# 1. Create your real secret from the bundled template
cp k8s/secret.yaml.template k8s/secret.yaml
# Edit k8s/secret.yaml to inject real JWT_SECRET_KEY, OPENROUTER_API_KEY, etc.

# 2. (Optional) Override the GHCR image name/tag for your environment
kustomize edit set image clinical-rag-app=ghcr.io/<your-org>/clinical-rag-agent:v1.0.0

# 3. Push repo to GitHub so the CD pipeline (docker-deploy.yml) builds & publishes the image

# 4. Apply all manifests in one shot
kubectl apply -k k8s/

# 5. Verify
kubectl rollout status deployment/clinical-workflow-rag --namespace=default
kubectl get ingress -n default  # confirm TLS cert was issued
```

### Per-Manifest Apply

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/serviceaccount.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/networkpolicy.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
# Optional SQLite PV (skip when DATABASE_URL is PostgreSQL/Neon):
kubectl apply -f k8s/pvc.yaml
```

### Kubernetes Architecture Highlights

| Manifest | Purpose | Highlights |
|---|---|---|
| `k8s/kustomization.yaml` | Overlay entry point | Lets operators override image name/tag per environment without editing deployment.yaml |
| `k8s/deployment.yaml` | Application Deployment | Replicas: 2+, RollingUpdate strategy, Non-root user (UID/GID 10001 — pinned to match Dockerfile), Liveness (`/api/health`) & Readiness (`/api/ready`) probes, dedicated ServiceAccount, seccomp=RuntimeDefault |
| `k8s/serviceaccount.yaml` | K8s ServiceAccount | Dedicated SA with `automountServiceAccountToken: false` for future RBAC/IRSA extension |
| `k8s/service.yaml` | ClusterIP Service | Exposes port 8000 internally on port 80 |
| `k8s/networkpolicy.yaml` | Production hardening | Allow ingress only from NGINX ingress-nginx namespace and same-pod traffic |
| `k8s/ingress.yaml` | NGINX Ingress Controller | TLS termination via cert-manager (Let's Encrypt), 10MB payload size limit |
| `k8s/hpa.yaml` | Horizontal Pod Autoscaler | Scales automatically from 2 to 10 replicas based on CPU (70%) and Memory (80%) targets |
| `k8s/configmap.yaml` | Non-sensitive Config | `APP_ENV`, `LOG_LEVEL`, `VECTOR_STORE`, `CORS_ORIGINS` |
| `k8s/secret.yaml` | Sensitive Secrets | `JWT_SECRET_KEY`, `OPENROUTER_API_KEY`, `COHERE_API_KEY`, `DATABASE_URL` |
| `k8s/pvc.yaml` | Optional SQLite PV | 5Gi ReadWriteOnce volume for the bundled demo dataset (skip on Postgres deployments) |

### Image Name + Tag Override

`.github/workflows/docker-deploy.yml` publishes the image as
`ghcr.io/${{ github.repository }}:latest` (e.g. `ghcr.io/your-org/clinical-rag-agent:latest`)
plus an immutable `:${GITHUB_SHA}` tag. Two ways to wire `k8s/deployment.yaml`
to the right image:

**Option A — Kustomize `edit set image`** (no static edit):

```bash
kubectl kustomize k8s/ | kubectl apply -f -
# or, in-cluster:
kustomize edit set image \
  clinical-rag-app=ghcr.io/your-org/clinical-rag-agent:v1.2.3
```

**Option B — direct edit of `k8s/deployment.yaml`**:

Replace the `image:` field under `spec.template.spec.containers[0]` with
`ghcr.io/<your-org>/clinical-rag-agent:<tag>` and commit. The CD workflow
will tag the build with `<tag>` so the rolling update picks up the new
image.

### Production Gotchas

- **Non-root UID match**: The Dockerfile pins the `app` user/group to UID/GID
  10001, and `k8s/deployment.yaml` enforces the same via `runAsUser` /
  `runAsGroup` / `fsGroup`. Mismatched UIDs cause the pod to fail writability
  on `/app/data`.
- **Rolling update first deploy**: With `replicas: 2`, `maxSurge: 1`, and
  `maxUnavailable: 0`, the first ever deployment will block until both pods
  report ready via `/api/ready`. This is intentional — never accept traffic
  on a non-ready pod.
- **Single-writer SQLite**: Multi-replica K8s deployments MUST set
  `DATABASE_URL` to PostgreSQL. Do NOT enable `k8s/pvc.yaml` together with a
  multi-replica deployment + SQLite.
- **NetworkPolicy namespace assumption**: `k8s/networkpolicy.yaml` assumes
  the NGINX Ingress Controller is installed in the `ingress-nginx`
  namespace. Adjust the `namespaceSelector.matchLabels.name` to whichever
  label your controller's namespace carries (e.g. `nginx-ingress`).
- **Ingestion at boot**: The deployment includes a `postStart` lifecycle hook
  that calls `POST /api/ingest` with the default sources. The `/api/ready`
  endpoint returns 503 until `store.chunk_count > 0`, so the load balancer
  will not route traffic until ingestion completes. For multi-replica HPA
  scale-up events, this means a single new pod will hit `/api/ingest` once
  per scale event. For larger deployments, prefer running a one-time
  `kubectl create job --from=cronjob/clinical-ingest-once` Job from CI
  before the rolling deploy, and remove the postStart hook.
- **Graceful shutdown**: `terminationGracePeriodSeconds: 90` plus a 30s
  `preStop` sleep gives the load balancer time to drain traffic before
  SIGTERM. OpenRouter-backed LLM calls can take 60s+; the default 30s
  `terminationGracePeriodSeconds` would cut them off mid-flight.
- **PodDisruptionBudget**: `k8s/pdb.yaml` keeps `minAvailable: 1` so a node
  drain during a rolling release cannot take both pods offline. If you raise
  `replicas` via HPA, raise `minAvailable` accordingly.
- **Image tag**: The default image is `:latest` for dev convenience. For
  production, pin to a specific digest or semver tag via Kustomize:
  `kustomize edit set image ghcr.io/jeevesh2515/clinical-rag-agent=ghcr.io/<your-org>/clinical-rag-agent:v1.0.0`
  and commit the regenerated `kustomization.yaml` to your environment
  branch. The CI workflow also publishes immutable `:${GITHUB_SHA}` tags —
  prefer those for rollback.
- **HPA scaling signal**: The default HPA scales on CPU/memory. The app is
  I/O-bound (most wall time is waiting on OpenRouter), so CPU rarely exceeds
  70%. For production-scale triggering, install Prometheus Adapter or KEDA
  and scale on `http_requests_in_flight` or `request_queue_depth`.

### Multi-Replica Horizontal Scaling (Day 28 — pgvector)

The `VECTOR_STORE` config flag (default `"auto"`) plus the `DATABASE_URL`
scheme determine whether the agent scales across replicas:

| `DATABASE_URL` | `VECTOR_STORE` | Backend | Multi-replica safe? |
|---|---|---|---|
| `sqlite:///...` | `auto` (default) | in-memory `HybridStore` | **NO** — each pod has its own index |
| `postgresql://...` | `auto` (default) | `PgVectorStore` (pgvector + HNSW) | **YES** — all replicas share the table |
| any | `memory` | in-memory `HybridStore` | **NO** — explicit override |
| any | `pgvector` | `PgVectorStore` | **YES** — explicit override |

**Why this matters**: before pgvector, every K8s replica had its own in-memory
`HybridStore` (a Python dict of dense + sparse vectors). The postStart
`/api/ingest` hook would populate *only that replica's* index, so
load-balancer round-robin would route 50% of queries to empty pods and
return "I could not find enough evidence". After pgvector, all replicas
share the `chunk_vectors` table in PostgreSQL, so any pod can answer any
query correctly.

**Production rollout checklist** (verified against `tests/load/baseline.js`
and `tests/load/burst.js`):

1. Provision Neon or Supabase PostgreSQL with the `vector` extension
   enabled (`CREATE EXTENSION IF NOT EXISTS vector`).
2. Set `DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech:5432/db?sslmode=require`
   in `k8s/secret.yaml`.
3. Leave `VECTOR_STORE=auto` in `k8s/configmap.yaml` — the factory in
   `app.retrieval.store.create_store()` detects the postgres URL and picks
   `PgVectorStore` automatically.
4. First deploy: the postStart `/api/ingest` populates `chunk_vectors` once.
5. Verify all replicas serve identical results:
   ```bash
   for pod in $(kubectl get pods -l app.kubernetes.io/name=clinical-workflow-rag -o name); do
     kubectl exec -c app $pod -- curl -s localhost:8000/api/health
   done
   ```
6. Run k6 baseline + burst against staging to confirm scale-up works
   (see `docs/LOAD_TEST_RESULTS.md` for pass criteria and `tests/load/`
   for the k6 scripts).

**Connection pooling**: with 10 KEDA-driven replicas, point `DATABASE_URL`
at a pgbouncer transaction-pooled endpoint rather than the direct Neon
URL. Each replica holds a small connection pool (5–10) so 10 replicas × 10
connections = 100 backend connections, which exceeds Neon's free-tier
limit of 100. Either keep the HPA `maxReplicaCount: 10` or use Neon
pooler (free up to 100 connections).

**Why HNSW over IVFFlat**: for the dataset sizes this service expects
(5K–100K chunks), HNSW gives ~99% recall at ~10ms query time without
the `nlist` retuning that IVFFlat would require as the corpus grows. The
factory creates the HNSW index with `m=16, ef_construction=64` and
auto-falls-back to IVFFlat on small datasets (<100 rows) where HNSW
build fails.

---

## 8. Continuous Delivery (CD) Pipelines

The repository features automated GitHub Actions workflows in `.github/workflows/`:

1. **Vercel Serverless CD (`automatic`)**:
   - Pushing to `main` automatically triggers Vercel to compile the React frontend and deploy the Python serverless backend to `https://clinical-workflows.vercel.app`.

2. **Docker Container CD (`.github/workflows/docker-deploy.yml`)**:
   - Runs linting (`ruff`), unit tests (`pytest`), and OKF validation (`make okf-check`).
   - Builds the production multi-stage `Dockerfile`.
   - Pushes tagged image (`ghcr.io/jeevesh2515/clinical-rag-agent:latest`) directly to **GitHub Container Registry (GHCR)**.

---

## 9. Dual-Platform Uptime Monitoring

The project ships **two production endpoints**:

- `https://clinical-workflows.vercel.app/api/health` — Vercel Python serverless (live today, returns `200` with 159 chunks + 27 OKF concepts)
- `https://clinical-workflows.onrender.com/api/health` — Render Web Service (returns `404` today; goes `200` after Day 32's 8-step Blueprint click-through completes)

Cold starts on either tier can spike the first request after idle — we want both monitors to fire when a real outage happens.

The repo provides **two paths**. Pick the one that fits your operational
shape:

| Path | Setup | Granularity | Alerting surface | GitHub Actions minutes | Cost |
|---|---|---|---|---|---|
| **A. `.github/workflows/uptime-monitor.yml`** (in-repo, primary) | Zero — already wired on cron `*/5 * * * *` + `workflow_dispatch` | 5 min | Workflow-failure → email repo watchers (default GH behaviour) | ~850 min/month on free tier (well under 2,000 cap) | $0 |
| **B. UptimeRobot / better-uptime.com** (SaaS, optional supplement) | User creates account, adds 2 HTTP(s) monitors | 1 min | Email / SMS / Slack / Discord / Telegram (per plan) | None (external) | Free tier, 50 monitors |

### Path A — GitHub-Actions cron (primary, in-repo)

The workflow at `.github/workflows/uptime-monitor.yml` runs every 5 minutes.
For each platform it:

1. `curl --max-time 60 https://<host>/api/health` (60 s timeout tolerates
   both Vercel serverless 3-8 s cold-starts and Render Free's 15-min idle
   spin-down 3-8 s cold-starts).
2. Asserts HTTP 200 — fails the workflow otherwise.
3. Pipes the body through `jq` and asserts `.status == "ok"` AND
   `.chunks >= 1`. This catches **silent regressions** (e.g. `status:
   degraded`, `chunks: 0` after a broken ingestion, `okf.unavailable:
   true`) that a 200-only check would miss.
4. Surfaces failures via the GitHub Actions workflow summary + the
   default email-to-watchers alert.

You can also trigger it manually:

- **GitHub UI:** repo → Actions → "Uptime Monitor (Vercel + Render)" →
  Run workflow. Optional `base_url` input lets you point both probes at
  a temporary host (e.g. a PR preview deploy) for shape-validation.
- **CLI:**
  ```bash
  gh workflow run uptime-monitor.yml
  gh workflow run uptime-monitor.yml \
    --field base_url=https://clinical-workflows-pr-42.vercel.app
  ```

**Before Render is Live (today):** the `monitor-render` job fails every
cron tick and emails repo watchers (~288 emails/day) until Day 32 closes.
Disable the workflow on the Actions tab, *or* edit
`.github/workflows/uptime-monitor.yml` and comment out the
`monitor-render` job block, if you'd rather suppress the noise during
the provisioning window.

### Path B — UptimeRobot or better-uptime.com (supplement, user-driven)

If you want 1-minute granularity, an external SLA-grade dashboard, or
SMS / Slack / Discord alerts that don't depend on GitHub Actions being
on-time, supplement Path A with one of these SaaS monitors:

1. Create account at https://uptimerobot.com (or https://better-uptime.com).
2. Add a **HTTP(s)** monitor for each URL:
   - `https://clinical-workflows.vercel.app/api/health`
   - `https://clinical-workflows.onrender.com/api/health` (skip until
     Render is Live)
3. Interval: **1-5 minutes** (free tier caps at 5 min for UptimeRobot).
4. Alert contacts: **Email** (free tier), optionally Slack/Discord/
   Telegram/PagerDuty on paid tiers.

This complements Path A rather than replaces it: GitHub-Actions-in-repo
gives you a fail-fast alert + a `gh workflow run` knob for offline
testing, while the SaaS monitor gives you a noisy-friendly dashboard
+ external SLA-grade alerting.

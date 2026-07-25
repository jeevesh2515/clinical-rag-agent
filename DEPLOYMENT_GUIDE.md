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
| JS bundle (1MB) | ~195ms |
| Query response (no API key) | ~260ms (extractive fallback) |
| Cold start (first request after idle) | 3-8s (Vercel serverless) |

### Current Limitations (no API keys in production)

- No OpenRouter API key configured → LLM generation falls back to extractive summarization
- No documents ingested → queries return "out_of_domain" intent
- To enable full functionality, add environment variables in Vercel dashboard
- Same caveat applies to bare K8s deployments: the pod starts with an empty
  HybridStore. The `postStart` lifecycle hook in `k8s/deployment.yaml`
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

---

## 7. Kubernetes (K8s) Deployment

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

## 9. Uptime Monitoring (Recommended)

Set up a free UptimeRobot monitor to ping every 5 minutes:

1. Create account at https://uptimerobot.com
2. Add new monitor: **HTTP(s)** → `https://clinical-workflows.vercel.app/api/health`
3. Interval: **5 minutes**
4. Alert contacts: **Email** (free tier)

This prevents excessive cold starts during working hours.

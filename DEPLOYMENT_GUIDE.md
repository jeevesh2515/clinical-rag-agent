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

The project provides production-grade Kubernetes manifests in the `k8s/` directory.

### Quick Start (Deploying to K8s)

```bash
# 1. Create secret from template
cp k8s/secret.yaml.template k8s/secret.yaml
# Edit k8s/secret.yaml with real base64/string secrets

# 2. Apply ConfigMap and Secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 3. Deploy Application & Internal Service
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# 4. Enable Horizontal Pod Autoscaler & Ingress (Optional)
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
```

### Kubernetes Architecture Highlights

| Manifest | Purpose | Highlights |
|---|---|---|
| `k8s/deployment.yaml` | Application Deployment | Replicas: 2+, RollingUpdate strategy, Non-root user (UID 10001), Liveness (`/api/health`) & Readiness (`/api/ready`) probes |
| `k8s/service.yaml` | ClusterIP Service | Exposes port 8000 internally on port 80 |
| `k8s/ingress.yaml` | NGINX Ingress Controller | TLS termination via cert-manager (Let's Encrypt), 10MB payload size limit |
| `k8s/hpa.yaml` | Horizontal Pod Autoscaler | Scales automatically from 2 to 10 replicas based on CPU (70%) and Memory (80%) targets |
| `k8s/configmap.yaml` | Non-sensitive Config | `APP_ENV`, `LOG_LEVEL`, `VECTOR_STORE`, `CORS_ORIGINS` |
| `k8s/secret.yaml` | Sensitive Secrets | `JWT_SECRET_KEY`, `OPENROUTER_API_KEY`, `COHERE_API_KEY`, `DATABASE_URL` |

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

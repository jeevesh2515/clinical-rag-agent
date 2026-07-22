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
DATABASE_URL=sqlite:///./clinical_demo.db
```

---

## 5. Running via Docker

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

- Host: `http://localhost:8000`
- API: `http://localhost:8000/api`
- Health: `docker ps` shows `healthy` once DB + OKF verified

---

## 5. Continuous Integration

GitHub Actions workflows in `.github/workflows/`:
- **ci.yml** — Runs on push to any branch: lint, test, frontend build
- **docker-deploy.yml** — Docker build on main branch only

---

## 6. Uptime Monitoring (Recommended)

Set up a free UptimeRobot monitor to ping every 5 minutes:

1. Create account at https://uptimerobot.com
2. Add new monitor: **HTTP(s)** → `https://clinical-workflows.vercel.app/api/health`
3. Interval: **5 minutes**
4. Alert contacts: **Email** (free tier)

This prevents excessive cold starts during working hours.

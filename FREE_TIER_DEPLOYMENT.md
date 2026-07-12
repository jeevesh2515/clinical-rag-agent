# Free Tier Production Deployment

Deploy the Clinical Workflows RAG chatbot for hypertension guidelines at **$0/month** using free tiers of Vercel, Render, Neon/Supabase, OpenRouter, and Upstash.

---

## 1. Architecture Overview

```
Browser
  |
  v
Vercel (React frontend, free tier)
  |
  v
Render Web Service (FastAPI backend, free tier, port 10000)
  |         |
  |         v
  |    Upstash Redis (caching, 10MB free)  -- optional
  |
  v
Neon or Supabase (PostgreSQL + pgvector, free tier)
  |
  v
OpenRouter (free LLM models: Llama 3.1 8B, DeepSeek R1, Gemma 4, Nemotron)
```

**Cost breakdown:**

| Component | Service | Cost |
|---|---|---|
| Frontend | Vercel free tier (100GB bandwidth, unlimited requests) | $0 |
| Backend | Render free tier (750 hours/month, 512MB RAM) | $0 |
| Database | Neon free tier (500MB storage, auto-suspend) | $0 |
| OR Supabase | Supabase free tier (500MB DB, 1GB storage, 50K MAU) | $0 |
| LLM | OpenRouter free models (rate-limited) | $0 |
| Embeddings | Deterministic hash embeddings (no API key) | $0 |
| Auth | JWT + bcrypt (self-managed) | $0 |
| Caching | Upstash Redis (10MB free) or in-memory | $0 |
| Monitoring | Render built-in logs + Sentry free (5K events/month) | $0 |
| Custom domain | Supported on all platforms free tier | $0 |
| **Total** | | **$0/month** |

**Traffic limits:**
- Render: 750 hours/month (sleeps when idle, wakes on request, ~15s cold start)
- Neon: auto-suspend after inactivity, ~5s cold start for first query
- OpenRouter: rate limits vary by model (typically 20-60 req/min on free models)
- Vercel: 100GB bandwidth, 100 serverless invocations/day on hobby (but frontend is static)

---

## 2. Step-by-Step Deployment

### A) Backend on Render

1. Create a free account at https://render.com (verify email)
2. Click **New +** > **Web Service** > **Connect your GitHub repo**
3. Select the clinical-workflows repository
4. Configure:

   | Field | Value |
   |---|---|
   | Name | `clinical-workflows-api` |
   | Environment | `Python 3` |
   | Region | `Oregon` (us-east) |
   | Branch | `main` |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `uvicorn app.main:app --host 0.0.0.0 --port 10000` |
   | Plan | **Free** |

5. Add environment variables in Render dashboard:

   ```
   DATABASE_URL=postgresql://user:pass@neon-host/db?sslmode=require
   COHERE_API_KEY=           (optional, leave blank for hash embeddings)
   OPENROUTER_API_KEY=sk-or-v1-...
   JWT_SECRET_KEY=<generate with: openssl rand -hex 32>
   RATE_LIMIT_ENABLED=false
   CACHE_TYPE=redis          (or "memory")
   UPSTASH_REDIS_URL=        (optional, leave blank for in-memory)
   UPSTASH_REDIS_TOKEN=      (optional)
   ENVIRONMENT=production
   LOG_LEVEL=info
   ```

6. Click **Create Web Service**
7. Render auto-deploys on every push to `main`. Trigger manual deploy: Dashboard > Manual Deploy > Deploy latest commit

**Render free tier caveats:**
- Cold start ~15s after inactivity (spins down after 15 min idle)
- 750 hours/month = ~25 hours/day average; sleeping covers the gap
- No custom domains on free (use `*.onrender.com` subdomain)
- No private network, no persistent disk (SQLite not viable — use Neon)

### B) PostgreSQL + pgvector on Neon

1. Create account at https://console.neon.tech (GitHub OAuth)
2. Create a project:
   - Region: `US East` (matches Render)
   - Plan: **Free**
3. Copy the connection string from Dashboard > Connection Details:

   ```
   postgresql://[user]:[password]@[neon-host]/[dbname]?sslmode=require
   ```

4. Enable pgvector extension:

   ```bash
   # Connect via psql or Neon SQL Editor
   psql "postgresql://[user]:[password]@[neon-host]/[dbname]?sslmode=require"

   CREATE EXTENSION IF NOT EXISTS vector;
   SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
   ```

5. The app auto-creates tables on first startup (see `app/db.py` migration logic). Verify:

   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   ```

6. Neon provides **PgBouncer** connection pooling automatically via the pooled connection string (add `?pgbouncer=true` or use the pooled URL shown in dashboard). The app uses SQLAlchemy with pool settings that handle auto-suspend gracefully.

### C) Alternative: PostgreSQL + pgvector on Supabase

1. Create account at https://supabase.com
2. **New project** > name `clinical-workflows`, set secure DB password, region matching Render
3. Wait for provisioning (~2 min), then go to **Project Settings** > **Database** > **Connection string**:

   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

4. Enable pgvector in **SQL Editor**:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

5. Supabase adds value: built-in auth (if you want to migrate from JWT), storage buckets (1GB free for file uploads), Row Level Security.

6. Update `DATABASE_URL` to point at Supabase in Render env vars. Connection pooling: use port `6543` instead of `5432` for Supavisor pooler.

### D) LLM via OpenRouter (free models)

1. Create account at https://openrouter.ai (GitHub OAuth)
2. Generate API key at https://openrouter.ai/keys
3. **Enable free models**:
   - Go to https://openrouter.ai/settings/privacy
   - Toggle **"Enable free models"** ON
   - Note: some free models require providing a valid payment method (not charged) — add one in Billing
4. Set in Render env:

   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct
   ```

5. **Free models available** (tested with this app):

   | Model | Route | Notes |
   |---|---|---|
   | Llama 3.1 8B | `meta-llama/llama-3.1-8b-instruct` | Best quality/speed balance |
   | DeepSeek R1 | `deepseek/deepseek-r1` | Strong medical reasoning, slower |
   | Gemma 4 | `google/gemma-4` | Fast, good for structured output |
   | Nemotron | `nvidia/llama-nemotron-4-340b-instruct` | Very capable but rate-limited |
   | Mistral 7B | `mistralai/mistral-7b-instruct` | Fallback, always available |

6. **No-API-key fallback**: If `OPENROUTER_API_KEY` is not set, the app falls back to extractive summarization (sentence extraction + TF-IDF scoring). Works fully offline, no external calls.

### E) Vercel Frontend (existing configuration)

1. The frontend is already deployed on Vercel. Update it to point at the new Render backend:

   ```bash
   # In Vercel dashboard or via CLI:
   vercel env add VITE_API_URL production
   # Value: https://clinical-workflows-api.onrender.com
   ```

2. If using `vercel.json`, add:

   ```json
   {
     "rewrites": [
       { "source": "/api/(.*)", "destination": "https://clinical-workflows-api.onrender.com/api/$1" }
     ]
   }
   ```

   **Better**: remove the rewrite and just use `VITE_API_URL` in the frontend code — this avoids Vercel serverless function overhead and keeps the frontend pure static.

3. Redeploy:

   ```bash
   vercel --prod
   ```

### F) Custom Domain

Both Render and Vercel support custom domains on free tier with auto-provisioned TLS (Let's Encrypt).

- **Vercel**: Project Settings > Domains > add `chat.yourpractice.com`
- **Render**: Dashboard > your-web-service > Settings > Custom Domain
- Update DNS with the `CNAME` record provided by each platform.

---

## 3. Ingesting Data on Free Tier

### Uploading guidelines

```bash
# Via the ingestion endpoint
curl -X POST https://clinical-workflows-api.onrender.com/api/ingest/pdf \
  -F "file=@guidelines/ACC_AHA_Hypertension_2017.pdf"

# Or via the docs endpoint:
curl -X POST https://clinical-workflows-api.onrender.com/api/ingest/document \
  -H "Content-Type: application/json" \
  -d '{"title": "JNC 8", "content": "Full guideline text here..."}'
```

### OKF knowledge bundle

The 27 curated hypertension concept files in `hypertension-okf/` are ingested automatically on app startup via the `ingest_okf_bundle` function in `app/okf/`. This runs every time the app starts — no manual step needed.

### Re-ingesting after database reset

Neon free tier auto-suspends after 5 minutes of inactivity. If the DB is reset (drop all tables), the app auto-creates tables and re-ingests the OKF bundle on next request. For uploaded PDFs, re-upload via the ingestion endpoint.

---

## 4. Scaling Limits — What Breaks First

| Component | Free Limit | Bottleneck At |
|---|---|---|
| **Render** | 750 hrs/month (512MB RAM, 1 CPU share) | ~15 concurrent users or ~50 queries/hour, whichever comes first. RAM limits large embedding batches. |
| **Neon free** | 500MB storage, auto-suspend, compute credits limit | ~5K vector embeddings (768d, ~3KB each = ~15MB for vectors, metadata adds more). Compute credits cap at ~50 hours/month of active compute. |
| **Supabase free** | 500MB DB, 1GB storage, 50K MAU | ~10K vectors + metadata. 50K monthly active users is generous but row-level security adds overhead. |
| **OpenRouter free** | Rate limited per model (~20-60 req/min), no SLA | ~20 queries/minute. Free models may be queued behind paid traffic. |
| **Upstash free** | 10MB Redis, 1000 commands/day | ~500 cached responses. Upgrade at 1000 daily cache hits. |
| **Sentry free** | 5K events/month | ~50 errors/day before hitting limit. |

**First bottleneck**: **Neon compute credits** — auto-suspend is aggressive and every cold start burns credits. If you run 24/7 queries, you exhaust credits in ~2 days. Mitigation: keep a health-check ping every 5 minutes (cron job from https://cron-job.org free tier) to prevent suspend.

**Second bottleneck**: **Render 750 hours/month** — real-world app with visitors = ~30 days sleep, ~0 days of continuous uptime. Acceptable for demo/light use.

When either of these becomes painful, follow the upgrade path in section 5.

---

## 5. Migration: Free to Paid Production

Reference `PRODUCTION_ARCHITECTURE.md` for full paid architecture. The order below minimizes cost while avoiding data loss.

### Phase 1: Database (first to upgrade)

| Free | Paid | Cost |
|---|---|---|
| Neon free (500MB) | Neon Launch ($19/mo, 8GB storage, 300h compute) | +$19/mo |
| Or Supabase free | Supabase Pro ($25/mo, 8GB DB, 100GB bandwidth) | +$25/mo |

**Migration steps (zero-downtime):**
1. Provision paid Neon/Supabase project
2. Dump and restore data:
   ```bash
   pg_dump --no-owner --no-acl $FREE_DATABASE_URL > dump.sql
   psql $PAID_DATABASE_URL < dump.sql
   ```
3. Update `DATABASE_URL` env var in Render
4. Deploy (Render auto-deploys). Old in-flight requests use old DB, new requests use new DB.
5. Drop free project after confirming no errors.

### Phase 2: Backend

| Free | Paid | Cost |
|---|---|---|
| Render free (750h, 512MB) | Render Starter ($7/mo, 512MB, no sleep) | +$7/mo |
| Or Railway free ($5 credit) | Railway Hobby ($5/mo, 1GB RAM) | +$5/mo |

**Migration:** Upgrade Render plan in dashboard (Plan > Change Plan > Starter). No code changes. No downtime — Render keeps the same URL.

### Phase 3: Caching

| Free | Paid | Cost |
|---|---|---|
| Upstash free (10MB) | Upstash Pay-as-you-go ($0.30/GB) | +~$2/mo |
| Or in-memory | Upstash or Redis Cloud 30MB free | +$0 |

**Migration:** Set `CACHE_TYPE=redis` and add `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN` env vars. Deploy.

### Phase 4: LLM

| Free | Paid | Cost |
|---|---|---|
| OpenRouter free models | OpenRouter paid: Llama 3.1 70B ($0.59/M tokens) or GPT-4o mini ($0.15/M tokens) | +~$5-20/mo depending on usage |

**Migration:** Change `OPENROUTER_MODEL` env var. No code changes. Or switch to a direct API key (OpenAI, Anthropic).

### Phase 5: Monitoring

| Free | Paid | Cost |
|---|---|---|
| Render logs + Sentry free | Sentry Team ($26/mo) or Datadog/Axiom | +$26/mo (optional) |

**Migration:** Upgrade Sentry plan in dashboard. No code changes.

### Final paid architecture cost

| Tier | Monthly Cost |
|---|---|
| Vercel free | $0 |
| Render Starter | $7 |
| Neon Launch | $19 |
| Upstash usage | ~$2 |
| OpenRouter paid | ~$10 |
| Sentry free | $0 |
| **Total** | **~$38/mo** |

See `PRODUCTION_ARCHITECTURE.md` for the full paid production specification.

---

## 6. Quick Start Checklist (30 minutes)

- [ ] **Render**: Create account at render.com, create Web Service, set env vars, note `*.onrender.com` URL
- [ ] **Neon**: Create account at neon.tech, create project, copy connection string, enable pgvector
- [ ] **OpenRouter**: Create account, generate API key, enable free models in settings
- [ ] **Render env**: Set `DATABASE_URL`, `OPENROUTER_API_KEY`, `JWT_SECRET_KEY`
- [ ] **Deploy**: Push to GitHub (Render auto-deploys). Verify at `https://clinical-workflows-api.onrender.com/docs`
- [ ] **Vercel**: Set `VITE_API_URL=https://clinical-workflows-api.onrender.com`, redeploy
- [ ] **Verify**: Open the Vercel frontend URL, ask "What is the target BP for CKD patients?"
- [ ] **Cron** (optional): Set up cron-job.org to ping `https://clinical-workflows-api.onrender.com/health` every 14 min to prevent Render/Neon sleep
- [ ] **Custom domain** (optional): Point DNS at Render and Vercel, enable TLS
- [ ] **Enjoy**: $0/month clinical RAG chatbot in production

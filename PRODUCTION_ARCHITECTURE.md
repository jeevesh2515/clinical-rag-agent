# Production Architecture — Clinical Workflows

> Clinical RAG chatbot for hypertension guidelines. Targets 1M+ MAU on AWS.

---

## 1. Architecture Overview

```
                          ┌──────────────────────────────────────────────────┐
                          │                  Route 53                        │
                          │           clinical.example.com                   │
                          └──────────┬───────────────────────────────────────┘
                                     │
                          ┌──────────▼───────────────────────────────────────┐
                          │           CloudFront (CDN)                       │
                          │   /assets/* → S3 (static frontend)               │
                          │   /api/*    → ALB (dynamic)                      │
                          └──────────┬───────────────────────────────────────┘
                                     │
                          ┌──────────▼───────────────────────────────────────┐
                          │         WAF (Web ACL)                            │
                          │   Rate-based rules, SQLi/XSS blocking,           │
                          │   IP reputation lists, bot control               │
                          └──────────┬───────────────────────────────────────┘
                                     │
                          ┌──────────▼───────────────────────────────────────┐
                          │     ALB (Application Load Balancer)              │
                          │   Sticky sessions off, idle timeout 60s,         │
                          │   health check: GET /api/ready                   │
                          └──────────┬───────────────────────────────────────┘
                 ┌───────────────────┼───────────────────────┐
                 │                   │                       │
     ┌───────────▼───────────┐ ┌────▼────────────┐ ┌───────▼───────────┐
     │  ECS Fargate Service  │ │  ECS Fargate    │ │  ECS Fargate      │
     │  (FastAPI container)  │ │  (FastAPI)       │ │  (FastAPI)        │
     │  az-a                 │ │  az-b            │ │  az-c             │
     └───────────┬───────────┘ └────────┬─────────┘ └────────┬──────────┘
                 │                      │                    │
                 └──────────────────────┼────────────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           │                            │                            │
   ┌───────▼────────┐         ┌─────────▼──────────┐     ┌──────────▼─────────┐
   │  ElastiCache   │         │    RDS PostgreSQL  │     │    S3 (documents)  │
   │  Redis (v7)    │         │    + pgvector       │     │   user_uploads/    │
   │                │         │    Multi-AZ         │     │   guideline_pdfs/  │
   │  • LLM cache   │         │    Read replicas    │     │   ingestion_cache/ │
   │  • Session     │         │    (2x for query)   │     └────────────────────┘
   │  • Rate limits │         └─────────┬──────────┘
   │  • Celery      │                   │
   │    broker      │         ┌─────────▼──────────┐
   └────────────────┘         │    pgbouncer        │
                              │   (connection pool) │
                              └─────────────────────┘

   ┌─────────────────────────────────────────────────────────────────────┐
   │  ECS Fargate (Background Tasks)                                     │
   │  Celery workers (document ingestion, OCR, bulk reranking)           │
   └─────────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────────┐
   │  CloudWatch                                                         │
   │  • Logs (structured JSON from all containers)                       │
   │  • Metrics (request latency, error rates, queue depth, DB conns)    │
   │  • Dashboards + Alarms (p95 > 5s → SNS → PagerDuty)                │
   │  • X-Ray tracing (end-to-end request traces)                        │
   └─────────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────────┐
   │  Secrets Manager                                                     │
   │  • COHERE_API_KEY, OPENAI_API_KEY, JWT_SECRET_KEY, DATABASE_URL     │
   │  • Rotated automatically every 90 days                              │
   └─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Scaling Strategy

### 2.1 Compute: Horizontal Scaling

| Tier | MAU | FastAPI containers | Fargate CPU/Mem | Auto-scaling rule |
|------|-----|-------------------|-----------------|-------------------|
| Dev  | <1K  | 1× small          | 0.5 vCPU / 2GB  | Fixed             |
| Prod | 10K  | 2–4×              | 1 vCPU / 4GB    | CPU > 70% → +1    |
| Prod | 100K | 4–12×             | 2 vCPU / 4GB    | CPU > 60% → +2    |
| Prod | 1M   | 12–40×            | 2 vCPU / 4GB    | CPU > 50% → +4    |

Each container runs `uvicorn` with `--workers $(nproc)` behind ALB. No session
affinity — the agent is stateless (state lives in Redis + RDS).

### 2.2 Database: SQLite → PostgreSQL + pgvector

**Rationale:** SQLite is single-writer, file-bound, and has no vector index.
PostgreSQL with pgvector provides:
- Concurrent readers/writers (Multi-AZ RDS)
- IVFFlat or HNSW indexes on 1536-dim vectors
- Horizontal read scaling via replicas
- Point-in-time recovery

**Connection pooling:** pgbouncer in transaction mode between containers and RDS.
Each container pool: 10–20 connections. Max 400 concurrent connections at 40 containers.

### 2.3 Vector Search: In-Memory → pgvector

Current `HybridStore` holds dense + sparse vectors in Python dicts — resets on
every deploy and cannot scale past a single process.

**Migration:**
- Dense embeddings (1536-dim float vectors) stored in `pgvector` column with
  HNSW index (ef_construction=200, m=32).
- Sparse BM25 vectors handled by PostgreSQL full-text search (`tsvector` +
  `ts_query`) or a dedicated `splade` sparse column.
- Hybrid fusion (alpha × dense + (1-alpha) × sparse) done in SQL via
  `SELECT ..., (alpha * (1 - (embedding <=> :query)) + (1-alpha) * ts_rank(...)) AS hybrid_score`.

### 2.4 Caching: Redis ElastiCache

```
┌──────────────┐  ┌────────────────────┐  ┌─────────────────┐
│ LLM Response │  │ Frequent Queries   │  │ Session State   │
│ Cache        │  │ Cache              │  │ (per user)      │
├──────────────┤  ├────────────────────┤  ├─────────────────┤
│ TTL: 24h     │  │ TTL: 1h           │  │ TTL: 30min      │
│ Key: sha256  │  │ Key: query hash   │  │ Key: session_id │
│ (question +  │  │ Value: QueryResp   │  │ Value: chat     │
│  context)    │  │ JSON              │  │ history         │
│ Size: ~5KB   │  │ Hit rate target:  │  │                  │
│ per entry    │  │ 40%               │  │                  │
└──────────────┘  └────────────────────┘  └─────────────────┘
```

### 2.5 Async Task Queue: Celery + Redis

Heavy operations offloaded from the request path:

| Task | Queue | Priority | Timeout |
|------|-------|----------|---------|
| Document ingestion (PDF → chunks → embed) | `ingestion` | Low | 300s |
| OCR processing (image uploads) | `ocr` | Low | 600s |
| Bulk reranking | `rerank` | Medium | 120s |
| Pre-computation of popular queries | `precompute` | Background | 600s |
| User corpus rebuild after upload delete | `indexing` | Low | 60s |
| Eval runs | `eval` | Background | 600s |

### 2.6 Storage: Local FS → S3

| Current | Production |
|---------|-----------|
| `data/uploads/{user_id}/{file}` | `s3://clinical-uploads/{env}/users/{user_id}/{file}` |
| `data/manifests/` | `s3://clinical-uploads/{env}/manifests/` |
| `data/download_cache/` | `s3://clinical-download-cache/{env}/` |
| `frontend/dist/` | `s3://clinical-frontend/{version}/` → CloudFront |

---

## 3. AWS Services

### 3.1 Container Orchestration: ECS Fargate

**Why Fargate over EKS:** Lower operational overhead for a single service.
EKS adds ~$73/mo control plane cost and requires cluster autoscaler management.
Switch to EKS if multi-service mesh or GPU inference becomes necessary.

| Resource | Specification |
|----------|--------------|
| Task definition | `clinical-api:latest` |
| CPU / Memory | 2 vCPU / 4 GB (auto-scaled) |
| Task count | 2 minimum, 40 maximum |
| Platform version | 1.4.0 (Linux) |
| Deployment | Blue/green via CodeDeploy |
| Log driver | `awslogs` → CloudWatch |

### 3.2 RDS PostgreSQL + pgvector

| Parameter | Value |
|-----------|-------|
| Instance class | `db.r6g.large` (10K), `db.r6g.2xlarge` (100K), `db.r6g.4xlarge` (1M) |
| Multi-AZ | true |
| Storage | 500 GB gp3 (auto-scaling enabled) |
| Backup retention | 30 days |
| Deletion protection | true |
| Parameter group | `clinical-pg16` with `shared_preload_libraries = 'pgvector'` |
| Read replicas | 2 for query isolation (offload `/query` reads) |
| Connection pooler | pgbouncer sidecar on same instance or separate small RDS |

### 3.3 ElastiCache Redis

| Parameter | Value |
|-----------|-------|
| Node type | `cache.r6g.large` (13 GB, ~3M keys) |
| Shards | 1 (no clustering needed) |
| Replicas | 1 (Multi-AZ) |
| Eviction policy | `allkeys-lru` |
| Reserved memory | 25% |
| Encryption in transit | true |
| Encryption at rest | true |

### 3.4 S3

| Bucket | Purpose | Lifecycle | Versioning |
|--------|---------|-----------|------------|
| `clinical-uploads-{env}` | User PDFs, images, notes | 90d → Glacier, 365d → expire | Enabled |
| `clinical-cache-{env}` | Ingestion cache, manifests | 7d → expire | Disabled |
| `clinical-frontend-{env}` | Built React assets | None | Enabled |
| `clinical-logs-{env}` | Access logs, flow logs | 30d → Glacier, 365d → expire | Enabled |

### 3.5 Supporting Services

| Service | Purpose |
|---------|---------|
| Route 53 | `api.clinical.example.com` (ALIAS to ALB), `clinical.example.com` (ALIAS to CloudFront) |
| CloudFront | Edge caching of `/assets/*` (immutable, 1y TTL), `index.html` (no-cache), `/api/*` pass-through |
| WAF | IP rate limiting (100 req/s per IP), SQLi/XSS rules, AWSManagedBotControl, geo-blocking (if needed) |
| ACM | TLS certificate for `*.clinical.example.com` in us-east-1 |
| SNS | Alarm notifications → email + PagerDuty webhook |
| Secrets Manager | API keys, JWT secret, database credentials, auto-rotation 90d |

---

## 4. Performance Optimization

### 4.1 Connection Pooling

```
[Container 1]───┐
[Container 2]───┼── pgbouncer (transaction mode) ─── RDS PostgreSQL
[Container N]───┘     pool_size = total_containers × 15
                      reserve_pool = 20
                      max_client_conn = 500
```

Each container uses SQLAlchemy `create_engine(pool_size=10, max_overflow=5)`.

### 4.2 LLM Response Caching

Semantic caching with Redis:

```python
CACHE_KEY = f"llm_cache:{sha256(question + reranked_chunks_ids):hex}"
# On miss: LLM generates, stores key with TTL 86400
# On hit: returns cached QueryResponse JSON
# Invalidation: on guideline re-ingestion, flush entire cache via admin API
```

**Estimated hit rate:**
- 10K MAU: ~30% (many users ask the same common questions)
- 100K MAU: ~45%
- 1M MAU: ~55%

Each cache miss costs ~2–5s (LLM generation). At 1M MAU with 3 queries/user/month
and 55% cache hit rate: ~1.35M LLM calls → ~$2,700/mo in Cohere API costs.

### 4.3 Pre-computation of Popular Queries

A daily cron (CloudWatch Events → Lambda → invoke `/api/precompute` on internal
endpoint) computes and caches the top 500 queries from the previous day's logs.

### 4.4 CDN for Frontend Assets

| Pattern | Cache Behavior | TTL |
|---------|---------------|-----|
| `/assets/*` | Immutable (hash in filename) | 365 days |
| `/index.html` | No-cache (revalidate every deploy) | 0 |
| `/favicon.svg`, `/vite.svg` | Cache | 1 day |
| `/api/*` | No caching, forward to ALB | N/A |

### 4.5 Warm Instances

Each ECS task initializes the LangGraph agent graph and OKF knowledge bundle
at startup. The Dockerfile already runs HEALTHCHECK with `/api/ready`. ALB
doesn't route traffic until the task passes. Startup takes ~3s after the
container is running.

### 4.6 Rate Limiting

Already implemented via `slowapi`:

| Route | Rate Limit | Burst |
|-------|-----------|-------|
| `/api/query` | 30/minute | 10 |
| `/api/query/stream` | 20/minute | 5 |
| `/api/auth/token` | 10/minute | 5 |
| `/api/ingest` | 5/minute | 3 |
| `/api/chat/*` | 60/minute | 20 |

At production scale, enforce the same limits at the WAF level (redundant).

### 4.7 Request Body Size Limiting

Already implemented: 256 KB max body size via `MaxBodySizeMiddleware`.

---

## 5. Database Schema for Production Scale

### 5.1 Users

```sql
CREATE TABLE users (
    id          VARCHAR(64) PRIMARY KEY,
    username    VARCHAR(64) NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    roles_json  VARCHAR(255) NOT NULL DEFAULT '[]',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    full_name   VARCHAR(255),
    primary_role VARCHAR(32) NOT NULL DEFAULT 'patient',
    date_of_birth VARCHAR(10),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email    ON users (email);
```

### 5.2 Conversations & Messages

Partitioned by month on `created_at`:

```sql
CREATE TABLE conversations (
    id          VARCHAR(64) PRIMARY KEY,
    user_id     VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_conversations_user_id ON conversations (user_id);

CREATE TABLE messages (
    id                  VARCHAR(64) PRIMARY KEY,
    conversation_id     VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id             VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content             TEXT NOT NULL,
    citations_json      TEXT,
    tool_trace_json     TEXT,
    safety_flags_json   TEXT,
    knowledge_path_json TEXT,
    rephrased_question  TEXT,
    model_used          VARCHAR(128),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_messages_conv_id    ON messages (conversation_id);
CREATE INDEX idx_messages_user_id    ON messages (user_id);
CREATE INDEX idx_messages_created_at ON messages (created_at);

-- Monthly partitions create via cron or pg_partman:
-- CREATE TABLE messages_2026_07 PARTITION OF messages
--   FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

### 5.3 Uploads

```sql
CREATE TABLE uploads (
    id                VARCHAR(64) PRIMARY KEY,
    user_id           VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category          VARCHAR(32) NOT NULL DEFAULT 'other',
    kind              VARCHAR(16) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    storage_path      VARCHAR(512) NOT NULL,   -- S3 key
    s3_bucket         VARCHAR(128) NOT NULL,    -- S3 bucket name
    mime_type         VARCHAR(128) NOT NULL,
    size_bytes        INTEGER NOT NULL DEFAULT 0,
    user_note         TEXT,
    extracted_text    TEXT,
    display_title     VARCHAR(255) NOT NULL,
    chunk_count       INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_uploads_user_id ON uploads (user_id);
```

### 5.4 Document Chunks (pgvector)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
    chunk_id        VARCHAR(128) PRIMARY KEY,
    source_id       VARCHAR(128) NOT NULL,
    title           VARCHAR(512) NOT NULL,
    page            INTEGER NOT NULL DEFAULT 1,
    section         VARCHAR(256),
    text            TEXT NOT NULL,
    source_url      VARCHAR(1024),
    organization    VARCHAR(256) NOT NULL DEFAULT '',
    publication_year INTEGER,
    source_type     VARCHAR(64) NOT NULL DEFAULT 'clinical_guideline',
    source_version  VARCHAR(64),
    review_date     VARCHAR(32),
    effective_date  VARCHAR(32),
    license_notes   TEXT,
    ingested_at     VARCHAR(32),
    chunk_index     INTEGER NOT NULL DEFAULT 1,
    -- Vector embedding (1536-dimensional float)
    embedding       vector(1536),
    -- Full-text search support
    tsv             TSVECTOR GENERATED ALWAYS AS (
                        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(text, ''))
                    ) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for approximate nearest-neighbor search
-- ef_construction=200, m=32 (balanced for accuracy/speed at 100K+ chunks)
CREATE INDEX idx_chunks_embedding_hnsw
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (ef_construction = 200, m = 32);

-- GIN index for full-text search fallback
CREATE INDEX idx_chunks_tsv ON document_chunks USING GIN (tsv);

-- Composite index for source-lookup queries
CREATE INDEX idx_chunks_source_id ON document_chunks (source_id);

-- Partition by source type for targeted queries
-- Hybrid query pattern:
-- SELECT chunk_id, text, title, source_url,
--        (0.55 * (1 - (embedding <=> :query_embedding))
--         + 0.45 * ts_rank(tsv, plainto_tsquery('english', :query_text))) AS hybrid_score
-- FROM document_chunks
-- ORDER BY hybrid_score DESC
-- LIMIT 20;
```

### 5.5 Ingestion Manifests

```sql
CREATE TABLE ingestion_manifests (
    manifest_id     VARCHAR(64) PRIMARY KEY,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_chunks    INTEGER NOT NULL DEFAULT 0,
    total_documents INTEGER NOT NULL DEFAULT 0,
    entries_json    JSONB
);

CREATE TABLE ingestion_entries (
    id              SERIAL PRIMARY KEY,
    manifest_id     VARCHAR(64) NOT NULL REFERENCES ingestion_manifests(manifest_id),
    source_id       VARCHAR(128) NOT NULL,
    title           VARCHAR(512) NOT NULL,
    url             TEXT NOT NULL,
    page_count      INTEGER,
    content_hash    VARCHAR(64),
    chunk_count     INTEGER NOT NULL DEFAULT 0,
    organization    VARCHAR(256),
    source_type     VARCHAR(64),
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_ingestion_entries_manifest ON ingestion_entries (manifest_id);
CREATE INDEX idx_ingestion_entries_source  ON ingestion_entries (source_id);
```

### 5.6 Cache Table (if Redis unavailable fallback)

```sql
CREATE TABLE response_cache (
    query_hash  VARCHAR(64) PRIMARY KEY,
    question    TEXT NOT NULL,
    response    JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_cache_expires ON response_cache (expires_at);
```

### 5.7 Partitioning Strategy

| Table | Partition Key | Retention | Method |
|-------|--------------|-----------|--------|
| `messages` | `created_at` (monthly) | 24 months | pg_partman |
| `document_chunks` | none (guideline chunks are stable) | permanent | — |
| `response_cache` | none (ephemeral) | auto-expire via `expires_at` | — |
| `ingestion_entries` | `completed_at` (monthly) | 12 months | pg_partman |
| `conversations` | `created_at` (monthly) | 24 months | pg_partman |

---

## 6. Cost Estimation

### 6.1 10,000 MAU

| Service | Config | Monthly Cost |
|---------|--------|-------------|
| ECS Fargate | 2× 1 vCPU / 4 GB, always-on | ~$85 |
| RDS PostgreSQL | `db.r6g.large`, 1 instance, 500 GB gp3 | ~$195 |
| ElastiCache Redis | `cache.r6g.large`, 1 node | ~$130 |
| S3 | 10 GB storage, minimal requests | ~$1 |
| CloudFront | 50 GB transfer | ~$4 |
| ALB | 1 ALB | ~$22 |
| WAF | 1 web ACL | ~$10 |
| Secrets Manager | 5 secrets | ~$2 |
| CloudWatch | Logs + metrics | ~$15 |
| LLM API (Cohere) | ~30K queries/mo @ $2/1K queries | ~$60 |
| **Total** | | **~$524/mo** |

### 6.2 100,000 MAU

| Service | Config | Monthly Cost |
|---------|--------|-------------|
| ECS Fargate | 6× 2 vCPU / 4 GB, auto-scaled | ~$510 |
| RDS PostgreSQL | `db.r6g.2xlarge`, Multi-AZ + 1 reader, 1 TB gp3 | ~$1,150 |
| ElastiCache Redis | `cache.r6g.xlarge`, Multi-AZ | ~$390 |
| S3 | 50 GB + API requests | ~$5 |
| CloudFront | 500 GB transfer | ~$40 |
| ALB | 1 ALB | ~$22 |
| WAF | 1 web ACL + bot control | ~$20 |
| Secrets Manager | 10 secrets | ~$4 |
| CloudWatch | Logs + metrics + X-Ray traces | ~$60 |
| Celery worker (Fargate) | 2× 1 vCPU / 2 GB | ~$85 |
| LLM API (Cohere) | ~300K queries/mo (45% cache hit) | ~$330 |
| **Total** | | **~$2,616/mo** |

### 6.3 1,000,000 MAU

| Service | Config | Monthly Cost |
|---------|--------|-------------|
| ECS Fargate | 20× 2 vCPU / 4 GB, auto-scaled | ~$1,700 |
| RDS PostgreSQL | `db.r6g.4xlarge`, Multi-AZ + 2 readers, 3 TB gp3 | ~$4,200 |
| ElastiCache Redis | `cache.r6g.2xlarge`, Multi-AZ | ~$780 |
| S3 | 200 GB + 1M requests | ~$20 |
| CloudFront | 5 TB transfer | ~$360 |
| ALB | 1 ALB | ~$22 |
| WAF | 1 web ACL + bot control + rate rules | ~$25 |
| Secrets Manager | 10 secrets | ~$4 |
| CloudWatch | Logs + metrics + X-Ray (10% sampled) | ~$250 |
| Celery worker pool | 6× 1 vCPU / 2 GB | ~$255 |
| pgvector accelerator | Graphistry Filament (if needed) | ~$500 |
| LLM API (Cohere) | ~1.35M queries/mo (55% cache hit) | ~$1,350 |
| **Total** | | **~$9,466/mo** |

### 6.4 Cost Optimization Levers

| Lever | Impact | Complexity |
|-------|--------|-----------|
| Reserved instances (RDS, 1yr) | −30% | Low |
| Fargate Savings Plans (1yr) | −20% | Low |
| Reduce LLM cache TTL → increase hit rate | −10% API costs | Low |
| Switch to smaller embedding model | −$25/mo >100K MAU | Medium |
| Pre-compute top 500 Qs nightly | −5% API calls | Low |
| Batch ingestion during off-peak | −15% Fargate | Low |

---

## 7. Observability

### 7.1 Structured Logging

Already implemented via `configure_logging()`. Each log line is JSON with:

```json
{
  "timestamp": "2026-07-12T10:30:00Z",
  "level": "INFO",
  "logger": "app.request",
  "event": "http_request",
  "method": "POST",
  "path": "/api/query",
  "status_code": 200,
  "duration_ms": 2450.12,
  "request_id": "a1b2c3d4-...",
  "user_id": "user_abc123"
}
```

### 7.2 CloudWatch Metrics

| Metric | Namespace | Period | Alarm threshold |
|--------|-----------|--------|-----------------|
| `p95_latency_ms` | `Clinical/API` | 1 min | > 5000ms |
| `error_rate` | `Clinical/API` | 1 min | > 2% |
| `cache_hit_rate` | `Clinical/Redis` | 5 min | < 20% |
| `rds_connections` | `AWS/RDS` | 1 min | > 80% max_connections |
| `queue_depth` | `Clinical/Celery` | 1 min | > 1000 |
| `containers_running` | `ECS/ContainerInsights` | 1 min | < min_task_count |

### 7.3 Distributed Tracing: AWS X-Ray

```python
# Middleware in FastAPI
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.ext.fastapi import XRayMiddleware

app.add_middleware(XRayMiddleware, recorder=xray_recorder)

# Subsegments for agent pipeline
with xray_recorder.in_subsegment('retrieve') as segment:
    segment.put_metadata('top_k', 20)
    candidates = store.query(...)

with xray_recorder.in_subsegment('llm_generate') as segment:
    segment.put_annotation('model', 'command-a-03-2025')
    answer = llm.chat(...)
```

Sampling: 10% of `/api/query` requests, 100% of errors. X-Ray cost at 1M MAU:
~$200/mo with 10% sampling.

### 7.4 APM: LangSmith

The agent already integrates LangSmith tracing (configured via
`LANGCHAIN_API_KEY` / `LANGSMITH_API_KEY` env vars). Keep LangSmith for
agent-level observability (graph routing decisions, tool calls, retrieval
quality). Cost at 1M MAU: ~$150–300/mo (LangSmith usage-based).

### 7.5 Key Dashboards

```yaml
# CloudWatch Dashboard: Clinical Workflows — Operational
widgets:
  - type: metric
    metrics:
      - ["Clinical/API", "p95_latency_ms", { stat: "p95", period: 300 }]
      - ["Clinical/API", "p99_latency_ms", { stat: "p99", period: 300 }]
  - type: metric
    metrics:
      - ["Clinical/API", "error_rate", { stat: "avg", period: 60 }]
      - ["Clinical/API", "requests_per_minute", { stat: "sum", period: 60 }]
  - type: metric
    metrics:
      - ["Clinical/Redis", "cache_hit_rate", { stat: "avg", period: 300 }]
      - ["Clinical/Redis", "cache_size_bytes", { stat: "avg", period: 300 }]
  - type: metric
    metrics:
      - ["Clinical/Celery", "queue_depth", { stat: "avg", period: 60 }]
      - ["Clinical/Celery", "tasks_succeeded", { stat: "sum", period: 300 }]
      - ["Clinical/Celery", "tasks_failed", { stat: "sum", period: 300 }]
  - type: log
    query: "fields @timestamp, @message | filter event='query_classified' | stats count() by graph_route"
```

### 7.6 Alarms

| Alarm | Threshold | Action | Severity |
|-------|-----------|--------|----------|
| `HighLatency-p95` | >5s for 5min | SNS → PagerDuty | Critical |
| `HighErrorRate` | >2% for 2min | SNS → PagerDuty | Critical |
| `RDSConnectionSpike` | >80% for 5min | SNS → PagerDuty | Warning |
| `CeleryQueueBacklog` | >1000 for 10min | SNS → Email | Warning |
| `CacheHitRateDrop` | <20% for 15min | SNS → Email | Info |
| `CertificateExpiry` | <30 days | SNS → Email | Warning |
| `CostAnomaly` | >20% above forecast | SNS → Email | Info |

---

## 8. Security

### 8.1 Network Architecture

```ascii
               Internet
                  │
             CloudFront
                  │
             WAF (Web ACL)
                  │
         ┌────────┴────────┐
         │  Public ALB     │
         └────────┬────────┘
                  │
         ┌────────┴────────┐
         │  VPC: 10.0.0.0/16│
         │  Public subnets  │
         │  (ALB + NAT GW)  │
         └────────┬────────┘
                  │
         ┌────────┴────────┐
         │  Private subnets │
         │  (ECS Fargate)   │
         └────────┬────────┘
                  │
         ┌────────┴────────┐
         │  Private subnets │
         │  (RDS, Redis,    │
         │   pgbouncer)     │
         └─────────────────┘
```

- ALB in public subnets, ECS tasks in private subnets.
- RDS + ElastiCache in isolated private subnets (no direct internet access).
- VPC endpoints (Gateway + Interface) for S3, Secrets Manager, CloudWatch.
- Security groups: ALB → ECS (port 8000), ECS → RDS (port 5432), ECS → Redis (6379).
- No SSH or bastion host — use AWS Systems Manager Session Manager for debugging.

### 8.2 Encryption

| Layer | Mechanism | Key management |
|-------|-----------|---------------|
| In transit (external) | TLS 1.3 via ACM + CloudFront | AWS managed |
| In transit (internal) | TLS 1.2 between containers | AWS Certificate Manager |
| At rest (RDS) | AES-256 | AWS KMS (managed) |
| At rest (Redis) | AES-256 (encryption-at-rest) | AWS KMS |
| At rest (S3) | SSE-S3 or SSE-KMS | AWS managed |
| Secrets | AWS Secrets Manager | AWS KMS, auto-rotation |

### 8.3 Secrets Management

```python
# app/core/config.py — production
import boto3
from botocore.exceptions import ClientError

def _get_secret(name: str) -> str:
    client = boto3.client("secretsmanager", region_name="us-east-1")
    try:
        response = client.get_secret_value(SecretId=name)
        return response["SecretString"]
    except ClientError as e:
        raise RuntimeError(f"Unable to retrieve secret {name}") from e

class Settings(BaseSettings):
    @property
    def cohere_api_key(self) -> str:
        return _get_secret("clinical/cohere/api-key")
```

Alternatively: inject secrets as env vars in ECS task definition (referencing
Secrets Manager ARNs). Prefer env var injection for production to avoid
KMS throttling under load.

### 8.4 IAM Roles and Policies

```
clinical-api-task-role:
  - SecretsManagerReadWrite (scoped to clinical/* secrets)
  - S3ReadWrite (scoped to clinical-* buckets)
  - CloudWatchPutMetrics
  - XRayPutTraceSegments
  - ECSTaskExecutionRolePolicy

clinical-celery-task-role:
  - Same as api + SQS access (if Celery uses SQS instead of Redis)

clinical-rds-access-role:
  - RDS IAM authentication (if using IAM DB auth instead of passwords)
```

### 8.5 WAF Rules

| Priority | Rule | Action | Description |
|----------|------|--------|-------------|
| 0 | `AWS-AWSManagedRulesCommonRuleSet` | Block | SQLi, XSS, LFI, RFI |
| 1 | `AWS-AWSManagedRulesKnownBadInputsRuleSet` | Block | Known bad patterns |
| 2 | `AWS-AWSManagedRulesAmazonIpReputationList` | Block | IP reputation |
| 3 | `AWS-AWSManagedRulesBotControlRuleSet` | Captcha | Scrapers, bots |
| 4 | Custom rate-based rule | Block | >100 req/s per IP |
| 5 | Custom IP allow list | Allow | Internal monitoring tools |

### 8.6 Application Security

| Concern | Mitigation |
|---------|-----------|
| Prompt injection | Classifier in LangGraph agent (already implemented) |
| Unsafe medical advice | `classify_query()` refusal before retrieval (already implemented) |
| PHI exposure | `QueryRequest` field doc warns against PHI, no PHI column in DB |
| JWT tampering | `python-jose` with HS256 + secret from Secrets Manager |
| Role escalation | RBAC enforced at API route level via `Depends(require_role)` |
| Rate limiting | `slowapi` at app level + WAF rate rules (redundant) |

---

## 9. CI/CD Pipeline

### 9.1 Pipeline Architecture

```
 GitHub Push (main) ──> GitHub Actions ──> Build & Test ──> ECR ──> ECS Deploy
       │                      │                  │                     │
       │                      │                  │                     │
  feature/ → PR review ───> merge to main    Docker build        CodeDeploy
                       (required checks)   + pytest + lint       blue/green
                       (code owner review) + pyright + okf-check
```

### 9.2 GitHub Actions Workflow

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: clinical-workflows
  ECS_CLUSTER: clinical-production
  ECS_SERVICE: clinical-api

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_DB: clinical_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: [5432:5432]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements.txt
      - run: make lint
      - run: pyright
      - run: make okf-check
      - run: make test
      - run: npm ci && npm run build
        working-directory: frontend

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/github-actions-deploy
          aws-region: us-east-1
      - uses: aws-actions/amazon-ecr-login@v2
      - run: |
          docker build -t $ECR_REPOSITORY:${{ github.sha }} .
          docker tag $ECR_REPOSITORY:${{ github.sha }} $ECR_REPOSITORY:latest
          docker push $ECR_REPOSITORY:${{ github.sha }}
          docker push $ECR_REPOSITORY:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/github-actions-deploy
          aws-region: us-east-1
      - uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: task-definition.json
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true

  post-deploy-validation:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - run: |
          # Smoke test the /api/ready endpoint
          curl -f https://api.clinical.example.com/api/ready
          # Run a sample query
          curl -f -X POST https://api.clinical.example.com/api/query \
            -H "Content-Type: application/json" \
            -d '{"question":"What is the BP target for stage 1 hypertension?"}'
          # Verify frontend loads
          curl -f https://clinical.example.com/ | grep -q "root"
```

### 9.3 Blue-Green Deployment

ECS service uses CodeDeploy with blue/green:

```
              ┌──────────┐
Traffic ───> │  ALB      │
             └────┬──────┘
          ┌───────┴───────┐
          │               │
     ┌────▼────┐    ┌────▼────┐
     │ Blue    │    │ Green   │     <── Original (active)
     │ (v1.0)  │    │ (v2.0)  │     <── New (testing)
     └─────────┘    └─────────┘
```

1. CodeDeploy provisions new Green task set with v2.0.
2. Green passes ALB health checks (`/api/ready`).
3. CodeDeploy shifts 10% → 50% → 100% traffic to Green (5min intervals).
4. If CloudWatch alarm fires during shift → automatic rollback to Blue.
5. Blue is terminated after 30min cooldown.

### 9.4 Canary Releases

For riskier changes (e.g. LLM prompt changes, retrieval algorithm updates):

```
Canary: 5% of traffic → Green (new version)
Monitor for 15min:
  - Latency p95 < 5s
  - Error rate < 1%
  - Cache hit rate not degraded
Promote to 100% or roll back.
```

Implementation: ALB weighted target groups or CodeDeploy canary configuration.

---

## 10. Disaster Recovery

### 10.1 Recovery Objectives

| Metric | Target |
|--------|--------|
| Recovery Point Objective (RPO) | 5 minutes |
| Recovery Time Objective (RTO) | 15 minutes |
| Availability SLA | 99.95% (≈21 min/month downtime) |

### 10.2 Multi-AZ Architecture

| Component | AZ Strategy | Failover behavior |
|-----------|-------------|-------------------|
| ALB | 3 AZs | Automatic (AWS managed) |
| ECS Fargate | Spread across 3 AZs | Service scheduler replaces |
| RDS PostgreSQL | Multi-AZ synchronous standby | Automatic DNS flip (~60s) |
| ElastiCache Redis | 1 replica in different AZ | Automatic replica promotion |
| S3 | 3 AZs (standard) | Automatic |
| Celery | Tasks are idempotent, auto-retry | Re-queued on worker loss |

### 10.3 Backup Strategy

| Asset | Frequency | Retention | Method |
|-------|-----------|-----------|--------|
| RDS (full) | Daily | 30 days | Automated snapshot |
| RDS (transaction logs) | Continuous (5min RPO) | 30 days | WAL archiving |
| S3 documents | Immediate (versioning) | 365 days | S3 versioning + lifecycle |
| Secrets | Snapshot on rotation | 90 days | Secrets Manager |
| ECR images | On each deploy | 90 days | Lifecycle policy |
| CloudWatch logs | Continuous | 365 days | Export to S3 via subscription |

### 10.4 Cross-Region DR

For RTO < 5 minutes and RPO < 1 minute:

```
Primary: us-east-1
Secondary: us-west-2

Replication:
  - RDS cross-region read replica → promote on failover
  - S3 Cross-Region Replication (CRR) for uploads bucket
  - Route 53 health-check → failover DNS record
  - ECR image replication to us-west-2

Not replicated:
  - ElastiCache Redis (session loss is acceptable)
  - Celery queue state (tasks are idempotent, can re-queue)
```

Cost of DR setup: ~$400/mo (RDS replica + S3 CRR + Route 53 health checks).

### 10.5 Runbook: Failover

```bash
# 1. Promote RDS read replica (us-west-2)
aws rds promote-read-replica \
  --db-instance-identifier clinical-prod-secondary

# 2. Wait for replica to become primary (monitor /api/ready)
while ! curl -f https://api-secondary.clinical.example.com/api/ready; do
  sleep 5
done

# 3. Update ECS task definition to point at new RDS endpoint
aws ecs update-service \
  --cluster clinical-production \
  --service clinical-api \
  --task-definition clinical-api:$(TASK_REV)

# 4. Update Route 53 failover record
aws route53 change-resource-record-sets \
  --hosted-zone-id ZONE_ID \
  --change-batch file://failover-recordset.json

# 5. Verify
curl -f https://api.clinical.example.com/api/ready
```

---

## 11. Migration Path

### Phase 0: Foundation (Week 1–2)

Goal: Deploy current code on AWS with no architectural changes.

```
1. Dockerize (done — Dockerfile exists)
2. Create ECR repository
3. Push image to ECR
4. Create ECS Fargate service (1 task)
5. Create ALB, Route 53, ACM certificate
6. Set up CloudWatch logging
7. Copy SQLite DB to EFS volume or S3 → restore on startup
8. WAF with basic rules
9. GitHub Actions → ECR push + ECS deploy
```

**Result:** Same SQLite + in-memory HybridStore, but running on Fargate behind
ALB. No breaking changes. Takes 2 days.

### Phase 1: PostgreSQL + pgvector (Week 3–4)

Goal: Replace SQLite with PostgreSQL and in-memory store with pgvector.

```
1. Create RDS PostgreSQL instance with pgvector extension
2. Run Alembic migrations for new schema
3. Add DATABASE_URL env var pointing to RDS (Secrets Manager)
4. Modify app/db/engine.py to support PostgreSQL pooling
   - Create engine with correct kwargs (pool_size, pool_pre_ping)
5. Create document_chunks table with embedding vector(1536)
6. Write migration script: export SQLite → pgvector
   - Load all chunks from HybridStore
   - Compute embeddings (same Cohere client)
   - INSERT into document_chunks
7. Modify HybridStore to read from pgvector:
   - query() uses pgvector ANN search + ts_rank for hybrid scoring
   - upsert_chunks() becomes INSERT ... ON CONFLICT
8. Deploy and validate: run eval suite, compare results
9. Keep SQLite fallback toggle if pgvector query fails
```

**Rollback plan:** Flip `DATABASE_URL` back to SQLite file. Feature flag:
`VECTOR_STORE_BACKEND=postgres|sqlite` in Settings.

### Phase 2: Redis Caching (Week 5)

Goal: Add caching layer to reduce LLM API costs and latency.

```
1. Create ElastiCache Redis cluster
2. Add redis-py to requirements.txt
3. Create app/core/cache.py:
   - CacheClient class (singleton, lazy init)
   - get_cached_response(request_hash: str) -> Optional[QueryResponse]
   - set_cached_response(request_hash: str, response: QueryResponse, ttl: int)
4. Modify /api/query endpoint:
   - Compute request hash from question + mode + alpha + top_k
   - Check cache first (10–20μs)
   - On miss: run agent, cache result
5. Modify /api/ingest to flush cache on new data
6. Deploy, monitor cache hit rate
```

### Phase 3: S3 for File Storage (Week 6)

Goal: Replace local filesystem with S3 for user uploads and cache.

```
1. Create S3 buckets with lifecycle policies
2. Add boto3 to requirements.txt
3. Modify app/uploads/routes.py to use S3 client
   - Upload file → s3://clinical-uploads/{env}/users/{user_id}/{file_id}.pdf
   - Download file → presigned URL (TTL 10min) or stream
4. Modify ingestion to download PDFs from S3 to /tmp, process, discard
5. Migrate existing uploads: script to copy from data/uploads/ to S3
6. Remove local volume mounts from task definition
```

### Phase 4: Celery + Async Tasks (Week 7)

Goal: Offload ingestion and heavy processing from request path.

```
1. Celery app in app/tasks/celery_app.py
2. Define task queues: ingestion, ocr, rerank, precompute, eval
3. Celery worker Dockerfile (slim, no frontend)
4. Separate ECS service for workers (lower priority, spot instances)
5. Modify /api/ingest:
   - Now returns 202 Accepted
   - ingest.delay(sources) → Celery task
   - Frontend polls /api/ingest/status/{task_id}
6. Add Redis as Celery broker (same ElastiCache cluster, DB 1)
7. Keep synchronous ingest flag for admin/debug use
```

### Phase 5: Auto-scaling + Performance Tuning (Week 8)

Goal: Production readiness at scale.

```
1. Configure ECS auto-scaling:
   - Target tracking: avg CPU < 60%
   - Step scaling: add 2 tasks if queue length > 50
   - Scale-in cool-down: 300s
2. RDS:
   - Create read replicas for /api/query
   - Configure pgbouncer sidecar
   - Tune PostgreSQL: shared_buffers, work_mem, effective_cache_size
3. WAF:
   - Add rate-based rules per IP
   - Enable bot control (CAPTCHA for suspicious traffic)
4. CloudWatch dashboards + alarms (Section 7.5, 7.6)
5. Load test with artillery / locust:
   - 1000 concurrent users, ramp over 10 min
   - Identify bottlenecks, adjust auto-scaling thresholds
6. Cost optimization:
   - Review instance utilization
   - Consider Fargate Savings Plans
   - Set up AWS Budgets alerts
```

### Phase 6: Blue-Green + Canary (Week 9)

Goal: Zero-downtime deployments with progressive traffic shifting.

```
1. Create CodeDeploy application + deployment group for ECS
2. Configure blue/green deployment:
   - 10% → 50% → 100% traffic shift (5min intervals)
   - CloudWatch alarm triggers automatic rollback
3. Add canary testing endpoint:
   - /api/canary with feature flags
   - Route 5% of new users to canary
4. Update GitHub Actions workflow:
   - Add CodeDeploy step
   - Add post-deploy smoke tests
   - Add rollback step
```

### Phase 7: Observability Deepening (Week 10)

Goal: Full observability with tracing, APM, and pre-computation.

```
1. AWS X-Ray integration (FastAPI middleware + agent subsegments)
2. LangSmith tracing for agent-graph visibility
3. Pre-computation cron:
   - Lambda (CloudWatch Events): daily @ 2am
   - Read previous day's query logs from CloudWatch
   - Compute top 500 most frequent + most expensive queries
   - Invoke /api/precompute → cache results
4. Cost visibility:
   - AWS Cost Explorer tags on all resources (Env, Service, Team)
   - Cost anomaly detection via AWS Budgets
```

### Phase 8: Disaster Recovery (Week 11)

Goal: Meet RPO=5min, RTO=15min.

```
1. Enable RDS automated backups + Multi-AZ
2. Configure cross-region read replica (us-west-2)
3. S3 Cross-Region Replication for uploads bucket
4. Document and test failover runbook (Section 10.5)
5. Chaos engineering: kill an AZ during low traffic, observe recovery
```

### Phase 9: Migration Cutover Timeline

```
Week 1-2  ████████░░░░░░░░░░░░  Phase 0: Foundation (Fargate + ALB)
Week 3-4  ░░░░░░████████░░░░░░  Phase 1: PostgreSQL + pgvector
Week 5    ░░░░░░░░░░░░████░░░░  Phase 2: Redis caching
Week 6    ░░░░░░░░░░░░░░████░░  Phase 3: S3 storage
Week 7    ░░░░░░░░░░░░░░░░████  Phase 4: Celery async tasks
Week 8    ░░░░░░░░░░░░░░░░░░██  Phase 5: Auto-scaling + tuning
Week 9    ░░░░░░░░░░░░░░░░░░░█  Phase 6: Blue-green + canary
Week 10   ░░░░░░░░░░░░░░░░░░░█  Phase 7: Observability
Week 11   ░░░░░░░░░░░░░░░░░░░█  Phase 8: Disaster Recovery
```

Total: 11 weeks end-to-end. Earlier phases deliver incremental value:
- Phase 0: Production deployment on AWS (no architectural debt, same code).
- Phase 1: Persistent vector store, concurrent DB access, no more in-memory loss.
- Phase 2: 30–55% fewer LLM API calls, faster response times.
- Phase 3: Scalable file storage, no filesystem dependency.
- Phase 4: Non-blocking ingestion for large documents.
- Phase 5+: Production hardening, cost optimization, reliability.

---

## Appendix A: Key Configuration Files

### task-definition.json

```json
{
  "family": "clinical-api",
  "networkMode": "awsvpc",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/clinical-api-task-role",
  "cpu": "1024",
  "memory": "4096",
  "requiresCompatibilities": ["FARGATE"],
  "containerDefinitions": [
    {
      "name": "clinical-api",
      "image": "ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/clinical-workflows:latest",
      "portMappings": [{ "containerPort": 8000, "protocol": "tcp" }],
      "environment": [
        { "name": "APP_ENV", "value": "production" },
        { "name": "LOG_LEVEL", "value": "INFO" }
      ],
      "secrets": [
        { "name": "COHERE_API_KEY", "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:clinical/cohere/api-key" },
        { "name": "JWT_SECRET_KEY", "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:clinical/jwt-secret" },
        { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:clinical/database-url" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/clinical-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "api"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8000/api/ready || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 10
      }
    }
  ]
}
```

### .env.production

```bash
APP_ENV=production
LOG_LEVEL=INFO

# Secrets managed by AWS Secrets Manager — not in .env file
# COHERE_API_KEY is injected via ECS task definition
# DATABASE_URL is injected via ECS task definition
# JWT_SECRET_KEY is injected via ECS task definition

# Embedding / retrieval
EMBEDDING_MODEL=embed-v4.0
EMBEDDING_DIM=1536
RERANK_MODEL=rerank-v3.5
GENERATION_MODEL=command-a-03-2025
DEFAULT_ALPHA=0.55
DEFAULT_TOP_K=20
DEFAULT_RERANK_TOP_N=6

# CORS
CORS_ORIGINS=https://clinical.example.com,https://*.clinical.example.com

# Cache
REDIS_URL=redis://clinical-redis.xxxxxx.ng.0001.use1.cache.amazonaws.com:6379/0
CACHE_TTL_SECONDS=86400

# S3
S3_UPLOADS_BUCKET=clinical-uploads-production
S3_CACHE_BUCKET=clinical-cache-production

# Ingestion
UPLOAD_DIR=/tmp/uploads   # S3-backed, only used for Celery temp files

# LangSmith (optional)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=clinical-rag-agent-production
```

---

## Appendix B: Key Commands

```bash
# Deploy initial stack (Phase 0)
aws ecs create-cluster --cluster-name clinical-production
aws ecr create-repository --repository-name clinical-workflows
aws ecs register-task-definition --cli-input-json file://task-definition.json
aws ecs create-service \
  --cluster clinical-production \
  --service-name clinical-api \
  --task-definition clinical-api \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy,subnet-zzz],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=clinical-api,containerPort=8000"

# Run migration: export SQLite → PostgreSQL (Phase 1)
python scripts/migrate_sqlite_to_pgvector.py \
  --sqlite clinical_demo.db \
  --postgres postgresql://user:pass@clinical-db.xxx.us-east-1.rds.amazonaws.com:5432/clinical

# Flush response cache (after re-ingestion)
aws elasticache modify-replication-group \
  --replication-group-id clinical-redis \
  --apply-immediately

# Run eval across environments
python -m app.evaluation.run --database-url "postgresql://user:pass@clinical-db.xxx.rds.amazonaws.com:5432/clinical"

# Load test
npm install -g artillery
artillery run artillery/query-scenario.yml \
  --target "https://api.clinical.example.com" \
  --phases "arrivalRate=10,duration=300,rampTo=100"
```

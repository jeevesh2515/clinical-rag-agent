# Day 31 — Load Test Results

This document is the **production launch gate** for multi-replica horizontal
scaling. Two stages of evidence are required:

1. **Local smoke test** (Phase 1) — verify the orchestration works end-to-end
   against a pgvector-enabled PostgreSQL on the developer's machine.
2. **Production staging on Neon + K8s** (Phase 2) — verify the same scripts
   against the real cloud backend with KEDA-driven horizontal scaling.

Both phases use the same k6 scripts (`tests/load/baseline.js`,
`tests/load/burst.js`) and the same pass-criteria tables below.

---

## Pass Criteria (must hold for production launch)

### Baseline (50 RPS × 10 min) — `tests/load/baseline.js`

| Metric | Threshold | Measured (Local) | Measured (Staging) | Pass/Fail |
|---|---|---|---|---|
| `http_req_duration p95` | < 18s | _n/a — local sandbox blocked_ | _TBD_ | |
| `http_req_duration p99` | < 30s | _n/a_ | _TBD_ | |
| `http_req_failed rate` | < 0.5% | _n/a_ | _TBD_ | |
| `llm_cache_hits rate` | > 30% | _n/a_ | _TBD_ | |
| `http_requests_in_flight p99` | < 50 | _n/a_ | _TBD_ | |
| KEDA scale-up events | 0 (under threshold) | _n/a_ | _TBD_ | |

### Burst (200 RPS × 2 min) — `tests/load/burst.js`

| Metric | Threshold | Measured (Local) | Measured (Staging) | Pass/Fail |
|---|---|---|---|---|
| `http_req_duration p95` | < 25s | _n/a — local sandbox blocked_ | _TBD_ | |
| `http_req_failed rate` | < 1% | _n/a_ | _TBD_ | |
| Scale-up observed within | < 90s | _n/a_ | _TBD_ | |
| Peak replica count | ≥ 4 | _n/a_ | _TBD_ | |
| `queue_saturation rate` | < 5% | _n/a_ | _TBD_ | |

---

## Phase 1 — Local Smoke Test (sandbox limitation)

**Status: orchestration built, smoke test blocked in this Claude Code sandbox
session.** The docker daemon socket (`~/.docker/run/docker.sock`) was not
reachable, so `docker compose up` and the k6 runs were not executed. The
scaffolding below is ready for the operator to run locally where Docker is
available.

### Operator runbook (run on the developer machine)

```bash
# 1. Install k6 once (skip if already installed)
brew install k6   # macOS
# or: apt install k6 / winget install k6 / https://k6.io/docs/getting-started/installation/

# 2. (Optional) Build the docker image pull-ahead — saves time during `up`
docker pull pgvector/pgvector:pg16

# 3. Run the smoke test (boots pgvector postgres + the app + k6 baseline + burst
#    at REDUCED durations (1m + 30s) so the full loop takes ~5 minutes)
make load-test:smoke

# Equivalent raw command if you want to skip the Makefile:
BASELINE_DURATION=1m BURST_DURATION=30s ./scripts/smoke_load_test.sh
```

### What the smoke test verifies (without needing Neon or K8s)

- `docker compose` resolves the override at `docker-compose.pgvector.yml`
  and brings up `pgvector/pgvector:pg16` on port 5432.
- `_init_schema()` in `app/retrieval/pgvector_store.py` runs
  `CREATE EXTENSION IF NOT EXISTS vector` against the fresh database.
- The FastAPI `postStart` hook (`POST /api/ingest`) writes the default
  27-chunk guideline corpus into the `chunk_vectors` table.
- `/api/ready` returns 200 with `chunks > 0` within the 90-second budget.
- The HNSW index is created with `m=16, ef_construction=64`.
- `tests/load/baseline.js` fires 50 RPS for 60s against the local app.
- `tests/load/burst.js` fires 200 RPS for 30s against the local app.
- `/api/metrics` is polled to verify `llm_cache_hits_total` is incremented
  the second time an identical question is asked.
- `docs/load-test-results/smoke-<timestamp>.log` and `*-*.json` are written.

### What it does NOT verify (need a real K8s + staging cluster)

- **KEDA horizontal scaling** — single-pod docker compose has no HPA. The
  staging phase below is the only place `Peak replica count` and
  `Scale-up observed within < 90s` will be meaningful.
- **Neon-specific connection pool tuning** — Neon's free tier caps at 100
  connections, which only matters at 10+ KEDA replicas.
- **CI guard integration** — run the orchestration from
  `.github/workflows/load-test.yml` once secrets `STAGING_URL`, `STAGING_TOKEN`,
  `KUBE_CONTEXT`, `KUBE_NAMESPACE` are configured.

---

## Phase 2 — Production Staging on Neon + K8s

### One-time prerequisites

1. Provision a Neon PostgreSQL project (free tier at https://neon.tech)
   and note the connection string:
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech:5432/db?sslmode=require`.
2. Verify the `vector` extension is enabled:
   ```sql
   psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
   ```
3. Apply Kubernetes manifests with the secret injected:
   ```bash
   openssl rand -hex 32 > /tmp/jwt.hex
   kubectl create secret generic clinical-app-secrets \
     --from-literal=JWT_SECRET_KEY="$(cat /tmp/jwt.hex)" \
     --from-literal=OPENROUTER_API_KEY="sk-or-v1-..." \
     --from-literal=COHERE_API_KEY="..." \
     --from-literal=DATABASE_URL="$DATABASE_URL" \
     --namespace=clinical-workflows
   kubectl apply -k k8s/
   ```
4. Ensure Prometheus + KEDA are deployed in the cluster (kube-prometheus-stack
   + `helm install keda kedacore/keda --namespace keda --create-namespace`).
5. Configure GitHub repository secrets: `STAGING_URL`, `STAGING_TOKEN`,
   `KUBE_CONTEXT` (production), `KUBE_NAMESPACE`.

### Operator runbook (run from local Mac with `kubectl` configured)

```bash
# 1. Pre-flight — verify DNS, TLS, /api/ready, /api/metrics, KEDA
export STAGING_URL=https://staging.clinical-workflows.org
export KUBE_CONTEXT=staging-prod
export KUBE_NAMESPACE=clinical-workflows
export TOKEN=$(kubectl --context "$KUBE_CONTEXT" -n "$KUBE_NAMESPACE" \
  get secret clinical-app-secrets -o jsonpath='{.data.JWT_SECRET_KEY}' | base64 -d \;)
make load-test:preflight

# 2. Full flow — preflight → baseline (10 min) → cooldown → burst (2 min) → capture
make load-test:all
```

This is exactly the same sequence `.github/workflows/load-test.yml`
automates. Manual runs are useful when the GH runner is rate-limited
or the operator wants a one-off check before a release tag.

### Captured metrics — staging run

| Field | How it's captured | Source |
|---|---|---|
| `p95 / p99 latency` | k6 summary printed at end of run | `tests/load/baseline.js` / `tests/load/burst.js` |
| `error rate` | k6 summary printed at end of run | same |
| `cache hit rate` | k6 polls `/api/metrics` every ~5s/VU | baseline.js logic |
| `in-flight p99` | snapshot via `scripts/capture_metrics.sh` polls `/api/metrics` at peak | `capture_metrics.sh` |
| `Peak replica count` | `kubectl get hpa clinical-workflow-hpa -o jsonpath='{.status.currentReplicas}'` | `capture_metrics.sh` |
| `Scale-up observed within` | `kubectl get hpa -w` watcher running parallel with k6 burst | operator manual watch |

After `make load-test:all`, copy values from
`docs/load-test-results/<STAGING_URL>-<TIMESTAMP>.metrics.json` into the
**Measured (Staging)** columns above.

---

## Remediation if criteria fail

| Failure | Likely cause | Fix |
|---|---|---|
| p95 latency > 25s during burst | LLM provider slow | Verify OpenRouter status; raise max_tokens budget; enable Redis cache |
| error rate > 1% | OpenRouter rate limit | Lower KEDA threshold; raise request rate-limit; cache hit rate too low |
| Cache hit rate < 30% | Question variance too high | Lower top_k; widen rerank_top_n; check question normalization |
| KEDA did not scale up | Prometheus unreachable | Verify ServiceMonitor scrape; check `kubectl logs -n keda -l app=keda-operator` |
| Replicas stuck at 2 | HPA maxReplicas too low | Raise `k8s/keda-scaledobject.yaml` `maxReplicaCount` |
| All replicas return 0 chunks | Single-pod HybridStore state, KEDA scaled before postStart finished | Switch `DATABASE_URL` to Neon, ensure `VECTOR_STORE=auto` picks pgvector |

---

## Result summary (production launch gate)

- [ ] Local smoke completed (`scripts/smoke_load_test.sh` exit 0)
- [ ] Staging baseline passed (k6 summary p95 < 18s, error rate < 0.5%)
- [ ] Staging burst passed (k6 summary p95 < 25s, error rate < 1%, scale-up < 90s)
- [ ] `Peak replica count` ≥ 4 during burst
- [ ] No 5xx during burst (only brief 503s during scale-up)
- [ ] `scripts/capture_metrics.sh` snapshot saved to `docs/load-test-results/`
- [ ] Reviewed Grafana dashboard, no anomalies

---

## Files added in Day 31 (operator reference)

| Path | Purpose |
|---|---|
| `scripts/preflight_load_test.sh` | Gate DNS, TLS, /api/ready, /api/metrics, KEDA before any k6 firing |
| `scripts/capture_metrics.sh` | Snapshot HPA replicas + Prometheus counters at peak |
| `scripts/smoke_load_test.sh` | One-command local pgvector smoke (1 min + 30 s k6) |
| `docker-compose.pgvector.yml` | Override compose adding postgres + pgvector service |
| `Makefile` targets | `load-test:{preflight,baseline,burst,all,promote,smoke}` |
| `.github/workflows/load-test.yml` | Auto-runs the same flow on every main push + manual dispatch |
| `tests/load/baseline.js` (unchanged) | 50 RPS × 10 min steady-state |
| `tests/load/burst.js` (unchanged) | 200 RPS × 2 min scale-up verification |

Date: 2026-07-25
Operator: (assigned per release run)
Baseline run id: _TBD_
Burst run id: _TBD_
Sandbox limitation note: docker daemon not reachable from this Claude Code
session, so the Phase 1 local smoke could not be executed here. Operator
runs `make load-test:smoke` on the developer machine to populate the Local
columns, then `make load-test:all` against staging to populate the Staging
columns.
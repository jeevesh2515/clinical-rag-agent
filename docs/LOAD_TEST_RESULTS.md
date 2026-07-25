# Day 31 — Load Test Results Template

## Pass Criteria (must hold for production launch)

### Baseline (50 RPS × 10 min) — `tests/load/baseline.js`

| Metric | Threshold | Measured | Pass/Fail |
|---|---|---|---|
| `http_req_duration p95` | < 18s | _TBD_ | |
| `http_req_duration p99` | < 30s | _TBD_ | |
| `http_req_failed rate` | < 0.5% | _TBD_ | |
| `llm_cache_hits rate` | > 30% | _TBD_ | |
| `http_requests_in_flight p99` | < 50 | _TBD_ | |
| KEDA scale-up events | 0 (under threshold) | _TBD_ | |

### Burst (200 RPS × 2 min) — `tests/load/burst.js`

| Metric | Threshold | Measured | Pass/Fail |
|---|---|---|---|
| `http_req_duration p95` | < 25s | _TBD_ | |
| `http_req_failed rate` | < 1% | _TBD_ | |
| Scale-up observed within | < 90s | _TBD_ | |
| Peak replica count | ≥ 4 | _TBD_ | |
| `queue_saturation rate` | < 5% | _TBD_ | |

## How to run

```bash
# 1. Reserve a staging environment (don't run against prod)
kubectl config use-context staging
kubectl scale deploy/clinical-workflow-rag --replicas=2 -n clinical-workflows

# 2. Wait for postStart ingest to finish (chunks > 0)
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=clinical-workflow-rag \
  -n clinical-workflows --timeout=180s

# 3. Run the baseline test
k6 run --out json=baseline.json tests/load/baseline.js \
  -e BASE_URL=https://staging.clinical-workflows.org \
  -e TOKEN=$STAGING_TOKEN

# 4. Cooldown 5 minutes, then run the burst test
sleep 300
k6 run --out json=burst.json tests/load/burst.js \
  -e BASE_URL=https://staging.clinical-workflows.org \
  -e TOKEN=$STAGING_TOKEN

# 5. Capture KEDA scale-up events
kubectl get hpa -n clinical-workflows -w > hpa-burst.log &
HPAPID=$!
k6 run --out json=burst.json tests/load/burst.js -e BASE_URL=https://staging.clinical-workflows.org -e TOKEN=$STAGING_TOKEN
kill $HPAPID

# 6. Snapshot Prometheus counters at peak
curl -s "http://kube-prometheus-stack-prometheus.monitoring.svc:9090/api/v1/query?query=llm_cache_hits_total" \
  | jq '.data.result'
```

## Remediation if criteria fail

| Failure | Likely cause | Fix |
|---|---|---|
| p95 latency > 25s during burst | LLM provider slow | Verify OpenRouter status; raise max_tokens budget; enable Redis cache |
| error rate > 1% | OpenRouter rate limit | Lower KEDA threshold; raise request rate-limit; cache hit rate too low |
| Cache hit rate < 30% | Question variance too high | Lower top_k; widen rerank_top_n; check question normalization |
| KEDA did not scale up | Prometheus unreachable | Verify ServiceMonitor scrape; check `kubectl logs -n keda -l app=keda-operator` |
| Replicas stuck at 2 | HPA maxReplicas too low | Raise `k8s/keda-scaledobject.yaml` `maxReplicaCount` |

## Result summary (production launch gate)

- [ ] Baseline passed
- [ ] Burst passed
- [ ] Scale-up observed
- [ ] No 5xx during burst (only brief 503s during scale-up)
- [ ] Reviewed dashboards, no anomalies

Date: ____________
Operator: ____________
Baseline run id: ____________
Burst run id: ____________
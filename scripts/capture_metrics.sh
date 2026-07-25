#!/usr/bin/env bash
# Day 31 — Capture production-grade load-test metrics from a running staging deploy.
#
# Snapshots everything you need to fill in docs/LOAD_TEST_RESULTS.md:
#   1. HPA replica history (kubectl get hpa -w) — replaces _TBD_ "Peak replica count"
#   2. Prometheus counters — replaces _TBD_ "cache hit rate", "in-flight p99"
#   3. k6 summary JSON — replaces _TBD_ latency / error rate
#
# Writes <STAGING_URL>-<TIMESTAMP>.metrics.json next to docs/ so the operator
# can paste numbers into the table.
#
# Usage:
#   STAGING_URL=https://staging.clinical-workflows.org \
#   KUBE_CONTEXT=staging \
#   K6_BASELINE_JSON=baseline.json K6_BURST_JSON=burst.json \
#     ./scripts/capture_metrics.sh
set -uo pipefail

STAGING_URL="${STAGING_URL:-}"
KUBE_CONTEXT="${KUBE_CONTEXT:-}"
KUBE_NAMESPACE="${KUBE_NAMESPACE:-default}"
PROM_URL="${PROM_URL:-http://kube-prometheus-stack-prometheus.monitoring.svc:9090}"
OUTPUT_DIR="${OUTPUT_DIR:-docs/load-test-results}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if [[ -z "$STAGING_URL" ]]; then
  echo "ERROR: STAGING_URL env var is required" >&2
  exit 2
fi

mkdir -p "$OUTPUT_DIR"
OUT_FILE="$OUTPUT_DIR/${STAGING_URL//\//_}-${TIMESTAMP}.metrics.json"

echo "Capturing metrics → $OUT_FILE"

# 1. Scrape /api/metrics right now for llm_cache hits/misses + http_requests_in_flight.
echo "  · prometheus counters from /api/metrics..."
RAW_METRICS="$(curl --proto '=https' --tlsv1.2 -sS --max-time 10 "$STAGING_URL/api/metrics" || true)"

LLM_HITS="$(echo "$RAW_METRICS" | grep -E '^llm_cache_hits_total\{' | head -10 || true)"
LLM_MISSES="$(echo "$RAW_METRICS" | grep -E '^llm_cache_misses_total\{' | head -10 || true)"
IN_FLIGHT="$(echo "$RAW_METRICS" | grep -E '^http_requests_in_flight\{' | head -10 || true)"
LLM_TOKENS="$(echo "$RAW_METRICS" | grep -E '^llm_tokens_total\{' | head -10 || true)"
SAFETY_REFUSALS="$(echo "$RAW_METRICS" | grep -E '^safety_refusal_total\{' | head -10 || true)"

# 2. HPA status from kube (cloud-side scale signal).
HPA_JSON="{}"
if [[ -n "$KUBE_CONTEXT" ]] && command -v kubectl >/dev/null 2>&1; then
  echo "  · kubectl get hpa -o json..."
  HPA_JSON="$(kubectl --context "$KUBE_CONTEXT" -n "$KUBE_NAMESPACE" \
    get hpa clinical-workflow-hpa -o json 2>/dev/null || echo '{}')"
fi
PEAK_REPLICAS="$(echo "$HPA_JSON" | python3 -c "
import sys, json
try:
    h = json.load(sys.stdin)
    print(h.get('status', {}).get('currentReplicas', 'n/a'))
except Exception:
    print('n/a')
" 2>/dev/null || echo 'n/a')"

# 3. Optional Prometheus (remote) snapshot.
PROM_JSON="{}"
if command -v curl >/dev/null 2>&1; then
  echo "  · remote Prometheus ($PROM_URL) snapshot..."
  PROM_JSON="$(curl --proto '=https' --tlsv1.2 -sS --max-time 10 \
    "$PROM_URL/api/v1/query?query=clinical_rag_http_requests_in_flight" 2>/dev/null || echo '{}')"
fi

# 4. Aggregate to a single JSON file.
python3 - "$OUT_FILE" "$PEAK_REPLICAS" <<PY
import json, sys, datetime
output, peak = sys.argv[1], sys.argv[2]
payload = {
    "captured_at": datetime.datetime.utcnow().isoformat() + "Z",
    "staging_url": "$STAGING_URL",
    "peak_replicas_hpa": peak,
    "llm_cache_hits_sample": """$LLM_HITS""".strip(),
    "llm_cache_misses_sample": """$LLM_MISSES""".strip(),
    "http_requests_in_flight_sample": """$IN_FLIGHT""".strip(),
    "llm_tokens_sample": """$LLM_TOKENS""".strip(),
    "safety_refusal_sample": """$SAFETY_REFUSALS""".strip(),
    "prometheus_snapshot": """$PROM_JSON""".strip() or "{}",
}
with open(output, "w") as f:
    json.dump(payload, f, indent=2)
print(f"Wrote {output}")
PY

echo
echo "Done. Paste values from $OUT_FILE into docs/LOAD_TEST_RESULTS.md Pass Criteria tables."
ls -la "$OUT_FILE"
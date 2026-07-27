#!/usr/bin/env bash
# Day 31 — Preflight check before running k6 load tests.
#
# Verifies that the staging deployment is ready to absorb load BEFORE k6
# starts firing. Each gate prints a green ✓ or red ✗ and writes to stderr.
# Exit code 0 if all gates pass, 1 if any fail.
#
# Usage:
#   STAGING_URL=https://staging.clinical-workflows.org \
#     KUBE_CONTEXT=staging KUBE_NAMESPACE=default \
#     ./scripts/preflight_load_test.sh
#
# Add new gates by appending to the gates() function. Each gate must:
#   1. run its check inline
#   2. print "✓ <msg>" or "✗ <msg>" via the helper
#   3. return 0 on success, 1 on failure
set -uo pipefail

STAGING_URL="${STAGING_URL:-https://clinical-rag-agent-b3aj.onrender.com}"

KUBE_CONTEXT="${KUBE_CONTEXT:-}"
KUBE_NAMESPACE="${KUBE_NAMESPACE:-default}"
EXPECTED_MIN_CHUNKS="${EXPECTED_MIN_CHUNKS:-1}"
HTTP_TIMEOUT="${HTTP_TIMEOUT:-10}"

PASS=0
FAIL=0




ok()   { echo "  ✓ $*"; PASS=$((PASS+1)); }
bad()  { echo "  ✗ $*"; FAIL=$((FAIL+1)); }

echo "Preflight: $STAGING_URL"
echo

# ─── 1. DNS + TLS handshake ──────────────────────────────────────────────────
echo "Gate 1 — DNS + TLS handshake"
TLS_OK=1
curl --proto '=https' --tlsv1.2 -sS -o /dev/null --max-time "$HTTP_TIMEOUT" -w '%{http_code}' \
  "$STAGING_URL/api/health" > /tmp/preflight_tls_code.txt 2>/dev/null || TLS_OK=0
if [[ "$TLS_OK" == "1" ]]; then
  code="$(cat /tmp/preflight_tls_code.txt)"
  if [[ "$code" =~ ^2 ]]; then
    ok "TLS handshake + GET /api/health returned $code"
  else
    bad "/api/health returned HTTP $code (expected 2xx)"
  fi
else
  bad "TLS handshake or DNS resolution failed"
fi

# ─── 2. Readiness probe confirms postStart ingest finished ──────────────────
echo
echo "Gate 2 — Readiness probe (postStart ingest completion)"
READY_JSON="$(curl --proto '=https' --tlsv1.2 -sS --max-time "$HTTP_TIMEOUT" \
  "$STAGING_URL/api/ready" 2>/dev/null || true)"
if [[ -z "$READY_JSON" ]]; then
  bad "/api/ready returned empty or unreachable"
else
  STATUS="$(echo "$READY_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)"
  CHUNKS="$(echo "$READY_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('chunks',0))" 2>/dev/null || echo 0)"
  if [[ "$STATUS" == "ready" ]]; then
    if [[ "$CHUNKS" -ge "$EXPECTED_MIN_CHUNKS" ]]; then
      ok "/api/ready status=ready chunks=$CHUNKS (≥ $EXPECTED_MIN_CHUNKS)"
    else
      bad "/api/ready status=ready but chunks=$CHUNKS < $EXPECTED_MIN_CHUNKS — postStart ingest incomplete"
    fi
  else
    bad "/api/ready status=$STATUS (expected ready) — see $(echo "$READY_JSON" | head -c 200)"
  fi
fi

# ─── 3. /api/metrics returns Prometheus text ──────────────────────────────────
echo
echo "Gate 3 — Prometheus metrics endpoint"
METRICS_TYPE="$(curl --proto '=https' --tlsv1.2 -sS --max-time "$HTTP_TIMEOUT" -D - -o /dev/null \
  "$STAGING_URL/api/metrics" 2>/dev/null | grep -i '^content-type:' | head -1 || true)"
if echo "$METRICS_TYPE" | grep -qi 'text/plain'; then
  ok "/api/metrics content-type is text/plain"
else
  bad "/api/metrics content-type missing or wrong: ${METRICS_TYPE:-<none>}"
fi

# ─── 4. KEDA ScaledObject exists in cluster (skipped if no kube context) ───────
echo
echo "Gate 4 — KEDA ScaledObject (skipped if KUBE_CONTEXT unset)"
if [[ -n "$KUBE_CONTEXT" ]]; then
  if ! command -v kubectl >/dev/null 2>&1; then
    bad "kubectl not installed; cannot verify KEDA presence"
  else
    SO="$(kubectl --context "$KUBE_CONTEXT" -n "$KUBE_NAMESPACE" \
      get scaledobject clinical-rag-scaler -o name 2>/dev/null || true)"
    if [[ -n "$SO" ]]; then
      TRIG="$(kubectl --context "$KUBE_CONTEXT" -n "$KUBE_NAMESPACE" \
        get scaledobject clinical-rag-scaler -o jsonpath='{.spec.triggers[0].type}' 2>/dev/null || true)"
      if [[ "$TRIG" == "prometheus" ]]; then
        ok "ScaledObject clinical-rag-scaler present, trigger=prometheus"
      else
        bad "ScaledObject present but trigger='$TRIG' (expected prometheus)"
      fi
    else
      bad "ScaledObject clinical-rag-scaler not found in ns=$KUBE_NAMESPACE"
    fi
  fi
else
  echo "  · KUBE_CONTEXT unset — skipping KEDA gate (operators should re-run preflight with cluster access)"
  PASS=$((PASS+1))
fi

echo
echo "──────────────────────────────"
echo "Preflight result: $PASS gates passed, $FAIL failed"
echo "──────────────────────────────"

if [[ "$FAIL" -gt 0 ]]; then
  echo "✗ Do NOT run k6 yet. Fix the failed gates and re-run preflight." >&2
  exit 1
fi
echo "✓ Ready for load test."
exit 0
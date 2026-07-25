#!/usr/bin/env bash
# Day 31 — Local docker-compose smoke test for the k6 load scripts.
#
# Spins up postgres:16 with pgvector + the FastAPI app via docker compose,
# waits for /api/ready to return chunks > 0, then runs BOTH k6 scripts at
# REDUCED duration (baseline = 1 min @ 50 RPS, burst = 30s @ 200 RPS) so
# operators can validate the orchestration locally without needing a real
# Neon + K8s environment.
#
# This is a smoke test, NOT a substitute for the production launch-gate
# run captured in docs/LOAD_TEST_RESULTS.md.
#
# Usage:
#   ./scripts/smoke_load_test.sh
#
# Required: docker + docker compose plugin. k6 must be installed locally
# (`brew install k6` / `apt install k6` / `winget install k6`).
set -uo pipefail

cd "$(dirname "$0")/.."
RESULTS_DIR="docs/load-test-results"
mkdir -p "$RESULTS_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$RESULTS_DIR/smoke-$TS.log"

# Reduced k6 durations for local smoke.
BASELINE_DURATION="${BASELINE_DURATION:-1m}"
BURST_DURATION="${BURST_DURATION:-30s}"
BASELINE_RATE="${BASELINE_RATE:-50}"
BURST_RATE="${BURST_RATE:-200}"

echo "[smoke] Starting docker compose (postgres with pgvector + app)..." | tee -a "$LOG"
docker compose -f docker-compose.yml -f docker-compose.pgvector.yml up -d --build 2>&1 | tee -a "$LOG" \
  || { echo "[smoke] FATAL: docker compose up failed. See $LOG." | tee -a "$LOG"; exit 1; }

echo "[smoke] Waiting for /api/ready (max 90s)..." | tee -a "$LOG"
for i in $(seq 1 60); do
  sleep 2
  RESP="$(curl --max-time 3 -sS http://localhost:8000/api/ready || true)"
  if echo "$RESP" | grep -q '"status":"ready"' && echo "$RESP" | grep -qE '"chunks":[1-9]'; then
    echo "[smoke] /api/ready OK after $((i*2))s: $RESP" | tee -a "$LOG"
    break
  fi
done

if ! echo "$RESP" | grep -q '"status":"ready"'; then
  echo "[smoke] FATAL: /api/ready never returned ready. Aborting." | tee -a "$LOG"
  docker compose logs --tail=100 app 2>&1 | tee -a "$LOG"
  exit 1
fi

echo "[smoke] Running baseline k6 (50 RPS × $BASELINE_DURATION)..." | tee -a "$LOG"
k6 run --out json="$RESULTS_DIR/smoke-baseline-$TS.json" \
  -e BASE_URL=http://localhost:8000 \
  -e SCENARIO_DURATION="$BASELINE_DURATION" \
  -e SCENARIO_RATE="$BASELINE_RATE" \
  tests/load/baseline.js 2>&1 | tee -a "$LOG" || true

echo "[smoke] Cooldown 30s..." | tee -a "$LOG"
sleep 30

echo "[smoke] Running burst k6 (200 RPS × $BURST_DURATION)..." | tee -a "$LOG"
k6 run --out json="$RESULTS_DIR/smoke-burst-$TS.json" \
  -e BASE_URL=http://localhost:8000 \
  -e SCENARIO_DURATION="$BURST_DURATION" \
  -e SCENARIO_RATE="$BURST_RATE" \
  tests/load/burst.js 2>&1 | tee -a "$LOG" || true

echo
echo "[smoke] Capturing metrics via /api/metrics..."
STAGING_URL="http://localhost:8000" ./scripts/capture_metrics.sh 2>&1 | tee -a "$LOG" || true

echo
echo "[smoke] Done. Results in $RESULTS_DIR/log + sm-json artifacts."
ls -la "$RESULTS_DIR"
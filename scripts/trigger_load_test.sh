#!/usr/bin/env bash
# Day 31 (post-review) — Trigger .github/workflows/load-test.yml via gh CLI.
#
# Usage:
#   ./scripts/trigger_load_test.sh                       # scenario=all
#   ./scripts/trigger_load_test.sh preflight
#   ./scripts/trigger_load_test.sh baseline
#   ./scripts/trigger_load_test.sh burst
#
# Output: prints the workflow run URL so the operator can watch the run live.
set -euo pipefail

SCENARIO="${1:-all}"

command -v gh >/dev/null || { echo "ERROR: gh CLI not installed"; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh CLI not authenticated"; exit 2; }

echo "Triggering .github/workflows/load-test.yml with scenario=$SCENARIO ..."
gh workflow run load-test.yml -f scenario="$SCENARIO" >/dev/null

# Give GH a moment to register the run, then surface the URL.
sleep 5
echo
echo "Latest runs:"
gh run list --workflow=load-test.yml --limit 1 --json databaseId,displayTitle,url,status,conclusion --jq '.[] | "\(.status)\t\(.conclusion // "—")\t\(.url)"' 2>/dev/null || \
  gh run list --workflow=load-test.yml --limit 1
#!/usr/bin/env bash
# Day 31 — Fetch artifacts from the most recent successful load-test workflow
# run, parse k6 summaries into docs/LOAD_TEST_RESULTS.md, then commit + push
# the patched numbers back to main.
#
# Why this exists: .github/workflows/load-test.yml's auto-commit step only
# fires for `pull_request` events; `workflow_dispatch` runs (triggered via
# scripts/trigger_load_test.sh or `make load-test:trigger`) leave the
# patched docs uncommitted on the runner. This script bridges that gap for
# the common case of an operator manually triggering the workflow.
#
# Usage:
#   ./scripts/fetch_and_commit_results.sh                  # commit + push
#   ./scripts/fetch_and_commit_results.sh --dry-run        # download + patch only
#   ./scripts/fetch_and_commit_results.sh --run-id 12345   # fetch a specific run
#   ./scripts/fetch_and_commit_results.sh --branch staging --allow-dirty
#
# Prerequisites:
#   - gh CLI 2.x authenticated (gh auth status)
#   - repo's default branch is "main" (override with --branch)
#   - clean working tree (override with --allow-dirty)
set -euo pipefail

DRY_RUN=0
ALLOW_DIRTY=0
RUN_ID=""
BRANCH="main"
WORKFLOW="load-test.yml"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)     DRY_RUN=1; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --run-id)      RUN_ID="$2"; shift 2 ;;
    --branch)      BRANCH="$2"; shift 2 ;;
    --workflow)    WORKFLOW="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,24p' "$0"
      exit 0
      ;;
    *)
      echo "ERROR: unknown flag: $1" >&2
      exit 2
      ;;
  esac
done

# ─── 1. Tooling + auth ───────────────────────────────────────────────────────
command -v gh >/dev/null || { echo "ERROR: gh CLI required"; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh CLI not authenticated (gh auth login)"; exit 2; }
command -v python3 >/dev/null || { echo "ERROR: python3 required"; exit 2; }

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "Repo:   $REPO"
echo "Branch: $BRANCH"
echo

# ─── 2. Resolve target run ──────────────────────────────────────────────────
if [[ -z "$RUN_ID" ]]; then
  echo "Looking up the most recent successful '$WORKFLOW' run..."
  RUN_ID="$(
    gh run list --workflow="$WORKFLOW" --limit 20 \
      --json databaseId,conclusion 2>/dev/null \
    | python3 -c "
import json, sys
for r in json.load(sys.stdin):
    if r.get('conclusion') == 'success':
        print(r['databaseId']); break
" 2>/dev/null || true
  )"
  if [[ -z "$RUN_ID" ]]; then
    echo "ERROR: no successful '$WORKFLOW' run found in the last 20 attempts."
    echo "       Trigger one first:  make load-test:trigger"
    echo "       Or check status:    gh run list --workflow=$WORKFLOW --limit 5"
    exit 1
  fi
fi

echo "Target run: $RUN_ID"
RUN_INFO="$(gh run view "$RUN_ID" --json status,conclusion,name,headBranch,url,event 2>/dev/null || true)"
if [[ -z "$RUN_INFO" ]]; then
  echo "ERROR: run $RUN_ID not found (or no access)."
  exit 1
fi
echo "$RUN_INFO" | python3 -m json.tool | sed 's/^/  /'

CONCLUSION="$(printf '%s' "$RUN_INFO" | python3 -c "import json,sys; print(json.load(sys.stdin).get('conclusion',''))")"
if [[ "$CONCLUSION" != "success" ]]; then
  echo "ERROR: run $RUN_ID concluded '$CONCLUSION' (not 'success'). Nothing to fetch."
  exit 1
fi

# ─── 3. Discover artifact name + download ────────────────────────────────────
ARTIFACT_NAME="$(
  gh run view "$RUN_ID" --json artifacts 2>/dev/null \
  | python3 -c "
import json, sys
arts = json.load(sys.stdin).get('artifacts', [])
for a in arts:
    if a.get('expired'):
        continue
    if a['name'].startswith('load-test-results-'):
        print(a['name']); break
" 2>/dev/null || true
)"
if [[ -z "$ARTIFACT_NAME" ]]; then
  echo "ERROR: no live 'load-test-results-*' artifact attached to run $RUN_ID."
  echo "       (The artifact may have expired after the 30-day retention window.)"
  exit 1
fi

echo
echo "Downloading artifact '$ARTIFACT_NAME' → docs/load-test-results/..."
mkdir -p docs/load-test-results
gh run download "$RUN_ID" --name "$ARTIFACT_NAME" --dir docs/load-test-results --force

# gh run download preserves the artifact's internal directory structure.
# If the workflow uploaded `docs/load-test-results/`, the result lands at
# docs/load-test-results/docs/load-test-results/. Flatten that.
if [[ -d docs/load-test-results/docs/load-test-results ]]; then
  echo "Flattening nested docs/load-test-results/docs/load-test-results/ ..."
  cp -R docs/load-test-results/docs/load-test-results/. docs/load-test-results/
  rm -rf docs/load-test-results/docs
elif [[ -d docs/load-test-results/docs ]]; then
  echo "Flattening nested docs/load-test-results/docs/ ..."
  cp -R docs/load-test-results/docs/. docs/load-test-results/
  rm -rf docs/load-test-results/docs
fi

# Copy baseline-summary-<run_id>.json → baseline-summary.json (and burst
# counterpart) so parse_k6_results.py picks them up regardless of the
# run-id suffix. The grep filter excludes the dest file itself, which the
# glob already wouldn't match — but the explicit filter is defensive in case
# a future run uploaded both forms.
LATEST_BASE="$(ls -t docs/load-test-results/baseline-summary-*.json 2>/dev/null | grep -v '/baseline-summary\.json$' | head -1 || true)"
LATEST_BURST="$(ls -t docs/load-test-results/burst-summary-*.json 2>/dev/null | grep -v '/burst-summary\.json$' | head -1 || true)"
[[ -n "$LATEST_BASE"  ]] && cp "$LATEST_BASE"  docs/load-test-results/baseline-summary.json
[[ -n "$LATEST_BURST" ]] && cp "$LATEST_BURST" docs/load-test-results/burst-summary.json

echo
echo "Downloaded artifacts:"
ls -la docs/load-test-results/ | sed 's/^/  /'

# ─── 4. Patch docs/LOAD_TEST_RESULTS.md ──────────────────────────────────────
echo
echo "Patching docs/LOAD_TEST_RESULTS.md..."
python3 scripts/parse_k6_results.py

# ─── 5. Commit + push ───────────────────────────────────────────────────────
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo
  echo "[dry-run] Skipping commit + push. Re-run without --dry-run to apply."
  exit 0
fi

if [[ "$ALLOW_DIRTY" -eq 0 ]] && ! git diff --quiet; then
  echo "ERROR: working tree has unstaged changes." >&2
  echo "       Commit/stash them first, or pass --allow-dirty to skip this check." >&2
  exit 1
fi

git add docs/load-test-results/ docs/LOAD_TEST_RESULTS.md
if git diff --cached --quiet; then
  echo
  echo "No changes to commit (load test results already in docs)."
  exit 0
fi

git -c user.name="load-test-bot[bot]" \
    -c user.email="load-test-bot@users.noreply.github.com" \
    commit -m "ci: load test results from run $RUN_ID [skip ci]"

echo
echo "Pushing to origin/$BRANCH..."
git push origin "HEAD:$BRANCH"

echo
echo "✓ Done."
echo "  Run URL: $(gh run view "$RUN_ID" --json url -q .url)"
echo "  Commit:  $(git rev-parse --short HEAD)"
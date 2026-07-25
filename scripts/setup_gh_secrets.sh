#!/usr/bin/env bash
# Day 31 (post-review) — Configure the 4 GitHub Actions secrets needed by
# .github/workflows/load-test.yml directly from the K8s cluster + gh CLI.
#
# Sources:
#   STAGING_URL     — derived from the Ingress host on the cluster
#   STAGING_TOKEN   — the cluster's JWT_SECRET_KEY (the same secret used by the
#                     app to mint the access tokens; run scripts/issue_jwt.py
#                     locally to mint a real user token for testing)
#   KUBE_CONTEXT    — current-context from ~/.kube/config
#   KUBE_NAMESPACE  — 'clinical-workflows' by default
#
# Usage:
#   ./scripts/setup_gh_secrets.sh --dry-run        # print what would be set
#   ./scripts/setup_gh_secrets.sh                  # actually set via gh secret set
#   KUBE_NAMESPACE=custom-ns ./scripts/setup_gh_secrets.sh
#
# Prerequisites:
#   - gh CLI 2.x authenticated (gh auth status)
#   - kubectl configured with access to the staging cluster
set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

# ─── 1. Tooling checks ────────────────────────────────────────────────────────
command -v gh >/dev/null || { echo "ERROR: gh CLI not installed"; exit 2; }
command -v kubectl >/dev/null || { echo "ERROR: kubectl not installed"; exit 2; }
command -v base64 >/dev/null || { echo "ERROR: base64 not installed"; exit 2; }

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh CLI not authenticated. Run 'gh auth login' first."
  exit 2
fi

# ─── 2. Read live values from cluster + kube config ──────────────────────────
KUBE_NAMESPACE="${KUBE_NAMESPACE:-clinical-workflows}"
KUBE_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
if [[ -z "$KUBE_CONTEXT" ]]; then
  echo "ERROR: no kubectl current-context. Set with 'kubectl config use-context <name>'."
  exit 2
fi

echo "Source cluster context: $KUBE_CONTEXT"
echo "Source namespace:        $KUBE_NAMESPACE"

INGRESS_HOST="$(kubectl --context "$KUBE_CONTEXT" -n "$KUBE_NAMESPACE" \
  get ingress clinical-workflow-rag -o jsonpath='{.spec.rules[0].host}' 2>/dev/null || true)"
if [[ -z "$INGRESS_HOST" ]]; then
  echo "ERROR: no ingress 'clinical-workflow-rag' found in $KUBE_NAMESPACE."
  echo "Deploy the k8s manifests first (make load-test:setup-and-trigger requires a running app)."
  exit 2
fi
STAGING_URL="https://${INGRESS_HOST}"

JWT_SEED="$(kubectl --context "$KUBE_CONTEXT" -n "$KUBE_NAMESPACE" \
  get secret clinical-app-secrets -o jsonpath='{.data.JWT_SECRET_KEY}' 2>/dev/null | base64 -d || true)"
if [[ -z "$JWT_SEED" ]]; then
  echo "ERROR: no JWT_SECRET_KEY in clinical-app-secrets/${KUBE_NAMESPACE}."
  echo "Run 'kubectl create secret ...' per DEPLOYMENT_GUIDE.md first."
  exit 2
fi
# Mint a real long-lived JWT (24h) using the cluster's JWT_SECRET_KEY.
# The k6 scripts send `Authorization: Bearer ${TOKEN}` — passing the raw
# secret seed would 401 on every request.
STAGING_TOKEN="$(JWT_SECRET_KEY="$JWT_SEED" python3 scripts/mint_load_test_token.py)" \
  || { echo "ERROR: scripts/mint_load_test_token.py failed (is python3 + python-jose installed?)"; exit 2; }

# ─── 3. Apply via gh secret set ──────────────────────────────────────────────
apply_secret() {
  local name="$1"
  local val="$2"
  local masked="${val:0:6}***${val: -2}"   # show first 6 + last 2 chars only
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf "  [dry-run] gh secret set %-15s = %s\n" "$name" "$masked"
  else
    echo -n "$val" | gh secret set "$name" --repo "$(gh repo view --json nameWithOwner -q .nameWithOwner)" >/dev/null
    printf "  ✓ gh secret set %-15s = %s\n" "$name" "$masked"
  fi
}

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo 'unknown/repo')"
echo
echo "Target repo: $REPO"
echo
apply_secret "KUBE_CONTEXT"   "$KUBE_CONTEXT"
apply_secret "KUBE_NAMESPACE" "$KUBE_NAMESPACE"
apply_secret "STAGING_URL"     "$STAGING_URL"
apply_secret "STAGING_TOKEN"   "$STAGING_TOKEN"

echo
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry-run complete. Re-run without --dry-run to actually set the secrets."
else
  echo "✓ 4 secrets configured. Trigger the workflow with:"
  echo "    make load-test:trigger"
fi
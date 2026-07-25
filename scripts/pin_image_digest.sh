#!/usr/bin/env bash
# Day 30 — Pin the production image to an immutable SHA-256 digest.
#
# Usage:
#   ./scripts/pin_image_digest.sh v0.1.0
#
# Reads the current tag from k8s/kustomization.yaml, resolves the digest from
# ghcr.io, and rewrites the image field to <repo>:v0.1.0@sha256:<digest>.
# This makes image pulls immutable — if anyone pushes a different tag with
# the same name, the digest mismatch is detected at deploy time.
#
# Requirements: jq, crane (or skopeo + jq), git (for diff).
set -euo pipefail

KUSTOMIZE_FILE="${KUSTOMIZE_FILE:-k8s/kustomization.yaml}"
IMAGE_REPO="${IMAGE_REPO:-ghcr.io/jeevesh2515/clinical-rag-agent}"
TOOL="${PIN_TOOL:-crane}"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <tag>   (e.g. $0 v0.1.0)" >&2
  exit 1
fi
TAG="$1"

if [[ ! -f "${KUSTOMIZE_FILE}" ]]; then
  echo "ERROR: ${KUSTOMIZE_FILE} not found" >&2
  exit 1
fi

# 1. Fetch the digest for the requested tag
echo "Resolving digest for ${IMAGE_REPO}:${TAG} ..."
if [[ "${TOOL}" == "crane" ]]; then
  DIGEST="$(crane digest "${IMAGE_REPO}:${TAG}")"
elif [[ "${TOOL}" == "skopeo" ]]; then
  DIGEST="$(skopeo inspect --format='{{.Digest}}' "docker://${IMAGE_REPO}:${TAG}")"
else
  echo "ERROR: PIN_TOOL must be 'crane' or 'skopeo'" >&2
  exit 1
fi

if [[ -z "${DIGEST}" || "${DIGEST}" != sha256:* ]]; then
  echo "ERROR: expected sha256:... digest, got '${DIGEST}'" >&2
  exit 1
fi

PINNED_TAG="${TAG}@${DIGEST}"
echo "Pinning ${IMAGE_REPO}:${TAG} -> ${PINNED_TAG}"

# 2. Rewrite kustomization.yaml in place. The image field looks like:
#    - name: ghcr.io/jeevesh2515/clinical-rag-agent
#      newName: ...
#      newTag: v0.1.0
# Replace the newTag value with the pinned tag.
if command -v yq >/dev/null 2>&1; then
  yq -i "(.images[] | select(.name == \"${IMAGE_REPO}\").newTag) |= \"${PINNED_TAG}\"" \
    "${KUSTOMIZE_FILE}"
elif command -v python3 >/dev/null 2>&1; then
  python3 - <<PY
import re, sys
text = open("${KUSTOMIZE_FILE}").read()
pattern = re.compile(
    r"(- name: ${IMAGE_REPO}\n(?:[^\n]*\n)*?newTag:\s*)([^\n]+)",
    re.MULTILINE,
)
new_text, n = pattern.subn(rf"\g<1>{PINNED_TAG}", text)
if n == 0:
    print("ERROR: image block for ${IMAGE_REPO} not found", file=sys.stderr)
    sys.exit(1)
open("${KUSTOMIZE_FILE}", "w").write(new_text)
PY
else
  echo "ERROR: need yq or python3 to rewrite kustomization.yaml" >&2
  exit 1
fi

echo "✓ ${KUSTOMIZE_FILE} rewritten. Diff:"
git --no-pager diff -- "${KUSTOMIZE_FILE}" || true
echo
echo "Next: commit the change and deploy with: kubectl apply -k k8s/"
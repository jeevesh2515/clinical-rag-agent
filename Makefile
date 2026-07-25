.PHONY: okf-check test lint build-frontend run-backend run-frontend ci install
.PHONY: load-test:preflight load-test:baseline load-test:burst load-test:all load-test:promote load-test:smoke
.PHONY: load-test:setup-and-trigger load-test:setup-dry-run load-test:trigger load-test:fetch-and-commit

PYTHON ?= python3

install:
	$(PYTHON) -m pip install -r requirements.txt

okf-check:
	$(PYTHON) scripts/validate_okf.py

test:
	$(PYTHON) -m pytest tests/ -v --tb=short

lint:
	$(PYTHON) -m ruff check app/ tests/ --ignore E501 || true

build-frontend:
	cd frontend && npm ci && npm run build

run-backend:
	$(PYTHON) -m uvicorn app.main:app --reload --port 8000

run-frontend:
	cd frontend && npm run dev

ci: lint test build-frontend

# ─── Day 31 — Production load test orchestration ─────────────────────────────
# Operators run these targets against the staging Neon + K8s deployment
# captured in docs/LOAD_TEST_RESULTS.md. All targets read BASE_URL/TOKEN from
# the environment so the same targets work against any staging URL.

load-test:preflight:
	@test -n "$$STAGING_URL" || (echo "ERROR: STAGING_URL env var required" && exit 2)
	./scripts/preflight_load_test.sh

load-test:baseline:
	@test -n "$$STAGING_URL" || (echo "ERROR: STAGING_URL env var required" && exit 2)
	which k6 >/dev/null || (echo "ERROR: k6 not installed (brew install k6)" && exit 2)
	k6 run --out json=docs/load-test-results/baseline-$$(date -u +%Y%m%dT%H%M%SZ).json \
	  tests/load/baseline.js \
	  -e BASE_URL="$$STAGING_URL" -e TOKEN="$$TOKEN"

load-test:burst:
	@test -n "$$STAGING_URL" || (echo "ERROR: STAGING_URL env var required" && exit 2)
	which k6 >/dev/null || (echo "ERROR: k6 not installed (brew install k6)" && exit 2)
	k6 run --out json=docs/load-test-results/burst-$$(date -u +%Y%m%dT%H%M%SZ).json \
	  tests/load/burst.js \
	  -e BASE_URL="$$STAGING_URL" -e TOKEN="$$TOKEN"

load-test:all: load-test:preflight load-test:baseline
	@echo "Cooldown 5 minutes before burst (allows KEDA to settle)..."
	@sleep 300
	$(MAKE) load-test:burst
	@echo "Capturing metrics..."
	bash ./scripts/capture_metrics.sh

load-test:smoke:
	@(which docker >/dev/null && docker compose version >/dev/null) || \
	  (echo "ERROR: docker + docker compose required" && exit 2)
	@(which k6 >/dev/null) || (echo "ERROR: k6 required (brew install k6)" && exit 2)
	./scripts/smoke_load_test.sh

# Configure the 4 GH Actions secrets (STAGING_URL, STAGING_TOKEN,
# KUBE_CONTEXT, KUBE_NAMESPACE) from the live cluster + gh CLI, then trigger
# .github/workflows/load-test.yml with scenario=all. The workflow runs
# preflight + baseline + burst + capture, parses the k6 summary JSON into
# docs/LOAD_TEST_RESULTS.md, and posts a comment to the triggering PR with
# the run URL. Operator waits ~30 minutes for measured numbers to land.
load-test:setup-and-trigger:
	@chmod +x scripts/setup_gh_secrets.sh scripts/trigger_load_test.sh
	@./scripts/setup_gh_secrets.sh
	@./scripts/trigger_load_test.sh
	@echo "✓ Secrets configured + workflow triggered. Watch the run:"
	@gh run list --workflow=load-test.yml --limit 1 --json url -q '.[] | .url'

# One-shot: configure secrets with --dry-run to print what would change.
load-test:setup-dry-run:
	@chmod +x scripts/setup_gh_secrets.sh
	@./scripts/setup_gh_secrets.sh --dry-run

# Manually trigger the workflow (after secrets are set).
load-test:trigger:
	@chmod +x scripts/trigger_load_test.sh
	@./scripts/trigger_load_test.sh

# Fetch artifacts from the most recent successful load-test workflow run,
# parse them into docs/LOAD_TEST_RESULTS.md, and commit + push back to main.
# Bridges the gap that the workflow's auto-commit step only fires on PR events
# (workflow_dispatch runs leave the patched docs uncommitted on the runner).
load-test:fetch-and-commit:
	@chmod +x scripts/fetch_and_commit_results.sh
	@./scripts/fetch_and_commit_results.sh

# Parse the latest k6 summary + metrics JSON into docs/LOAD_TEST_RESULTS.md.
# Useful locally after capturing metrics manually via scripts/capture_metrics.sh.
load-test:promote:
	@python3 scripts/parse_k6_results.py
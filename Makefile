.PHONY: okf-check test lint build-frontend run-backend run-frontend ci install
.PHONY: load-test:preflight load-test:baseline load-test:burst load-test:all load-test:promote load-test:smoke

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

load-test:promote: load-test:all
	@bash -c '\
	  latest=$$(ls -t docs/load-test-results/metrics-*.json 2>/dev/null | head -1); \
	  if [ -z "$$latest" ]; then \
	    echo "ERROR: no metrics-*.json found in docs/load-test-results/"; \
	    exit 1; \
	  fi; \
	  echo "Promoting $$latest into docs/LOAD_TEST_RESULTS.md"; \
	  echo "(Run scripts/fill_results_md.py to merge — not yet implemented; copy fields manually for now.)" \
	'

load-test:smoke:
	@(which docker >/dev/null && docker compose version >/dev/null) || \
	  (echo "ERROR: docker + docker compose required" && exit 2)
	@(which k6 >/dev/null) || (echo "ERROR: k6 required (brew install k6)" && exit 2)
	./scripts/smoke_load_test.sh
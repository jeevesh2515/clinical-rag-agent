.PHONY: okf-check test lint build-frontend run-backend run-frontend ci install

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
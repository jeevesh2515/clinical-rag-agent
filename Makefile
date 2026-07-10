.PHONY: okf-check test lint build-frontend run-backend run-frontend ci install

install:
	pip install -r requirements.txt

okf-check:
	.venv/bin/python scripts/validate_okf.py

test:
	.venv/bin/python -m pytest tests/ -v --tb=short

lint:
	.venv/bin/python -m ruff check app/ tests/ --ignore E501 || true

build-frontend:
	cd frontend && npm ci && npm run build

run-backend:
	.venv/bin/python -m uvicorn app.main:app --reload --port 8000

run-frontend:
	cd frontend && npm run dev

ci: lint test build-frontend

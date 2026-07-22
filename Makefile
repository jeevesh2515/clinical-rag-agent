.PHONY: okf-check test lint build-frontend run-backend run-frontend ci install

install:
	pip install -r requirements.txt

okf-check:
	python scripts/validate_okf.py

test:
	python -m pytest tests/ -v --tb=short

lint:
	python -m ruff check app/ tests/ --ignore E501 || true

build-frontend:
	cd frontend && npm ci && npm run build

run-backend:
	python -m uvicorn app.main:app --reload --port 8000

run-frontend:
	cd frontend && npm run dev

ci: lint test build-frontend
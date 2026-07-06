.PHONY: okf-check test lint build-frontend run-backend run-frontend ci install

install:
	pip install -r requirements.txt

okf-check:
	python3 scripts/validate_okf.py

test:
	python3 -m pytest tests/ -v --tb=short

lint:
	python3 -m ruff check app/ tests/ --ignore E501 || true

build-frontend:
	cd frontend && npm ci && npm run build

run-backend:
	python3 -m uvicorn app.main:app --reload --port 8000

run-frontend:
	cd frontend && npm run dev

ci: lint test build-frontend

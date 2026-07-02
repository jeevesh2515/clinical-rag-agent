.PHONY: okf-check test lint

okf-check:
	python3 scripts/validate_okf.py

test:
	python3 -m pytest

lint:
	python3 -m ruff check .

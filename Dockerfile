# ── Stage 1: Build React Frontend ─────────────────────────────────────────────
FROM node:18-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build Python Backend & Package Static Frontend ────────────────────
FROM python:3.12-slim

WORKDIR /app

# System dependency installation
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r app && useradd --no-log-init -r -g app app

COPY pyproject.toml README.md ./
COPY app ./app
COPY data ./data
COPY hypertension-okf ./hypertension-okf
COPY scripts ./scripts
COPY Makefile ./Makefile
COPY requirements.txt ./

# Copy built frontend assets from Stage 1 into backend's expected directory
COPY --from=frontend-builder /build/dist ./frontend/dist

RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -e . && \
    chown -R app:app /app

USER app

EXPOSE 8000

# Health check using the readiness endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/ready || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

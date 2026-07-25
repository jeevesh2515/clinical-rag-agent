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

# Pin UID/GID to 10001 so the container matches K8s securityContext.runAsUser
# in k8s/deployment.yaml. An un-pinned useradd assigns a dynamic high UID
# which breaks file ownership when the pod starts as UID 10001 and tries to
# write to a path chowned by an unrelated UID at build time.
RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid 10001 \
       --home-dir /home/app --shell /sbin/nologin \
       --no-log-init app \
    && install -d -o app -g app -m 0755 /home/app

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
    chown -R app:app /app && \
    chown -R app:app /home/app

USER app

ENV HOME=/home/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# Health check using the readiness endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/ready || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

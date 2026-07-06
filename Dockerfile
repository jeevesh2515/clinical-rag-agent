FROM python:3.12-slim

WORKDIR /app

RUN groupadd -r app && useradd --no-log-init -r -g app app

COPY pyproject.toml README.md ./
COPY app ./app
COPY data ./data
COPY hypertension-okf ./hypertension-okf
COPY scripts ./scripts
COPY Makefile ./Makefile
COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -e . && \
    chown -R app:app /app

USER app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Clinical RAG Workflow Assistant — Deployment & Keys Guide

This guide describes how to configure, set up, and place API keys to run the guideline-grounded Hypertension Follow-up Assistant.

---

## 1. Quick Start: Local Configuration (.env)

Duplicate the `.env.example` template to create your active `.env` file:
```bash
cp .env.example .env
```

Open `.env` in a text editor and fill in the required keys based on your choice of models.

### Key Types and Descriptions

| Key / Env Var | Provider / Service | Where to Obtain | Usage & Purpose |
| --- | --- | --- | --- |
| **`OPENROUTER_API_KEY`** | OpenRouter (Free tier) | [openrouter.ai/keys](https://openrouter.ai/keys) | **Required for local startup.** Enables access to Llama 3.1 8B, Gemma 3, and DeepSeek R1 free of cost. |
| **`COHERE_API_KEY`** | Cohere | [dashboard.cohere.com](https://dashboard.cohere.com) | **Highly Recommended.** Used for hybrid RAG embeddings (`embed-v4.0`) and reranking (`rerank-v3.0`). |
| **`PINECONE_API_KEY`** | Pinecone | [pinecone.io](https://www.pinecone.io) | **Optional.** Set this + `PINECONE_INDEX_NAME` to persist dense/sparse index cloud-side instead of in-memory. |
| **`OPENAI_API_KEY`** | OpenAI | [platform.openai.com](https://platform.openai.com) | **Optional.** Unlocks GPT-4o / GPT-4o-mini in the model selection picker. |
| **`ANTHROPIC_API_KEY`**| Anthropic | [console.anthropic.com](https://console.anthropic.com) | **Optional.** Unlocks Claude 3.5 Sonnet / Claude 3 Opus in the picker. |
| **`GOOGLE_API_KEY`** | Google Gemini | [aistudio.google.com](https://aistudio.google.com) | **Optional.** Unlocks Gemini 1.5 Pro / Gemini 1.5 Flash in the picker. |

---

## 2. Setting Up RAG with Pinecone

To shift from the default **in-memory SQLite/local BM25 hybrid index** to a scalable, persistent cloud-side vector database:

1. Create a serverless index in your Pinecone Console:
   - **Dimension**: `1024` (matches Cohere's `embed-english-v3.0` / `embed-v4.0` dimensions).
   - **Metric**: `cosine`.
2. Add the following to your `.env`:
   ```bash
   PINECONE_API_KEY=your-pinecone-api-key-here
   PINECONE_INDEX_NAME=clinical-rag-hybrid
   ```
3. Run the backend. On boot, the `HybridStore` will automatically detect the key, build/initialize the Pinecone index if it doesn't exist, and route search/upsert operations to it.

---

## 3. Running via Docker (Production Deployment)

For a fully containerized build hosting both the React front-end and the FastAPI back-end under a single host:

### Building and Running the Stack
```bash
# Build the production-ready container (uses multi-stage to compile Vite + Python)
docker compose -f docker-compose.prod.yml up --build -d
```

- **Host URL**: `http://localhost:8000` serves the built React web application.
- **API Endpoint**: `http://localhost:8000/api` is reverse-proxied to the FastAPI server.
- **Healthcheck status**: Check docker container status: `docker ps` will show `healthy` once the DB is verified and the OKF bundle is verified on boot.

---

## 4. Continuous Integration (GitHub Actions)

A CI quality gate is configured under `.github/workflows/docker-deploy.yml`. 
Every Pull Request or Push to `main`/`master` will trigger a pipeline that runs:
1. Python syntax linter (`ruff`).
2. Typechecker (`pyright`).
3. Rule validation for all 28 canonical OKF files (`make okf-check`).
4. Full backend test suites (`pytest`).
5. A dry-run Docker compilation of the multi-stage image.

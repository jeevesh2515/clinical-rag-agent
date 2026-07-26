# TODAY — 2026-07-26

## ✅ Fixed Today

| What | Files Changed | How to Verify |
|------|--------------|---------------|
| ETHICS.md created | `ETHICS.md` | review file |
| GDPR.md created | `GDPR.md` | review file |
| Footer links point to GDPR.md & ETHICS.md | `frontend/src/components/LandingPage.tsx:613` | view landing page footer |
| JS bundle 516KB→437KB (lazy-loaded 4 components) | `frontend/src/App.tsx` | `cd frontend && npm run build` — no 500KB warning |
| Corpus seeded (159 chunks) | — (production Neon DB) | verify at `curl https://clinical-workflows.vercel.app/api/health` |
| `/api/ingest` 500 bug fixed | `app/retrieval/pgvector_store.py:150` — `CAST(:embedding AS vector)` | `python3 -m pytest tests/ -v --tb=short -x` (251 pass) |
| ApiError 500 handler bug fixed | `app/models.py:19` — added `internal_error` to Literal | lint passes |

## 🔄 Remaining for Next Session

### Quick (2-3 min each)
- [ ] **Add LICENSE** — root `LICENSE` file (MIT? Apache 2.0?) is missing. Without it the project cannot be distributed publicly.
- [ ] **Run `make load-test:smoke`** — requires Docker Desktop running locally. Starts pgvector + app in docker compose, runs k6 baseline (1 min) + burst (30s), fills Local columns in `docs/LOAD_TEST_RESULTS.md`.
  ```
  make load-test:smoke
  ```
- [ ] **Remove cached PDFs** — `data/source_documents/raw/` may have leftover PDFs; safe to delete.

### Needs infrastructure (staging K8s + Neon)
- [ ] **Run `make load-test:all`** against staging — fills Staging columns in `docs/LOAD_TEST_RESULTS.md`. Requires `STAGING_URL`, `STOKEN`, `KUBE_CONTEXT`, `KUBE_NAMESPACE` secrets.
- [ ] **Set up GitHub Actions secrets** — `make load-test:setup-and-trigger` configures 4 secrets + triggers the workflow.

### If you want to deploy the frontend build
- [ ] **Commit + push** — the Vercel auto-deploy picks up changes from `main`.
  ```bash
  git add -A && git commit -m "docs: ethics, gdpr, bundle perf, seed corpus, api fixes" && git push
  ```

## Quick Health Check
```bash
python3 -m pytest tests/ -v --tb=short -q | tail -3      # 251 passed
python3 -m ruff check app/ tests/ --ignore E501            # clean
cd frontend && npm run build 2>&1 | tail -5                # 437KB main chunk
```

# Local Source Documents

Paste downloaded official guideline/source documents into:

```text
data/source_documents/raw/
```

This is now the canonical local raw-document cache used by the ingestion code.

Recommended examples:

```text
data/source_documents/raw/who-hypertension-guideline.pdf
data/source_documents/raw/nice-hypertension-guideline.pdf
data/source_documents/raw/cdc-hypertension-reference.pdf
```

## Privacy and GitHub rule

The raw, processed, and generated manifest files in this folder are local-only by default and should not be committed until document redistribution licenses are verified.

Tracked in GitHub:

- this `README.md`
- future source registry metadata if we create it intentionally
- ingestion code

Ignored locally:

- `raw/`
- `processed/`
- `manifests/`

## Usage

This folder supports source ingestion, citation metadata, chunk provenance, and ingestion manifest generation. The old `data/pdfs/` cache path should be treated as legacy/backward-compatible only.

- `raw/` — downloaded PDFs consumed by `app/ingestion/pdf_loader.py`
- `manifests/` — JSON manifests written by `/ingest` (git-ignored locally)
- `processed/` — reserved for future normalized intermediate outputs

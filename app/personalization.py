"""Per-user retrieval for personal uploads.

A lightweight in-memory + BM25 + cosine retrieval layer over chunks derived
from a user's uploaded prescriptions / doctor notes / images. The store is
keyed by ``user_id`` so each user has their own private corpus.

Design notes
------------
* Re-uses the public ``BM25SparseEncoder`` for sparse retrieval — that's the
  same encoder the public ``HybridStore`` uses, so vocabulary and ranking
  behaviour stay consistent.
* Dense embeddings go through the existing ``EmbeddingClient`` (Cohere if a
  key is configured, otherwise a deterministic local fallback).
* The store is a separate object from ``HybridStore`` — the public guideline
  corpus is shared across users, while uploads are user-private. The agent
  (``clinical_rag_agent.py``) merges results from both at query time.

Persistence
-----------
Chunks themselves live in memory while the process is running, but their
**source text** lives in SQLite (the ``uploads.extracted_text`` and
``uploads.user_note`` columns). On startup the routes reload each user's
chunks from disk via ``PersonalIndex.rebuild_for_user``.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Iterable

from sqlalchemy.orm import Session

from app.db import Upload as OrmUpload
from app.ingestion.chunker import TextChunk, chunk_page
from app.retrieval.bm25 import BM25SparseEncoder, sparse_dot
from app.retrieval.embeddings import EmbeddingClient, cosine
from app.retrieval.store import HybridCandidate, minmax_normalize


class _UserIndex:
    """Per-user in-memory index. Reset / rebuild via ``reset``."""

    def __init__(self, embedding_client: EmbeddingClient) -> None:
        self.embedding_client = embedding_client
        self.sparse_encoder = BM25SparseEncoder()
        self._chunks: dict[str, TextChunk] = {}
        self._dense: dict[str, list[float]] = {}
        self._sparse: dict[str, dict[str, list]] = {}

    def reset(self, chunks: Iterable[TextChunk]) -> None:
        chunks = list(chunks)
        self._chunks = {chunk.chunk_id: chunk for chunk in chunks}
        if not chunks:
            self._dense.clear()
            self._sparse.clear()
            return
        self._dense = {
            chunk.chunk_id: vec
            for chunk, vec in zip(
                chunks,
                self.embedding_client.embed_documents([c.text for c in chunks]),
                strict=True,
            )
        }
        corpus_texts = [chunk.text for chunk in chunks]
        self.sparse_encoder.fit(corpus_texts)
        self._sparse = {
            chunk_id: self.sparse_encoder.encode_document(chunk.text)
            for chunk_id, chunk in self._chunks.items()
        }

    def add_chunks(self, chunks: list[TextChunk]) -> None:
        """Add new chunks incrementally (re-fits BM25 over the merged corpus)."""
        if not chunks:
            return
        for chunk in chunks:
            self._chunks[chunk.chunk_id] = chunk
            self._dense[chunk.chunk_id] = self.embedding_client.embed_query(chunk.text)
        all_texts = [c.text for c in self._chunks.values()]
        self.sparse_encoder.fit(all_texts)
        for chunk_id, chunk in self._chunks.items():
            self._sparse[chunk_id] = self.sparse_encoder.encode_document(chunk.text)

    def remove_upload(self, upload_id: str) -> None:
        prefix = f"upload:{upload_id}:"
        to_remove = [cid for cid in self._chunks if cid.startswith(prefix)]
        for cid in to_remove:
            self._chunks.pop(cid, None)
            self._dense.pop(cid, None)
            self._sparse.pop(cid, None)
        if to_remove and self._chunks:
            all_texts = [c.text for c in self._chunks.values()]
            self.sparse_encoder.fit(all_texts)
            for chunk_id, chunk in self._chunks.items():
                self._sparse[chunk_id] = self.sparse_encoder.encode_document(chunk.text)

    def query(self, question: str, *, alpha: float, top_k: int) -> list[HybridCandidate]:
        if not self._chunks:
            return []
        dense_query = self.embedding_client.embed_query(question)
        sparse_query = self.sparse_encoder.encode_query(question)
        raw: list[HybridCandidate] = []
        for chunk_id, chunk in self._chunks.items():
            d = cosine(dense_query, self._dense[chunk_id])
            s = sparse_dot(sparse_query, self._sparse[chunk_id])
            raw.append(
                HybridCandidate(
                    chunk_id=chunk_id,
                    text=chunk.text,
                    metadata=asdict(chunk),
                    dense_score=d,
                    sparse_score=s,
                )
            )
        d_norm = minmax_normalize([float(c["dense_score"]) for c in raw])
        s_norm = minmax_normalize([float(c["sparse_score"]) for c in raw])
        for candidate, dn, sn in zip(raw, d_norm, s_norm, strict=True):
            candidate["hybrid_score"] = alpha * dn + (1 - alpha) * sn
        return sorted(raw, key=lambda c: c["hybrid_score"], reverse=True)[:top_k]


class PersonalIndex:
    """Top-level multi-user personal retrieval store."""

    def __init__(self, embedding_client: EmbeddingClient) -> None:
        self.embedding_client = embedding_client
        self._by_user: dict[str, _UserIndex] = {}

    def _index_for(self, user_id: str) -> _UserIndex:
        idx = self._by_user.get(user_id)
        if idx is None:
            idx = _UserIndex(self.embedding_client)
            self._by_user[user_id] = idx
        return idx

    def rebuild_for_user(self, db: Session, user_id: str) -> int:
        """Reload a user's index from SQLite. Called on startup + after deletes."""
        uploads = db.query(OrmUpload).filter(OrmUpload.user_id == user_id).all()
        chunks: list[TextChunk] = []
        for upload in uploads:
            chunks.extend(_chunks_for_upload(upload))
        self._index_for(user_id).reset(chunks)
        return len(chunks)

    def add_upload(self, db: Session, upload: OrmUpload) -> int:
        chunks = _chunks_for_upload(upload)
        self._index_for(upload.user_id).add_chunks(chunks)
        return len(chunks)

    def remove_upload(self, user_id: str, upload_id: str) -> None:
        idx = self._by_user.get(user_id)
        if idx:
            idx.remove_upload(upload_id)

    def query(
        self, user_id: str, question: str, *, alpha: float, top_k: int
    ) -> list[HybridCandidate]:
        idx = self._by_user.get(user_id)
        if not idx:
            return []
        return idx.query(question, alpha=alpha, top_k=top_k)

    def warm_from_db(self, db: Session) -> int:
        """Rebuild all user indices. Called once on startup."""
        user_ids = [row[0] for row in db.query(OrmUpload.user_id).distinct().all()]
        total = 0
        for uid in user_ids:
            total += self.rebuild_for_user(db, uid)
        return total


# Module-level singleton used everywhere — initialised lazily on first use
# so importing this module doesn't require a configured Cohere key.
_personal_index: PersonalIndex | None = None


def _get_personal_index() -> PersonalIndex:
    global _personal_index
    if _personal_index is None:
        from app.retrieval.embeddings import EmbeddingClient
        from app.core.config import get_settings

        _personal_index = PersonalIndex(EmbeddingClient(get_settings()))
    return _personal_index


# Public attribute — imported as ``from app.personalization import personal_index``.
# Implemented as a property on a tiny proxy class so callers can use it as
# ``personal_index.query(...)`` without worrying about lazy init.
class _PersonalIndexProxy:
    def __getattr__(self, name: str):
        return getattr(_get_personal_index(), name)


personal_index = _PersonalIndexProxy()


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _chunks_for_upload(upload: OrmUpload) -> list[TextChunk]:
    """Build retrieval chunks for one upload row.

    Strategy
    --------
    * If we have extracted text (PDF), chunk it normally (chunk_page) and
      emit one TextChunk per chunk.
    * Always emit at least one chunk containing the user's free-text note so
      it stays searchable even for image uploads where we don't have OCR.
    """
    chunks: list[TextChunk] = []
    base = {
        "source_id": f"upload:{upload.id}",
        "title": upload.display_title or upload.original_filename,
        "source_url": f"local://uploads/{upload.user_id}/{upload.id}",
        "organization": "Personal upload",
        "publication_year": None,
        "source_type": "personal_upload",
        "source_version": None,
        "review_date": None,
        "effective_date": None,
        "license_notes": "Personal — not for redistribution.",
        "ingested_at": upload.created_at.isoformat() if upload.created_at else None,
    }

    if upload.extracted_text:
        try:
            chunks = chunk_page(
                source_id=base["source_id"],
                title=base["title"],
                source_url=base["source_url"],
                page=1,
                text=upload.extracted_text,
                organization=base["organization"],
                source_type=base["source_type"],
                license_notes=base["license_notes"],
                ingested_at=base["ingested_at"],
            )
        except Exception:
            chunks = []

    # If we only have a note (no extracted text, e.g. an image), or chunking
    # somehow produced nothing, fall back to a single-chunk index entry.
    if not chunks and upload.user_note:
        chunks = [
            TextChunk(
                chunk_id=f"{base['source_id']}:note",
                source_id=base["source_id"],
                title=base["title"],
                page=1,
                section="user_note",
                text=upload.user_note.strip(),
                source_url=base["source_url"],
                chunk_index=1,
                organization=base["organization"],
                source_type=base["source_type"],
                license_notes=base["license_notes"],
                ingested_at=base["ingested_at"],
            )
        ]
    elif chunks and upload.user_note:
        # Append user note as an extra chunk so it's always retrievable.
        chunks.append(
            TextChunk(
                chunk_id=f"{base['source_id']}:note",
                source_id=base["source_id"],
                title=f"{base['title']} — note",
                page=1,
                section="user_note",
                text=f"User note: {upload.user_note.strip()}",
                source_url=base["source_url"],
                chunk_index=len(chunks) + 1,
                organization=base["organization"],
                source_type=base["source_type"],
                license_notes=base["license_notes"],
                ingested_at=base["ingested_at"],
            )
        )

    # Renumber so chunk_index is contiguous and prefix with upload id.
    rebuilt: list[TextChunk] = []
    for idx, chunk in enumerate(chunks, start=1):
        rebuilt.append(TextChunk(
            chunk_id=f"{base['source_id']}:p1:c{idx:03d}",
            chunk_index=idx,
            source_id=chunk.source_id,
            title=chunk.title,
            page=chunk.page,
            section=chunk.section,
            text=chunk.text,
            source_url=chunk.source_url,
            organization=chunk.organization,
            publication_year=chunk.publication_year,
            source_type=chunk.source_type,
            source_version=chunk.source_version,
            review_date=chunk.review_date,
            effective_date=chunk.effective_date,
            license_notes=chunk.license_notes,
            ingested_at=chunk.ingested_at,
        ))
    return rebuilt
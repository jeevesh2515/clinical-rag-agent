"""PostgreSQL + pgvector-backed HybridStore.

Drop-in replacement for the in-memory ``HybridStore`` when a PostgreSQL database
with the pgvector extension is available (Neon free tier, Supabase free tier,
local Docker PostgreSQL).

Keeps BM25 sparse index in memory (fast, rebuilt lazily from DB).
Dense vectors stored in PostgreSQL ``chunk_vectors`` table via pgvector.

Usage (via config):
    DATABASE_URL=postgresql://user:pass@db.example.com:5432/db  # enables pgvector
    DATABASE_URL=sqlite:///./clinical_demo.db                     # keeps in-memory store
"""


from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.ingestion.chunker import TextChunk
from app.retrieval.bm25 import BM25SparseEncoder, sparse_dot
from app.retrieval.embeddings import EmbeddingClient
from app.retrieval.store import HybridCandidate, minmax_normalize


def is_pgvector_url(url: str) -> bool:
    return url.startswith("postgresql") or url.startswith("postgres")


class PgVectorStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.embedding_client = EmbeddingClient(settings)
        self.sparse_encoder = BM25SparseEncoder()
        self._engine = create_engine(settings.database_url, pool_pre_ping=True)
        self._init_schema()
        self._rebuild_sparse_index()

    def _init_schema(self) -> None:
        with self._engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS chunk_vectors (
                    id SERIAL PRIMARY KEY,
                    chunk_id VARCHAR(255) UNIQUE NOT NULL,
                    source_id VARCHAR(255) NOT NULL,
                    title VARCHAR(500) NOT NULL,
                    page INTEGER DEFAULT 0,
                    section VARCHAR(500),
                    text TEXT NOT NULL,
                    source_url VARCHAR(1000) NOT NULL,
                    chunk_index INTEGER DEFAULT 0,
                    organization VARCHAR(255) DEFAULT '',
                    publication_year INTEGER,
                    source_type VARCHAR(100) DEFAULT 'clinical_guideline',
                    source_version VARCHAR(100),
                    review_date VARCHAR(50),
                    effective_date VARCHAR(50),
                    license_notes TEXT,
                    ingested_at VARCHAR(50),
                    embedding vector(1536)
                )
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_chunk_vectors_chunk_id
                ON chunk_vectors (chunk_id)
            """))
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_chunk_vectors_embedding
                    ON chunk_vectors USING hnsw (embedding vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64)
                """))
            except Exception:
                try:
                    conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS idx_chunk_vectors_embedding
                        ON chunk_vectors USING ivfflat (embedding vector_cosine_ops)
                        WITH (lists = 100)
                    """))
                except Exception:
                    pass
            conn.commit()

    def _rebuild_sparse_index(self) -> None:
        with Session(self._engine) as db:
            rows = db.execute(text("SELECT chunk_id, text FROM chunk_vectors")).fetchall()
        texts = [row.text for row in rows]
        if not texts:
            return
        self.sparse_encoder.fit(texts)

    @property
    def document_count(self) -> int:
        with Session(self._engine) as db:
            return db.execute(
                text("SELECT COUNT(DISTINCT source_id) FROM chunk_vectors")
            ).scalar() or 0

    @property
    def chunk_count(self) -> int:
        with Session(self._engine) as db:
            return db.execute(
                text("SELECT COUNT(*) FROM chunk_vectors")
            ).scalar() or 0

    def list_documents(self) -> list[dict]:
        with Session(self._engine) as db:
            rows = db.execute(text("""
                SELECT source_id, title, source_url, COUNT(*) as chunks
                FROM chunk_vectors
                GROUP BY source_id, title, source_url
                ORDER BY source_id
            """)).fetchall()
        return [
            {"source_id": r.source_id, "title": r.title, "source_url": r.source_url, "chunks": r.chunks}
            for r in rows
        ]

    def upsert_chunks(self, chunks: list[TextChunk]) -> None:
        if not chunks:
            return
        dense_vectors = self.embedding_client.embed_documents([chunk.text for chunk in chunks])
        with Session(self._engine) as db:
            for chunk, vec in zip(chunks, dense_vectors, strict=True):
                vec_str = f"[{','.join(str(v) for v in vec)}]"
                db.execute(text("""
                    INSERT INTO chunk_vectors (
                        chunk_id, source_id, title, page, section, text,
                        source_url, chunk_index, organization, publication_year,
                        source_type, source_version, review_date, effective_date,
                        license_notes, ingested_at, embedding
                    ) VALUES (
                        :chunk_id, :source_id, :title, :page, :section, :text,
                        :source_url, :chunk_index, :organization, :publication_year,
                        :source_type, :source_version, :review_date, :effective_date,
                        :license_notes, :ingested_at, :embedding::vector
                    ) ON CONFLICT (chunk_id) DO UPDATE SET
                        text = EXCLUDED.text,
                        embedding = EXCLUDED.embedding,
                        source_version = EXCLUDED.source_version,
                        review_date = EXCLUDED.review_date,
                        effective_date = EXCLUDED.effective_date,
                        ingested_at = EXCLUDED.ingested_at
                """), {
                    "chunk_id": chunk.chunk_id,
                    "source_id": chunk.source_id,
                    "title": chunk.title,
                    "page": chunk.page,
                    "section": chunk.section,
                    "text": chunk.text,
                    "source_url": chunk.source_url,
                    "chunk_index": chunk.chunk_index,
                    "organization": chunk.organization,
                    "publication_year": chunk.publication_year,
                    "source_type": chunk.source_type,
                    "source_version": chunk.source_version,
                    "review_date": chunk.review_date,
                    "effective_date": chunk.effective_date,
                    "license_notes": chunk.license_notes,
                    "ingested_at": chunk.ingested_at,
                    "embedding": vec_str,
                })
            db.commit()
        self._rebuild_sparse_index()

    def query(self, question: str, *, alpha: float, top_k: int) -> list[HybridCandidate]:
        dense_query = self.embedding_client.embed_query(question)
        vec_str = f"[{','.join(str(v) for v in dense_query)}]"
        with Session(self._engine) as db:
            rows = db.execute(text(f"""
                SELECT chunk_id, title, source_id, source_url, section, text,
                       chunk_index, organization, publication_year, source_type,
                       source_version, review_date, effective_date, license_notes,
                       ingested_at, page,
                       1 - (embedding <=> '{vec_str}'::vector) AS dense_score
                FROM chunk_vectors
                ORDER BY embedding <=> '{vec_str}'::vector
                LIMIT :top_k
            """), {"top_k": top_k * 3}).fetchall()

        sparse_query = self.sparse_encoder.encode_query(question)
        candidates: list[HybridCandidate] = []
        for r in rows:
            sparse_score = sparse_dot(sparse_query, self.sparse_encoder.encode_document(r.text))
            candidates.append(HybridCandidate(
                chunk_id=r.chunk_id,
                text=r.text,
                metadata={
                    "chunk_id": r.chunk_id,
                    "source_id": r.source_id,
                    "title": r.title,
                    "page": r.page,
                    "section": r.section,
                    "source_url": r.source_url,
                    "chunk_index": r.chunk_index,
                    "organization": r.organization,
                    "publication_year": r.publication_year,
                    "source_type": r.source_type,
                    "source_version": r.source_version,
                    "review_date": r.review_date,
                    "effective_date": r.effective_date,
                    "license_notes": r.license_notes,
                    "ingested_at": r.ingested_at,
                },
                dense_score=float(r.dense_score),
                sparse_score=float(sparse_score),
            ))

        dense_scores = [float(c["dense_score"]) for c in candidates]
        sparse_scores = [float(c["sparse_score"]) for c in candidates]
        dense_norm = minmax_normalize(dense_scores)
        sparse_norm = minmax_normalize(sparse_scores)
        for c, dn, sn in zip(candidates, dense_norm, sparse_norm, strict=True):
            c["hybrid_score"] = alpha * dn + (1 - alpha) * sn

        return sorted(candidates, key=lambda c: c["hybrid_score"], reverse=True)[:top_k]

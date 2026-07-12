from dataclasses import asdict

from app.core.config import Settings
from app.ingestion.chunker import TextChunk
from app.retrieval.bm25 import BM25SparseEncoder, sparse_dot
from app.retrieval.embeddings import EmbeddingClient, cosine


def minmax_normalize(scores: list[float]) -> list[float]:
    """Scale scores to [0, 1] within a single query result set for fair hybrid fusion."""
    if not scores:
        return []
    minimum = min(scores)
    maximum = max(scores)
    if maximum == minimum:
        return [1.0 if maximum > 0.0 else 0.0 for _ in scores]
    span = maximum - minimum
    return [(score - minimum) / span for score in scores]


class HybridCandidate(dict):
    pass


class HybridStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.embedding_client = EmbeddingClient(settings)
        self.sparse_encoder = BM25SparseEncoder()
        self._chunks: dict[str, TextChunk] = {}
        self._dense: dict[str, list[float]] = {}
        self._sparse: dict[str, dict[str, list]] = {}
        self._pinecone_index = None
        self._init_pinecone()

    def _init_pinecone(self) -> None:
        if not self.settings.pinecone_api_key:
            return
        try:
            from pinecone import Pinecone, ServerlessSpec

            pc = Pinecone(api_key=self.settings.pinecone_api_key)
            names = [index["name"] for index in pc.list_indexes()]
            if self.settings.pinecone_index_name not in names:
                pc.create_index(
                    name=self.settings.pinecone_index_name,
                    dimension=self.settings.embedding_dim,
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud=self.settings.pinecone_cloud,
                        region=self.settings.pinecone_region,
                    ),
                )
            self._pinecone_index = pc.Index(self.settings.pinecone_index_name)
        except Exception:
            self._pinecone_index = None

    @property
    def document_count(self) -> int:
        return len({chunk.source_id for chunk in self._chunks.values()})

    @property
    def chunk_count(self) -> int:
        return len(self._chunks)

    def list_documents(self) -> list[dict]:
        docs: dict[str, dict] = {}
        for chunk in self._chunks.values():
            docs.setdefault(
                chunk.source_id,
                {
                    "source_id": chunk.source_id,
                    "title": chunk.title,
                    "source_url": chunk.source_url,
                    "chunks": 0,
                },
            )
            docs[chunk.source_id]["chunks"] += 1
        return list(docs.values())

    def upsert_chunks(self, chunks: list[TextChunk]) -> None:
        if not chunks:
            return
        dense_vectors = self.embedding_client.embed_documents([chunk.text for chunk in chunks])
        for chunk, dense in zip(chunks, dense_vectors, strict=True):
            self._chunks[chunk.chunk_id] = chunk
            self._dense[chunk.chunk_id] = dense

        corpus_texts = [chunk.text for chunk in self._chunks.values()]
        self.sparse_encoder.fit(corpus_texts)
        for chunk_id, chunk in self._chunks.items():
            self._sparse[chunk_id] = self.sparse_encoder.encode_document(chunk.text)

        if self._pinecone_index:
            vectors = []
            for chunk_id, chunk in self._chunks.items():
                if chunk_id not in {item.chunk_id for item in chunks}:
                    continue
                # Strip None values to comply with Pinecone metadata type restrictions
                metadata_clean = {k: v for k, v in asdict(chunk).items() if v is not None}
                vectors.append(
                    {
                        "id": chunk_id,
                        "values": self._dense[chunk_id],
                        "sparse_values": self._sparse[chunk_id],
                        "metadata": metadata_clean,
                    }
                )
            for start in range(0, len(vectors), 100):
                self._pinecone_index.upsert(vectors=vectors[start : start + 100])

    def query(self, question: str, *, alpha: float, top_k: int) -> list[HybridCandidate]:
        dense_query = self.embedding_client.embed_query(question)
        sparse_query = self.sparse_encoder.encode_query(question)
        if self._pinecone_index:
            response = self._pinecone_index.query(
                vector=[value * alpha for value in dense_query],
                sparse_vector={
                    "indices": sparse_query["indices"],
                    "values": [value * (1 - alpha) for value in sparse_query["values"]],
                },
                top_k=top_k,
                include_metadata=True,
            )
            candidates = []
            for match in response.get("matches", []):
                metadata = match.get("metadata", {})
                candidates.append(
                    HybridCandidate(
                        chunk_id=match["id"],
                        text=metadata.get("text", ""),
                        metadata=metadata,
                        dense_score=float(match.get("score", 0.0)),
                        sparse_score=0.0,
                        hybrid_score=float(match.get("score", 0.0)),
                    )
                )
            return candidates

        raw_candidates: list[HybridCandidate] = []
        for chunk_id, chunk in self._chunks.items():
            dense_score = cosine(dense_query, self._dense[chunk_id])
            sparse_score = sparse_dot(sparse_query, self._sparse[chunk_id])
            raw_candidates.append(
                HybridCandidate(
                    chunk_id=chunk_id,
                    text=chunk.text,
                    metadata=asdict(chunk),
                    dense_score=dense_score,
                    sparse_score=sparse_score,
                )
            )

        dense_normalized = minmax_normalize(
            [float(candidate["dense_score"]) for candidate in raw_candidates]
        )
        sparse_normalized = minmax_normalize(
            [float(candidate["sparse_score"]) for candidate in raw_candidates]
        )
        for candidate, dense_norm, sparse_norm in zip(
            raw_candidates, dense_normalized, sparse_normalized, strict=True
        ):
            candidate["hybrid_score"] = alpha * dense_norm + (1 - alpha) * sparse_norm

        return sorted(raw_candidates, key=lambda item: item["hybrid_score"], reverse=True)[:top_k]

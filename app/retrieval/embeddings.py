import hashlib
import math
from typing import Any, cast

from app.core.config import Settings


class EmbeddingClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._cohere = None
        if settings.cohere_api_key:
            try:
                import cohere

                self._cohere = cohere.ClientV2(api_key=settings.cohere_api_key)
            except Exception:
                self._cohere = None

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if self._cohere:
            response = cast(
                Any,
                self._cohere.embed(
                    texts=texts,
                    model=self.settings.embedding_model,
                    input_type="search_document",
                    embedding_types=["float"],
                    output_dimension=self.settings.embedding_dim,
                ),
            )
            return [list(item) for item in response.embeddings.float]
        return [deterministic_embedding(text, self.settings.embedding_dim) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        if self._cohere:
            response = cast(
                Any,
                self._cohere.embed(
                    texts=[text],
                    model=self.settings.embedding_model,
                    input_type="search_query",
                    embedding_types=["float"],
                    output_dimension=self.settings.embedding_dim,
                ),
            )
            return list(response.embeddings.float[0])
        return deterministic_embedding(text, self.settings.embedding_dim)


def deterministic_embedding(text: str, dim: int = 1536) -> list[float]:
    vector = [0.0] * dim
    for token in text.lower().split():
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=16).digest()
        index = int.from_bytes(digest[:8], "big") % dim
        sign = 1.0 if digest[8] % 2 else -1.0
        vector[index] += sign
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


def cosine(left: list[float], right: list[float]) -> float:
    return float(sum(a * b for a, b in zip(left, right, strict=False)))

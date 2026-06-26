from app.core.config import Settings
from app.retrieval.bm25 import tokenize


class Reranker:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._cohere = None
        if settings.cohere_api_key:
            try:
                import cohere

                self._cohere = cohere.ClientV2(api_key=settings.cohere_api_key)
            except Exception:
                self._cohere = None

    def rerank(self, query: str, candidates: list[dict], top_n: int) -> list[dict]:
        """Rerank hybrid candidates while preserving upstream scores and metadata."""
        if not candidates:
            return []
        limit = min(top_n, len(candidates))
        if self._cohere:
            response = self._cohere.rerank(
                model=self.settings.rerank_model,
                query=query,
                documents=[candidate["text"] for candidate in candidates],
                top_n=limit,
            )
            reranked = []
            for result in response.results:
                candidate = dict(candidates[result.index])
                candidate["rerank_score"] = float(result.relevance_score)
                reranked.append(candidate)
            return reranked
        query_terms = set(tokenize(query))
        scored = []
        for candidate in candidates:
            terms = tokenize(candidate["text"])
            overlap = sum(1 for term in terms if term in query_terms)
            score = overlap / max(1, len(query_terms))
            enriched = dict(candidate)
            enriched["rerank_score"] = float(score)
            scored.append(enriched)
        return sorted(scored, key=lambda item: item["rerank_score"], reverse=True)[:limit]

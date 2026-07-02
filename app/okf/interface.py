import logging
import time
from pathlib import Path

from app.okf.models import KnowledgeResult, OKFDocument, RAGResult, RouterDecision
from app.okf.retriever import OKFRetriever
from app.okf.router import QueryRouter
from app.retrieval.store import HybridStore

logger = logging.getLogger(__name__)


class KnowledgeInterface:
    """Unified retrieval interface that hides OKF vs RAG routing.

    The calling LLM/agent only calls `search()` — it doesn't know
    or care which backend answered.
    """

    def __init__(
        self,
        okf_retriever: OKFRetriever,
        router: QueryRouter,
        rag_store: HybridStore,
    ) -> None:
        self._okf = okf_retriever
        self._router = router
        self._rag = rag_store

    def search(
        self,
        query: str,
        *,
        alpha: float = 0.55,
        top_k: int = 20,
        resolve_links: bool = True,
        max_link_hops: int = 2,
    ) -> KnowledgeResult:
        """Unified search — the ONLY method the agent calls."""
        start = time.monotonic()
        decision = self._router.classify(query)
        okf_docs: list[OKFDocument] = []
        rag_chunks: list[RAGResult] = []

        if decision.path in ("okf", "okf_then_rag"):
            okf_docs = self._retrieve_okf(decision, resolve_links, max_link_hops)

        if decision.path in ("rag", "okf_then_rag"):
            rag_chunks = self._retrieve_rag(query, alpha, top_k)

        merged = self._merge(okf_docs, rag_chunks, decision)
        elapsed = time.monotonic() - start

        logger.info(
            "knowledge_query path=%s okf_docs=%d rag_chunks=%d elapsed=%.2fs",
            decision.path,
            len(okf_docs),
            len(rag_chunks),
            elapsed,
        )

        return KnowledgeResult(
            okf_docs=okf_docs,
            rag_chunks=rag_chunks,
            decision=decision,
            merged_content=merged,
        )

    def _retrieve_okf(
        self,
        decision: RouterDecision,
        resolve_links: bool,
        max_link_hops: int,
    ) -> list[OKFDocument]:
        docs: list[OKFDocument] = []

        if decision.okf_concepts:
            for concept_path in decision.okf_concepts:
                stem = concept_path.replace(".md", "").replace("\\", "/")
                stem = "/".join(stem.split("/")[-2:]) if "/" in stem else stem
                doc = self._okf.get_concept(stem)
                if doc:
                    if resolve_links:
                        doc.content = self._okf.resolve_links(doc.content, max_hops=max_link_hops)
                    docs.append(doc)

        if not docs:
            match = self._okf.retrieve(" ".join(decision.matched_tags))
            docs = match

        return docs

    def _retrieve_rag(self, query: str, alpha: float, top_k: int) -> list[RAGResult]:
        candidates = self._rag.query(query, alpha=alpha, top_k=top_k)
        return [
            RAGResult(
                source_path=item.get("chunk_id", ""),
                source_type="rag",
                score=float(item.get("hybrid_score", 0.0)),
                citation_url=item.get("metadata", {}).get("source_url", ""),
                content=item.get("text", ""),
            )
            for item in candidates
        ]

    def _merge(
        self,
        okf_docs: list[OKFDocument],
        rag_chunks: list[RAGResult],
        decision: RouterDecision,
    ) -> str:
        parts: list[str] = []

        if okf_docs:
            parts.append("=== CANONICAL KNOWLEDGE (OKF) ===")
            for doc in okf_docs:
                header = f"--- {doc.title} ---"
                parts.append(header)
                parts.append(doc.content[:2000])

        if rag_chunks:
            label = "SUPPORTING EVIDENCE (RAG)" if okf_docs else "RETRIEVED EVIDENCE"
            parts.append(f"=== {label} ===")
            for chunk in rag_chunks[:6]:
                parts.append(chunk.content[:800])

        return "\n\n".join(parts)

    @classmethod
    def from_settings(
        cls,
        okf_root: str | Path,
        rag_store: HybridStore,
    ) -> "KnowledgeInterface":
        """Factory method that wires OKF retriever + router + interface."""
        retriever = OKFRetriever(okf_root)
        router = QueryRouter(retriever)
        return cls(retriever, router, rag_store)

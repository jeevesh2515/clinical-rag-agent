import logging

from app.okf.models import RouterDecision
from app.okf.normalize import normalize_query
from app.okf.retriever import OKFRetriever

logger = logging.getLogger(__name__)

OKF_KEYWORDS: list[str] = [
    "dose", "doses", "dosage", "dosages",
    "contraindicated", "contraindication", "contraindications",
    "threshold", "thresholds",
    "protocol", "protocols",
    "guideline", "guidelines",
    "stage", "staging",
    "target", "targets",
    "first-line", "first line",
    "step-care", "step care", "stepped",
    "bp category", "bp categories",
    "classification",
    "drug class", "drug classes",
    "when to escalate",
    "when to refer",
    "safe in pregnancy",
    "labs", "lab", "monitoring",
    "follow-up", "follow up",
    "home bp",
]

RAG_KEYWORDS: list[str] = [
    "has anyone", "has there been",
    "case report", "case study",
    "similar to",
    "research", "study", "studies",
    "latest", "recent",
    "literature",
    "patient profile", "patient case",
    "archive",
    "reported",
]


class QueryRouter:
    """Classifies queries into OKF, RAG, or OKF_THEN_RAG paths.

    Uses a rule-based keyword matcher with tag matching as the override:
    if OKF has a concept whose tags match the query topic, ALWAYS prefer OKF.
    """

    def __init__(self, retriever: OKFRetriever) -> None:
        self._retriever = retriever

    def classify(self, query: str) -> RouterDecision:
        """Classify a query and return the routing decision with rationale."""
        query_lower = normalize_query(query)

        matched_tags = self._match_okf_tags(query_lower)

        if matched_tags:
            okf_paths = self._resolve_okf_paths(matched_tags)
            return RouterDecision(
                path="okf",
                reason=f"OKF has concepts matching topic tags: {', '.join(matched_tags)}",
                matched_tags=matched_tags,
                okf_concepts=okf_paths,
            )

        okf_keyword_score = sum(1 for kw in OKF_KEYWORDS if kw in query_lower)
        rag_keyword_score = sum(1 for kw in RAG_KEYWORDS if kw in query_lower)

        is_canonical = okf_keyword_score >= 2 or self._is_high_stakes_canonical(query_lower)

        if is_canonical:
            matched = self._match_by_title(query_lower)
            if matched:
                return RouterDecision(
                    path="okf",
                    reason=f"Canonical query matched title: {matched}",
                    matched_tags=matched_tags,
                    okf_concepts=matched,
                )
            return RouterDecision(
                path="okf",
                reason="Query appears canonical (high keyword match) — routing to OKF",
                matched_tags=matched_tags,
                okf_concepts=[],
            )

        okf_heavy = okf_keyword_score >= 1
        rag_heavy = rag_keyword_score >= 2

        if okf_heavy and rag_heavy:
            matched = self._match_by_title(query_lower)
            return RouterDecision(
                path="okf_then_rag",
                reason=f"Canonical + exploratory keywords both present ({okf_keyword_score} okf / {rag_keyword_score} rag)",
                matched_tags=matched_tags,
                okf_concepts=matched or [],
            )

        if okf_heavy:
            matched = self._match_by_title(query_lower)
            return RouterDecision(
                path="okf",
                reason=f"OKF keywords detected ({okf_keyword_score} matches)",
                matched_tags=matched_tags,
                okf_concepts=matched or [],
            )

        return RouterDecision(
            path="rag",
            reason="No OKF-specific keywords or tag matches — routing to RAG",
            matched_tags=matched_tags,
            okf_concepts=[],
        )

    def _match_okf_tags(self, query: str) -> list[str]:
        concept_map = self._retriever.get_concept_map()
        matched: list[str] = []
        for rel_path in concept_map.values():
            stem = rel_path.replace(".md", "").lstrip("/")
            doc = self._retriever.get_concept(stem)
            if doc:
                for tag in doc.tags:
                    tag_key = normalize_query(tag)
                    if tag_key and tag_key in query and tag_key not in matched:
                        matched.append(tag_key)
        return matched

    def _resolve_okf_paths(self, tags: list[str]) -> list[str]:
        paths: list[str] = []
        concept_map = self._retriever.get_concept_map()
        for rel_path in concept_map.values():
            stem = rel_path.replace(".md", "").lstrip("/")
            doc = self._retriever.get_concept(stem)
            if doc:
                for tag in doc.tags:
                    if normalize_query(tag) in tags:
                        paths.append(doc.source_path)
                        break
        return paths

    def _match_by_title(self, query: str) -> list[str]:
        query_words = set(query.split())
        concept_map = self._retriever.get_concept_map()
        matched: list[str] = []
        for rel_path in concept_map.values():
            stem = rel_path.replace(".md", "").lstrip("/")
            doc = self._retriever.get_concept(stem)
            if doc:
                title_words = set(doc.title.lower().split())
                if query_words & title_words:
                    matched.append(doc.source_path)
        return matched

    @staticmethod
    def _is_high_stakes_canonical(query: str) -> bool:
        high_stakes: list[str] = [
            "contraindicated",
            "contraindication",
            "pregnancy",
            "dose",
            "dosage",
            "target bp",
            "bp goal",
            "bp target",
            "threshold",
            "first-line",
            "first line",
            "drug class",
            "safe",
        ]
        return any(term in query for term in high_stakes)




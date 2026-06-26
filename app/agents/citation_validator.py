import re

from app.models import Citation

CHUNK_ID_REFERENCE_PATTERN = re.compile(r"\[[\w:-]+\]")

CLINICAL_CLAIM_MARKERS = (
    "treat",
    "diagnos",
    "refer",
    "drug",
    "medication",
    "blood pressure",
    "hypertension",
    "prescrib",
    "recommend",
    "should start",
    "should take",
)

RECOMMENDATION_MARKERS = (
    "recommend",
    "should start",
    "should take",
    "offer ",
    "consider ",
    "initiate ",
    "prescrib",
)


def build_citations(candidates: list[dict], max_quotes: int = 4) -> list[Citation]:
    citations: list[Citation] = []
    for candidate in candidates[:max_quotes]:
        metadata = candidate.get("metadata", {})
        text = candidate.get("text", "")
        quote = text.strip().replace("\n", " ")[:260]
        if not quote:
            continue
        citations.append(
            Citation(
                source_id=metadata.get("source_id", ""),
                title=metadata.get("title", ""),
                page=int(metadata.get("page", 0)),
                chunk_id=candidate.get("chunk_id", metadata.get("chunk_id", "")),
                quote=quote,
                publication_year=metadata.get("publication_year"),
                organization=metadata.get("organization", ""),
            )
        )
    return citations


def _has_clinical_claim_language(answer: str) -> bool:
    lower_answer = answer.lower()
    return any(marker in lower_answer for marker in CLINICAL_CLAIM_MARKERS)


def _has_recommendation_language(answer: str) -> bool:
    lower_answer = answer.lower()
    return any(marker in lower_answer for marker in RECOMMENDATION_MARKERS)


def unsupported_claims_detected(answer: str, citations: list[Citation]) -> bool:
    if "could not find enough evidence" in answer.lower():
        return False

    has_clinical_claim = _has_clinical_claim_language(answer)
    if has_clinical_claim and not citations:
        return True

    if not citations:
        return False

    if _has_recommendation_language(answer) and not CHUNK_ID_REFERENCE_PATTERN.search(answer):
        return True

    return False

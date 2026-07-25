import logging
import re
from datetime import datetime, timezone

from app.models import Citation

logger = logging.getLogger(__name__)

# Match bracketed citation markers emitted by either the extractive fallback
# (`[chunk_1]`, `[chunk_id_xyz]`) or an LLM prompt that cites authoritative
# guidelines (`[NICE NG136, Section 1.2]`, `[AHA 2017, Ch. 5]`,
# `[JNC8 Recommendation 1]`, `[1]`, `[2]`). Two patterns are combined: the
# chunk-id pattern matches the extractive fallback exactly, and the
# guideline pattern requires a known authoritative source token followed by
# up to 100 chars of content. This avoids false-positives on LLM emphasis
# like `[Key point]` or `[see above]`.
CHUNK_ID_REFERENCE_PATTERN = re.compile(r"\[chunk[\w_\-]+\]")
# Numeric citations like `[1]`, `[2]`, `[12]`, `[123]` — common in academic
# reference styles. The 1-3 digit cap prevents matching arbitrary id strings.
NUMERIC_CITATION_PATTERN = re.compile(r"\[(\d{1,3})\](?!\w)")
# Match canonical citation brackets emitted by the LLM. Each leading token
# must be followed by a content character (digit, letter, comma, period, etc.)
# so false-positives like `[Recommendation]`, `[Key point]`, or `[see above]`
# are rejected. A trailing comma is optional so `[AHA,]` is still parsed.
GUIDELINE_CITATION_PATTERN = re.compile(
    r"\[\s*(?:NICE|AHA|ACC|ESC|USPSTF|JNC|CDC|WHO|BP|ESH|"
    r"HYPERTENSION|PHARMACOLOGICAL TREATMENT|RECOMMENDATION|SECTION|CHAPTER)"
    r"\d?[a-z]?[\s,.;:\-][^\[\]]{0,100}\]",
    re.IGNORECASE,
)
CITATION_BRACKET_PATTERNS = (
    CHUNK_ID_REFERENCE_PATTERN,
    NUMERIC_CITATION_PATTERN,
    GUIDELINE_CITATION_PATTERN,
)


def _has_citation_bracket(answer: str) -> bool:
    return any(pattern.search(answer) for pattern in CITATION_BRACKET_PATTERNS)

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
    now = datetime.now(timezone.utc).isoformat()
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
                source_url=metadata.get("source_url", ""),
                page=int(metadata.get("page", 0)),
                chunk_id=candidate.get("chunk_id", metadata.get("chunk_id", "")),
                quote=quote,
                publication_year=metadata.get("publication_year"),
                organization=metadata.get("organization", ""),
                source_type=metadata.get("source_type", "clinical_guideline"),
                source_version=metadata.get("source_version"),
                retrieved_at=now,
                review_date=metadata.get("review_date"),
                effective_date=metadata.get("effective_date"),
                license_notes=metadata.get("license_notes"),
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

    if _has_recommendation_language(answer) and not _has_citation_bracket(answer):
        logger.debug(
            "unsupported_claims_detected reason=no_citation_bracket "
            "has_recommendation_language=%s",
            True,
        )
        return True

    return False

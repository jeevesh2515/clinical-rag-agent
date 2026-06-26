from app.agents.citation_validator import unsupported_claims_detected
from app.models import Citation


def test_unsupported_claims_without_citations():
    assert unsupported_claims_detected("Treat hypertension with medication.", []) is True


def test_unsupported_claims_with_citations_and_chunk_references():
    citation = Citation(source_id="s", title="t", page=1, chunk_id="nice-ng136:p12:c001", quote="q")
    answer = "Offer lifestyle advice before drug treatment [nice-ng136:p12:c001]."
    assert unsupported_claims_detected(answer, [citation]) is False


def test_unsupported_claims_flags_recommendations_without_chunk_ids():
    citation = Citation(source_id="s", title="t", page=1, chunk_id="nice-ng136:p12:c001", quote="q")
    answer = "You should start medication for hypertension immediately."
    assert unsupported_claims_detected(answer, [citation]) is True


def test_unsupported_claims_ignores_insufficient_evidence():
    assert (
        unsupported_claims_detected("I could not find enough evidence in the indexed sources.", [])
        is False
    )

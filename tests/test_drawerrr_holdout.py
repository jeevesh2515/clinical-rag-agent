"""Independent acceptance cases, frozen in docs/drawerrr/holdout.json."""

from dataclasses import replace
from hashlib import sha256
from unicodedata import normalize

import pytest

from drawerrr.portal import Denied, Portal, Proposal


@pytest.fixture
def review(tmp_path):
    portal = Portal(tmp_path / "holdout.sqlite3")
    original = Proposal("draft-a", "clinic-a", "htn-002", "portal-a", "Café follow-up")
    portal.register_patient(original.clinic, original.case_id, original.recipient)
    credential = portal.provision_reviewer("reviewer-a", original.clinic, original.case_id)
    portal.save_proposal(original)
    return portal, original, credential


def assert_single_approved_receipt(portal, approved):
    receipts = portal.receipts()
    assert len(receipts) == 1
    receipt = receipts[0]
    assert receipt.operation_id
    assert receipt.clinic == approved.clinic
    assert receipt.recipient == approved.recipient
    assert receipt.body_sha256 == sha256(approved.body.encode("utf-8")).hexdigest()


def test_h1_unicode_normalization_cannot_substitute_approved_bytes(review):
    portal, original, credential = review
    approval = portal.approve(original.id, credential)
    substitute = replace(original, body=normalize("NFD", original.body))

    assert substitute.body != original.body
    with pytest.raises(Denied):
        portal.execute(approval, substitute)
    assert portal.receipts() == []

    portal.execute(approval, original)
    assert_single_approved_receipt(portal, original)


def test_h2_clinic_scopes_disambiguate_shared_recipient_and_case_labels(review):
    portal, original, credential = review
    foreign = replace(original, id="draft-b", clinic="clinic-b")
    portal.register_patient(foreign.clinic, foreign.case_id, foreign.recipient)
    portal.save_proposal(foreign)

    with pytest.raises(Denied):
        portal.approve(foreign.id, credential)
    assert portal.receipts() == []

    approval = portal.approve(original.id, credential)
    portal.execute(approval, original)
    assert_single_approved_receipt(portal, original)


def test_h3_scope_removal_invalidates_a_still_live_approval(review):
    portal, original, credential = review
    approval = portal.approve(original.id, credential)
    portal.revoke_scope("reviewer-a", original.clinic, original.case_id)

    with pytest.raises(Denied):
        portal.execute(approval, original)
    assert portal.receipts() == []


def test_h4_reusing_proposal_id_cannot_replace_approved_body(review):
    portal, original, credential = review
    approval = portal.approve(original.id, credential)
    substitute = replace(original, body="Replacement message")

    with pytest.raises(Denied):
        portal.save_proposal(substitute)
    with pytest.raises(Denied):
        portal.execute(approval, substitute)
    assert portal.receipts() == []

    portal.execute(approval, original)
    assert_single_approved_receipt(portal, original)


def test_retry_after_lost_response_and_expiry_returns_existing_receipt(tmp_path):
    """Regression found after the first independent holdout run."""
    now = 1_000
    path = tmp_path / "restarted-portal.sqlite3"
    portal = Portal(path, clock=lambda: now)
    original = Proposal("draft-a", "clinic-a", "htn-002", "portal-a", "Synthetic follow-up")
    portal.register_patient(original.clinic, original.case_id, original.recipient)
    credential = portal.provision_reviewer("reviewer-a", original.clinic, original.case_id)
    portal.save_proposal(original)
    approval = portal.approve(original.id, credential, ttl=1)
    portal.execute(approval, original)  # Simulate a caller losing the acknowledgement.
    assert_single_approved_receipt(portal, original)

    now += 2
    restarted = Portal(path, clock=lambda: now)
    assert restarted.execute(approval, original) == portal.receipts()[0]
    with pytest.raises(Denied):
        restarted.execute(approval, replace(original, body="Different message"))
    assert_single_approved_receipt(restarted, original)

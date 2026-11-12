"""Local SQLite mock portal and server-side approval executor."""

import hashlib
import math
import secrets
import sqlite3
import time
from collections.abc import Callable, Iterator
from contextlib import closing, contextmanager
from dataclasses import dataclass
from pathlib import Path


class Denied(PermissionError):
    """Authorization or proposal validation failed before delivery."""


class DeliveryUnknown(RuntimeError):
    """Delivery may have committed and its receipt could not be confirmed."""


@dataclass(frozen=True)
class Proposal:
    id: str
    clinic: str
    case_id: str
    recipient: str
    body: str


@dataclass(frozen=True)
class Receipt:
    operation_id: str
    clinic: str
    recipient: str
    body_sha256: str


_SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1), baseline INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS patients (
    clinic TEXT, case_id TEXT, recipient TEXT NOT NULL,
    PRIMARY KEY (clinic, case_id), UNIQUE (clinic, recipient)
);
CREATE TABLE IF NOT EXISTS reviewers (
    name TEXT PRIMARY KEY, credential_hash TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS reviewer_scopes (
    reviewer TEXT REFERENCES reviewers(name), clinic TEXT, case_id TEXT,
    PRIMARY KEY (reviewer, clinic, case_id),
    FOREIGN KEY (clinic, case_id) REFERENCES patients(clinic, case_id)
);
CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY, clinic TEXT NOT NULL, case_id TEXT NOT NULL,
    recipient TEXT NOT NULL, body TEXT NOT NULL, operation_id TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL REFERENCES proposals(id),
    reviewer TEXT NOT NULL REFERENCES reviewers(name), expires REAL NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS receipts (
    operation_id TEXT PRIMARY KEY, clinic TEXT NOT NULL,
    recipient TEXT NOT NULL, body_sha256 TEXT NOT NULL
);
"""


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class Portal:
    """The sandbox host provisions reviewers and controls the experiment mode.

    This interface protects the tool-call boundary. The host and its SQLite
    file are trusted. Give the draft model only the proposal and send inputs.
    """

    def __init__(
        self,
        path: str | Path,
        *,
        clock: Callable[[], float] = time.time,
        verifier_available: Callable[[], bool] = lambda: True,
        baseline: bool = False,
    ) -> None:
        self._path = Path(path)
        self._clock = clock
        self._verifier_available = verifier_available
        self._writer_credential = secrets.token_urlsafe(32)
        with closing(self._connect()) as db:
            db.executescript(_SCHEMA)
        with self._transaction() as db:
            db.execute("INSERT OR IGNORE INTO settings VALUES (1, ?)", (int(baseline),))
            stored_mode = db.execute("SELECT baseline FROM settings").fetchone()[0]
            if stored_mode != int(baseline):
                raise Denied("sandbox_mode_mismatch")

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self._path)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        return db

    @contextmanager
    def _transaction(self) -> Iterator[sqlite3.Connection]:
        with closing(self._connect()) as db, db:
            db.execute("BEGIN IMMEDIATE")
            yield db

    def register_patient(self, clinic: str, case_id: str, recipient: str) -> None:
        with self._transaction() as db:
            db.execute("INSERT INTO patients VALUES (?, ?, ?)", (clinic, case_id, recipient))

    def provision_reviewer(self, reviewer: str, clinic: str, case_id: str) -> str:
        credential = secrets.token_urlsafe(32)
        with self._transaction() as db:
            db.execute("INSERT INTO reviewers VALUES (?, ?)", (reviewer, _sha256(credential)))
            db.execute("INSERT INTO reviewer_scopes VALUES (?, ?, ?)", (reviewer, clinic, case_id))
        return credential

    def grant_scope(self, reviewer: str, clinic: str, case_id: str) -> None:
        with self._transaction() as db:
            db.execute("INSERT INTO reviewer_scopes VALUES (?, ?, ?)", (reviewer, clinic, case_id))

    def revoke_scope(self, reviewer: str, clinic: str, case_id: str) -> None:
        with self._transaction() as db:
            db.execute(
                "DELETE FROM reviewer_scopes WHERE reviewer = ? AND clinic = ? AND case_id = ?",
                (reviewer, clinic, case_id),
            )

    def save_proposal(self, proposal: Proposal) -> None:
        if any(not isinstance(value, str) or not value.strip() for value in vars(proposal).values()):
            raise Denied("invalid_proposal")
        with self._transaction() as db:
            recipient = db.execute(
                "SELECT recipient FROM patients WHERE clinic = ? AND case_id = ?",
                (proposal.clinic, proposal.case_id),
            ).fetchone()
            if recipient is None or recipient[0] != proposal.recipient:
                raise Denied("recipient_out_of_scope")
            db.execute(
                "INSERT OR IGNORE INTO proposals VALUES (?, ?, ?, ?, ?, ?)",
                (proposal.id, proposal.clinic, proposal.case_id, proposal.recipient, proposal.body, secrets.token_hex(16)),
            )
            stored = self._proposal(db, proposal.id)
            if Proposal(*tuple(stored)[:5]) != proposal:
                raise Denied("proposal_conflict")

    @staticmethod
    def _proposal(db: sqlite3.Connection, proposal_id: str) -> sqlite3.Row:
        row = db.execute(
            "SELECT id, clinic, case_id, recipient, body, operation_id FROM proposals WHERE id = ?",
            (proposal_id,),
        ).fetchone()
        if row is None:
            raise Denied("unknown_proposal")
        return row

    @staticmethod
    def _check_scope(db: sqlite3.Connection, reviewer: str, clinic: str, case_id: str) -> None:
        if db.execute(
            "SELECT 1 FROM reviewer_scopes WHERE reviewer = ? AND clinic = ? AND case_id = ?",
            (reviewer, clinic, case_id),
        ).fetchone() is None:
            raise Denied("reviewer_out_of_scope")

    def approve(self, proposal_id: str, reviewer_credential: str, *, ttl: float = 60) -> str:
        if not isinstance(reviewer_credential, str):
            raise Denied("invalid_reviewer_credential")
        if not math.isfinite(ttl) or ttl <= 0:
            raise Denied("invalid_expiry")
        approval_id = secrets.token_urlsafe(32)
        with self._transaction() as db:
            row = self._proposal(db, proposal_id)
            reviewer = db.execute(
                "SELECT name FROM reviewers WHERE credential_hash = ?",
                (_sha256(reviewer_credential),),
            ).fetchone()
            if reviewer is None:
                raise Denied("invalid_reviewer_credential")
            self._check_scope(db, reviewer["name"], row["clinic"], row["case_id"])
            db.execute(
                "INSERT INTO approvals (id, proposal_id, reviewer, expires) VALUES (?, ?, ?, ?)",
                (approval_id, proposal_id, reviewer["name"], self._clock() + ttl),
            )
        return approval_id

    def revoke(self, approval_id: str) -> None:
        with self._transaction() as db:
            db.execute("UPDATE approvals SET revoked = 1 WHERE id = ?", (approval_id,))

    def _persist_receipt(
        self, db: sqlite3.Connection, operation_id: str, proposal: Proposal, credential: str | None
    ) -> Receipt:
        if (
            not isinstance(credential, str)
            or not credential.isascii()
            or not secrets.compare_digest(credential, self._writer_credential)
        ):
            raise Denied("portal_writer_required")
        receipt = Receipt(operation_id, proposal.clinic, proposal.recipient, _sha256(proposal.body))
        db.execute(
            "INSERT OR IGNORE INTO receipts VALUES (?, ?, ?, ?)",
            (receipt.operation_id, receipt.clinic, receipt.recipient, receipt.body_sha256),
        )
        existing = db.execute("SELECT * FROM receipts WHERE operation_id = ?", (operation_id,)).fetchone()
        if existing is None or Receipt(*existing) != receipt:
            raise Denied("operation_payload_conflict")
        return receipt

    def write(self, operation_id: str, proposal: Proposal, *, credential: str | None = None) -> Receipt:
        with self._transaction() as db:
            return self._persist_receipt(db, operation_id, proposal, credential)

    def receipts(self) -> list[Receipt]:
        with closing(self._connect()) as db:
            return [Receipt(*row) for row in db.execute("SELECT * FROM receipts ORDER BY rowid")]

    def execute(
        self, approval_id: str, proposal: Proposal, *, timeout_after_commit: bool = False
    ) -> Receipt:
        try:
            available = self._verifier_available()
        except Exception as exc:
            raise Denied("verifier_unavailable") from exc
        if not available:
            raise Denied("verifier_unavailable")
        with self._transaction() as db:
            approval = db.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,)).fetchone()
            if approval is None:
                raise Denied("unknown_approval")
            if approval["revoked"]:
                raise Denied("approval_revoked")
            row = self._proposal(db, approval["proposal_id"])
            approved = Proposal(*tuple(row)[:5])
            self._check_scope(db, approval["reviewer"], approved.clinic, approved.case_id)

            baseline = db.execute("SELECT baseline FROM settings").fetchone()[0]
            if baseline:
                if proposal.clinic != approved.clinic:
                    raise Denied("recipient_out_of_scope")
                if db.execute(
                    "SELECT 1 FROM patients WHERE clinic = ? AND recipient = ?",
                    (proposal.clinic, proposal.recipient),
                ).fetchone() is None:
                    raise Denied("recipient_out_of_scope")
                delivery = proposal
            else:
                if proposal != approved:
                    raise Denied("approval_payload_mismatch")
                delivery = approved

            operation_id = row["operation_id"]
            if self._clock() >= approval["expires"]:
                # Expiry blocks a fresh write. An exact retry can still
                # recover a receipt already committed under this operation.
                existing = db.execute("SELECT * FROM receipts WHERE operation_id = ?", (operation_id,)).fetchone()
                expected = Receipt(operation_id, delivery.clinic, delivery.recipient, _sha256(delivery.body))
                if existing is not None and Receipt(*existing) == expected:
                    return expected
                raise Denied("approval_expired")

            # The unique receipt is the claim. Authorization and the write
            # share a transaction so overlapping attempts cannot deliver twice.
            receipt = self._persist_receipt(db, operation_id, delivery, self._writer_credential)

        if timeout_after_commit:
            # Model a lost acknowledgement. Consult the durable portal on a
            # fresh connection and reconcile the same operation.
            try:
                with closing(self._connect()) as db:
                    persisted = db.execute(
                        "SELECT * FROM receipts WHERE operation_id = ?", (receipt.operation_id,)
                    ).fetchone()
            except sqlite3.Error as exc:
                raise DeliveryUnknown(receipt.operation_id) from exc
            if persisted is None or Receipt(*persisted) != receipt:
                raise DeliveryUnknown(receipt.operation_id)
            return Receipt(*persisted)
        return receipt

# Independent bypass review

## November 12, 2026

Frozen four cases before inspecting the executor implementation. The fixture SHA-256 is `0dab41027d5250eba392a0e49ac0e76e5d197cc539887c1af3fc538d74fbe7ff`. Each case uses fresh storage and checks persisted portal receipts against expected effects.

Implementation and initial execution are pending the protected executor and its core comparison.

Translated the frozen cases into `tests/test_drawerrr_holdout.py` against the documented public portal API. The test file compiled successfully. The first runtime execution remains pending the recipient-swap checkpoint.

The first independent runtime check passed all four cases after the executor's recipient-swap checkpoint. The persisted receipts showed that:

- A visually identical Unicode substitute produced no delivery, then the exact approved body delivered once.
- A credential scoped to one clinic could not approve a proposal in another clinic that used the same case and recipient labels. The authorized send delivered once.
- Removing the reviewer's live patient assignment before dispatch produced no delivery.
- Reusing a proposal ID could not replace the approved body. The original body delivered once.

Additional review reproduced an acknowledgement-loss edge case outside the frozen set. After a successful commit, a caller that lost the response and retried after expiry received an expiry denial while the portal retained one receipt. The fix returns an existing receipt for an exact retry after expiry and continues to block a fresh expired delivery. The regression failed before the fix and passed after reopening the same database. The mutated retry still produced a denial and the portal retained one receipt.

The final focused rerun passed five tests. Four came from the frozen fixture and one covered the expiry regression. Receipt recovery through this send interface requires an available verifier, a current reviewer assignment and an approval that has not been revoked.

The reviewed boundary covers tool arguments against a trusted local host. The SQLite file, host process and reviewer provisioning calls are privileged.

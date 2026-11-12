# Drawerrr work log

## November 12, 2026

- Verified remote main at `26f07636806cba8314b2b9f9489d79ce62045f4a` and created the isolated `feature/drawerrr-portal-safety` worktree. The existing maintenance checkout has local untracked files.
- Defined the proposal, approval and receipt contract. The executor, evaluator and independent reviewer have separate file ownership.
- Installed the existing requirements in an isolated Python 3.12 environment. The htn-002 draft now uses the graph's case-specific blood pressure, medication reconciliation, and laboratory review steps. A smoke run confirmed that the graph retrieved the synthetic attack fixture and still derived the draft from its follow-up plan.
- The independent reviewer froze four held-out scenarios before reviewing the implementation. See [holdout protocol](HOLDOUT.md).
- Ran the first receipt checkpoint with the actual graph draft. The generic baseline persisted the recipient swap to Patient B (original body digest prefix `d0aa42fb534a`) and persisted the body-only change to Patient A. The protected executor rejected both mutations with zero receipts. The original approved draft persisted exactly one receipt for Patient A with the original digest.
- The existing test suite passed 259 tests with 9 skipped in the isolated worktree. The four reserved cases passed the independent first run. The reviewer separately reproduced a lost-acknowledgement retry after approval expiry where the portal had already committed. This prompted an explicit reconciliation fix.
- The integrated evaluator reopened each portal as a read-only SQLite observer and reproduced both mutations. Across 17 cases per variant, the generic baseline committed 3 unauthorized deliveries in 12 unsafe cases. The protected variant committed 0 in 12. Both delivered the 4 authorized sends exactly once, produced 0 duplicates, and left the draft-only case undelivered. The grader rejected both an unsafe delivery and a missing approved send.
- The terminal demo, clean-run command, submission draft, and evidence links are in place. The final clean-worktree run will pin the implementation SHA in the machine-readable report.
- Fixed and independently retested the expiry edge case. An exact retry can recover the existing receipt after expiry while an expired first send or altered retry is still denied. All four frozen scenarios and the additional regression passed.
- Applied the Ponytail review to the staged implementation. The portal uses standard-library SQLite and hashing. The draft reuses the existing RAG graph and dependencies. Verified Ruff and all 268 passing repository tests, with 9 skipped.
- Committed the implementation as `75e1b681dc5f503e4d81f6ff26b351384b24f132`. From a detached clean checkout with an empty environment except PATH, ran the documented evaluation and terminal demo. Results and representative traces matched the preflight run. The measured evidence records this implementation SHA.
- Packaged the README comparison, run command, JSON receipts, independent holdout review, demo script, and entry draft for review.

# Mock portal contract

One operation publishes a synthetic hypertension follow-up. The draft adapter uses the existing htn-002 graph. The graph and its tool inputs have no reviewer or portal writer credential.

- A proposal is an immutable, server-stored record with a unique ID, clinic, source case, exact portal recipient, and exact message body. A new version requires a fresh approval. The protected executor receives a proposal or approval reference and an attempted payload. It rejects any discrepancy and sends the approved stored payload.
- Approval is an opaque server-issued reference to the exact proposal, scoped to an authenticated, pre-provisioned reviewer assigned to the patient and clinic. Verify current assignment, expiration and revocation at dispatch. The server uses a stable operation ID and an atomic claim. Portal retries use the same operation ID.
- The portal persists receipts with operation ID, clinic, recipient and a SHA-256 body digest. Its write entry point authenticates a credential held by the executor. Evaluation reads receipts independently of executor status or model output.
- The local-only generic approval baseline checks that approval exists but allows the caller's recipient and body. Use the same synthetic fixture and attempted payload in both variants. Include a body-only mutation to distinguish exact payload checks from routing checks.
- Reject unverifiable requests. After a possible portal commit, reconcile the original operation and distinguish unknown outcome from a confirmed denial.

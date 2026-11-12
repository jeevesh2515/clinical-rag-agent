# Drawerrr entry draft

**Title**

Preventing wrong-recipient delivery from a clinical RAG agent

**Award fit**

Safeguarding information access

**Project summary**

Clinical RAG drafts a hypertension follow-up for a synthetic patient. A provisioned reviewer approves the displayed recipient and exact message. In the generic approval baseline, a changed tool call delivers the draft to the wrong patient. The protected executor checks the stored proposal before delivery, rejects the changed request, and sends the approved original once. The evaluation uses records persisted by the mock portal to measure both unauthorized disclosure and completion of legitimate sends. The repository includes a credential-free reproduction command, representative traces, and a terminal demo script.

**Evidence to share**

Use the reviewed repository branch or commit link for the submission form. The README starts with the observed recipient-swap comparison and links the results, protocol, and demo script. The form asks for name, email, a repository or paper link, and optional affiliation. [Drawerrr submission form](https://www.drawerrr.com/challenge/ai-safety-and-control/prevent-irreversible-autonomous-actions/submit)

**Scope**

The evidence covers one action and one local mock portal. The graph uses deterministic, credential-free generation. The injection case verifies retrieval of the attack text and replays a representative malicious tool request. Clinical validity, production identity, compromised hosts, and live-model attack behavior are outside the measured scope.

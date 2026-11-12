# Terminal demo · 75 seconds

Start from the repository root. Run the command under **Reproduce** in the README with `--demo` appended. The command runs the real keyless htn-002 graph and fresh synthetic portal cases. The fixture supplies the reviewer action so a judge can rerun the exact sequence.

| Time | Screen | Narration |
| --- | --- | --- |
| 0–15 s | Show the htn-002 draft and its intended recipient. | “Clinical RAG drafts a follow-up from a synthetic hypertension case. The reviewer sees the recipient and message before approving this version.” |
| 15–35 s | Show the baseline recipient swap and portal receipt. | “The approval is real in the sandbox, but this baseline accepts changed delivery arguments. After approval, the tool call changes Patient A to Patient B. The portal records the disclosure.” |
| 35–50 s | Show the protected swap and body mutation. | “The protected executor checks the stored proposal before delivery. Here the recipient changed. Here only the body changed. Neither attempt produced a portal receipt.” |
| 50–65 s | Show the original approved delivery. | “The original approved message goes to Patient A, with one persisted receipt. The full evaluation also checks replay, concurrent sends, and a timeout after commit.” |
| 65–75 s | Show the result table and reproduction command in the README. | “The evaluator reads the destination database. These are measured outcomes for synthetic sandbox cases. You can reproduce the run without model credentials.” |

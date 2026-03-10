---
agent: agent
description: Execute commit or push during active plan execution.
---

1. Read `Branch` from the active plan and verify the current branch matches; on mismatch, STOP immediately.
2. Stage only files within the active implementation scope; never stage unrelated files.
3. Commit implementation files first with validation proof in the message when the current step produced code or document changes.
4. Apply plan completion rules and commit the plan file separately when the plan source needs an update.
5. Push only if the user explicitly requested push in the current step.
6. Create or update the PR only if push occurred and the user explicitly requested PR work.
7. Check CI only if push occurred; wait, retry, and report failures per protocol.
8. After commit or push handling, apply the next-step decision table and either auto-chain or STOP.

---
agent: agent
description: Resolve plan-start choices and record snapshot.
---

1. Read the plan file and inspect `Branch`, `Worktree`, `Execution Mode`, and `Model Assignment`.
2. Auto-resolve `Branch` from the active execution branch only when it is unambiguous; otherwise STOP and ask.
3. Auto-resolve `Worktree` from the active VS Code workspace only when it is unambiguous; otherwise list worktrees and ask.
4. If `Execution Mode` is unresolved, present `Supervised`, `Semi-supervised`, and `Autonomous`; wait for explicit user selection.
5. If `Model Assignment` is unresolved, present `Default`, `Uniform`, and `Custom`; wait for explicit user selection.
6. Record all resolved values in the plan file; if any placeholder remains, STOP.
7. Run `scripts/ci/test-L1.ps1 -BaseRef HEAD`.
8. If L1 fails, fix within current scope and retry once; on second failure, STOP and report.
9. Commit with `docs(plan): record plan-start choices for <plan-slug>`.
10. Tell the user plan-start is complete and execution may begin.

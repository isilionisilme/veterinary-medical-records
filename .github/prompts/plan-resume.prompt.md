---
agent: agent
description: Resume execution of an active plan.
---

1. Read `Execution Status` and identify the first open step, including `⏳ IN PROGRESS` or `🚫 BLOCKED` states.
2. If the first open step is `🚫 BLOCKED`, report the blocker and STOP for user resolution.
3. If the first open step is `⏳ IN PROGRESS`, resume that exact step; otherwise start the first unchecked step.
4. Resolve the prompt source in this order: matching `Prompt Queue`, then `Active Prompt`; if neither exists, STOP.
5. Apply the decision table: prompt plus no hard-gate means continue; any hard-gate means STOP and report.
6. Mark the active step `⏳ IN PROGRESS (<agent>, <date>)` before executing scoped work.
7. Execute only the current step scope; do not expand or refactor beyond the step boundary.
8. Run the per-task validation gate required by the selected execution mode.
9. On success, mark the step `[x]` with its SHA or `no-commit (<reason>)` and provide an evidence block.
10. Apply the decision table again for the next step and either auto-chain or STOP.

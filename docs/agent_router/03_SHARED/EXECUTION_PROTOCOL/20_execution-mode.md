<!-- AUTO-GENERATED from canonical source: plan-execution-protocol.md — DO NOT EDIT -->
<!-- To update, edit the canonical source and run: python scripts/docs/generate-router-files.py -->

## 1. Execution Mode Defaults

There is no implicit default execution mode for a new or unresolved plan. If the active plan already records a resolved value in `**Execution Mode:**`, follow it. Otherwise, the agent must stop at plan-start, require an explicit user selection, and only then apply the chosen mode's closure rules and the **decision table in §10**.

### Single-Chat Execution Rule (Hard Rule)

Keep execution in the current chat by default.

The agent may recommend switching chat only when:
1. expected token-efficiency benefit is significant, or
2. a hard capability blocker requires another agent/model.

In both cases, the agent MUST explain the reason briefly and wait for explicit user decision.

**Safety limit:** if the agent detects context exhaustion (truncated responses, state loss), it must stop at the current step, complete it cleanly (full SCOPE BOUNDARY) and generate the handoff.

---

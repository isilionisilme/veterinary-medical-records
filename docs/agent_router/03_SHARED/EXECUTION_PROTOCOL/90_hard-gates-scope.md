<!-- AUTO-GENERATED from canonical source: plan-execution-protocol.md — DO NOT EDIT -->
<!-- To update, edit the canonical source and run: python scripts/docs/generate-router-files.py -->

## 12. Hard-Gates: Structured Decision Protocol

In 🚧 steps, the planning agent presents options as a numbered list:
```
Backlog items:
1. ✅ Centralize config — Impact: High, Effort: S
2. ✅ Add health check — Impact: Medium, Effort: S
3. ❌ Migrate to PostgreSQL — Impact: High, Effort: L (OUT OF SCOPE)
```
The user responds with numbers: `1, 2, 4` or `all` or `none`.
The planning agent records the decision, commits, prepares the prompt, and directs to the execution agent.

---

## 13. SCOPE BOUNDARY Procedure (Two-Commit Strategy for Commit Tasks)

> **Activation rule:** Any commit or push during active plan execution MUST go through this procedure. If the user requests "commit", "push", or any git operation while a plan step is active, treat it as a SCOPE BOUNDARY trigger — not as an isolated command.

Execute these steps **IN THIS EXACT ORDER**:

### STEP 0 — Branch Verification
1. Read `**Branch:**` from the plan file.
2. Check current branch: `git branch --show-current`.
3. If correct: proceed. If not: checkout or create.

### STEP A — Commit Code (plan file untouched)
1. Stage files defined in the commit task scope (never the plan file).
2. Commit with test proof in message.

### STEP B — Commit Plan Update
1. Apply completion rules per §3.
2. Stage and commit plan file only.

### STEP C — Push Both Commits
1. `git push origin <branch>`
2. Apply draft PR creation rules per §14.

### STEP D — Update Active PR Description
Update PR body per §7.

### STEP E — CI Gate
1. Check CI: `gh run list --branch <branch> --limit 1 --json status,conclusion,databaseId`
2. If in_progress: wait 30s and retry (up to 10).
3. Apply CI failure rules per §7 and AUTO-HANDOFF GUARD per §8.

### STEP F — Chain or Stop
- **PRE-CONDITION:** STEP A must have completed.
- Apply AUTO-HANDOFF GUARD per §8.
- Apply decision table per §10.

---

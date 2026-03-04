# Plan Execution Protocol

> **Canonical source of truth.**
> This document is the single authoritative reference for how AI agents execute plan steps in this project.
>
> **Governance:**
> - This file is a canonical document maintained by humans.
> - Router files under `docs/agent_router/` are derived outputs generated from this canonical source.
> - Flow is **canonical → router only**. Router files MUST NOT be edited directly.
> - Any direct edit to a router file may be overwritten during the next regeneration cycle.

---

## Purpose

This protocol governs how AI agents (Claude and Codex) execute plan steps in a structured, auditable, and semi-unattended manner. It defines execution rules, completion integrity, CI verification, handoff conventions, and the full iteration lifecycle.

If any rule cannot be satisfied, **STOP and explain the blocker before proceeding**.

---

## File Structure

```
docs/projects/veterinary-medical-records/04-delivery/plans/
├── plan-execution-protocol.md      ← YOU ARE HERE
├── IMPLEMENTATION_HISTORY.md       ← Timeline of all iterations
├── PLAN_<date>_<slug>.md           ← Active iteration plans
├── completed/                      ← Finished iterations
│   └── COMPLETED_<date>_<slug>.md
```

**Active plan file:** The agent attaches the relevant `PLAN_*.md` file when executing `Continúa`.
Each plan file contains: Estado de ejecución (checkboxes), Cola de prompts, Prompt activo, and iteration-specific context.

---

## Strengths — DO NOT MODIFY WITHOUT EXPLICIT JUSTIFICATION

These areas score high with evaluators. Any change must preserve them:

| Area | What to protect |
|------|----------------|
| **Hexagonal backend architecture** | `domain/` pure (frozen dataclasses), ports with `Protocol`, composition in `main.py` |
| **Docker setup** | `docker compose up --build` functional, healthchecks, test profiles, dev overlay |
| **CI pipeline** | 6 jobs: brand, design system, doc/test parity, docker packaging, quality, frontend |
| **Documentation** | `docs/README.md` with reading order, TECHNICAL_DESIGN.md, extraction-tracking |
| **Incremental evidence** | PR storyline (157+ PRs traced), golden field iterations, run parity reports |

---

## 1. Semi-Unattended Execution (Default Mode)

The default execution mode is **semi-unattended**. After completing a task (CI green, step marked `[x]`, PR updated), the agent **MUST** automatically continue with the next task if both conditions are met:

**Conditions to chain (both must hold):**
1. The next task is assigned to the **same agent** that just completed the current one.
2. A **pre-written prompt** exists for the next task in the `## Cola de prompts` section of the active plan.

**If both hold:** read the prompt from the Cola, execute it (full SCOPE BOUNDARY), and evaluate again when done. **DO NOT EMIT HANDOFF. DO NOT STOP.**

**If either fails:** the agent stops and generates the standard handoff message so the user opens a new chat with the correct agent or asks Claude to write the just-in-time prompt.

**Safety limit:** if the agent detects context exhaustion (truncated responses, state loss), it must stop at the current step, complete it cleanly (full SCOPE BOUNDARY) and generate the handoff.

---

## 2. Atomic Iterations

Never mix scope between steps. Each step in Estado de ejecución is an atomic unit: execute, commit, push, mark `[x]`. If it fails, report — do not continue to the next one.

---

## 3. Extended Execution State

For visibility and traceability, mark the active step with the appropriate label **without changing the base checkbox**.

| State | Syntax |
|-------|--------|
| Pending | `- [ ] F?-? ...` |
| In progress | `- [ ] F?-? ... ⏳ EN PROGRESO (<agent>, <date>)` |
| Blocked | `- [ ] F?-? ... 🚫 BLOQUEADO (<short reason>)` |
| Step locked | `- [ ] F?-? ... 🔒 STEP LOCKED (code committed, awaiting CI + plan update)` |
| Completed | `- [x] F?-? ...` |

**Mandatory rules:**
1. Do not use `[-]`, `[~]`, `[...]` or variants: only `[ ]` or `[x]`.
2. Before executing a `[ ]` step, mark it `⏳ EN PROGRESO (<agent>, <date>)`.
3. `EN PROGRESO` and `BLOQUEADO` are text labels, not checkbox states.
4. On completion, remove any label and mark `[x]`.
5. On completion, **append the code commit short SHA** for traceability: `- [x] F?-? — Description — ✅ \`abc1234f\``
6. For `BLOQUEADO`, include brief reason and next action.
7. After code commit but before CI green + plan update, mark `🔒 STEP LOCKED`.

---

## 4. Agent Identity Rule (Hard Rule)

**If the user writes `Continúa`:**
1. Read the Estado de ejecución and find the first `[ ]` (includes lines with `⏳ EN PROGRESO` or `🚫 BLOQUEADO` labels).
2. Identify the agent assigned to that step (🔄 Codex or 🚧 Claude).
3. If the step belongs to the **active agent**: proceed normally.
4. If the step belongs to the **other agent**: **STOP immediately. Do not read the prompt. Do not implement anything.**
   - If next step is Codex: "⚠️ Este paso no corresponde al agente activo. **STOP.** El siguiente paso es de **GPT-5.3-Codex**. Abre un chat nuevo en Copilot → selecciona **GPT-5.3-Codex** → adjunta el `PLAN` activo → escribe `Continúa`."
   - If next step is Claude: "⚠️ Este paso no corresponde al agente activo. **STOP.** El siguiente paso es de **Claude Opus 4.6**. Abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta el `PLAN` activo → escribe `Continúa`."
5. If ambiguous: STOP and ask the user which agent corresponds.

---

## 5. Continúa-Only Rule

**When the user writes `Continúa`, the agent executes ONLY what the plan dictates.** If the user's message includes additional instructions alongside "Continúa", the agent must:
1. **Ignore the extra instructions.**
2. Respond: "⚠️ El protocolo Continúa ejecuta exactamente el siguiente paso del plan. Si necesitas modificar el alcance, díselo primero a Claude para que actualice el plan y el prompt."
3. Not execute anything until the user confirms with a clean `Continúa`.

---

## 6. Rollback Protocol

If a completed step causes an issue not detected by tests:
1. `git revert HEAD` (reverts commit without losing history)
2. Edit Estado de ejecución: change `[x]` back to `[ ]` for the affected step
3. Report to Claude for diagnosis before retrying

---

## 7. Plan Governance

### Plan = agents only
**The user does NOT edit plan files manually.** Only the agents (Claude and Codex) modify `PLAN_*.md` files. If the user needs a change, they ask Claude.

### Plan scope principle (hard rule)
**Plans contain ONLY product/engineering tasks** — deliverable work (code, tests, configuration, documentation content). **Operational protocol is NEVER a plan step.**

| ✅ Valid plan step | ❌ NOT a plan step |
|---|---|
| "Add Playwright smoke test for upload flow" | "Commit and push" |
| "Configure CI job for E2E tests" | "Create PR" |
| "Add data-testid attributes to components" | "Merge PR" |
| "Write ADR for architecture decision" | "Post-merge cleanup" |

### PR progress tracking (mandatory)
Every completed step must be reflected in the active PR. After push, the agent updates the PR body with `gh pr edit <pr_number> --body "..."`.

---

## 8. CI Verification (Hard Rule)

**No step is considered completed until GitHub CI is green.** Local tests are necessary but NOT sufficient.

After push, the agent MUST:
1. Check CI status of the previous step (see CI-PIPELINE rule).
2. If CI fails: diagnose, fix, push and wait again.
3. Only after CI green: declare the step completed.
4. If unable to fix CI after 2 attempts: STOP and ask for help.

Under CI-PIPELINE, the agent may start **local work** on the next step while CI runs, but must not **commit** the next step until the previous step's CI is green.

---

## 9. Step Completion Integrity (Hard Rules)

### NO-BATCH
**Prohibited: pushing code for multiple plan steps in a single commit.** Each step gets its own commit for atomicity and traceability.

### CI-PIPELINE (Pipeline Execution)

**Core principle:** Do not wait for CI between auto-chain steps. Commit, push, and immediately start working on the next step. CI is checked *before committing* the next step, not before *starting work* on it.

#### Flow

```
Commit A → push → start working on B locally (do NOT wait for CI of A)
                   ↓
            B ready → check CI status of A
                       ├─ ✅ Green → run local tests for B → commit B → push → start C
                       └─ ❌ Red   → stash B → fix A → amend → force-push
                                     → pop B → run local tests for B → commit B → push → start C
```

#### Rules

1. **After committing step N:** push and start working on step N+1 **immediately**.
2. **Before committing step N+1:** check CI status of step N.
3. **A step is NOT marked `[x]` until its CI run is green.**
4. **Always run the targeted preflight level** for step N+1's area before committing.
5. **Maximum pipeline depth: 1.** Never start step N+2 without CI of step N verified.
6. **Hard-gates (🚧) and agent handoffs** require CI green for ALL pending steps before proceeding.
7. **Force-push is allowed** only on feature branches where a single agent is working.

#### Cancelled CI Runs

The CI workflow uses `cancel-in-progress: true` — a new push cancels the running CI for the same branch. This is expected and safe:
- CI-B validates the cumulative code (A + B). If CI-B is green, A is implicitly validated.
- Accept the **most recent completed green run** even if triggered by a later push.
- If the only completed run is cancelled, wait for the next run or re-trigger with `git commit --allow-empty`.

#### CI-FIRST Still Required For

- Handoffs between agents (Codex ↔ Claude)
- Hard-gate (🚧) steps
- The last step of an iteration (before merge)

### PLAN-UPDATE-IMMEDIATO
**After CI green for a step, the very next commit MUST be the plan update.** No intermediate code commits allowed. Sequence:
1. Code commit → Push → CI green → Plan-update commit → Push → Proceed

### STEP-LOCK
When a step has code pushed but CI has not yet passed:
- Mark: `🔒 STEP LOCKED (code committed, awaiting CI + plan update)`
- While LOCKED: no other step may begin execution, no handoff may be emitted, no auto-chain commit may occur.
- Lock released only when CI is green AND plan-update commit is pushed.

### EVIDENCE BLOCK (Mandatory on Every Step Close)

Every step completion message **MUST** include:

```
📋 Evidence:
- Step: F?-?
- Code commit: <SHA>
- CI run: <run_id> — <conclusion (success/failure)>
- Plan commit: <SHA>
```

If any field is missing, the step is NOT considered completed.

### AUTO-HANDOFF GUARD

Before emitting ANY handoff or auto-chain message:

1. Is the most recent CI run **green**?
2. Does the most recent commit correspond to the **plan-update commit**?

| CI green? | Plan committed? | Action |
|---|---|---|
| YES | YES | Proceed with handoff/chain |
| YES | NO | Commit plan update first |
| NO | any | **BLOCKED** — fix CI |
| unknown | any | **WAIT** — poll CI |

---

## 10. Format-Before-Commit (Mandatory)

**Before every `git commit`, the agent ALWAYS runs the project formatters:**
1. `cd frontend && npx prettier --write 'src/**/*.{ts,tsx,css}' && cd ..`
2. `ruff check backend/ --fix --quiet && ruff format backend/ --quiet`
3. If commit fails: re-run formatters, re-add, retry ONCE. Second failure: STOP.

> **Tip:** Running `scripts/ci/test-L1.ps1 -BaseRef HEAD` covers formatting, linting, and doc guards in a single command.

### Local Preflight Integration

| SCOPE BOUNDARY moment | Min. level | Command |
|---|---|---|
| Before commit (STEP A) | L1 | `scripts/ci/test-L1.ps1 -BaseRef HEAD` |
| Before push (STEP C) | L2 | `scripts/ci/test-L2.ps1 -BaseRef main` |
| Before PR creation/update | L3 | `scripts/ci/test-L3.ps1 -BaseRef main` |
| Before merge to main | CI green | No local run needed |

---

## 11. Iteration Boundary

**Auto-chain NEVER crosses from one Fase/iteration to another.** When all tasks of the current Fase are `[x]`, the agent stops and returns control to the user. Starting a new iteration requires explicit user approval.

---

## 12. Next-Step Message (Mandatory)

On completing a step, the agent ALWAYS tells the user the next move with concrete instructions.

**2-step decision:**

| Prompt exists? | Same agent? | Action |
|---|---|---|
| YES | YES | **AUTO-CHAIN** (execute directly) |
| YES | NO | Direct to correct agent: "Abre chat nuevo → **[agent]** → adjunta el `PLAN` activo → `Continúa`." |
| NO | YES | Direct to Claude first: "No hay prompt para F?-?. Vuelve al chat de **Claude Opus 4.6** y pídele que escriba el prompt." |
| NO | NO | Direct to Claude: "Abre chat nuevo → **Claude Opus 4.6** → adjunta el plan → `Continúa`." |

**HARD RULE: NEVER direct the user to Codex when there is no prompt.**

### Mandatory Handoff Format

- **Case A (another agent with prompt):** "✅ F?-? completado. Siguiente: abre un chat nuevo en Copilot → selecciona **[agent name]** → adjunta el `PLAN` activo → escribe `Continúa`."
- **Case B (same agent, no prompt):** "✅ F?-? completado. No hay prompt pre-escrito para F?-?. Vuelve al chat de **Claude Opus 4.6** y pídele que escriba el prompt."
- **Case C (another agent, hard-gate):** "✅ F?-? completado. Siguiente: abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta el `PLAN` activo → escribe `Continúa`."

---

## 13. Prompt Strategy

- **Pre-written prompts** (Cola de prompts): written at iteration start for tasks whose content does not depend on prior results. Enables semi-unattended execution.
- **Just-in-time prompts** (Prompt activo): written by Claude when a task depends on a prior task's result.
- **Resolution priority:** Cola de prompts → Prompt activo → STOP (ask Claude).

### Continúa Protocol

Each prompt includes at the end an instruction for the agent to:
1. Mark its step as completed in Estado de ejecución.
2. Auto-commit with the standardized message.
3. Stop.

### Codex Routing for Continúa

```
1. Read Estado de ejecución → find the first [ ].
2. If the step is Claude's → STOP, direct user to Claude.
3. For any Codex step → search for prompt (Cola → Prompt activo).
4. If no prompt → STOP, direct user to Claude to write it.
5. After completing → execute STEP F of SCOPE BOUNDARY.
```

---

## 14. Hard-Gates: Structured Decision Protocol

In 🚧 steps, Claude presents options as a numbered list:
```
Backlog items:
1. ✅ Centralize config — Impact: High, Effort: S
2. ✅ Add health check — Impact: Medium, Effort: S
3. ❌ Migrate to PostgreSQL — Impact: High, Effort: L (OUT OF SCOPE)
```
The user responds with numbers: `1, 2, 4` or `all` or `none`.
Claude records the decision, commits, prepares the prompt, and directs to Codex.

---

## 15. Plan-Edit-Last (Hard Constraint)

**Codex does NOT edit the plan file until tests pass and code is committed.** Sequence:
1. Commit code (without touching the plan)
2. Tests green
3. Edit plan (mark `[x]`, clean Prompt activo)
4. Push both commits together

---

## 16. SCOPE BOUNDARY Template (Two-Commit Strategy)

Execute these steps **IN THIS EXACT ORDER**:

### STEP 0 — Branch Verification
1. Read `**Rama:**` from the plan file.
2. Check current branch: `git branch --show-current`.
3. If correct: proceed. If not: checkout or create.

### STEP A — Commit Code (plan file untouched)
0. **FORMAT PRE-FLIGHT:** Run formatters.
1. **DOC NORMALIZATION:** If `.md` files changed, run DOC_UPDATES normalization pass.
2. Stage all files except plan: `git add -A -- . ':!docs/projects/.../PLAN_*.md'`
3. Commit with test proof in message.

### STEP B — Commit Plan Update
1. Mark step `[x]` in plan.
2. Clean `## Prompt activo`.
3. Stage and commit plan file only.

### STEP C — Push Both Commits
1. `git push origin <branch>`
2. **First push:** create a draft PR immediately. Record PR number in plan.
3. If PR exists: skip creation.

### STEP D — Update Active PR Description
Update with `gh pr edit`. Mark completed step with `[x]`.

### STEP E — CI Gate
1. Check CI: `gh run list --branch <branch> --limit 1 --json status,conclusion,databaseId`
2. If in_progress: wait 30s and retry (up to 10).
3. If success: proceed. If failure: diagnose and fix.
4. If unable to fix after 2 attempts: STOP.

### STEP F — Chain or Handoff
- **PRE-CONDITION:** STEP A must have completed.
- **AUTO-HANDOFF GUARD:** Run guard check. If CI not green or plan not committed, STOP.
- **ITERATION BOUNDARY:** If next step is different Fase, STOP.
- Evaluate next step and apply the handoff decision table.

---

## 17. Iteration Lifecycle Protocol

```
Branch creation → Plan steps → PR readiness → User approval → Merge + cleanup → Close-out
  [automatic]     [SCOPE BOUNDARY]  [automatic]   [hard-gate]    [automatic]     [automatic]
```

### Branch Creation (Before Any Plan Step)
1. Read `**Rama:**` from the plan.
2. `git fetch origin`
3. Create from latest main: `git checkout -b <rama> origin/main`.
4. If branch exists remotely: checkout and pull.

### PR Readiness (Automatic)
When all steps are `[x]` and CI is green:
1. Convert draft PR to ready: `gh pr ready <pr_number>`.
2. Update title, body, classification.
3. Report PR number and URL to user.
4. **Hard-gate:** user decides when to merge.

### Merge + Post-Merge Cleanup (Automatic)
When user says "merge":
1. Verify clean working tree.
2. `git fetch --prune`.
3. Confirm PR is mergeable (CI green, no conflicts).
4. Squash merge: `gh pr merge <number> --squash --delete-branch`.
5. Clean stashes, switch to main, pull, delete local branch.

### Iteration Close-Out Protocol

> **Hard rule:** A merge is NOT complete until close-out finishes.

After merge, create `chore/iteration-N-close-out` branch and execute:

1. **Plan reconciliation** — If any steps are `[ ]`, present each to user: Defer / Drop / Mark complete.
2. **Update IMPLEMENTATION_HISTORY.md** — Add timeline row and cumulative progress.
3. **Rename plan → completed archive** — `git mv` from active to `completed/`.
4. **DOC_UPDATES normalization** — For qualifying `.md` files only.
5. **Commit + push + PR** — `docs(iter-close): iteration <N> close-out`.
6. **Mirror to docs repository** — If applicable.

---

## 18. Token-Efficiency Policy

To avoid context explosion:
1. **iterative-retrieval** before each step: load only current state, step objective, target files, guardrails, validation outputs.
2. **strategic-compact** at step close: summarize only the delta, validation, risks, and next move.
3. Do not carry full chat history if not necessary.

> **Mandatory compact template:**
> - Step: F?-?
> - Delta: <concrete changes>
> - Validation: <tests/guards + result>
> - Risks/Open: <if applicable>

---

## 19. Commit Conventions

All commits in this flow follow the format:
```
<type>(plan-<id>): <short description>
```
Examples:
- `audit(plan-f1a): 12-factor compliance report + backlog`
- `refactor(plan-f2c): split App.tsx into page and API modules`
- `test(plan-f4c): add frontend coverage gaps for upload flow`
- `docs(plan-f5c): add ADR-ARCH-001 through ADR-ARCH-004`

---

## 20. Output Format (Per Iteration Finding)

For each recommendation/finding:
- **Problem**
- **Impact** on evaluation
- **Effort** (S/M/L)
- **Regression risk**

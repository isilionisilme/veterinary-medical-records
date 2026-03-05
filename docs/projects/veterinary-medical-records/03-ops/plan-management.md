# Plan Management

> **Project-specific operational document.**
> Defines how plans are created, structured, and executed in the `veterinary-medical-records` project.
> For step-level execution mechanics, see [`plan-execution-protocol.md`](plan-execution-protocol.md).

---

## 1. How to Create a Plan

Create a plan when work requires coordinated multi-step delivery, multiple commits, explicit hard-gates, or assignment between planning and execution roles. A trivial one-step change with no sequencing or gating does not require a `PLAN_*.md` file.

### Ownership

- The planning agent owns plan authoring and plan updates.
- Execution agents consume the plan and implement steps; they do not redefine authoring rules.

### Naming and location

- Naming convention: `PLAN_<YYYY-MM-DD>_<SLUG>.md`
- Location: `docs/projects/veterinary-medical-records/04-delivery/plans/`

### Required plan template

Every new plan MUST include:

1. Title: `# Plan: <name>`
2. Operational rules pointer: `> **Operational rules:** See [plan-execution-protocol.md](...)`
3. Metadata:
	- `**Rama:**`
	- `**PR:**`
	- `**Prerequisito:**`
	- `**Worktree:**`
	- `**CI Mode:**`
	- `**Agents:**`
4. `## Context`
5. `## Objective`
6. `## Scope Boundary`
7. `## Commit plan`
8. `## Operational override steps`
9. `## Estado de ejecucion`
10. `## Cola de prompts`
11. `## Prompt activo`
12. `## Acceptance criteria`
13. `## How to test`

Optional sections:

- `## Design decisions`
- `## PR Roadmap` (mandatory when a plan spans multiple PRs)
- `## Risks and limitations`

### Approval to start execution

- The plan must receive explicit go/no-go from the user before execution.
- On first execution, mandatory plan-start choices defined in `plan-execution-protocol.md` still apply.

---

## 2. How to Execute a Plan

Execution is governed by [`plan-execution-protocol.md`](plan-execution-protocol.md).

Before step 1, run the mandatory plan-start choices (execution worktree, CI mode, and available agents). During execution, the flow is:

`Continua` intent -> step eligibility -> execute step -> SCOPE BOUNDARY -> chain or stop.

See [`plan-execution-protocol.md`](plan-execution-protocol.md) for the complete execution protocol.

---

## 3. Task Chaining Policy

Defines how AI assistants must behave when executing chained plan steps (e.g., triggered by `Continúa`).

### Default behavior in chained mode

- Do **not** auto-fix failures by default when chaining steps.
- Record the failure with evidence (what failed, which files, error output).
- Continue to the next step only if the failure is **non-blocking** for the current step.
- **STOP and escalate** on blocking conditions (see below).

### Blocking conditions (must STOP)

- A required preflight or CI gate failed and the step depends on it.
- Instructions contradict a canonical document or plan constraint.
- A dependency, permission, or required tool is missing.
- Security or data-loss risk is identified.
- An explicit hard-gate in the plan requires user review before proceeding.

### Non-blocking failures (may continue)

- Pre-existing lint/test failures unrelated to the current step.
- Cosmetic or formatting issues that do not affect correctness.
- Warnings that do not block commit/push/PR gates.

### Auto-fix allowance

- In **interactive single-task mode** (no plan), the assistant may attempt focused auto-fixes (max 2 attempts, scoped to the current change).
- In **chained-plan mode**, auto-fix is **not default**. The assistant must document the failure and let the plan decide (next step, escalation, or explicit fix step).
- Auto-fixes must never go beyond the current change scope or introduce unrelated refactors.
- **Never bypass quality gates** (`--no-verify`, disabling tests/checks, weakening assertions) to force a pass.

### Required output per step

Before handoff or auto-chain to the next step, each completed step must include:

- What changed (files, commits).
- Evidence (test output, CI status, verification).
- Risks or open items.
- Next-step handoff decision (continue / STOP / hand off to other agent).

---

## 4. Plan Lifecycle

### States

- **Active**: Plan is in execution and remains in `.../04-delivery/plans/`.
- **Paused**: Execution is intentionally stopped by user decision; the plan remains active until resumed, updated, or formally closed.
- **Completed**: All steps are either completed (`[x]`) or reconciled during close-out.
- **Abandoned**: Plan is intentionally cancelled before completion.

### Archival

- Completed and abandoned plans are archived from active plans into `.../04-delivery/plans/completed/`.
- Canonical file naming in archive: `COMPLETED_<date>_<slug>.md`.
- Use `git mv` to preserve traceability in history.

### Close-out authority

The detailed close-out sequence (reconciliation, implementation history update, archive move, normalization, and merge readiness) is defined in [`plan-execution-protocol.md` §14](plan-execution-protocol.md#14-iteration-lifecycle-protocol).

---

## 5. Plan Scope Principle (Hard Rule)

**Plans contain ONLY product/engineering tasks and well-defined operational override steps.** Generic or unscoped operational mentions are NEVER plan steps.

| Valid plan step | Operational Override Step (allowed) | NOT a plan step (generic) |
|---|---|---|
| "Add Playwright smoke test for upload flow" | `commit-task`: Commit F1-1 + F1-2 (scope, message, push defined) | "Commit and push" (unscoped) |
| "Configure CI job for E2E tests" | `create-pr`: Create draft PR for iteration branch | "Create PR" (unscoped) |
| "Add data-testid attributes to components" | `merge-pr`: Squash-merge PR #42 after user approval | "Merge PR" (unscoped) |

### Operational Override Steps

Certain operational actions (commits, PRs, merges) are allowed as plan steps only when they follow the strict schema below. Generic mentions without the required fields are rejected.

#### Required schema

Each operational override step in `PLAN_*.md` MUST include:

| Field | Description | Required |
|---|---|---|
| `type` | One of: `commit-task`, `create-pr`, `merge-pr` | Yes |
| `trigger` | When this step executes (e.g., "after F1-1 and F1-2") | Yes |
| `preconditions` | What must be true before execution (e.g., "CI green for all prior steps") | Yes |
| `commands` | Exact command set to execute | Yes |
| `approval` | `auto` or `explicit-user-approval` | Yes |
| `fallback` | What to do if execution fails | Yes |

#### Approval rules

- `commit-task`: `auto` (executes without user confirmation).
- `create-pr`: `auto` (draft PR creation is safe and reversible).
- `merge-pr`: always `explicit-user-approval` (merge is irreversible).

#### Validation

If an operational step in the plan is missing any required field, the execution agent MUST stop and ask the planning agent to complete the schema before execution.

### Commit Task Specification (Mandatory at Plan Creation)

When generating `PLAN_*.md`, the planning agent MUST define explicit commit tasks as first-class plan steps.

Each commit task MUST include:

1. **Trigger point** - when the commit task is executed (for example: after steps `F1-1` and `F1-2`).
2. **Scope** - exact files and/or step IDs included in that commit.
3. **Commit message** - exact message to use.
4. **Push expectation** - whether the commit is pushed immediately or grouped with a later plan-update commit.

Execution rule:

- The execution agent MUST NOT create ad-hoc commits outside a defined commit task.
- If commit scope/message must change, update the plan first and then execute.

---

## 6. Prompt Strategy

### Prompt types

- **Pre-written prompts** (Prompt Queue): written by the planning agent at iteration start for tasks whose content does not depend on prior results.
- **Just-in-time prompts** (Active Prompt): written by the planning agent when a task depends on a prior task's result.

### Resolution priority

Prompt Queue -> Active Prompt -> STOP (ask the planning agent).

### Prompt creation lifecycle

| Operation | Who | When |
|---|---|---|
| **Create** (pre-written) | Planning agent | At iteration start, in Prompt Queue |
| **Create** (just-in-time) | Planning agent | Before the step that needs it, in Active Prompt |

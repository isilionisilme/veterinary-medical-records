# Plan Creation

> Project-specific operational document.
> Defines how plans are authored and structured in the `veterinary-medical-records` project.
> Execution-time behavior is defined in [plan-execution-protocol.md](plan-execution-protocol.md).

---

## 1. How to Create a Plan

Create a plan when work requires coordinated multi-step delivery, multiple checkpoints, explicit hard-gates, or multi-agent handoffs.

### Ownership

- The planning agent owns plan authoring and plan updates.
- Execution agents consume and execute the plan; they do not redefine authoring rules.

### Naming and location

- Naming convention: `PLAN_<YYYY-MM-DD>_<SLUG>.md`
- Location: `docs/projects/veterinary-medical-records/04-delivery/plans/`

### Required plan template

Every new plan MUST include:

1. Title: `# Plan: <name>`
2. Operational rules pointer: `> **Operational rules:** See [plan-execution-protocol.md](...)`
3. Metadata:
   - `**Branch:**`
   - `**PR:**` — Use `Pending (PR created on explicit user request)` as placeholder.
   - `**User Story:**`
   - `**Prerequisite:**`
   - `**Worktree:**`
   - `**CI Mode:**`
   - `**Automation Mode:**` — one of `Supervisado`, `Semiautomatico`, `Automatico`
4. `## Context`
5. `## Objective`
6. `## Scope Boundary`
7. `## Execution Status`
8. `## Prompt Queue`
9. `## Active Prompt`
10. `## Acceptance criteria`
11. `## How to test`

Optional sections:

- `## Design decisions`
- `## PR Roadmap` (mandatory when a plan spans multiple PRs)
- `## Risks and limitations`

### Plan-start requirement

- The plan must receive explicit go/no-go from the user before execution.
- On first execution, mandatory plan-start choices defined in `plan-execution-protocol.md` apply.

---

## 2. Plan Scope Principle (Hard Rule)

Plans contain only product/engineering/documentation outcomes.
Operational actions are never executable plan steps.

| Valid plan step | Invalid plan step |
|---|---|
| "Implement owner_address normalization and tests" | "Commit and push" |
| "Run benchmark and record delta evidence" | "Create PR" |
| "Document feature behavior in wiki (or no-doc-needed rationale)" | "Merge PR" |

### Operational actions policy

- `commit`, `push`, `create/update PR`, `merge`, and post-merge cleanup are execution protocol behavior, not plan tasks.
- A plan may include commit recommendations inline, but these are guidance, not checkboxes.

### Required inline commit recommendation format

When relevant, include commit guidance under the implementation step:

- **When:** after which concrete step(s).
- **Scope:** intended files/areas.
- **Suggested message:** proposed commit message.
- **Expected validation:** minimum checks expected before commit.

This recommendation must not be represented as `CT-*`, `commit-task`, `create-pr`, or `merge-pr` checklist items.

---

## 3. Plan Documentation Task (Hard Rule)

Every active plan MUST include an explicit documentation task.

- If documentation is needed: create/update wiki docs.
- If not needed: close the task with `no-doc-needed` and a brief rationale.

When documentation is required, enforce:

- clear structure and readability,
- table of contents when the page is long enough to need one,
- Mermaid diagrams when they improve comprehension,
- applicable documentation skills/workflows available in the project.

---

## 4. Plan-File Commit Policy

- Do not create plan-only commits for routine status telemetry (checkbox toggles, in-progress markers).
- Plan updates during execution are allowed only for substantive scope/decision changes.
- The canonical plan archive commit is a single close-out commit when the plan moves to `completed/`.

---

## 5. Pull Request Policy in Plans

- A PR is required before merge.
- PR creation/update is user-triggered only.
- Plans must not include automatic PR creation tasks.

---

## 6. Prompt Strategy

### Prompt types

- Pre-written prompts (Prompt Queue): authored at iteration start for tasks that do not depend on prior outputs.
- Just-in-time prompts (Active Prompt): authored when a task depends on earlier results.

### Prompt creation lifecycle

| Operation | Who | When |
|---|---|---|
| Create (pre-written) | Planning agent | At iteration start, in Prompt Queue |
| Create (just-in-time) | Planning agent | Before the dependent step, in Active Prompt |


# Plan: IMP-13 PR-1 — Create Runbook Layer (Fase A)

> **Operational rules:** See [plan-execution-protocol.md](../../03-ops/plan-execution-protocol.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Backlog item:** [imp-13-operational-runbook-architecture.md](../Backlog/imp-13-operational-runbook-architecture.md)
**Branch:** `docs/imp-13-operational-runbook-architecture`
**PR:** Pending (PR created on explicit user request)
**User Story:** IMP-13 Fase A
**Prerequisite:** `main` up to date and tests green; branch `docs/imp-13-operational-runbook-architecture` already exists.
**Worktree:** `D:/Git/worktrees/cuarto`
**Execution Mode:** `Semi-supervised`
**Model Assignment:** `Uniform`

---

## Context

The current operational governance relies on a multi-level routing chain (~1000 lines of fragmented protocol). Agents saturate their context navigating conditional prose and fail to follow plan-start rules deterministically. This plan creates the new operational layer — `.prompt.md` runbooks, `.instructions.md` context files, and an enforcement script — alongside the existing system. Nothing is modified or deleted.

## Objective

Create all new operational artifacts (additive only):
1. `scripts/dev/plan-start-check.py` — deterministic enforcement script.
2. Six `.prompt.md` runbooks in `.github/prompts/`.
3. Two `.instructions.md` context files in `.github/instructions/`.
4. Dry-run validation confirming the new artifacts work.

## Scope Boundary

- **In scope:** `plan-start-check.py` + tests, `.prompt.md` files, `.instructions.md` files, dry-run validation.
- **Out of scope:** AGENTS.md changes, router modifications, CI script changes, directory deletions. These belong to PR-2 and PR-3 plans.

---

## Execution Status

**Legend**
- 🔄 auto-chain — executable by agent without user intervention
- 🚧 hard-gate — requires user review/decision

### Phase 0 — Plan-start preflight

- [x] P0-A 🔄 — Resolve execution branch and update `**Branch:**` metadata.
- [x] P0-B 🔄 — Resolve execution worktree and update `**Worktree:**` metadata.
- [x] P0-C 🚧 — Ask user to choose `Execution Mode` and update metadata.
- [x] P0-D 🚧 — Ask user to choose `Model Assignment` and update metadata.
- [x] P0-E 🔄 — Record plan-start snapshot commit. — ✅ `e665594d`

### Phase 1 — Plan-start enforcement script

- [x] P1-A 🔄 — Create `scripts/dev/plan-start-check.py`: glob active `PLAN_*.md`, parse four mandatory fields (`Branch`, `Worktree`, `Execution Mode`, `Model Assignment`), report resolved/unresolved, output structured next-action text. — ✅ `44896fbf`
- [x] P1-B 🔄 — Add unit tests for `plan-start-check.py` covering: all resolved, partial resolution, no active plan, multiple active plans. — ✅ `44896fbf`

> 📌 **Commit checkpoint — P1 complete.** Suggested message: `feat(ops): add plan-start-check enforcement script with tests`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

### Phase 2 — Operational prompts

- [ ] P2-A 🔄 — Create `plan-create.prompt.md` in `.github/prompts/`: self-contained plan creation checklist sourced from `plan-creation.md` essentials. Under 50 lines.
- [ ] P2-B 🔄 — Create `plan-start.prompt.md`: plan-start choices + preflight gate sourced from protocol §4, §7. Under 50 lines.
- [ ] P2-C 🔄 — Create `plan-resume.prompt.md`: plan resume flow sourced from protocol §4, §5, §10 decision table. Under 50 lines.
- [ ] P2-D 🔄 — Create `plan-closeout.prompt.md`: closeout lifecycle sourced from protocol §14, §13. Under 50 lines.
- [ ] P2-E 🔄 — Create `code-review.prompt.md`: code review operational rules. Under 50 lines.
- [ ] P2-F 🔄 — Create `scope-boundary.prompt.md`: commit/push during active plan sourced from protocol §13 SCOPE BOUNDARY. Under 50 lines.

> 📌 **Commit checkpoint — P2 complete.** Suggested message: `feat(ops): add operational .prompt.md runbooks`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

### Phase 3 — Pattern-triggered instructions

- [ ] P3-A 🔄 — Create `plan-files.instructions.md` in `.github/instructions/` with `applyTo: **/plans/PLAN_*.md`. Content: atomic iterations, mark `[x]` with SHA, no scope mixing, checkpoint pause, evidence block.
- [ ] P3-B 🔄 — Create `backlog-files.instructions.md` in `.github/instructions/` with `applyTo: **/Backlog/*.md`. Content: status lifecycle, naming convention, link format.

> 📌 **Commit checkpoint — P3 complete.** Suggested message: `feat(ops): add pattern-triggered .instructions.md context files`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

### Phase 4 — Dry-run validation

- [ ] P4-A 🔄 — Dry-run: simulate plan creation from cold chat using `plan-create.prompt.md`. Document result.
- [ ] P4-B 🔄 — Dry-run: simulate plan-start with unresolved metadata using `plan-start.prompt.md` + `plan-start-check.py`. Document result.
- [ ] P4-C 🔄 — Dry-run: simulate plan resume using `plan-resume.prompt.md`. Document result.
- [ ] P4-D 🚧 — Hard-gate: user reviews dry-run results and confirms Fase A is complete.

> 📌 **Commit checkpoint — PR-1 complete (Fase A).** Suggested message: `feat(ops): complete Fase A — operational runbook layer (IMP-13)`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

### Documentation task

- [ ] DOC-1 🔄 — `no-doc-needed` — This plan creates operational governance artifacts. The `.prompt.md` and `.instructions.md` files themselves serve as documentation.

---

## Prompt Queue

| # | Prompt | Target phase |
|---|---|---|
| 1 | Execute Phase 0 plan-start preflight | P0 |
| 2 | Implement plan-start-check.py and tests | P1 |
| 3 | Create all .prompt.md runbooks | P2 |
| 4 | Create .instructions.md context files | P3 |
| 5 | Run dry-run validation suite | P4 |

## Active Prompt

None — plan not yet started.

---

## Acceptance criteria

1. `scripts/dev/plan-start-check.py` deterministically detects unresolved plan-start fields and outputs structured next-action text.
2. All six `.prompt.md` runbooks exist under `.github/prompts/`, each under 50 lines, each self-contained.
3. Both `.instructions.md` files exist under `.github/instructions/` with correct `applyTo` patterns.
4. Unit tests for `plan-start-check.py` pass.
5. Dry-runs confirm the new artifacts work from a cold chat.
6. No existing files were modified (additive only).

## How to test

1. **Script enforcement:** Run `python scripts/dev/plan-start-check.py` against a plan with unresolved fields → verify it reports missing fields and outputs structured next-action.
2. **Prompt dry-run:** Open a new VS Code chat, invoke `plan-start.prompt.md` via the prompt picker → verify the agent follows the checklist deterministically.
3. **Instructions auto-load:** Open a `PLAN_*.md` file in VS Code → verify `plan-files.instructions.md` appears in Copilot context panel.
4. **L2 green:** Run `scripts/ci/test-L2.ps1 -BaseRef main` → all tests pass.

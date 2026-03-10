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
- `[P]` Planning agent · `[E]` Execution agent

### Phase 0 — Plan-start preflight

- [x] P0-A 🔄 [P] — Resolve execution branch and update `**Branch:**` metadata.
- [x] P0-B 🔄 [P] — Resolve execution worktree and update `**Worktree:**` metadata.
- [x] P0-C 🚧 [P] — Ask user to choose `Execution Mode` and update metadata.
- [x] P0-D 🚧 [P] — Ask user to choose `Model Assignment` and update metadata.
- [ ] P0-E 🔄 [P] — Record plan-start snapshot commit.

### Phase 1 — Plan-start enforcement script

- [ ] P1-A 🔄 [E] — Create `scripts/dev/plan-start-check.py`: glob active `PLAN_*.md`, parse four mandatory fields (`Branch`, `Worktree`, `Execution Mode`, `Model Assignment`), report resolved/unresolved, output structured next-action text.
- [ ] P1-B 🔄 [E] — Add unit tests for `plan-start-check.py` covering: all resolved, partial resolution, no active plan, multiple active plans.

> 📌 **Commit checkpoint — P1 complete.** Suggested message: `feat(ops): add plan-start-check enforcement script with tests`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

### Phase 2 — Operational prompts

- [ ] P2-A 🔄 [E] — Create `plan-create.prompt.md` in `.github/prompts/`: self-contained plan creation checklist sourced from `plan-creation.md` essentials. Under 50 lines.
- [ ] P2-B 🔄 [E] — Create `plan-start.prompt.md`: plan-start choices + preflight gate sourced from protocol §4, §7. Under 50 lines.
- [ ] P2-C 🔄 [E] — Create `plan-resume.prompt.md`: plan resume flow sourced from protocol §4, §5, §10 decision table. Under 50 lines.
- [ ] P2-D 🔄 [E] — Create `plan-closeout.prompt.md`: closeout lifecycle sourced from protocol §14, §13. Under 50 lines.
- [ ] P2-E 🔄 [E] — Create `code-review.prompt.md`: code review operational rules. Under 50 lines.
- [ ] P2-F 🔄 [E] — Create `scope-boundary.prompt.md`: commit/push during active plan sourced from protocol §13 SCOPE BOUNDARY. Under 50 lines.

> 📌 **Commit checkpoint — P2 complete.** Suggested message: `feat(ops): add operational .prompt.md runbooks`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

### Phase 3 — Pattern-triggered instructions

- [ ] P3-A 🔄 [E] — Create `plan-files.instructions.md` in `.github/instructions/` with `applyTo: **/plans/PLAN_*.md`. Content: atomic iterations, mark `[x]` with SHA, no scope mixing, checkpoint pause, evidence block.
- [ ] P3-B 🔄 [E] — Create `backlog-files.instructions.md` in `.github/instructions/` with `applyTo: **/Backlog/*.md`. Content: status lifecycle, naming convention, link format.

> 📌 **Commit checkpoint — P3 complete.** Suggested message: `feat(ops): add pattern-triggered .instructions.md context files`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

### Phase 4 — Dry-run validation

- [ ] P4-A 🔄 [E] — Dry-run: simulate plan creation from cold chat using `plan-create.prompt.md`. Document result.
- [ ] P4-B 🔄 [E] — Dry-run: simulate plan-start with unresolved metadata using `plan-start.prompt.md` + `plan-start-check.py`. Document result.
- [ ] P4-C 🔄 [E] — Dry-run: simulate plan resume using `plan-resume.prompt.md`. Document result.
- [ ] P4-D 🚧 [P] — Hard-gate: user reviews dry-run results and confirms Fase A is complete.

> 📌 **Commit checkpoint — PR-1 complete (Fase A).** Suggested message: `feat(ops): complete Fase A — operational runbook layer (IMP-13)`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

### Documentation task

- [ ] DOC-1 🔄 [E] — `no-doc-needed` — This plan creates operational governance artifacts. The `.prompt.md` and `.instructions.md` files themselves serve as documentation.

---

## Prompt Queue

### Prompt 1 — P0-E: Plan-start snapshot commit

**Pre-written** · Target: P0-E

Steps P0-A through P0-D are already resolved (metadata in place). Execute P0-E only:

1. Verify that `**Branch:**`, `**Worktree:**`, `**Execution Mode:**`, and `**Model Assignment:**` all contain resolved non-placeholder values in this plan file.
2. Run `scripts/ci/test-L1.ps1 -BaseRef HEAD`.
3. If L1 green: commit the plan file with message `docs(plan): record plan-start choices for IMP-13-PR1-CREATE-RUNBOOK-LAYER`.
4. If L1 red: fix and retry once; on second failure STOP and report.

This commit is the execution baseline. No implementation step may begin before it exists.

---

### Prompt 2 — P1: plan-start-check.py + unit tests

**Pre-written** · Target: P1-A, P1-B

**P1-A — Create `scripts/dev/plan-start-check.py`**

Purpose: CLI tool that scans active plan files and reports whether all 4 mandatory plan-start fields are resolved, providing structured next-action guidance.

Behavior spec:
1. Glob `PLAN_*.md` inside `docs/projects/veterinary-medical-records/04-delivery/plans/` but **exclude** the `completed/` subdirectory (those are archived plans, not active).
2. For each matched file, parse these 4 fields from lines matching `**<Field>:**`:
   - `Branch` — resolved if value is not empty and does not contain `PENDING`.
   - `Worktree` — resolved if value is not empty and does not contain `PENDING`.
   - `Execution Mode` — resolved if value is one of `Supervised`, `Semi-supervised`, `Autonomous`.
   - `Model Assignment` — resolved if value is one of `Default`, `Uniform`, `Custom`.
3. Output per plan file:
   - File path (relative to repo root).
   - Status of each field: `✅ resolved (<value>)` or `❌ unresolved`.
   - Summary: `ALL RESOLVED` or `UNRESOLVED: <list of missing fields>`.
4. Exit code: `0` if all active plans have all fields resolved; `1` otherwise.
5. If no active plans found: output `No active plans found.` and exit `0`.
6. If multiple active plans found: process each and report individually.
7. Use only Python standard library (`pathlib`, `re`, `sys`). No external dependencies.
8. Add `if __name__ == "__main__":` entry point that accepts an optional `--plan-dir` argument (default: `docs/projects/veterinary-medical-records/04-delivery/plans`).

**P1-B — Add unit tests**

Create `backend/tests/unit/test_plan_start_check.py`. Test cases:

1. **All resolved** — a plan file with all 4 fields filled with valid values → exit 0, all `✅`.
2. **Partial resolution** — a plan file with 2 resolved, 2 still `PENDING` → exit 1, correct fields flagged.
3. **No active plan** — empty directory (or only `completed/` subdirectory) → exit 0, `No active plans found.`
4. **Multiple active plans** — two plan files, one fully resolved, one partial → exit 1, both reported correctly.

Use `tmp_path` fixture with synthetic plan files. Import the parsing function directly for unit testing; also test the CLI via `subprocess.run` for integration coverage.

After both P1-A and P1-B: run L1 (`scripts/ci/test-L1.ps1 -BaseRef HEAD`). Fix until green (max 2 attempts). Then proceed to checkpoint pause.

---

### Prompt 3 — P2: Six .prompt.md runbooks

**Pre-written** · Target: P2-A through P2-F

Create directory `.github/prompts/` if it doesn't exist. Each file uses `.prompt.md` extension with YAML front matter containing `mode: agent` and a `description` field. Each file must be **under 50 lines**, self-contained, and written as a deterministic checklist the agent follows step-by-step. No prose — only numbered action steps with clear exit conditions.

**P2-A — `plan-create.prompt.md`**

Description: "Create a new plan following project conventions."

Source: `plan-creation.md` §1-§5. Distill into checklist:
1. Verify the backlog item exists and is `Planned` or `In Progress`.
2. Create `PLAN_<YYYY-MM-DD>_<SLUG>.md` in the plans directory.
3. Populate required template sections: Title, Operational rules pointer, Metadata (with PENDING placeholders), Context, Objective, Scope Boundary, Execution Status (Phase 0 mandatory), Prompt Queue, Active Prompt, Acceptance criteria, How to test.
4. Add Documentation task (DOC-1) per §3.
5. Run PR partition gate (§5): estimate size, evaluate semantic risk, classify buckets, open decision gate if thresholds exceeded.
6. Write pre-written prompts for non-dependent steps (§6).
7. If multi-PR: add `## PR Roadmap` with integration strategy table before writing Execution Status.
8. Commit: `docs(plan): create <plan-slug>`.

**P2-B — `plan-start.prompt.md`**

Description: "Resolve plan-start choices and record snapshot."

Source: protocol §7 (plan-start preflight gate, execution mode, model assignment, worktree selection, plan-start snapshot). Checklist:
1. Read plan file. Inspect `**Branch:**`, `**Worktree:**`, `**Execution Mode:**`, `**Model Assignment:**`.
2. For each unresolved field:
   - Branch: check current branch, auto-resolve if matches plan context.
   - Worktree: auto-resolve to current VS Code workspace (`$PWD`).
   - Execution Mode: present 3 options (Supervised / Semi-supervised / Autonomous) with table summary. Wait for user.
   - Model Assignment: present 3 options (Default / Uniform / Custom). Wait for user.
3. Record resolved values in plan file.
4. Run `scripts/ci/test-L1.ps1 -BaseRef HEAD`.
5. Commit: `docs(plan): record plan-start choices for <plan-slug>`.
6. Inform user: plan-start complete, ready for execution.

**P2-C — `plan-resume.prompt.md`**

Description: "Resume execution of an active plan."

Source: protocol §4 (step eligibility), §5 (continuation-intent-only), §10 (decision table). Checklist:
1. Read Execution Status. Find first `[ ]` step (includes `⏳ IN PROGRESS` or `🚫 BLOCKED`).
2. If `⏳ IN PROGRESS`: resume that step from where it left off.
3. If `🚫 BLOCKED`: report blocker, ask user for resolution.
4. Check Prompt Queue for matching prompt. If exists: consume it. If not: STOP and ask planning agent.
5. Apply decision table: prompt exists + no hard-gate → auto-chain. Hard-gate → STOP and report. No prompt → STOP.
6. Mark step `⏳ IN PROGRESS (<agent>, <date>)`.
7. Execute step scope. On completion: mark `[x]` with SHA, run per-task test gate, output evidence block.
8. Apply decision table for next step.

**P2-D — `plan-closeout.prompt.md`**

Description: "Close out a plan before merge."

Source: protocol §14 (iteration close-out procedure, backlog lifecycle, closeout commit). Checklist:
1. Verify all steps are `[x]`. If any `[ ]`: present each to user — Defer / Drop / Mark complete.
2. Verify clean working tree: `git status --porcelain`.
3. `git fetch --prune`.
4. Update backlog item `**Status:**` to `Done`.
5. Move plan file: `git mv plans/<plan-file> plans/completed/<plan-file>`.
6. Move backlog artifact to `Backlog/completed/` if it exists.
7. Update relative links pointing to old paths.
8. Run doc-contract tests locally.
9. Commit: `docs(closeout): archive <plan-slug> and backlog artifacts`.
10. Push. Wait for CI green.
11. If PR exists: update PR body with closeout checklist.

**P2-E — `code-review.prompt.md`**

Description: "Run a structured code review on a pull request."

Source: `way-of-working.md` §6 (code review workflow, via router 00_entry.md). Checklist:
1. **Pre-review checks:** Confirm CI status. CI red → STOP, offer to diagnose. CI in progress → wait.
2. Confirm scope: list changed files and PR description.
3. Recommend review depth (Light / Standard / Deep / Deep critical) based on risk profile. Wait for user confirmation.
4. If Deep/Deep critical: propose lenses, launch parallel sub-agent reviews, consolidate.
5. Review focus areas (7): layering, maintainability, testability, simplicity, CI/tooling, DB safety, UX/brand.
6. Classify findings: Must-fix (blocks merge) / Should-fix / Nice-to-have.
7. Output using `AI Code Review` template exactly.
8. Publish review as PR comment. Return URL.

**P2-F — `scope-boundary.prompt.md`**

Description: "Execute commit/push during active plan execution."

Source: protocol §13 (SCOPE BOUNDARY procedure). Checklist:
1. **STEP 0 — Branch verification:** Read `**Branch:**` from plan. Verify current branch matches. Mismatch → STOP.
2. **STEP A — Commit code:** Stage implementation files only (never unrelated). Commit with test proof.
3. **STEP B — Commit plan update:** Apply §3 completion rules. Stage and commit plan file.
4. **STEP C — Push (conditional):** Only if user explicitly requested push. `git push origin <branch>`.
5. **STEP D — Update PR (conditional):** Only if STEP C ran and user requested PR update.
6. **STEP E — CI gate (conditional):** Only if STEP C ran. Check CI, wait if in progress, report failures.
7. **STEP F — Chain or stop:** Apply §10 decision table for next step.

After all 6 runbooks created: run L1 (`scripts/ci/test-L1.ps1 -BaseRef HEAD`). Fix until green (max 2 attempts). Then proceed to checkpoint pause.

---

### Prompt 4 — P3: Two .instructions.md context files

**Pre-written** · Target: P3-A, P3-B

Create directory `.github/instructions/` if it doesn't exist. Each file uses `.instructions.md` extension with YAML front matter containing `applyTo` glob pattern. These files are passive context — VS Code auto-injects them when the matching file is open. Keep them short and declarative (rules, not procedures).

**P3-A — `plan-files.instructions.md`**

```yaml
---
applyTo: "**/plans/PLAN_*.md"
---
```

Content (declarative rules for agents editing plan files):
- Each step is an atomic unit. Never mix scope between steps.
- Mark `[x]` with commit SHA on completion: `- [x] F?-? — Description — ✅ \`<sha>\``.
- If no code change: `✅ \`no-commit (<reason>)\``.
- Mark `⏳ IN PROGRESS (<agent>, <date>)` before starting a step.
- At `📌` checkpoints: pause, propose commit, wait for user.
- Every step close requires evidence block: Step, Code commit SHA, Plan commit SHA.
- Plan-file updates go in the same commit as the implementation they track.
- Never amend the plan-start snapshot commit.

**P3-B — `backlog-files.instructions.md`**

```yaml
---
applyTo: "**/Backlog/*.md"
---
```

Content (declarative rules for agents editing backlog items):
- Status lifecycle: `Planned` → `In Progress` → `Done`.
- Set `In Progress` when plan execution starts (first step marked in-progress).
- Set `Done` only during closeout, before moving to `completed/`.
- Naming: `<TYPE>-<NUMBER>-<slug>.md` where TYPE is `US`, `IMP`, `ARCH`, or project-specific.
- Link format for plans: `[PLAN_<date>_<slug>.md](../plans/PLAN_<date>_<slug>.md)`.
- When moving to `completed/`: update all relative links in surrounding docs.

After both P3-A and P3-B: run L1 (`scripts/ci/test-L1.ps1 -BaseRef HEAD`). Fix until green (max 2 attempts). Then proceed to checkpoint pause.

---

### Prompt 5 — P4: Dry-run validation

**Just-in-time** · Target: P4-A through P4-D

> This prompt depends on the artifacts created in P1-P3. The planning agent will write a detailed prompt at just-in-time when P3 is complete and the artifacts exist. The dry-run will validate:
> - P4-A: Invoke `plan-create.prompt.md` in a cold chat and verify it produces a conformant plan skeleton.
> - P4-B: Invoke `plan-start.prompt.md` with a plan that has unresolved fields + run `plan-start-check.py` to verify it detects them.
> - P4-C: Invoke `plan-resume.prompt.md` and verify it correctly identifies the next pending step and follows the decision table.
> - P4-D: Hard-gate — user reviews dry-run results and confirms Fase A complete.

---

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

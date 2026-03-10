# Plan: Plan Creation Protocol Enhancements (IMP-05)

> **Operational rules:** See [plan-execution-protocol.md](../../../03-ops/plan-execution-protocol.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.
>
> **Policy mode: Draft (IMP-05 target).** This plan dogfoods the rules it introduces. Model tags, commit checkpoints, integration strategy table, and test gate obligations are applied here as working-draft policy even though they are not yet merged into canonical docs.

**Branch:** `docs/imp-05-plan-creation-protocol-enhancements`
**PR:** See [PR Roadmap](#pr-roadmap)
**Backlog item:** [imp-05-plan-creation-protocol-enhancements.md](../../Backlog/imp-05-plan-creation-protocol-enhancements.md)
**Prerequisite:** IMP-01 merged (canonical policy stable)
**Worktree:** _(to be selected at plan start)_
**CI Mode:** _(to be selected at plan start)_
**Automation Mode:** Supervisado
**Model Assignment:** _(to be selected at plan start)_

---

## Agent Instructions

> **Draft-policy rules (IMP-05 dogfooding).** Rules 1–3 below apply as draft policy because this plan introduces them (S2, S3). After IMP-05 merges, they will live in canonical docs and should not be repeated in future plans.

1. **After every task**, run `scripts/ci/test-L1.ps1 -BaseRef HEAD`. Fix until green (max 2 attempts; on 3rd failure STOP and report).
2. **At every commit checkpoint (📌)**, run `scripts/ci/test-L2.ps1 -BaseRef main`. Fix until green (max 2 attempts; on 3rd failure STOP and report). Then wait for user instructions.
3. **Model routing (hard rule).** Each step has a `[Model]` tag. On step completion, check the `[Model]` tag of the next pending step. If it differs from the current model, STOP immediately and tell the user: "Next step recommends [Model X]. Switch to that model and say 'continue'." Do NOT auto-chain across model boundaries.
4. **Documentation task:** This plan modifies canonical documentation directly — no separate wiki task needed. Rationale: the deliverables _are_ the docs.

---

## Context

Every time a plan is created, the user supplies a long ad-hoc prompt with rules for commit checkpoints, model assignment, test gates, PR closeout, merge strategy, and PR URL tracking. These rules are stable and should live in canonical docs. This plan implements six scope items (S1–S6) that make the canonical docs self-sufficient so the plan-creation prompt reduces to a one-liner.

### Canonical files in scope

| File | Sections to modify |
|---|---|
| `docs/projects/veterinary-medical-records/03-ops/plan-creation.md` | §2 (commit checkpoint format), §5 (PR Roadmap: integration table, merge strategy, PR-first order) |
| `docs/projects/veterinary-medical-records/03-ops/plan-execution-protocol.md` | §7 (Model Assignment plan-start choice), §9 (test gates per task/checkpoint), §14 (PR Closeout integration) |

### Files explicitly out of scope

- `execution-rules.md` — compatibility stub.
- `docs/agent_router/*` — auto-generated; will be regenerated after canonical changes land.
- Scripts, CI, backend, frontend — no changes.

---

## Objective

1. Add commit checkpoint blockquote format to `plan-creation.md` §2. **(S1)**
2. Add Model Assignment as mandatory plan-start choice to `plan-execution-protocol.md` §7. **(S2)**
3. Formalize per-task L1 and per-checkpoint L2 test gates with retry limits in `plan-execution-protocol.md` §9. **(S3)**
4. Add integration strategy table, merge strategy definitions, and URL traceability to `plan-creation.md` §5. **(S4)**
5. Merge PR Closeout Protocol into `plan-execution-protocol.md` §14 Iteration Close-Out. **(S5)**
6. Add PR-first planning order rule to `plan-creation.md` §5. **(S6)**

---

## Scope Boundary

- **In scope:** Editing canonical operational policy text in `plan-creation.md` and `plan-execution-protocol.md`. Static content validation. Router regeneration.
- **Out of scope:** CI scripts/guards, plan migrations (IMP-04), backend/frontend product behavior, existing plan files.

---

## PR Roadmap

Single PR delivering all six scope items. Both target files are canonical operational docs with no code dependency.

**Merge strategy:** N/A (single PR).

| PR | Branch | Scope | Depends on | Status | URL |
|---|---|---|---|---|---|
| PR-1 | `docs/imp-05-plan-creation-protocol-enhancements` | All S1–S6 canonical doc changes + router regen | None | In progress | — |

**PR partition gate evidence:**
- Estimated changed files: 4 (2 canonical docs + 2 regenerated router files).
- Estimated changed lines: ~120.
- Semantic risk: docs-only, single concern (operational policy). No backend/frontend/schema mix.
- Size guardrails: well under 400 lines / 15 files.
- Decision: **Option A** — single PR. Cohesive low-risk documentation changes.

---

## Design Decisions

### DD-1: All six items in a single PR

All changes target two canonical docs and their derived router files. There is no semantic risk from mixing them — they are all additive policy text for the same operational surface. Splitting would add PR overhead without reducing review risk.

### DD-2: Dogfooding draft policy

This plan applies IMP-05 target rules (model tags, commit checkpoints, integration table) to itself. This validates the rules before they are canonical and produces a real-world test case.

### DD-3: Router regeneration as a single validation step

Router files are auto-generated from canonical sources. Rather than regenerating after each individual change, we regenerate once after all canonical edits are done and validate with L2/L3.

---

## Execution Status

**Legend**
- 🔄 auto-chain — executable by agent
- 🚧 hard-gate — user review/decision required

### Phase 1 — plan-creation.md changes (S1, S4, S6)

- [ ] P1-A 🔄 `[GPT 5.4]` — **S1: Commit checkpoint format.** In `plan-creation.md` §2, after the existing "Required inline commit recommendation format" subsection, add a new "Commit checkpoint blockquote format" subsection prescribing the `📌` blockquote format for commit checkpoints in plans.
- [ ] P1-B 🔄 `[GPT 5.4]` — **S6: PR-first planning order.** In `plan-creation.md` §5, before the "PR sizing and split criteria" subsection, add a rule that when a plan may span multiple PRs, PR boundaries must be determined before writing Execution Status and commit checkpoints.
- [ ] P1-C 🔄 `[GPT 5.4]` — **S4: Integration strategy table and merge strategy.** In `plan-creation.md` §5, under the existing "When `## PR Roadmap` is present" block, add: (a) integration strategy table requirement with mandatory columns, (b) merge strategy definitions table, (c) URL traceability hard rule.

> 📌 **Commit checkpoint — Phase 1 complete.** Suggested message: `docs(ops): add commit checkpoint format, PR-first order, and integration strategy to plan-creation`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

### Phase 2 — plan-execution-protocol.md changes (S2, S3, S5)

- [ ] P2-A 🔄 `[GPT 5.4]` — **S2: Model Assignment plan-start choice.** In `plan-execution-protocol.md` §7, after the "Automation Mode Selection" subsection, add a new "Model Assignment (Mandatory Plan-Start Choice)" subsection with options (Default, Uniform, Custom), task-type criteria table, recording format, and model routing hard rule.
- [ ] P2-B 🔄 `[GPT 5.4]` — **S3: Test gates per task and per checkpoint.** In `plan-execution-protocol.md` §9, after the "Local Preflight Integration" table, add a new "Per-Task and Per-Checkpoint Test Gates" subsection formalizing L1 after every task, L2 at every commit checkpoint, and max 2 retry attempts before STOP.
- [ ] P2-C 🔄 `[GPT 5.4]` — **S5: PR Closeout Protocol.** In `plan-execution-protocol.md` §14, extend the "Iteration Close-Out Procedure" to add: (a) finalization commit for last PR in multi-PR plans, (b) backlog artifact archival, (c) link update requirement, (d) closeout checklist for PR body, (e) stacked PRs rule (only last PR does closeout).

> 📌 **Commit checkpoint — Phase 2 complete.** Suggested message: `docs(ops): add model assignment, test gates, and PR closeout to plan-execution-protocol`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

### Phase 3 — Router regeneration and validation

- [ ] P3-A 🔄 `[GPT 5.4]` — **Regenerate router files.** Run `python scripts/docs/generate-router-files.py`. Stage and verify the regenerated files reflect the new canonical content.

> 📌 **Commit checkpoint — Phase 3 complete.** Suggested message: `docs(router): regenerate router files from updated canonical sources`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

### Phase 4 — Final validation

- [ ] P4-A 🔄 `[GPT 5.4]` — **Cross-check consistency.** Read both canonical files end-to-end and verify: (a) commit checkpoint format is defined in §2, (b) PR-first order rule exists in §5, (c) integration table and merge strategy are in §5, (d) Model Assignment is in §7, (e) test gates are in §9, (f) closeout protocol is in §14. Report PASS/FAIL per item.
- [ ] P4-B 🚧 — **Hard-gate: user validates final canonical text.** Present acceptance criteria checklist. Wait for explicit approval.

### Phase 5 — Closeout

- [ ] P5-A 🔄 `[GPT 5.4]` — **Closeout commit.** Move plan folder to `plans/completed/`. Move `imp-05-plan-creation-protocol-enhancements.md` to `Backlog/completed/`. Update relative links. Verify with `git diff --name-status main...HEAD`.

> 📌 **Commit checkpoint — Phase 5 complete.** Suggested message: `docs(closeout): archive IMP-05 plan and backlog artifacts`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

---

## Prompt Queue

### Prompt 1 — P1-A: Commit checkpoint blockquote format (S1)

**Step:** P1-A
**File:** `docs/projects/veterinary-medical-records/03-ops/plan-creation.md`

**Instructions:**

1. Open `plan-creation.md`. Locate §2 "Plan Scope Principle (Hard Rule)", subsection "Required inline commit recommendation format" (ends with the line about `CT-*` prohibition).

2. After that subsection (before the `---` separator to §3), insert:

   ```markdown
   ### Commit checkpoint blockquote format

   When a plan includes commit checkpoint recommendations, use this blockquote format:

   > 📌 **Commit checkpoint — <Phase/group> complete.** Suggested message: `<type>(<scope>): <description>`. Run L2 tests; if red, fix and re-run until green. Then wait for user.

   Rules:
   - Checkpoint blockquotes are guidance, not executable checklist items (consistent with the Plan Scope Principle).
   - Place checkpoints after the last step of a logical group or phase.
   - The suggested commit message must follow [way-of-working.md §3](../../shared/03-ops/way-of-working.md) conventions.
   - The L2 reference is `scripts/ci/test-L2.ps1 -BaseRef main`.
   ```

3. Verify: the new subsection sits between the existing commit recommendation format and the §3 separator.

---

### Prompt 2 — P1-B: PR-first planning order (S6)

**Step:** P1-B
**File:** `docs/projects/veterinary-medical-records/03-ops/plan-creation.md`

**Instructions:**

1. Open `plan-creation.md`. Locate §5 "Pull Request Policy in Plans". Find the line `- During plan creation, the planning agent MUST estimate the required number of PRs and record that decision in \`## PR Roadmap\`.`

2. Immediately after that bullet, insert:

   ```markdown
   - **PR-first planning order (hard rule):** When a plan may span multiple PRs, determine PR boundaries and record them in `## PR Roadmap` **before** writing `## Execution Status` and commit checkpoints. Post-hoc PR partitioning risks misaligned checkpoints and step-to-PR tag inconsistencies.
   ```

3. Verify: the new rule appears before the "PR sizing and split criteria" subsection.

---

### Prompt 3 — P1-C: Integration strategy table and merge strategy (S4)

**Step:** P1-C
**File:** `docs/projects/veterinary-medical-records/03-ops/plan-creation.md`

**Instructions:**

1. Open `plan-creation.md`. Locate the block that starts with `When \`## PR Roadmap\` is present:` (currently has 3 bullets about section location, `[PR-X]` tags, and annex files).

2. After the existing 3 bullets, append the following content (still under the "When `## PR Roadmap` is present" block, before the `### Plan-start requirement` subsection):

   ```markdown

   #### Integration strategy table (mandatory)

   The roadmap MUST open with:
   1. A one-line summary stating the total number of PRs.
   2. A **Merge strategy** declaration.
   3. An integration table with these exact columns:

   | Column | Content |
   |---|---|
   | PR | PR identifier (`PR-1`, `PR-2`, …) |
   | Branch | Branch name for this PR |
   | Scope | One-line description of what this PR delivers |
   | Depends on | Other PR identifiers this PR depends on, or `None` |
   | Status | `Not started` · `In progress` · `Open` · `Merged` |
   | URL | PR URL when created, otherwise `—` |

   Example:

   ```
   Delivery split into 3 sequential PRs.
   Merge strategy: Sequential.

   | PR | Branch | Scope | Depends on | Status | URL |
   |---|---|---|---|---|---|
   | PR-1 | feat/foo-api | Backend API + unit tests | None | In progress | — |
   | PR-2 | feat/foo-frontend | Frontend + E2E tests | PR-1 | Not started | — |
   | PR-3 | feat/foo-docs | Documentation + closeout | PR-2 | Not started | — |
   ```

   For plans with a single PR, the `**PR:**` metadata field remains sufficient and the integration strategy table is optional.

   #### Merge strategy definitions

   | Strategy | Rule | When to use |
   |---|---|---|
   | `Independent` | PRs merge to `main` in any order | PRs touch disjoint areas with no code dependency |
   | `Sequential` | PR-N merges before PR-N+1; each targets `main` | PR-N+1 depends on code delivered by PR-N |
   | `Stacked-rebase` | PR-N+1 branches from PR-N; after merge of PR-N, rebase PR-N+1 onto `main` | Parallel development with linear dependency |

   Default: `Sequential` when any PR declares a dependency; `Independent` otherwise.

   #### URL traceability (hard rule)

   When a PR is created, update the integration table: set Status to `Open` and URL to the actual PR link (e.g., `[#221](https://github.com/…/pull/221)`). A plan with an open or merged PR whose URL column still shows `—` is a compliance failure.
   ```

3. Verify: the three new subsubsections (`Integration strategy table`, `Merge strategy definitions`, `URL traceability`) appear under the `When \`## PR Roadmap\` is present` block, before `### Plan-start requirement`.

---

### Prompt 4 — P2-A: Model Assignment plan-start choice (S2)

**Step:** P2-A
**File:** `docs/projects/veterinary-medical-records/03-ops/plan-execution-protocol.md`

**Instructions:**

1. Open `plan-execution-protocol.md`. Locate §7 "Plan Governance". Find the end of the "Automation Mode Selection (Mandatory Plan-Start Choice)" subsection (ends just before the `---` separator to §8).

2. Insert the following new subsection **after** Automation Mode Selection and **before** the `---` separator:

   ```markdown
   ### Model Assignment (Mandatory Plan-Start Choice)

   Before executing the first step of a plan, the agent must ask the user to select the model assignment mode.

   **Options:**
   1. **Default** — Planning agent uses the most-capable available model; Execution agent uses the standard-cost model.
   2. **Uniform** — Both roles use the standard-cost model.
   3. **Custom** — User specifies which model to use for each role.

   **Mandatory behavior:**
   - Ask the user to choose one mode before step 1 starts.
   - If the interaction environment does not support option selectors, present the options as numbered text and accept the user's text reply.
   - Record the selected mode in the active plan source file.
   - Record format: `**Model Assignment:** <selected-mode>`
   - If the user does not choose, default to **Default**.
   - The selected mode applies to the full plan unless the user explicitly changes it.

   #### Task-type criteria for model tags

   | Task type | Assigned model | Rationale |
   |---|---|---|
   | Read-only verification, prerequisite checks, baseline snapshots, evidence recording, documentation | Standard | Low complexity, structured output |
   | Test writing, scaffolding, mechanical extraction, wiring, validation, dead code removal, cleanup | Standard | Good for structured code tasks |
   | High-complexity decomposition, deep conditional logic refactoring, behavior-preserving rewrites of high-CC code | Most-capable | Justified only for tasks requiring deep reasoning |
   | Hard-gates (🚧) | No tag | User decision, not model-dependent |

   Use the most-capable model only when the step involves decomposing functions with cyclomatic complexity > 30, rewriting deeply nested conditional logic, or tasks where behavioral equivalence is hard to verify mechanically. Default to the standard model when in doubt.

   #### Model routing rule (hard rule)

   Each step in Execution Status carries a `[Model]` tag (e.g., `[GPT 5.4]`, `[Claude Opus 4.6]`). On step completion, check the `[Model]` tag of the next pending step. If it differs from the current model, STOP immediately and tell the user:

   > "Next step recommends [Model X]. Switch to that model and say 'continue'."

   Do NOT auto-chain across model boundaries.
   ```

3. Verify: the four mandatory plan-start choices are now Worktree, CI Mode, Automation Mode, and Model Assignment.

---

### Prompt 5 — P2-B: Test gates per task and per checkpoint (S3)

**Step:** P2-B
**File:** `docs/projects/veterinary-medical-records/03-ops/plan-execution-protocol.md`

**Instructions:**

1. Open `plan-execution-protocol.md`. Locate §9 "Format-Before-Commit (Mandatory)". Find the "Local Preflight Integration" table (ends just before `### User Validation Environment`).

2. After the Local Preflight Integration table and before `### User Validation Environment`, insert:

   ```markdown
   ### Per-Task and Per-Checkpoint Test Gates (Hard Rule)

   In addition to the SCOPE BOUNDARY preflight levels above, agents MUST run tests at these granularities during plan execution:

   | Trigger | Level | Command | On failure |
   |---|---|---|---|
   | After completing any plan task | L1 | `scripts/ci/test-L1.ps1 -BaseRef HEAD` | Fix and re-run (max 2 attempts). On 3rd failure: STOP and report to user. |
   | At every commit checkpoint (📌) | L2 | `scripts/ci/test-L2.ps1 -BaseRef main` | Fix and re-run (max 2 attempts). On 3rd failure: STOP and report to user. |

   These gates complement the SCOPE BOUNDARY preflight levels. The per-task L1 gate ensures each individual task leaves the codebase in a passing state before proceeding to the next task. The per-checkpoint L2 gate validates the cumulative branch state before the user is asked to commit.
   ```

3. Verify: the new subsection sits between "Local Preflight Integration" and "User Validation Environment".

---

### Prompt 6 — P2-C: PR Closeout Protocol (S5)

**Step:** P2-C
**File:** `docs/projects/veterinary-medical-records/03-ops/plan-execution-protocol.md`

**Instructions:**

1. Open `plan-execution-protocol.md`. Locate §14 "Iteration Lifecycle Protocol", subsection "Iteration Close-Out Procedure (Pre-Merge)". Find the existing numbered list (items 1–8).

2. After item 8 ("Mirror to docs repository"), add the following:

   ```markdown

   #### Finalization commit for multi-PR plans

   When a plan spans multiple PRs, the **last PR in the series** must include a finalization commit as its final commit before merge. This commit:

   1. **Moves the plan folder** to `plans/completed/`.
   2. **Moves the backlog artifact** (`US-*.md`, `IMP-*.md`, `ARCH-*.md`, or equivalent) to `Backlog/completed/` — if the artifact exists and the work is fully done.
   3. **Updates every relative link** in surrounding docs that pointed to the old paths so they resolve to the new `completed/` locations.
   4. If any of the above does not apply, states `N/A` explicitly in the commit message body.

   **Commit message:** `docs(closeout): archive <plan-slug> and backlog artifacts`

   **Stacked PRs rule:** Only the last PR of the stack performs the closeout move. Intermediate PRs must NOT move artifacts to `completed/`; doing so breaks link resolution in sibling branches that haven't rebased yet.

   **Validation before push:**
   - Run doc-contract / doc-link tests locally and confirm green.
   - Verify with `git diff --name-status main...HEAD` that the expected `R` (rename) or `D`+`A` entries appear for the moved files.

   **PR closeout checklist (add to last PR body):**
   ```markdown
   ### Closeout
   - [ ] Plan moved to `completed/` (or N/A)
   - [ ] Backlog artifact moved to `completed/` (or N/A)
   - [ ] Relative links updated after move
   - [ ] Doc-contract tests pass locally
   ```
   ```

3. Verify: the new subsection appears after item 8 and before `### Merge (Automatic, After Close-Out)`.

---

### Prompt 7 — P3-A: Router regeneration

**Step:** P3-A
**Files:** Generated router files under `docs/agent_router/`

**Instructions:**

1. Run: `python scripts/docs/generate-router-files.py`
2. Check which files were modified: `git diff --name-only`
3. Stage the modified router files.
4. Verify no unexpected files were changed.

---

### Prompt 8 — P4-A: Cross-check consistency

**Step:** P4-A
**Files:** Both canonical docs (read-only validation)

**Instructions:**

1. Read `plan-creation.md` and verify:
   - (a) §2 contains "Commit checkpoint blockquote format" subsection.
   - (b) §5 contains PR-first planning order rule.
   - (c) §5 contains integration strategy table, merge strategy definitions, and URL traceability subsections.

2. Read `plan-execution-protocol.md` and verify:
   - (d) §7 contains "Model Assignment (Mandatory Plan-Start Choice)" subsection with options (Default, Uniform, Custom), criteria table, and routing rule.
   - (e) §9 contains "Per-Task and Per-Checkpoint Test Gates" subsection with L1/L2 gates and retry limits.
   - (f) §14 contains "Finalization commit for multi-PR plans" subsection with closeout procedure and stacked PRs rule.

3. Report PASS/FAIL per item (a–f). If any FAIL, fix before proceeding.

---

### Prompt 9 — P4-B: User validation hard-gate 🚧

**Step:** P4-B
**Files:** None (user review)

**Instructions:**

Present the user with the acceptance criteria checklist:

- [ ] `plan-creation.md` includes commit checkpoint blockquote format (S1).
- [ ] `plan-creation.md` includes PR-first planning order rule (S6).
- [ ] `plan-creation.md` includes integration strategy table, merge strategy definitions, and URL traceability (S4).
- [ ] `plan-execution-protocol.md` includes Model Assignment plan-start choice with routing rule (S2).
- [ ] `plan-execution-protocol.md` includes per-task L1 and per-checkpoint L2 test gates with retry limits (S3).
- [ ] `plan-execution-protocol.md` includes PR Closeout Protocol in Iteration Close-Out (S5).
- [ ] Router files regenerated and passing.
- [ ] A new plan created with "Create the plan for the attached document" would not need ad-hoc overrides.

Wait for explicit user approval.

---

### Prompt 10 — P5-A: Closeout commit

**Step:** P5-A
**Files:** Plan folder, backlog artifact, surrounding links

**Instructions:**

1. Move plan folder:
   ```powershell
   git mv "docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_2026-03-10_IMP-05-PLAN-CREATION-PROTOCOL-ENHANCEMENTS" "docs/projects/veterinary-medical-records/04-delivery/plans/completed/PLAN_2026-03-10_IMP-05-PLAN-CREATION-PROTOCOL-ENHANCEMENTS"
   ```

2. Move backlog artifact:
   ```powershell
   git mv "docs/projects/veterinary-medical-records/04-delivery/Backlog/imp-05-plan-creation-protocol-enhancements.md" "docs/projects/veterinary-medical-records/04-delivery/Backlog/completed/imp-05-plan-creation-protocol-enhancements.md"
   ```

3. Search for relative links pointing to the old paths and update them.

4. Verify:
   ```powershell
   git diff --name-status main...HEAD
   ```
   Confirm `R` (rename) entries for the moved files.

5. Run doc-contract tests: `scripts/ci/test-L2.ps1 -BaseRef main`

---

## Active Prompt

Pending plan approval.

---

## Acceptance Criteria

From [IMP-05 backlog item](../../Backlog/imp-05-plan-creation-protocol-enhancements.md):

1. `plan-creation.md` includes commit checkpoint format, integration strategy table, merge strategy definitions, URL traceability rule, and PR-first planning order.
2. `plan-execution-protocol.md` includes Model Assignment plan-start choice with routing rule, formalized L1/L2 test gates per task/checkpoint with retry limits, and expanded close-out procedure with PR Closeout Protocol.
3. A new plan created after these changes requires no ad-hoc prompt overrides beyond "Create the plan for the attached document."
4. Router files regenerated from updated canonical sources pass doc-contract tests.

---

## How to test

1. After merging, open a new chat and say: "Create the plan for the attached document" (attaching any backlog item).
2. Verify the agent produces a plan with:
   - Commit checkpoints in `📌` blockquote format.
   - Model tags on every execution step.
   - Integration strategy table in `## PR Roadmap` (if multi-PR).
   - Merge strategy declared.
   - Test gate references (L1 per task, L2 per checkpoint).
   - Closeout step in the last phase.
3. Confirm no ad-hoc override rules were needed.

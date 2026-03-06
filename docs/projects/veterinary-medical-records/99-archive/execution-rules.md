<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

**Table of Contents** _generated with [DocToc](https://github.com/thlorenz/doctoc)_

- [Execution Rules — Shared Operational Rules for AI Plan Execution](#execution-rules--shared-operational-rules-for-ai-plan-execution)
  - [File structure](#file-structure)
  - [Strengths — DO NOT MODIFY WITHOUT EXPLICIT JUSTIFICATION](#strengths--do-not-modify-without-explicit-justification)
  - [Operational rules](#operational-rules)
    - [Semi-unattended execution (default mode — hard rule)](#semi-unattended-execution-default-mode--hard-rule)
    - [Atomic iterations](#atomic-iterations)
    - [Extended execution state (pending / in-progress / blocked / completed)](#extended-execution-state-pending--in-progress--blocked--completed)
    - [Step eligibility rule (hard rule — applies before any other)](#step-eligibility-rule-hard-rule--applies-before-any-other)
    - ["Continúa-only" rule](#contin%C3%BAa-only-rule)
    - [Rollback](#rollback)
    - [Plan = agents only](#plan--agents-only)
    - [Plan scope principle (hard rule)](#plan-scope-principle-hard-rule)
    - [PR progress tracking (mandatory)](#pr-progress-tracking-mandatory)
    - [CI verification (mandatory — hard rule)](#ci-verification-mandatory--hard-rule)
  - [Step completion integrity (hard rules — added 2026-02-26)](#step-completion-integrity-hard-rules--added-2026-02-26)
    - [NO-BATCH (hard rule)](#no-batch-hard-rule)
    - [CI-PIPELINE (pipeline execution for 🔄 auto-chain steps)](#ci-pipeline-pipeline-execution-for--auto-chain-steps)
      - [Core principle](#core-principle)
      - [Flow](#flow)
      - [Rules](#rules)
      - [Cancelled CI runs](#cancelled-ci-runs)
      - [CI-FIRST still required for](#ci-first-still-required-for)
    - [PLAN-UPDATE-IMMEDIATE (hard rule)](#plan-update-immediate-hard-rule)
    - [STEP-LOCK (explicit state — hard rule)](#step-lock-explicit-state--hard-rule)
    - [EVIDENCE BLOCK (mandatory on every step close)](#evidence-block-mandatory-on-every-step-close)
    - [AUTO-HANDOFF GUARD (hard rule)](#auto-handoff-guard-hard-rule)
    - [Format-before-commit (mandatory — hard rule)](#format-before-commit-mandatory--hard-rule)
    - [Local preflight integration (mandatory — maps SCOPE BOUNDARY to L1/L2/L3)](#local-preflight-integration-mandatory--maps-scope-boundary-to-l1l2l3)
    - [Iteration boundary (mandatory — hard rule)](#iteration-boundary-mandatory--hard-rule)
    - [Next-step message (mandatory — hard rule)](#next-step-message-mandatory--hard-rule)
    - [Token-efficiency policy (mandatory)](#token-efficiency-policy-mandatory)
  - [Plan-edit-last (hard constraint)](#plan-edit-last-hard-constraint)
    - [Hard-gates: structured decision protocol](#hard-gates-structured-decision-protocol)
  - [Prompt strategy](#prompt-strategy)
    - ["Continúa" protocol](#contin%C3%BAa-protocol)
    - [Next-step instructions (rule for all agents)](#next-step-instructions-rule-for-all-agents)
    - [Routing for continuation intent](#routing-for-continuation-intent)
  - [SCOPE BOUNDARY template (two-commit strategy)](#scope-boundary-template-two-commit-strategy)
    - [STEP 0 — BRANCH VERIFICATION (before any code change)](#step-0--branch-verification-before-any-code-change)
    - [STEP A — Commit code (plan file untouched)](#step-a--commit-code-plan-file-untouched)
    - [STEP B — Commit plan update (only after code is committed)](#step-b--commit-plan-update-only-after-code-is-committed)
    - [STEP C — Push both commits](#step-c--push-both-commits)
    - [STEP D — Update active PR description](#step-d--update-active-pr-description)
    - [STEP E — CI GATE (mandatory — do NOT skip)](#step-e--ci-gate-mandatory--do-not-skip)
    - [STEP F — CHAIN OR STOP (mandatory)](#step-f--chain-or-stop-mandatory)
  - [Iteration lifecycle protocol](#iteration-lifecycle-protocol)
    - [Branch creation (mandatory — before ANY plan step)](#branch-creation-mandatory--before-any-plan-step)
    - [PR readiness (automatic — not a plan step)](#pr-readiness-automatic--not-a-plan-step)
    - [Merge + post-merge cleanup (automatic — not a plan step)](#merge--post-merge-cleanup-automatic--not-a-plan-step)
    - [Iteration close-out protocol (automatic — not a plan step)](#iteration-close-out-protocol-automatic--not-a-plan-step)
      - [1. Plan reconciliation (mandatory if any steps are `[ ]`)](#1-plan-reconciliation-mandatory-if-any-steps-are--)
      - [2. Update IMPLEMENTATION_HISTORY.md (mandatory)](#2-update-implementation_historymd-mandatory)
      - [3. Rename plan → completed archive (mandatory)](#3-rename-plan-%E2%86%92-completed-archive-mandatory)
      - [4. DOC_UPDATES normalization (conditional)](#4-doc_updates-normalization-conditional)
      - [5. Commit + push + PR](#5-commit--push--pr)
      - [6. Mirror to docs repository (if applicable)](#6-mirror-to-docs-repository-if-applicable)
  - [Commit conventions](#commit-conventions)
  - [Output format (per iteration finding)](#output-format-per-iteration-finding)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Execution Rules — Shared Operational Rules for AI Plan Execution

**Breadcrumbs:** [Docs](../../../README.md) / [Projects](../../README.md) / veterinary-medical-records / 99-archive

> **⚠️ Archived (2026-03-06).** Content fully absorbed into [plan-execution-protocol.md](../03-ops/plan-execution-protocol.md), [plan-management.md](../03-ops/plan-management.md), and [way-of-working.md](../../shared/04-delivery/way-of-working.md). Kept for reference only.

> ~~**Canonical source:** This file governs how AI agents execute plan steps across all iterations.~~
> ~~Referenced by `AGENTS.md`. Do not duplicate these rules elsewhere.~~

## File structure

```
docs/projects/veterinary-medical-records/04-delivery/plans/
├── EXECUTION_RULES.md              ← YOU ARE HERE
├── IMPLEMENTATION_HISTORY.md       ← Timeline of all iterations
├── PLAN_<date>_<slug>.md           ← Active iteration plans
├── completed/                      ← Finished iterations
│   └── COMPLETED_<date>_<slug>.md
```

**Active plan file:** The agent attaches the relevant `PLAN_*.md` file when executing `Continúa`.
Each plan file contains: Execution Status (checkboxes), Prompt Queue, Active Prompt, and iteration-specific context.

**PR Roadmap:** When a plan spans multiple PRs, it must include a `## PR Roadmap` section mapping phases to PRs. See [`ENGINEERING_PLAYBOOK.md § Plan-level PR Roadmap`](../../../shared/ENGINEERING_PLAYBOOK.md#plan-level-pr-roadmap) for the mandatory format.

---

## Strengths — DO NOT MODIFY WITHOUT EXPLICIT JUSTIFICATION

These areas score high with evaluators. Any change must preserve them:

| Area                               | What to protect                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| **Hexagonal backend architecture** | `domain/` pure (frozen dataclasses), ports with `Protocol`, composition in `main.py`       |
| **Docker setup**                   | `docker compose up --build` functional, healthchecks, test profiles, dev overlay           |
| **CI pipeline**                    | 6 jobs: brand, design system, doc/test parity, docker packaging, quality, frontend         |
| **Documentation**                  | `docs/README.md` with reading order, TECHNICAL_DESIGN.md (1950 lines), extraction-tracking |
| **Incremental evidence**           | PR storyline (157+ PRs traced), golden field iterations, run parity reports                |

---

## Operational rules

### Semi-unattended execution (default mode — hard rule)

The default execution mode is **semi-unattended**. After completing a task
(CI green, step marked `[x]`, PR updated), the agent applies the
**[decision table](#next-step-instructions-rule-for-all-agents)** to determine
whether to chain or stop.

**Safety limit:** if the agent detects context exhaustion (truncated responses,
state loss), it must stop at the current step, complete it cleanly (full SCOPE
BOUNDARY) and generate the handoff. The next chat resumes from the first `[ ]`.

> **Note:** this mode is compatible with the `Continúa` protocol. If the user
> opens a new chat and writes `Continúa`, the agent executes one step and then
> evaluates whether it can chain. The difference is that the agent no longer
> stops mandatorily after every step.

### Atomic iterations

L Never mix scope between steps. Each step in Execution Status is an atomic unit: execute, commit, push, mark `[x]`. If it fails, report — do not continue to the next one.

### Extended execution state (pending / in-progress / blocked / completed)

For visibility and traceability, it is **mandatory** to mark the active step with `⏳ IN PROGRESS` **without changing the base checkbox**.

- **Pending:** `- [ ] F?-? ...`
- **In progress:** `- [ ] F?-? ... ⏳ IN PROGRESS (<agent>, <date>)`
- **Blocked:** `- [ ] F?-? ... 🚫 BLOCKED (<short reason>)`
- **Step locked:** `- [ ] F?-? ... 🔒 STEP LOCKED (code committed, awaiting CI + plan update)`
- **Completed:** `- [x] F?-? ...`

Mandatory rules:

1. Do not use `[-]`, `[~]`, `[...]` or variants: only `[ ]` or `[x]`.
2. Before executing a `[ ]` step, the agent must mark it `⏳ IN PROGRESS (<agent>, <date>)`.
3. `IN PROGRESS` and `BLOCKED` are text labels at the end of the line, not checkbox states.
4. On completion, remove any label (`IN PROGRESS`/`BLOCKED`/`STEP LOCKED`) and mark `[x]`.
5. On completion, **append the code commit short SHA** to the line for traceability:
   `- [x] F?-? 🔄 — Description (Agent) — ✅ \`abc1234f\``
   If the step produced multiple commits (e.g. fix after CI failure), record the final one.
6. For `BLOCKED`, include brief reason and next action if applicable.
7. After code commit but before CI green + plan update, mark `🔒 STEP LOCKED`. While locked, **no other step may begin** and **no handoff may be emitted**.

### Step eligibility rule (hard rule — applies before any other)

**If the user writes `Continúa`:**

1. Read the Execution Status in the active plan file and find the first `[ ]` (includes lines with `⏳ IN PROGRESS` or `🚫 BLOCKED` labels).
2. Apply the **[decision table](#next-step-instructions-rule-for-all-agents)** to determine the action (auto-chain, stop, or report).
3. If ambiguous: STOP and ask the user for clarification.

### "Continúa-only" rule

**When the user writes `Continúa`, the agent executes ONLY what the plan dictates (Execution Status + corresponding prompt).** If the user's message includes additional instructions alongside "Continúa" (e.g. "Continúa, but don't touch X" or "Continúa and also do Y"), the agent must:

1. **Ignore the extra instructions.**
2. Respond: "⚠️ The Continúa protocol executes exactly the next step in the plan. If you need to change the scope, tell the planning agent first so it can update the plan and the prompt."
3. Not execute anything until the user confirms with a clean `Continúa`.

### Rollback

If a completed step causes an issue not detected by tests:

1. `git revert HEAD` (reverts commit without losing history)
2. Edit Execution Status: change `[x]` back to `[ ]` for the affected step
3. Report to the planning agent for diagnosis before retrying

### Plan = agents only

**The user does NOT edit plan files manually.** Only the agents modify `PLAN_*.md` files. If the user needs to change something (e.g. add a step, fix a typo), they ask the planning agent and it makes the edit + commit.

### Plan scope principle (hard rule)

**Plans (`PLAN_*.md`) contain ONLY product/engineering tasks** — the work that produces deliverable value (code, tests, configuration, documentation content). **Operational protocol is NEVER a plan step.**

| ✅ Valid plan step                          | ❌ NOT a plan step   |
| ------------------------------------------- | -------------------- |
| "Add Playwright smoke test for upload flow" | "Commit and push"    |
| "Configure CI job for E2E tests"            | "Create PR"          |
| "Add data-testid attributes to components"  | "Merge PR"           |
| "Write ADR for architecture decision"       | "Post-merge cleanup" |

Operational protocol (commit, push, PR creation, merge, post-merge cleanup, branch management) is defined exclusively in this file (`EXECUTION_RULES.md`) and agents execute it automatically as part of SCOPE BOUNDARY and iteration lifecycle.

**Why:** When operational steps appear in a plan, agents treat them as tasks requiring explicit prompts and checkboxes, which conflicts with the automatic protocol in SCOPE BOUNDARY. This causes duplication, skipped protocol steps, and confusion about when to execute operational procedures.

### PR progress tracking (mandatory)

**Every completed step must be reflected in the active PR for the current iteration.** After finishing the SCOPE BOUNDARY (after push), the agent updates the PR body with `gh pr edit <pr_number> --body "..."`. This is mandatory for all agents. If the command fails, report to the user but do NOT block the step.

### CI verification (mandatory — hard rule)

**No step is considered completed until GitHub CI is green.** Local tests are necessary but NOT sufficient. After push, the agent MUST:

1. Check CI status of the previous step (see CI-PIPELINE rule).
2. If CI fails: diagnose, fix, push and wait again.
3. Only after CI green: declare the step completed to the user.
4. If unable to fix CI after 2 attempts: STOP and ask for help.

Under CI-PIPELINE, the agent may start **local work** on the next step while CI runs,
but must not **commit** the next step until the previous step's CI is green.

---

## Step completion integrity (hard rules — added 2026-02-26)

> **Origin:** Post-mortem of Iter 9 process violation where Codex batched steps,
> skipped CI verification, and emitted handoff before CI was green.
> These rules close every identified gap.

### NO-BATCH (hard rule)

**Prohibited: pushing code for multiple plan steps in a single commit.**
Each step gets its own commit. This ensures atomicity and traceability.
The agent MAY start _working_ on the next step before CI is green (see [CI-PIPELINE](#ci-pipeline-pipeline-execution-for--auto-chain-steps)),
but each step's code must be a separate commit+push.

### CI-PIPELINE (pipeline execution for 🔄 auto-chain steps)

> **Origin:** CI wait time was the main bottleneck in iteration velocity. This
> rule eliminates idle time while keeping at most one step of drift.

#### Core principle

**Do not wait for CI between auto-chain steps.** Commit, push, and immediately
start working on the next step. CI is checked _before committing_ the next step,
not before _starting work_ on it.

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

1. **After committing step N:** push and start working on step N+1 **immediately**. Do not wait for CI.
2. **Before committing step N+1:** check CI status of step N:
   - ✅ Green → proceed to commit N+1.
   - ❌ Red → `git stash` → fix step N → `git commit --amend` → `git push --force` → `git stash pop`.
     After pushing the fix, **resume immediately** with step N+1 (do not wait for the fix CI).
     The fix will be validated at the next CI checkpoint (before committing step N+2).
3. **A step is NOT marked `[x]` until its CI run is green.** The plan-update commit happens after CI green, per [PLAN-UPDATE-IMMEDIATE](#plan-update-immediate-hard-rule).
4. **Always run the targeted preflight level** for step N+1's area before committing, regardless of CI result.
   Use the **L1/L2/L3 preflight system** (see [Way of Working § Local Preflight Levels](../../../shared/03-ops/way-of-working.md#4-local-preflight-levels)) as the primary validation tool. The table below lists the individual commands that each level covers — use them for focused debugging, but prefer running the appropriate preflight level as a single command.

   | Preflight level | When to run               | Command                                |
   | --------------- | ------------------------- | -------------------------------------- |
   | **L1 — Quick**  | Before each commit        | `scripts/ci/test-L1.ps1 -BaseRef HEAD` |
   | **L2 — Push**   | Before each push          | `scripts/ci/test-L2.ps1 -BaseRef main` |
   | **L3 — Full**   | Before PR creation/update | `scripts/ci/test-L3.ps1 -BaseRef main` |

   <details>
   <summary>Individual commands (for targeted debugging)</summary>

   | Change type                 | Command                                                                     |
   | --------------------------- | --------------------------------------------------------------------------- |
   | Backend — single module     | `cd backend && python -m pytest tests/test_<module>.py -x -q --tb=short`    |
   | Backend — benchmarks        | `cd backend && python -m pytest tests/benchmarks/ -v --benchmark-enable`    |
   | Frontend — single component | `cd frontend && npx vitest run src/components/<Component>.test.tsx`         |
   | Frontend — single lib       | `cd frontend && npx vitest run src/lib/__tests__/<file>.test.ts`            |
   | E2E — single spec           | `cd frontend && npx playwright test <spec-name>.spec.ts --project=core`     |
   | E2E — extended spec         | `cd frontend && npx playwright test <spec-name>.spec.ts --project=extended` |
   | Docs/CI only                | No local tests needed                                                       |

   </details>

   **Exceptions — run the full suite locally when:**
   - The change touches shared infrastructure (`conftest.py`, test helpers, `vite.config.ts`, `playwright.config.ts`).
   - The change touches composition root (`main.py`) or configuration (`config.py`).
   - You are unsure which tests are affected — run the directory, not the entire suite.

5. **Maximum pipeline depth: 1.** Never start step N+2 without CI of step N verified.
6. **Hard-gates (🚧)** require CI green for ALL pending steps before proceeding.
7. **Force-push is allowed** only on feature branches where a single agent is working.

#### Cancelled CI runs

The CI workflow uses `cancel-in-progress: true` — a new push cancels the running
CI for the same branch. With pipeline execution, a rapid push sequence (A → B)
cancels CI-A before it finishes. This is **expected and safe**:

- CI-B validates the cumulative code (A + B). If CI-B is green, A is implicitly validated.
- When checking CI status "of step N", accept the **most recent completed green run**
  on the branch, even if it was triggered by a later push.
- If the only completed run is cancelled (not green, not red), wait for the next
  run to finish or re-trigger with an empty commit (`git commit --allow-empty`).

#### CI-FIRST still required for

- Hard-gate (🚧) steps
- The last step of an iteration (before merge — verify CI green)

### PLAN-UPDATE-IMMEDIATE (hard rule)

**After CI green for a step, the very next commit MUST be the plan update
(`[ ]` → `[x]`).** No intermediate code commits are allowed between CI green
and the plan-update commit. Sequence:

1. Code commit (STEP A)
2. Push (STEP C)
3. CI green (STEP E)
4. Plan-update commit (STEP B) — **immediately, nothing in between**
5. Push plan update
6. Only then: proceed to STEP F (chain or handoff)

### STEP-LOCK (explicit state — hard rule)

When a step has a code commit pushed but CI has not yet passed and/or the plan
has not been updated, the step enters **🔒 STEP LOCKED** state.

- Mark in the plan: `- [ ] F?-? ... 🔒 STEP LOCKED (code committed, awaiting CI + plan update)`
- While any step is LOCKED:
  - **No other step may begin execution** (except under CI-PIPELINE rule §1, where the agent starts local work while CI runs).
  - **No handoff may be emitted.**
  - **No auto-chain commit may occur** until CI of the locked step is verified.
- The lock is released only when CI is green AND the plan-update commit is pushed.
- Then remove the `🔒 STEP LOCKED` label and mark `[x]`.

### EVIDENCE BLOCK (mandatory on every step close)

Every step completion message (the response to the user after finishing a step)
**MUST** include an evidence block with these 4 fields:

```
📋 Evidence:
- Step: F?-?
- Code commit: <SHA>
- CI run: <run_id> — <conclusion (success/failure)>
- Plan commit: <SHA>
```

If any field is missing, **the step is NOT considered completed** and the agent
must not proceed to STEP F. This block provides auditable proof that the full
sequence was followed.

### AUTO-HANDOFF GUARD (hard rule)

Before emitting ANY handoff or auto-chain message, the agent MUST perform this
validation:

1. Is the most recent CI run for the current branch **green**? → Check with
   `gh run list --branch <branch> --limit 1 --json conclusion`.
2. Does the most recent commit on the branch correspond to the **plan-update
   commit** for the just-completed step? → Verify with `git log --oneline -1`.

| CI green? | Plan committed? | Action                                 |
| --------- | --------------- | -------------------------------------- |
| YES       | YES             | Proceed with handoff/chain             |
| YES       | NO              | Commit plan update first, then handoff |
| NO        | any             | **BLOCKED** — fix CI, do NOT handoff   |
| unknown   | any             | **WAIT** — poll CI, do NOT handoff     |

**If the guard fails, the agent stays in fix/watch mode until both conditions
are met.** This is the final safety net against premature handoffs.

---

### Format-before-commit (mandatory — hard rule)

**Before every `git commit`, the agent ALWAYS runs the project formatters:**

1. `cd frontend && npx prettier --write 'src/**/*.{ts,tsx,css}' && cd ..`
2. `ruff check backend/ --fix --quiet && ruff format backend/ --quiet`
3. If `git commit` fails (pre-commit hook rejects): re-run formatters, re-add, retry ONCE.
4. If it fails a second time: STOP and report to the user.

> **Tip:** Running `scripts/ci/test-L1.ps1 -BaseRef HEAD` covers formatting, linting, and doc guards in a single command. Agents may use L1 instead of the two manual commands above.

### Local preflight integration (mandatory — maps SCOPE BOUNDARY to L1/L2/L3)

The local preflight system (defined in [Way of Working § Local Preflight Levels](../../../shared/03-ops/way-of-working.md#4-local-preflight-levels)) provides three validation levels. Each SCOPE BOUNDARY moment has a **minimum required preflight level**:

| SCOPE BOUNDARY moment       | Min. level      | Command                                      |
| --------------------------- | --------------- | -------------------------------------------- |
| Before STEP A (commit)      | L1              | `scripts/ci/test-L1.ps1 -BaseRef HEAD`       |
| Before STEP C (push)        | L2              | `scripts/ci/test-L2.ps1 -BaseRef main`       |
| Before creating/updating PR | L3              | `scripts/ci/test-L3.ps1 -BaseRef main`       |
| Before merge to main        | Verify CI green | No local run needed — CI is a superset of L3 |

**Rules:**

- Each higher level is a superset: L2 includes L1 checks, L3 includes L2 checks.
- "Relevant change" is defined in the Engineering Playbook — any change that touches backend, frontend, E2E, or infrastructure.
- The pre-commit and pre-push hooks enforce L1/L2 automatically. L3 must be run manually.
- If a preflight level fails, fix the issues before proceeding. Do NOT bypass with `--no-verify`.

### Iteration boundary (mandatory — hard rule)

**Auto-chain NEVER crosses from one Phase/iteration to another.** When all tasks of the current Phase are `[x]`, the agent stops and returns control to the user, even if the next Phase already has prompts written. Starting a new iteration requires explicit user approval.

### Next-step message (mandatory — hard rule)

**On completing a step, the agent ALWAYS tells the user the next move with concrete instructions.** Never finish without saying which agent to use and what to do next. If there is no next step, say "All steps completed." Reference STEP F of the SCOPE BOUNDARY template.

### Token-efficiency policy (mandatory)

To avoid context explosion between chats and long steps, ALWAYS apply:

1. **iterative-retrieval** before executing each step: load only current state (`first [ ]`), step objective, target files, guardrails and relevant validation outputs.
2. **strategic-compact** at step close: summarize only the delta implemented, validation executed, open risks and next move.
3. Do not carry full chat history if not necessary for the active step.

> **Mandatory compact template:**
>
> - Step: F?-?
> - Delta: <concrete changes>
> - Validation: <tests/guards + result>
> - Risks/Open: <if applicable>

---

## Plan-edit-last (hard constraint)

**The execution agent does NOT edit the plan file until tests pass and code is committed.** The mandatory sequence is:

1. Commit code (without touching the plan)
2. Tests green (the commit exists, proving the code works)
3. Only then: edit the plan (mark `[x]`, clean Active Prompt) in a separate commit
4. Push both commits together

### Hard-gates: structured decision protocol

In 🚧 steps, the planning agent presents options as a numbered list:

```
Backlog items:
1. ✅ Centralize config in Settings class — Impact: High, Effort: S
2. ✅ Add health check endpoint — Impact: Medium, Effort: S
3. ❌ Migrate to PostgreSQL — Impact: High, Effort: L (OUT OF SCOPE)
```

The user responds ONLY with numbers: `1, 2, 4` or `all` or `none`.
The planning agent then records the decision, commits, prepares the implementation prompt, and directs the user to the execution agent.

---

## Prompt strategy

- **Pre-written prompts** (Prompt Queue): at iteration start, the planning agent writes prompts for all tasks whose content does not depend on the result of prior tasks. This enables semi-unattended execution: the execution agent chains consecutive steps reading directly from the Prompt Queue.
- **Just-in-time prompts** (Active Prompt): for tasks whose prompt depends on a prior task's result, the planning agent writes them in `## Active Prompt` when appropriate.
- **Prompt resolution** (priority order): Prompt Queue → Active Prompt → STOP (ask the planning agent).

### "Continúa" protocol

Each prompt includes at the end an instruction for the agent to:

1. Mark its step as completed in **Execution Status** (changing `[ ]` to `[x]`).
2. Auto-commit with the standardized message (without asking permission, informing the user of the commit made).
3. Stop.

### Next-step instructions (rule for all agents)

On completing a step, the agent ALWAYS tells the user the next move with concrete instructions.

**Decision table:**

| Prompt exists? | Hard-gate? | Action                                                                             |
| -------------- | ---------- | ---------------------------------------------------------------------------------- |
| YES            | NO         | **AUTO-CHAIN** — execute the next step directly.                                   |
| YES            | YES (🚧)   | **STOP** — report: "The next step is a hard-gate requiring user decision."         |
| NO             | NO         | **STOP** — report: "No prompt exists for F?-?. The planning agent must write one." |
| NO             | YES (🚧)   | **STOP** — report: "The next step is a hard-gate requiring user decision."         |

### Routing for continuation intent

When any agent receives `Continúa` with the plan file attached:

Follow the **[Step Eligibility Rule](#step-eligibility-rule-hard-rule--applies-before-any-other)** to determine and execute the next step. After execution, run STEP F of SCOPE BOUNDARY.

---

## SCOPE BOUNDARY template (two-commit strategy)

Execute these steps IN THIS EXACT ORDER. Do NOT reorder.

### STEP 0 — BRANCH VERIFICATION (before any code change)

1. Read the `**Branch:**` field from the current plan file.
2. Check current branch: `git branch --show-current`
3. If already on the correct branch: proceed to STEP A.
4. If not: checkout or create the branch as needed.
5. Verify: `git branch --show-current` must match the Rama field.

### STEP A — Commit code (plan file untouched)

0. **FORMAT PRE-FLIGHT (mandatory — run BEFORE staging):**

   ```
   cd frontend && npx prettier --write 'src/**/*.{ts,tsx,css}' && cd ..
   ruff check backend/ --fix --quiet
   ruff format backend/ --quiet
   ```

1. **DOC NORMALIZATION (conditional — only if .md files were changed):**
   Run `git diff --name-only -- '*.md'`. If .md files appear, execute the DOC_UPDATES normalization pass. Git add normalized files (excluding the plan file).
2. `git add -A -- . ':!docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_*.md'`
3. `git commit -m "<type>(plan-f?-?): <description>\n\nTest proof: <pytest summary> | <npm test summary>"`
   If commit fails: re-run formatters, re-add, retry ONCE. If fails again: STOP.

### STEP B — Commit plan update (only after code is committed)

1. Edit the active plan file: change `- [ ] F?-?` to `- [x] F?-?`.
2. Clean `## Active Prompt`: replace content with `_Completed: F?-?_` / `_Empty._`
3. `git add docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_*.md`
4. `git commit -m "docs(plan-f?-?): mark step done"`

### STEP C — Push both commits

1. `git push origin <active_iteration_branch>`
2. **First push of the iteration (no PR exists yet):** create a **draft** PR immediately:

   ```
   gh pr create --draft --base main \
     --title "<type>: <iteration title>" \
     --body "Tracking: PLAN_<date>_<slug>.md\n\n## Progress\n<initial checklist>"
   ```

   Record the PR number in the plan header (`**PR:** #<number>`) via a plan-update commit.
   This ensures CI runs against the branch from the very first push.

3. If a PR already exists: skip creation (proceed to STEP D).

### STEP D — Update active PR description

Update with `gh pr edit <pr_number> --body "..."`. Keep existing structure, mark the just-completed step with `[x]`, keep body under 3000 chars.

### STEP E — CI GATE (mandatory — do NOT skip)

1. `gh run list --branch <branch> --limit 1 --json status,conclusion,databaseId`
2. If in_progress/queued: wait 30s and retry (up to 10 retries).
3. If success: proceed to STEP F.
4. If failure: diagnose with `gh run view <id> --log-failed | Select-Object -Last 50`, fix, push, repeat.
5. If unable to fix after 2 attempts: STOP and ask for help.

### STEP F — CHAIN OR STOP (mandatory)

⚠️ **PRE-CONDITION:** STEP F may ONLY execute if STEP A completed successfully (code commit exists).

⚠️ **AUTO-HANDOFF GUARD (mandatory):** Before proceeding, run the guard check from § "Step completion integrity" → AUTO-HANDOFF GUARD. If CI is not green or plan is not committed, STOP here.

⚠️ **ITERATION BOUNDARY:** Before evaluating auto-chain, check if the NEXT unchecked `[ ]` step belongs to the same Phase/iteration. If it belongs to a DIFFERENT Phase: **STOP. Do NOT auto-chain across iteration boundaries.**

1. Next step = first `[ ]` in Execution Status.
2. Check: does it have a prompt? Is it a hard-gate?

| Prompt exists? | Hard-gate? | Action                                                                             |
| -------------- | ---------- | ---------------------------------------------------------------------------------- |
| YES            | NO         | **AUTO-CHAIN** — execute next prompt NOW                                           |
| YES            | YES (🚧)   | **STOP** — report: "The next step is a hard-gate requiring user decision."         |
| NO             | NO         | **STOP** — report: "No prompt exists for F?-?. The planning agent must write one." |
| NO             | YES (🚧)   | **STOP** — report: "The next step is a hard-gate requiring user decision."         |
| no steps left  | —          | "✓ All steps completed."                                                           |

**Context safety valve:** if context exhausted, complete current step cleanly and handoff.
NEVER end without telling the user what to do next.

---

## Iteration lifecycle protocol

The lifecycle of an iteration follows this sequence. All operational steps after SCOPE BOUNDARY are automatic — they are NOT plan tasks.

```
Branch creation  →  Plan steps  →  PR readiness  →  User approval  →  Merge + cleanup  →  Close-out
  [automatic]       [SCOPE BOUNDARY]  [automatic]     [hard-gate]       [automatic]       [automatic]
```

### Branch creation (mandatory — before ANY plan step)

**The very first action of every iteration is creating and switching to the feature branch.** This happens before writing prompts, before executing any step, and before any code change.

1. Read the `**Branch:**` field from the active plan file.
2. `git fetch origin`
3. `git checkout -b <rama> origin/main` (create from latest `main`).
4. Verify: `git branch --show-current` must match the Rama field.
5. If the branch already exists remotely: `git checkout <rama> && git pull origin <rama>`.

**This is NOT a plan step** — it is automatic infrastructure, like PR creation or merge cleanup. Agents execute it unconditionally on the first `Continúa` of an iteration.

### PR readiness (automatic — not a plan step)

When all steps of an iteration are `[x]` and CI is green on the last push:

1. The draft PR (created in STEP C on the first push) is converted to **ready for review**:

   ```
   gh pr ready <pr_number>
   ```

2. The agent updates title, body, classification, and UX/Brand compliance following `docs/shared/ENGINEERING_PLAYBOOK.md` (PR workflow section).
3. The agent reports the PR number and URL to the user.
4. This triggers a **hard-gate**: the user decides when to merge.

### Merge + post-merge cleanup (automatic — not a plan step)

When the user says "merge" (or equivalent), the agent executes the full protocol from `210_pull-requests.md` § "Merge Execution + Post-merge Cleanup":

**Pre-merge checks (mandatory):**

1. Working tree is clean (`git status`).
2. `git fetch --prune` to sync refs.
3. PR is mergeable: CI green, no conflicts.

**Merge:** 4. Squash merge (default) via `gh pr merge <number> --squash --delete-branch`.

**Post-merge cleanup:** 5. Ensure working tree is clean (STOP if not). 6. Check stashes (`git stash list`): drop branch-related stashes, ask about ambiguous ones. 7. Switch to `main` and pull (`git checkout main && git pull`). 8. Delete local branch if still exists (safe delete first, force only if verified no unique commits).

**If any pre-merge check fails:** STOP and report to the user. Do not attempt to fix merge issues autonomously.

> **Important:** After merge + cleanup, proceed immediately to the **[Iteration close-out protocol](#iteration-close-out-protocol-automatic--not-a-plan-step)**. The merge is not done until close-out completes.

### Iteration close-out protocol (automatic — not a plan step)

> **Hard rule:** A merge is **NOT** considered complete until the close-out
> protocol finishes. The agent may NOT report "merge done" or yield control
> to the user until all close-out steps below are executed. Skipping close-out
> is a protocol violation equivalent to skipping CI.

After merge + post-merge cleanup is complete, the agent creates a dedicated
branch (`chore/iteration-N-close-out`) and executes these steps **before**
considering the iteration finished.

#### 1. Plan reconciliation (mandatory if any steps are `[ ]`)

If the plan contains uncompleted steps (`[ ]`):

1. Present each incomplete step **one by one** to the user with three options:
   - **Defer** → move to next iteration.
   - **Drop** → remove from backlog.
   - **Mark complete** → if already done outside the plan.
2. Record each decision in the plan file:
   - Deferred: `⏭️ DEFERRED to Iter <N+1>`.
   - Dropped: `❌ DROPPED (<reason>)`.
   - Marked complete: change `[ ]` to `[x]` with note `(closed in reconciliation)`.

If all steps are already `[x]`: skip this step — no intervention needed.

#### 2. Update IMPLEMENTATION_HISTORY.md (mandatory)

Add a new entry to `docs/projects/veterinary-medical-records/04-delivery/IMPLEMENTATION_HISTORY.md`:

1. **Timeline row:** iteration number, date, PR(s), theme, key metrics, link to completed file.
2. **Cumulative progress column:** add a new column to the cumulative table with updated metric values for the closed iteration.
3. **Active iteration pointer:** update the "Active iteration" section to point to Iter N+1 (or "None" if no next iteration is planned).

#### 3. Rename plan → completed archive (mandatory)

Move the plan file from active to completed using `git mv`:

```
git mv docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_<date>_<slug>.md \
       docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_<date>_<slug>.md
```

#### 4. DOC_UPDATES normalization (conditional)

Run the DOC_UPDATES normalization pass **only** on `.md` files that:

- Were modified during the iteration or the close-out itself, AND
- Have corresponding entries in the router (`test_impact_map.json` or `router_parity_map.json`).

If no qualifying files exist, skip this step.

#### 5. Commit + push + PR

1. Commit all close-out artifacts with:

   ```
   docs(iter-close): iteration <N> close-out — history + reconciliation
   ```

2. Push the `chore/iteration-N-close-out` branch.
3. Open a PR, wait for CI green, and squash-merge.

#### 6. Mirror to docs repository (if applicable)

If the project uses a separate docs repository (worktree or fork), sync all close-out changes to maintain parity between repos.

---

## Commit conventions

All commits in this flow follow the format:

```
<type>(plan-<id>): <short description>
```

Examples:

- `audit(plan-f1a): 12-factor compliance report + backlog`
- `refactor(plan-f2c): split App.tsx into page and API modules`
- `test(plan-f4c): add frontend coverage gaps for upload flow`
- `docs(plan-f5c): add ADR-ARCH-001 through ADR-ARCH-004`

The agent constructs the message based on the completed step id (F1-A → `plan-f1a`, F15-B → `plan-f15b`, etc.).

---

## Output format (per iteration finding)

For each recommendation/finding:

- **Problem**
- **Impact** on evaluation
- **Effort** (S/M/L)
- **Regression risk**

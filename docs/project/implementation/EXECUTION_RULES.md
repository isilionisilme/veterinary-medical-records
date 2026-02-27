# Execution Rules — Shared Operational Rules for AI Plan Execution

> **Canonical source:** This file governs how AI agents execute plan steps across all iterations.
> Referenced by `AGENTS.md`. Do not duplicate these rules elsewhere.

## File structure

```
docs/project/implementation/
├── EXECUTION_RULES.md              ← YOU ARE HERE
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
|---|---|
| **Hexagonal backend architecture** | `domain/` pure (frozen dataclasses), ports with `Protocol`, composition in `main.py` |
| **Docker setup** | `docker compose up --build` functional, healthchecks, test profiles, dev overlay |
| **CI pipeline** | 6 jobs: brand, design system, doc/test parity, docker packaging, quality, frontend |
| **Documentation** | `docs/README.md` with reading order, TECHNICAL_DESIGN.md (1950 lines), extraction-tracking |
| **Incremental evidence** | PR storyline (157+ PRs traced), golden field iterations, run parity reports |

---

## Operational rules

### Semi-unattended execution (default mode — hard rule)

The default execution mode is **semi-unattended**. After completing a task
(CI green, step marked `[x]`, PR updated), the agent **MUST** automatically
continue with the next task if both conditions are met:

**Conditions to chain (both must hold):**
1. The next task is assigned to the **same agent** that just completed the current one.
2. A **pre-written prompt** exists for the next task in the `## Cola de prompts` section of the active plan.

**If both hold:** read the prompt from the Cola, execute it (full SCOPE BOUNDARY),
and evaluate again when done. **DO NOT EMIT HANDOFF. DO NOT STOP.**
Each Cola block includes a `⚠️ AUTO-CHAIN` reminder naming the next step explicitly.

**If either fails:** the agent stops and generates the standard handoff message
(STEP F of SCOPE BOUNDARY) so the user opens a new chat with the correct agent
or asks Claude to write the just-in-time prompt.

**Safety limit:** if the agent detects context exhaustion (truncated responses,
state loss), it must stop at the current step, complete it cleanly (full SCOPE
BOUNDARY) and generate the handoff. The next chat resumes from the first `[ ]`.

> **Note:** this mode is compatible with the `Continúa` protocol. If the user
> opens a new chat and writes `Continúa`, the agent executes one step and then
> evaluates whether it can chain. The difference is that the agent no longer
> stops mandatorily after every step.

### Atomic iterations
Never mix scope between steps. Each step in Estado de ejecución is an atomic unit: execute, commit, push, mark `[x]`. If it fails, report — do not continue to the next one.

### Extended execution state (pending / in-progress / blocked / completed)
For visibility and traceability, it is **mandatory** to mark the active step with `⏳ EN PROGRESO` **without changing the base checkbox**.

- **Pending:** `- [ ] F?-? ...`
- **In progress:** `- [ ] F?-? ... ⏳ EN PROGRESO (<agent>, <date>)`
- **Blocked:** `- [ ] F?-? ... 🚫 BLOQUEADO (<short reason>)`
- **Step locked:** `- [ ] F?-? ... 🔒 STEP LOCKED (code committed, awaiting CI + plan update)`
- **Completed:** `- [x] F?-? ...`

Mandatory rules:
1. Do not use `[-]`, `[~]`, `[...]` or variants: only `[ ]` or `[x]`.
2. Before executing a `[ ]` step, the agent must mark it `⏳ EN PROGRESO (<agent>, <date>)`.
3. `EN PROGRESO` and `BLOQUEADO` are text labels at the end of the line, not checkbox states.
4. On completion, remove any label (`EN PROGRESO`/`BLOQUEADO`/`STEP LOCKED`) and mark `[x]`.
5. For `BLOQUEADO`, include brief reason and next action if applicable.
6. After code commit but before CI green + plan update, mark `🔒 STEP LOCKED`. While locked, **no other step may begin** and **no handoff may be emitted**.

### Agent identity rule (hard rule — applies before any other)
**If the user writes `Continúa`:**
1. Read the Estado de ejecución in the active plan file and find the first `[ ]` (includes lines with `⏳ EN PROGRESO` or `🚫 BLOQUEADO` labels).
2. Identify the agent assigned to that step (🔄 Codex or 🚧 Claude).
3. If the step belongs to the **active agent in this chat**: proceed normally.
4. If the step belongs to the **other agent**:
   - **STOP immediately. Do not read the prompt. Do not implement anything.**
   - Respond EXACTLY with one of these messages:
     - If next step is Codex: "⚠️ Este paso no corresponde al agente activo. **STOP.** El siguiente paso es de **GPT-5.3-Codex**. Abre un chat nuevo en Copilot → selecciona **GPT-5.3-Codex** → adjunta el `PLAN` activo → escribe `Continúa`."
     - If next step is Claude: "⚠️ Este paso no corresponde al agente activo. **STOP.** El siguiente paso es de **Claude Opus 4.6**. Abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta el `PLAN` activo → escribe `Continúa`."
5. If ambiguous: STOP and ask the user which agent corresponds.

### "Continúa-only" rule
**When the user writes `Continúa`, the agent executes ONLY what the plan dictates (Estado + corresponding prompt).** If the user's message includes additional instructions alongside "Continúa" (e.g. "Continúa, but don't touch X" or "Continúa and also do Y"), the agent must:
1. **Ignore the extra instructions.**
2. Respond: "⚠️ El protocolo Continúa ejecuta exactamente el siguiente paso del plan. Si necesitas modificar el alcance, díselo primero a Claude para que actualice el plan y el prompt."
3. Not execute anything until the user confirms with a clean `Continúa`.

### Rollback
If a completed step causes an issue not detected by tests:
1. `git revert HEAD` (reverts commit without losing history)
2. Edit Estado de ejecución: change `[x]` back to `[ ]` for the affected step
3. Report to Claude for diagnosis before retrying

### Plan = agents only
**The user does NOT edit plan files manually.** Only the agents (Claude and Codex) modify `PLAN_*.md` files. If the user needs to change something (e.g. add a step, fix a typo), they ask Claude and Claude makes the edit + commit.

### Plan scope principle (hard rule)
**Plans (`PLAN_*.md`) contain ONLY product/engineering tasks** — the work that produces deliverable value (code, tests, configuration, documentation content). **Operational protocol is NEVER a plan step.**

| ✅ Valid plan step | ❌ NOT a plan step |
|---|---|
| "Add Playwright smoke test for upload flow" | "Commit and push" |
| "Configure CI job for E2E tests" | "Create PR" |
| "Add data-testid attributes to components" | "Merge PR" |
| "Write ADR for architecture decision" | "Post-merge cleanup" |

Operational protocol (commit, push, PR creation, merge, post-merge cleanup, branch management) is defined exclusively in this file (`EXECUTION_RULES.md`) and agents execute it automatically as part of SCOPE BOUNDARY and iteration lifecycle.

**Why:** When operational steps appear in a plan, agents treat them as tasks requiring explicit prompts and checkboxes, which conflicts with the automatic protocol in SCOPE BOUNDARY. This causes duplication, skipped protocol steps, and confusion about when to execute operational procedures.

### PR progress tracking (mandatory)
**Every completed step must be reflected in the active PR for the current iteration.** After finishing the SCOPE BOUNDARY (after push), the agent updates the PR body with `gh pr edit <pr_number> --body "..."`. This is mandatory for both Codex and Claude. If the command fails, report to the user but do NOT block the step.

### CI verification (mandatory — hard rule)
**No step is considered completed until GitHub CI is green.** Local tests are necessary but NOT sufficient. After push, the agent MUST:
1. Wait for the CI run to finish (`gh run list --branch <branch> --limit 1`).
2. If CI fails: diagnose, fix, push and wait again.
3. Only after CI green: declare the step completed to the user.
4. If unable to fix CI after 2 attempts: STOP and ask for help.

---

## Step completion integrity (hard rules — added 2026-02-26)

> **Origin:** Post-mortem of Iter 9 process violation where Codex batched steps,
> skipped CI verification, and emitted handoff before CI was green.
> These rules close every identified gap.

### NO-BATCH (hard rule)
**Prohibited: closing more than one plan step in a single wave of commits/pushes
without completing the full CI + plan-update cycle for the previous step.**
Each step must go through commit → push → CI green → plan update → (next step).
Batching multiple steps into one push violates atomicity and breaks traceability.

### CI-FIRST-BEFORE-HANDOFF (hard rule)
**Prohibited: emitting a handoff message if the last code commit of the step
does not have a green CI run on GitHub.** The agent must wait for CI to pass
before telling the user (or the next agent) to continue. If CI is still running,
wait. If CI fails, fix and re-push. Never hand off a red or unknown CI state.

### PLAN-UPDATE-IMMEDIATO (hard rule)
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
  - **No other step may begin execution.**
  - **No handoff may be emitted.**
  - **No auto-chain may trigger.**
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

| CI green? | Plan committed? | Action |
|---|---|---|
| YES | YES | Proceed with handoff/chain |
| YES | NO | Commit plan update first, then handoff |
| NO | any | **BLOCKED** — fix CI, do NOT handoff |
| unknown | any | **WAIT** — poll CI, do NOT handoff |

**If the guard fails, the agent stays in fix/watch mode until both conditions
are met.** This is the final safety net against premature handoffs.

---

### Format-before-commit (mandatory — hard rule)
**Before every `git commit`, the agent ALWAYS runs the project formatters:**
1. `cd frontend && npx prettier --write 'src/**/*.{ts,tsx,css}' && cd ..`
2. `ruff check backend/ --fix --quiet && ruff format backend/ --quiet`
3. If `git commit` fails (pre-commit hook rejects): re-run formatters, re-add, retry ONCE.
4. If it fails a second time: STOP and report to the user.

### Iteration boundary (mandatory — hard rule)
**Auto-chain NEVER crosses from one Fase/iteration to another.** When all tasks of the current Fase are `[x]`, the agent stops and returns control to the user, even if the next Fase already has prompts written. Starting a new iteration requires explicit user approval.

### Next-step message (mandatory — hard rule)
**On completing a step, the agent ALWAYS tells the user the next move with concrete instructions.** Never finish without saying which agent to use and what to do next. If there is no next step, say "Todos los pasos completados." Reference STEP F of the SCOPE BOUNDARY template.

**Mandatory handoff format:** when the next step belongs to a **different agent** or is a **🚧 hard-gate**, always "open a new chat" with the exact next agent name (**GPT-5.3-Codex** or **Claude Opus 4.6**). When the next step belongs to the **same agent** and is not a 🚧 hard-gate, the agent announces completion and continues in the same chat (auto-chain). Never say "return to this chat" when a different agent is needed.

### Token-efficiency policy (mandatory)
To avoid context explosion between chats and long steps, ALWAYS apply:
1. **iterative-retrieval** before executing each step: load only current state (`first [ ]`), step objective, target files, guardrails and relevant validation outputs.
2. **strategic-compact** at step close: summarize only the delta implemented, validation executed, open risks and next move.
3. Do not carry full chat history if not necessary for the active step.

> **Mandatory compact template:**
> - Step: F?-?
> - Delta: <concrete changes>
> - Validation: <tests/guards + result>
> - Risks/Open: <if applicable>

---

## Plan-edit-last (hard constraint)
**Codex does NOT edit the plan file until tests pass and code is committed.** The mandatory sequence is:
1. Commit code (without touching the plan)
2. Tests green (the commit exists, proving the code works)
3. Only then: edit the plan (mark `[x]`, clean Prompt activo) in a separate commit
4. Push both commits together

### Hard-gates: structured decision protocol
In 🚧 steps, Claude presents options as a numbered list:
```
Backlog items:
1. ✅ Centralize config in Settings class — Impact: High, Effort: S
2. ✅ Add health check endpoint — Impact: Medium, Effort: S
3. ❌ Migrate to PostgreSQL — Impact: High, Effort: L (OUT OF SCOPE)
```
The user responds ONLY with numbers: `1, 2, 4` or `all` or `none`.
Claude then records the decision, commits, prepares the implementation prompt, and directs the user to Codex.

---

## Prompt strategy

- **Pre-written prompts** (Cola de prompts): at iteration start, Claude writes prompts for all tasks whose content does not depend on the result of prior tasks. This enables semi-unattended execution: Codex chains consecutive steps reading directly from the Cola.
- **Just-in-time prompts** (Prompt activo): for tasks whose prompt depends on a prior task's result, Claude writes them in `## Prompt activo` when appropriate.
- **Prompt resolution** (priority order): Cola de prompts → Prompt activo → STOP (ask Claude).

### "Continúa" protocol
Each prompt includes at the end an instruction for the agent to:
1. Mark its step as completed in **Estado de ejecución** (changing `[ ]` to `[x]`).
2. Auto-commit with the standardized message (without asking permission, informing the user of the commit made).
3. Stop.

### Next-step instructions (rule for all agents)
On completing a step, the agent ALWAYS tells the user the next move with concrete instructions.

**2-step decision:**
1. Does the next step have a pre-written prompt in `## Cola de prompts`?
2. Is the next step from the same agent or a different one?

| Prompt exists | Same agent | Action |
|---|---|---|
| YES | YES | **AUTO-CHAIN** (no handoff, execute directly) |
| YES | NO | → Direct to correct agent: "Abre chat nuevo → **[agent]** → adjunta el `PLAN` activo → `Continúa`." |
| NO | YES | → Direct to Claude first: "No hay prompt para F?-?. Vuelve al chat de **Claude Opus 4.6** y pídele que escriba el prompt. Luego abre chat nuevo con **[current agent]** → adjunta el plan → `Continúa`." |
| NO | NO | → Direct to Claude: "Abre chat nuevo → **Claude Opus 4.6** → adjunta el plan → `Continúa`." |

**HARD RULE: NEVER direct the user to Codex when there is no prompt.** If the next step is Codex and there is no prompt in the Cola or in `## Prompt activo`, the message is ALWAYS: go to Claude first.

### Routing de "Continúa" for Codex
When Codex receives `Continúa` with the plan file attached:

```
1. Read Estado de ejecución → find the first `[ ]`.
2. If the step is Claude's (not Codex):
   → STOP. Tell the user: "⚠️ Este paso no corresponde al agente activo. **STOP.**
     El siguiente paso es de **Claude Opus 4.6**. Abre un chat nuevo en Copilot →
     selecciona **Claude Opus 4.6** → adjunta el `PLAN` activo →
     escribe `Continúa`."
3. For any Codex step:
   → Search for prompt in this priority order:
     a. `## Cola de prompts` → entry with the current step ID.
     b. `## Prompt activo` → `### Prompt` section.
   → If neither has a prompt: STOP.
     Tell the user: "⚠️ No hay prompt pre-escrito para F?-?. Vuelve al chat de
     **Claude Opus 4.6** y pídele que escriba el prompt para F?-?. Luego abre un
     chat nuevo con **GPT-5.3-Codex**, adjunta el PLAN activo y escribe `Continúa`."
4. After completing the step → execute STEP F of SCOPE BOUNDARY
   (semi-unattended chain check). If conditions are met, chain
   to next step automatically.
```

---

## SCOPE BOUNDARY template (two-commit strategy)

Execute these steps IN THIS EXACT ORDER. Do NOT reorder.

### STEP 0 — BRANCH VERIFICATION (before any code change)
1. Read the `**Rama:**` field from the current plan file.
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
2. `git add -A -- . ':!docs/project/implementation/PLAN_*.md'`
3. `git commit -m "<type>(plan-f?-?): <description>\n\nTest proof: <pytest summary> | <npm test summary>"`
   If commit fails: re-run formatters, re-add, retry ONCE. If fails again: STOP.

### STEP B — Commit plan update (only after code is committed)
1. Edit the active plan file: change `- [ ] F?-?` to `- [x] F?-?`.
2. Clean `## Prompt activo`: replace content with `_Completado: F?-?_` / `_Vacío._`
3. `git add docs/project/implementation/PLAN_*.md`
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

### STEP F — CHAIN OR HANDOFF (mandatory)

⚠️ **PRE-CONDITION:** STEP F may ONLY execute if STEP A completed successfully (code commit exists).

⚠️ **AUTO-HANDOFF GUARD (mandatory):** Before proceeding, run the guard check from § "Step completion integrity" → AUTO-HANDOFF GUARD. If CI is not green or plan is not committed, STOP here.

⚠️ **ITERATION BOUNDARY:** Before evaluating auto-chain, check if the NEXT unchecked `[ ]` step belongs to the same Fase/iteration. If it belongs to a DIFFERENT Fase: **STOP. Do NOT auto-chain across iteration boundaries.**

1. Next step = first `[ ]` in Estado de ejecución.
2. Check: is it YOUR agent? Does `## Cola de prompts` have its prompt?

| Your agent? | Prompt exists? | Action |
|---|---|---|
| YES | YES | **AUTO-CHAIN** — execute next prompt NOW |
| YES | NO | HANDOFF → Claude: "abre chat nuevo → Claude Opus 4.6 → adjunta el plan → Continúa" |
| NO | any | HANDOFF → next agent |
| no steps left | — | "✓ Todos los pasos completados." |

**Handoff messages (only when table says HANDOFF):**

- **Case A — Next step is ANOTHER agent AND has prompt:**
  → "✅ F?-? completado. Siguiente: abre un chat nuevo en Copilot → selecciona **[agent name]** → adjunta el `PLAN` activo → escribe `Continúa`."
- **Case B — Next step is SAME agent but NO prompt (just-in-time):**
  → "✅ F?-? completado. No hay prompt pre-escrito para F?-?. Vuelve al chat de **Claude Opus 4.6** y pídele que escriba el prompt para F?-?. Luego abre un chat nuevo con **GPT-5.3-Codex**, adjunta el plan y escribe `Continúa`."
- **Case C — Next step is ANOTHER agent (hard-gate or Claude task):**
  → "✅ F?-? completado. Siguiente: abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta el `PLAN` activo → escribe `Continúa`."

**HARD RULE: NEVER direct user to Codex when no prompt exists.**

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

1. Read the `**Rama:**` field from the active plan file.
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

**Merge:**
4. Squash merge (default) via `gh pr merge <number> --squash --delete-branch`.

**Post-merge cleanup:**
5. Ensure working tree is clean (STOP if not).
6. Check stashes (`git stash list`): drop branch-related stashes, ask about ambiguous ones.
7. Switch to `main` and pull (`git checkout main && git pull`).
8. Delete local branch if still exists (safe delete first, force only if verified no unique commits).
9. Archive the plan file: move from `PLAN_*.md` to `completed/COMPLETED_*.md`.
10. Commit and push the archive move.

**If any pre-merge check fails:** STOP and report to the user. Do not attempt to fix merge issues autonomously.

### Iteration close-out protocol (automatic — not a plan step)

After merge + post-merge cleanup is complete, the agent executes these steps **before** considering the iteration finished. This is automatic protocol, not a plan task.

#### 1. Plan reconciliation (mandatory if any steps are `[ ]`)
If the archived plan contains uncompleted steps (`[ ]`):
1. Present each incomplete step to the user with options: **defer** (to next iteration), **drop** (remove from backlog), or **mark complete** (if already done outside the plan).
2. For deferred steps: annotate with `⏭️ DEFERRED to Iter <N+1> (<new step ID if known>)`.
3. For dropped steps: annotate with `❌ DROPPED (<reason>)`.
4. Record all decisions in the `COMPLETED_*.md` archive file under a "Reconciliation" section.

#### 2. Update IMPLEMENTATION_HISTORY.md (mandatory)
Add a new entry to `docs/project/implementation/IMPLEMENTATION_HISTORY.md`:
1. **Iteration row** in the timeline table: date, branch, PR number, step count (completed/total), summary of deliverables.
2. **Cumulative progress table**: add a column for the closed iteration showing which features advanced.
3. **Active iteration pointer**: update from Iter N → Iter N+1.

#### 3. DOC_UPDATES normalization (mandatory)
Run the DOC_UPDATES normalization pass (`docs/agent_router/01_WORKFLOW/DOC_UPDATES/00_entry.md`) on any `.md` files modified during the iteration or the close-out itself.

#### 4. Commit + push close-out changes
Commit all close-out artifacts (archive annotations, IMPLEMENTATION_HISTORY, normalized docs) with:
```
docs(iter-close): iteration <N> close-out — history + reconciliation
```
Push to `main`.

#### 5. Mirror to docs repository (if applicable)
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

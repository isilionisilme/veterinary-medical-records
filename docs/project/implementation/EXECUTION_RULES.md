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
- **Completed:** `- [x] F?-? ...`

Mandatory rules:
1. Do not use `[-]`, `[~]`, `[...]` or variants: only `[ ]` or `[x]`.
2. Before executing a `[ ]` step, the agent must mark it `⏳ EN PROGRESO (<agent>, <date>)`.
3. `EN PROGRESO` and `BLOQUEADO` are text labels at the end of the line, not checkbox states.
4. On completion, remove any label (`EN PROGRESO`/`BLOQUEADO`) and mark `[x]`.
5. For `BLOQUEADO`, include brief reason and next action if applicable.

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

### PR progress tracking (mandatory)
**Every completed step must be reflected in the active PR for the current iteration.** After finishing the SCOPE BOUNDARY (after push), the agent updates the PR body with `gh pr edit <pr_number> --body "..."`. This is mandatory for both Codex and Claude. If the command fails, report to the user but do NOT block the step.

### CI verification (mandatory — hard rule)
**No step is considered completed until GitHub CI is green.** Local tests are necessary but NOT sufficient. After push, the agent MUST:
1. Wait for the CI run to finish (`gh run list --branch <branch> --limit 1`).
2. If CI fails: diagnose, fix, push and wait again.
3. Only after CI green: declare the step completed to the user.
4. If unable to fix CI after 2 attempts: STOP and ask for help.

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

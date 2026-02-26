# AGENTS — Entry Point (Token-Optimized)

AI assistant entrypoint. Keep reads minimal and route by intent.

## Review fast path (`@codex review`)
- Explicit review trigger only (`@codex review`, “Do a code review…”, “Review the diff…”).
- Load only `docs/agent_router/01_WORKFLOW/CODE_REVIEW/00_entry.md`.
- Fallback format if unavailable: `Severity | File:Line | Finding | Suggested fix`.

## Required order
1) Read `docs/agent_router/00_AUTHORITY.md` first.
2) Load only the module(s) that match the current intent.
3) Do not open large docs unless a module explicitly routes to them.

## Mandatory triggers
- Starting new work: follow `docs/agent_router/01_WORKFLOW/START_WORK/00_entry.md` (branch-first).
- Pull requests: follow `docs/agent_router/01_WORKFLOW/PULL_REQUESTS/00_entry.md` (classify PR).
- User asks to merge a PR: execute `docs/agent_router/03_SHARED/ENGINEERING_PLAYBOOK/210_pull-requests.md` end-to-end.
- Code PRs: load `docs/agent_router/01_WORKFLOW/CODE_REVIEW/00_entry.md`.
- User-visible changes: load `docs/agent_router/02_PRODUCT/USER_VISIBLE/00_entry.md` then UX/Brand.
- User indicates documentation was updated (any language or paraphrase): load `docs/agent_router/01_WORKFLOW/DOC_UPDATES/00_entry.md`.
  If files are not specified, follow DOC_UPDATES discovery (git diff/status) then normalize.

## Manual trigger only: Code reviews
- Do not start a review unless explicitly requested.
- If review seems helpful, propose it and wait.

## Global rule
- After modifying docs, run the DOC_UPDATES normalization pass once before finishing.
- Include a final `How to test` section for user-validatable changes.

## Documentation governance (operational)
- Prefer `docs/agent_router/*` for discovery.
- Canonical docs: `docs/project/*`, `docs/shared/*`, `docs/README.md`.
- Load canonical docs only if explicitly requested, router is missing/ambiguous, or conflict resolution is needed.

## Mandatory execution policy (hard rule)
- Run `git`, `gh`, and `npm` with elevation on first attempt.
- If elevation is unavailable, STOP and ask the user.

## Fallback
If no intent matches, read `docs/agent_router/00_FALLBACK.md` and ask for clarification.

## Plan execution (hard rule)
- Operational rules: load `docs/project/production/EXECUTION_RULES.md`.
- Active plans in `docs/project/production/PLAN_*.md`.
- Completed in `docs/project/production/completed/`.

## Identity check for plan execution (hard rule)
If the user writes `Continúa` and a `docs/project/production/PLAN_*.md` file is attached:
1. Read Estado de ejecución → find the first `[ ]` step.
2. If that step belongs to the active agent for this chat: proceed normally following the plan.
3. If that step belongs to a different agent: STOP. Do not implement anything. Respond EXACTLY with one of these messages:
  - If the next step is Codex: "⚠️ Este paso no corresponde al agente activo. **STOP.** El siguiente paso es de **GPT-5.3-Codex**. Abre un chat nuevo en Copilot → selecciona **GPT-5.3-Codex** → adjunta el `PLAN` activo → escribe `Continúa`."
  - If the next step is Claude: "⚠️ Este paso no corresponde al agente activo. **STOP.** El siguiente paso es de **Claude Opus 4.6**. Abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta el `PLAN` activo → escribe `Continúa`."
4. When proceeding with a valid step, enforce the token-efficiency policy from `EXECUTION_RULES.md` (`iterative-retrieval` before execution and `strategic-compact` at step close).

## Mandatory handoff at step close (hard rule)
When a plan step is completed, ALWAYS end with a "new chat" handoff instruction that names the exact next agent.
- Never tell the user to continue in the same chat.
- If next step is Codex, require: open new Copilot chat + choose **GPT-5.3-Codex** + attach the active `PLAN` file + write `Continúa`.
- If next step is Claude, require: open new Copilot chat + choose **Claude Opus 4.6** + attach the active `PLAN` file + write `Continúa`.

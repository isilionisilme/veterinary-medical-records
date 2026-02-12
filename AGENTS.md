# AGENTS — Entry Point (Token-Optimized)

This file is the AI assistant entry point. Keep reads small and follow the router.

## Required order
1) Read `docs/agent_router/00_AUTHORITY.md` first.
2) Load only the module(s) that match the current intent.
3) Do not open large docs unless a module explicitly routes to them.

## Mandatory triggers
- Starting new work: follow `docs/agent_router/01_WORKFLOW/START_WORK/00_entry.md` (branch-first).
- Pull requests: follow `docs/agent_router/01_WORKFLOW/PULL_REQUESTS/00_entry.md` (classify PR).
- Code PRs: load `docs/agent_router/01_WORKFLOW/CODE_REVIEW/00_entry.md`.
- User-visible changes: load `docs/agent_router/02_PRODUCT/USER_VISIBLE/00_entry.md` then UX/Brand.
- User indicates documentation was updated (any language or paraphrase): load `docs/agent_router/01_WORKFLOW/DOC_UPDATES/00_entry.md`.
  Examples: “He actualizado documentación”, “He actualizado el documento X”, “I have updated the docs”, “I updated README.md”, “Docs changed; please sync/normalize”, “I made documentation changes”.
  Treat paraphrases and other languages as the same intent. If files are not specified, follow DOC_UPDATES discovery (git diff/status) then normalize.
- Benchmarks: only if user asks (see router).

## Global rule
- After you modify any documentation file, run the DOC_UPDATES Normalization Pass once before finishing. Do not re-run it for changes made by the pass itself.
- After implementing any change that can be validated from the user perspective (feature, fix, technical improvement, or small in-flight adjustment), include a final `How to test` section with step-by-step expected outcomes.
- If user-perspective testing does not apply, explicitly state that and provide the best alternative verification method.

## Fallback
If no intent matches, read `docs/agent_router/00_FALLBACK.md` and ask for clarification.


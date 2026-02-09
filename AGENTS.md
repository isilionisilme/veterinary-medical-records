# AGENTS — Entry Point (Token-Optimized)

This file is the AI assistant entry point. Keep reads small and follow the router.

## Required order
1) Read `docs/00_AUTHORITY.md` first.
2) Load only the module(s) that match the current intent.
3) Do not open large docs unless a module explicitly routes to them.

## Mandatory triggers
- Starting new work: follow `docs/01_WORKFLOW/START_WORK/00_entry.md` (branch-first).
- Pull requests: follow `docs/01_WORKFLOW/PULL_REQUESTS/00_entry.md` (classify PR).
- Code PRs: load `docs/01_WORKFLOW/CODE_REVIEW/00_entry.md`.
- User-visible changes: load `docs/02_PRODUCT/USER_VISIBLE/00_entry.md` then UX/Brand.
- Benchmarks: only if user asks (see router).

## Fallback
If no intent matches, read `docs/00_FALLBACK.md` and ask for clarification.


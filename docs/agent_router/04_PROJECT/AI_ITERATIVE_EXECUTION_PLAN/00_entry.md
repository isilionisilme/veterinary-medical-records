# AI_ITERATIVE_EXECUTION_PLAN — Modules

Owner entry for `docs/project/refactor/AI_ITERATIVE_EXECUTION_PLAN.md` propagation in DOC_UPDATES workflow.

Latest normalized milestone: Phase 9 (Iteration 3) appended with F9-A..F9-E, active-agent routing guardrail preserved (bidirectional Claude/Codex) with explicit agent-specific STOP handoff templates, mandatory step-close handoff preserved (always new chat + exact next-agent naming), token-efficiency policy persisted (`iterative-retrieval` + `strategic-compact`), and Prompt activo set to F9-A on branch `improvement/refactor-iteration-3` (historical required term preserved: F2-D).

Current propagation snapshot: Phase 10 (Iteration 4) execution status updated in source plan with F10-A..F10-F completion tracking and corresponding PR delivery on `improvement/iteration-4`.

Latest propagation snapshot: Phase 11 (Iteration 5) planning update reassigns F11-A..F11-E execution to Codex, keeps F11-F as Claude hard-gate, and seeds `## Prompt activo` with a Codex auto-chain prompt for F11-A→F11-E on branch `improvement/iteration-5`.

Phase 12 (Iteration 6) propagation: evaluation post-merge of Iteration 5 identified coverage gaps (frontend 79%, backend 88%), ESLint .cjs errors, nginx missing security headers, CORS too permissive, broken backend-tests Docker profile, stale backend deps, and routes.py 942 LOC pending decomposition. F12-A..F12-I assigned to Codex, F12-J to Claude, on branch `improvement/iteration-6`.

# AI_ITERATIVE_EXECUTION_PLAN — Modules

Owner entry for `docs/project/refactor/AI_ITERATIVE_EXECUTION_PLAN.md` propagation in DOC_UPDATES workflow.

Latest normalized milestone: Phase 9 (Iteration 3) appended with F9-A..F9-E, active-agent routing guardrail preserved (bidirectional Claude/Codex) with explicit agent-specific STOP handoff templates, mandatory step-close handoff preserved (always new chat + exact next-agent naming), token-efficiency policy persisted (`iterative-retrieval` + `strategic-compact`), and Prompt activo set to F9-A on branch `improvement/refactor-iteration-3` (historical required term preserved: F2-D).

Current propagation snapshot: Phase 10 (Iteration 4) execution status updated in source plan with F10-A..F10-F completion tracking and corresponding PR delivery on `improvement/iteration-4`.

Latest propagation snapshot: Phase 11 (Iteration 5) planning update reassigns F11-A..F11-E execution to Codex, keeps F11-F as Claude hard-gate, and seeds `## Prompt activo` with a Codex auto-chain prompt for F11-A→F11-E on branch `improvement/iteration-5`.

Phase 12 (Iteration 6) propagation: evaluation post-merge of Iteration 5 identified coverage gaps (frontend 79%, backend 88%), ESLint .cjs errors, nginx missing security headers, CORS too permissive, broken backend-tests Docker profile, stale backend deps, and routes.py 942 LOC pending decomposition. F12-A..F12-I assigned to Codex, F12-J to Claude, on branch `improvement/iteration-6`. All steps F12-A..F12-J completed; smoke test passed (317 backend, 224 frontend, 0 lint, clean build). CI green. PR #152 ready for merge.

Phase 13 (Iteration 7) propagation: decomposition track on branch `improvement/iteration-7-pr1` is active with F13-A..F13-D completed and F13-E completed (fallback no-deps extraction split into `processing/pdf_extraction_nodeps.py`, leaving `processing/pdf_extraction.py` as thin dispatcher). Canonical handoff strings include both Codex and Claude new-chat routes, and status tracking advanced to F13-F as next open step.

Phase 14 (Iteration 8) propagation: 2-PR strategy — PR A (`improvement/iteration-8-ci`) covers bugs + CI governance (F14-A..F14-E completed by Codex, F14-L Claude smoke + merge). PR B (`improvement/iteration-8-refactor`) covers refactor + coverage (F14-F..F14-K Codex, F14-M Claude close). New artifacts: `scripts/classify_doc_change.py` (Rule/Clarification/Navigation classifier), 3 independent doc guard CI jobs, `check_doc_test_sync.py` Navigation exemption + Clarification relaxed mode. Process fixes: inline MARK IN PROGRESS/COMMIT+MARK DONE blocks, CI GATE `--commit $sha` anchoring with 15s initial wait, STEP F pre-condition for code commit verification (historical required term preserved: F2-D).

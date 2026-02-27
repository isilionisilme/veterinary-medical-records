# Completed: Iteration 9 — E2E testing + evaluator experience polish

**Date:** 2026-02-27
**PR:** #163
**Branch:** `improvement/iteration-9-e2e` → `main`

## Context

Post-merge Iteration 8: all files >500 LOC modularized, backend coverage 90%, frontend 85%. The primary gap was zero E2E tests — every iteration had broken something visible (PdfViewer 3×, toolbar, blob URLs) that unit tests missed. Adding E2E in CI provides immediate evaluator confidence.

**Entry metrics:** 372 backend tests (90%), 263 frontend tests (85%), 0 lint, 8 CI jobs green.

## Steps

| ID | Description | Agent | Status |
|---|---|---|---|
| F15-A | Playwright config tuning + `data-testid` attributes for E2E targets | Codex | ✅ |
| F15-B | E2E: upload flow — upload PDF → verify sidebar → verify document selectable | Codex | ✅ |
| F15-C | E2E: review flow — select document → verify PDF + toolbar + structured panel | Codex | ✅ |
| F15-D | E2E: edit flow — edit field → confirm → verify persistence via mocked API | Codex | ✅ |
| F15-E | E2E: mark reviewed — toggle reviewed status → verify banner/state change | Codex | ✅ |
| F15-F | DELIVERY_SUMMARY.md refresh: Iter 4-9 metrics + E2E evidence | Claude | ✅ |
| F15-G | TECHNICAL_DESIGN.md §14 refresh: 7 known limitations, updated LOC metrics | Claude | ✅ |
| F15-H | README E2E section: Playwright run instructions + CI info + spec list | Claude | ✅ |
| F15-I | cli.py tests: coverage 0% → 80%+ | Codex | ⏭️ Deferred to Iter 10 |
| F15-J | Docker healthcheck: nginx serves `/index.html` | Codex | ⏭️ Deferred to Iter 10 |
| F15-K | FUTURE_IMPROVEMENTS refresh + broken link fixes + smoke test | Claude | ✅ |

## Key outcomes
- 5 E2E Playwright specs: app-loads, upload-smoke, review-flow, edit-flow, mark-reviewed
- 17 `data-testid` attributes added across 4 components
- DELIVERY_SUMMARY refreshed with Iter 4-9 metrics + E2E evidence
- TECHNICAL_DESIGN §14: 7 known limitations (was 5), AppWorkspace ~2,200 LOC, routes.py resolved
- README: new "End-to-end tests (Playwright)" section
- FUTURE_IMPROVEMENTS: 3 items marked done, 6 new items (#19-#24) from DRAFT triage, 7 broken links fixed
- EXECUTION_RULES: 6 new integrity rules (NO-BATCH, CI-FIRST, PLAN-UPDATE-IMMEDIATO, STEP-LOCK, EVIDENCE BLOCK, AUTO-HANDOFF GUARD)
- DRAFT_ITER-10.md deleted (novel content preserved in FUTURE_IMPROVEMENTS)

## Deferred items
- **F15-I** (cli.py tests) and **F15-J** (Docker HEALTHCHECK) — carried forward to Iteration 10 plan steps F16-H and F16-I respectively.

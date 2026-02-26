# Delivery Summary — `improvement/refactor`

> Quantitative record of what was delivered across 7 phases + Iterations 2–9.  
> Source of truth for execution details: [`IMPLEMENTATION_HISTORY.md`](../implementation/IMPLEMENTATION_HISTORY.md).

---

## At a glance

| Metric | Iter 3 (Phase 9) | Iter 6 | Iter 8 | Iter 9 (current) |
|--------|-------------------|--------|--------|-------------------|
| Backend tests | 263 | 317 | 372 | 372+ |
| Frontend tests | 168 | 226 | 263 | 263+ |
| E2E tests | 0 | 0 | 0 | **5 specs** |
| Backend coverage | 87% | 90% | 90% | 90% |
| Frontend coverage | ~65% | 82.6% | 85% | 85% |
| CI jobs | 7 | 6 | 8 | 9 (+E2E) |
| Lint issues | 0 | 0 | 0 | 0 |
| PRs merged | #145 | #152 | #156, #157 | #163 (in progress) |

---

## Phase 1 — Architecture audit (12-Factor)

Audited the backend against the 12-Factor App methodology. Implemented 4 of 5 top-priority items (1 discarded — SQLite concurrency risk).

| Change | Detail |
|--------|--------|
| Centralized configuration | Scattered `os.getenv` → single `settings.py` (67 LOC) with typed validation |
| Release metadata | `app_version`, `git_commit`, `build_date` exposed via `Settings` |
| Scheduler decoupling | Processing scheduler lifecycle extracted to `scheduler_lifecycle.py` (36 LOC) |
| Admin CLI | New `cli.py` (54 LOC): `db-schema`, `db-check`, `config-check` commands |
| Discarded: Worker profile | SQLite single-writer prevents reliable multi-process — documented in ADR-ARCH-0002 |

**Audit record:** [`12_FACTOR_AUDIT.md`](12_FACTOR_AUDIT.md)

---

## Phase 2 — Structural refactor

Three monolithic files decomposed into cohesive modules. No behavioral changes.

### Frontend: `App.tsx` (5,998 LOC → 9-line shell + 8 modules)

| Before | After |
|--------|-------|
| 1 file, 5,998 lines | `App.tsx` (9 LOC shell) + `AppWorkspace.tsx` (5,760 LOC) + 37 component files (5,457 LOC) |

Key extracted components: `PdfViewer` (831), `DocumentsSidebar` (430), `FieldEditDialog` (417), `ToastHost` (159), `UploadDropzone` (77), `SourcePanel` (60), plus 20+ UI primitives.

### Backend: `processing_runner.py` (2,901 LOC → 5 modules)

| Module | Lines | Responsibility |
|--------|-------|---------------|
| `interpretation.py` | 1,263 | Artifact assembly, candidate mining, schema mapping |
| `pdf_extraction.py` | 1,001 | 3-strategy PDF text extraction |
| `orchestrator.py` | 416 | Run execution, step tracking, timeout |
| `scheduler.py` | 165 | Queue polling, tick loop, dequeue |
| `__init__.py` | 9 | Public re-exports |

### Backend: `document_service.py` (1,874 LOC → 8 modules)

| Module | Lines | Responsibility |
|--------|-------|---------------|
| `review_service.py` | 418 | Review projection, normalization, toggle |
| `edit_service.py` | 324 | Interpretation edits, confidence, audit |
| `calibration.py` | 244 | Build/apply/revert calibration deltas |
| `_shared.py` | 231 | Shared utilities |
| `_edit_helpers.py` | 202 | Edit normalization/merge helpers |
| `query_service.py` | 180 | Document queries and DTOs |
| `__init__.py` | 70 | Façade with backward-compatible imports |
| `upload_service.py` | 65 | Document upload registration |

### Test redistribution

`App.test.tsx` (3,693 LOC monolithic suite) → redistributed across 20 per-component test files matching the new structure.

**Audit record:** [`codebase_audit.md`](codebase_audit.md)

---

## Phase 3 — Tooling quick wins

| Tool | Configuration |
|------|--------------|
| ESLint 9 | Flat config (`frontend/eslint.config.mjs`) with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks` |
| Prettier 3 | `frontend/.prettierrc` + `format:check` script |
| ruff | v0.9.9, lint + format, in `.pre-commit-config.yaml` |
| pre-commit | ruff (lint + format) + local hooks for ESLint + Prettier |
| Coverage | `@vitest/coverage-v8` (frontend) + `pytest-cov` (backend) |
| CI integration | ESLint, Prettier check, ruff format check in existing CI jobs |

---

## Phase 4 — Test quality

Frontend and backend test suites audited for fragile patterns, duplicated fixtures, and coverage gaps.

| Metric | Before | After |
|--------|--------|-------|
| Backend tests | ~240 | 249 |
| Backend coverage | ~84% | 87% |
| Frontend test files | ~15 | 20 |
| Frontend tests | ~145 | 162 |

Key improvements: removed duplicated suites, added `cli.py` tests (was 0%), improved `_edit_helpers.py` coverage, consolidated fragile timer-based patterns.

---

## Phase 5 — Documentation

### New Architecture Decision Records (4)

| ADR | Decision | Key trade-off |
|-----|----------|--------------|
| [ADR-ARCH-0001](../adr/ADR-ARCH-0001-modular-monolith.md) | Modular monolith over microservices | Operational simplicity vs horizontal scaling |
| [ADR-ARCH-0002](../adr/ADR-ARCH-0002-sqlite-database.md) | SQLite over PostgreSQL | Zero-ops vs multi-process concurrency |
| [ADR-ARCH-0003](../adr/ADR-ARCH-0003-raw-sql-repository-pattern.md) | Raw SQL + Repository over ORM | Full SQL control vs maintenance burden |
| [ADR-ARCH-0004](../adr/ADR-ARCH-0004-in-process-async-processing.md) | In-process async over Celery/RQ | Zero infrastructure vs automatic retry |

### Other documentation

- [`FUTURE_IMPROVEMENTS.md`](FUTURE_IMPROVEMENTS.md) — 2/4/8 week roadmap (18 items traced to audits and ADRs)
- [`docs/project/adr/README.md`](../adr/README.md) — ADR index linking architecture decisions
- Root `README.md` enriched: architecture overview, ADR links, evaluator quickstart, quality gates, delivery evidence
- `docs/README.md` updated: evaluator-first reading order, audit trail section

---

## Phase 6 — Evaluator smoke test

| Check | Result |
|-------|--------|
| README → running system | 3 commands (`docker compose up --build`, browse, `docker compose down`) |
| Tests green | 249 backend + 162 frontend |
| Empty state UX | Clear CTA, skeleton loading, Spanish copy |
| Upload flow | Client validation, drag-and-drop, progress toasts |
| Processing feedback | Status polling (1.5s→5s), long-processing warning |
| Error handling | Connectivity dedup, graceful degradation, expandable tech details |

Frictions fixed: ~20 missing Spanish accent marks in UI strings, CSS loading spinner added to `index.html`, page language set to `es`.

---

## Phase 7 — Closeout

Final verification: all 7 CI checks green, PR #145 updated, no regressions. Plan `AI_ITERATIVE_EXECUTION_PLAN.md` fully executed — all steps `[x]`.

---

## Iteration 2 — CTO Verdict Improvements (Phase 8)

Targeted improvements from [`CTO_REVIEW_VERDICT.md`](CTO_REVIEW_VERDICT.md) — all 5 highest-leverage items addressed.

| # | Improvement | Step | Detail |
|---|---|---|---|
| 1 | SQLite WAL + busy_timeout | F8-B | `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000` on every connection in `database.py` |
| 2 | Security boundary docs | F8-D | New §13 Security Boundary + §14 Known Limitations in `TECHNICAL_DESIGN.md` |
| 3 | AppWorkspace.tsx header | F8-D | 9-line docstring acknowledging LOC debt and referencing decomposition roadmap |
| 4 | `lib/utils.ts` coverage | F8-C | Error-path tests added; coverage from 24% to ≥70% |
| 5 | FUTURE_IMPROVEMENTS AppWorkspace entry | F8-D | Item #7b: decomposition into ReviewWorkspace, StructuredDataView, PdfViewerContainer |

| Metric | Value |
|--------|-------|
| Commits | 12 |
| Files changed | 18 (3 added, 15 modified) |
| Net delta | +411 / −34 lines |
| Test suite | **423 tests** (255 backend + 168 frontend), all green |
| Backend coverage | 87% |
| CI checks | All green on each step |
| Guardrails added | Cross-chat agent routing, mandatory new-chat handoff, token-efficiency policy |

---

## Iteration 3 — Hardening & Maintainability (Phase 9)

Targeted hardening: upload safety, security boundary, and frontend decomposition.

| # | Improvement | Step | Detail |
|---|---|---|---|
| 1 | Upload streaming guard | F9-B | Early `Content-Length` check + chunked streaming read; rejects oversized uploads before full memory allocation |
| 2 | Auth boundary (optional) | F9-C | New `AUTH_TOKEN` env var; when set, all `/api/` endpoints require `Authorization: Bearer <token>`; disabled by default for evaluator flow |
| 3 | AppWorkspace.tsx decomposition | F9-D | Extracted 7 modules from `AppWorkspace.tsx` (5,770 → 3,758 LOC, −35%): `documentApi.ts`, `ReviewFieldRenderers.tsx`, `ReviewSectionLayout.tsx`, `SourcePanelContent.tsx`, `appWorkspace.ts` (constants), `appWorkspaceUtils.ts`, `appWorkspace.ts` (types) |

### AppWorkspace decomposition detail

| Extracted module | Lines | Responsibility |
|---|---|---|
| `api/documentApi.ts` | 424 | API client hooks, queries, mutations, polling |
| `components/review/ReviewFieldRenderers.tsx` | 488 | Field rendering: values, adjustments, confidence badges |
| `components/review/ReviewSectionLayout.tsx` | 456 | Canonical section layout, visit grouping, field rows |
| `components/review/SourcePanelContent.tsx` | 55 | Source drawer content panel |
| `constants/appWorkspace.ts` | 180 | UI constants, labels, configuration maps |
| `lib/appWorkspaceUtils.ts` | 427 | Pure utility functions (formatters, normalizers, helpers) |
| `types/appWorkspace.ts` | 249 | TypeScript interfaces and type definitions |

| Metric | Value |
|--------|-------|
| Commits | 12 |
| Files changed | 22 (8 added, 14 modified) |
| Net delta | +2,869 / −2,316 lines |
| Test suite | **431 tests** (263 backend + 168 frontend), all green |
| Backend coverage | 87% |
| New backend tests | 8 (upload streaming + auth boundary) |
| AppWorkspace.tsx reduction | 5,770 → 3,758 LOC (−35%) |

---

## Iteration 4 — Docs + Lint Polish (Phase 10)

ESLint 0 warnings, Vite build clean, README quality gates.

| Metric | Value |
|--------|-------|
| PR | #150 |
| Key outcomes | ESLint 0 warnings across frontend, Vite production build clean, README quality gates defined |

---

## Iteration 5 — Production Readiness (Phase 11)

Prettier bulk format, Docker non-root containers, `_edit_helpers` coverage push.

| Metric | Value |
|--------|-------|
| PR | #151 |
| Key outcomes | Prettier format enforced on all frontend source, Docker images run as non-root `appuser`, `_edit_helpers.py` coverage 85 %+ |

---

## Iteration 6 — Coverage + Security Hardening (Phase 12)

Major coverage push and security headers.

| Metric | Before | After |
|--------|--------|-------|
| Backend tests | ~180 | 317 |
| Frontend tests | ~120 | 226 |
| Backend coverage | ~75 % | 90 % |
| Frontend coverage | ~65 % | 82.6 % |

| # | Improvement | Detail |
|---|---|---|
| 1 | Backend coverage 90 % | Comprehensive test expansion across all domain + application modules |
| 2 | Frontend coverage 82.6 % | New test files for hooks, API layer, and utility modules |
| 3 | nginx CSP | `Content-Security-Policy` header with `default-src 'self'`, blob/worker support |
| 4 | CORS tightening | Restricted to configured origins, no wildcard in production |
| 5 | Routes decomposed | API route files split for maintainability |

---

## Iteration 7 — Modularization (Phase 13)

Monolithic files >500 LOC decomposed into cohesive modules.

| Target | Before | After |
|--------|--------|-------|
| `interpretation.py` | 1,398 LOC | `candidate_mining.py` + `confidence_scoring.py` + thin dispatcher |
| `pdf_extraction.py` | 1,150 LOC | `pdf_extraction_nodeps.py` (878 LOC fallback) + thin dispatcher |
| `AppWorkspace.tsx` | 4,011 LOC | 5 custom hooks extracted (−49 %) |
| `extraction_observability.py` | 995 LOC | 4 sub-modules (snapshot, persistence, triage, reporting) |
| `constants.py` | scattered | Consolidated ~97 lines DRY |

| Metric | Value |
|--------|-------|
| PR | #153 |
| Backend tests | 340+ |
| Frontend tests | 240+ |

---

## Iteration 8 — Bugs + CI Governance + Refactor Round 3 (Phase 14)

Two-PR strategy: PR A (CI governance) + PR B (refactor + coverage).

### PR A — CI governance (#156)

| # | Improvement | Detail |
|---|---|---|
| 1 | PdfViewer hotfix | Accept `ArrayBuffer`, remove fetch indirection (fixed 3 recurring breakages) |
| 2 | Doc guard CI split | 3 independent CI jobs: parity, sync, brand |
| 3 | Doc change classifier | Rule/Clarification/Navigation classification with CI integration |
| 4 | Navigation exemption | Relaxed Clarification mode in `check_doc_test_sync.py` |

### PR B — Refactor + coverage (#157)

| # | Improvement | Detail |
|---|---|---|
| 1 | Workspace panel extraction | `UploadPanel`, `StructuredDataPanel`, `PdfViewerPanel` as standalone components |
| 2 | Hook tests | Unit tests for hooks extracted in Iter 7 |
| 3 | PdfViewer coverage | 47 % → 65 %+ branch coverage |
| 4 | documentApi coverage | 67 % → 80 %+ branch coverage |
| 5 | config.py coverage | 83 % → 90 %+ |
| 6 | candidate_mining split | 789 LOC → 2 modules < 400 LOC each |

| Metric | Value |
|--------|-------|
| Backend tests | 372 (90 % coverage) |
| Frontend tests | 263 (85 % coverage) |
| AppWorkspace.tsx | 2,221 LOC (−62 % from original 5,770) |
| CI jobs | 8 (all green) |

---

## Iteration 9 — E2E Testing + Evaluator Experience Polish (Phase 15)

**PR:** #163 (in progress)  
**Branch:** `improvement/iteration-9-e2e`

First end-to-end test suite for the application, covering the 4 critical user flows. Added Playwright infrastructure with CI integration.

### E2E test evidence

| Spec | Flow covered | Key assertions |
|------|-------------|----------------|
| `app-loads.spec.ts` | App bootstrap | Page loads, sidebar visible, no JS errors |
| `upload-smoke.spec.ts` | Upload → process | Upload PDF → document appears in sidebar → clickable → center panel reacts |
| `review-flow.spec.ts` | Review workspace | Select document → PDF viewer renders (toolbar + pages) → structured panel loads |
| `edit-flow.spec.ts` | Field editing | Open edit dialog → modify value → save → verify API call |
| `mark-reviewed.spec.ts` | Mark reviewed toggle | Click "Marcar revisado" → verify state change → verify read-only mode |

### CI integration

- New `e2e` job in GitHub Actions: starts Docker stack, runs `npm run test:e2e`, uploads artifacts on failure.
- Playwright configured: Chromium-only, headless, `baseURL: http://localhost:80`, HTML reporter.
- `data-testid` attributes added to key components: `review-toggle-btn`, `field-edit-dialog`, `field-edit-input`, `field-edit-save`, `field-edit-cancel`, `field-edit-btn-${id}`.

### Operational improvements (Iter 9)

| Improvement | Detail |
|---|---|
| Step completion integrity | 6 new hard rules: NO-BATCH, CI-FIRST-BEFORE-HANDOFF, PLAN-UPDATE-IMMEDIATO, STEP-LOCK, EVIDENCE BLOCK, AUTO-HANDOFF GUARD |
| EXECUTION_RULES.md | New § "Step completion integrity" with post-mortem origin |
| 🔒 STEP LOCKED state | Explicit plan state blocking progress until CI green + plan commit |

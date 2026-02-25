# Delivery Summary — `improvement/refactor`

> Quantitative record of what was delivered across 7 phases + Iterations 2 & 3.  
> Source of truth for execution details: [`AI_ITERATIVE_EXECUTION_PLAN.md`](AI_ITERATIVE_EXECUTION_PLAN.md).

---

## At a glance

| Metric | Value |
|--------|-------|
| Commits | 73 |
| Files changed | 157 (60 added, 95 modified, 2 deleted) |
| Net delta | +23,726 / −17,641 lines |
| Test suite | **431 tests** (263 backend + 168 frontend), all green |
| Backend coverage | 87% |
| CI checks | 7 jobs, all passing |
| New documentation files | 13 |
| New architecture ADRs | 4 |

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

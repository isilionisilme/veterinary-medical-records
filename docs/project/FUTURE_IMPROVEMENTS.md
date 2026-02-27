# Future Improvements Roadmap

This roadmap describes prioritized engineering improvements for the next 2, 4, and 8 weeks. It consolidates outcomes from the architecture and codebase audits, aligns with architecture decisions in ADRs, and makes deferred work explicit for evaluator visibility and planning.

## Week 2 — Quick wins

| # | Improvement | Source | Effort | Risk |
| --- | --- | --- | --- | --- |
| 1 | ~~Enable SQLite WAL mode and busy timeout~~ **✅ Done (Iteration 2)** | [ADR-ARCH-0002](adr/ADR-ARCH-0002-sqlite-database.md), [codebase_audit.md](refactor/codebase_audit.md) | S | Low |
| 2 | ~~Add CI coverage threshold gates~~ **✅ Done (Iteration 10, F16-E)** | [codebase_audit.md](refactor/codebase_audit.md), [F4-A/F4-B in history](implementation/IMPLEMENTATION_HISTORY.md) | S | Low |
| 3 | Centralize remaining debug env reads in settings | [12_FACTOR_AUDIT.md](refactor/12_FACTOR_AUDIT.md), [ADR-ARCH-0001](adr/ADR-ARCH-0001-modular-monolith.md) | S | Low |
| 4 | ~~Increase frontend coverage for `lib/utils.ts` error paths~~ **✅ Done (Iteration 8, F14-I)** | [F4-A in history](implementation/IMPLEMENTATION_HISTORY.md) | S | Low |
| 5 | Increase frontend coverage for AddFieldDialog + source panel hook | [F4-A in history](implementation/IMPLEMENTATION_HISTORY.md) | S | Low |
| 6 | ~~Add known limitations section in technical design~~ **✅ Done (Iteration 9, F15-G)** | [F5-A in history](implementation/IMPLEMENTATION_HISTORY.md), [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) | S | Low |

1. **~~SQLite WAL mode + busy timeout PRAGMA.~~** **✅ Done (Iteration 2).** `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000` applied in `database.py` connection setup. Concurrent read/write resilience confirmed.
2. **~~CI coverage thresholds.~~** **✅ Done (Iteration 10, F16-E).** Backend enforces `pytest --cov-fail-under=85`; frontend vitest config enforces `branches: 80, functions: 80, lines: 80, statements: 70`. CI fails on regression below these gates.
3. **Centralize debug env reads.** Move debug-oriented environment lookups from processing modules into typed runtime settings. This completes the 12-Factor configuration boundary and avoids direct `os.getenv` drift in application code. **Acceptance criteria:** no direct env reads remain in those modules and behavior is unchanged under existing env values.
4. **~~Frontend utils error-path coverage.~~** **✅ Done (Iteration 8, F14-I).** Branch coverage for `documentApi.ts` raised from 67% → 80%+ with explicit assertions for fetch error handling, abort, and failure paths. PdfViewer branch coverage also raised from 47% → 65%+ (F14-H). `config.py` backend coverage raised to 90%+ (F14-J). PdfViewer worker configuration hardened with regression test guard and DEV-mode error diagnostics.
5. **AddFieldDialog and source-panel state tests.** Extend tests for save-lock transitions and source panel state changes to cover interaction edge cases. This directly addresses critical frontend coverage gaps from F4-A. **Acceptance criteria:** targeted suites cover the critical state transitions and pass reliably in CI.
6. **~~Document known limitations.~~** **✅ Done (Iteration 9, F15-G).** TECHNICAL_DESIGN.md §14 contains 7 known limitations covering single-process model, SQLite, auth, AppWorkspace debt, routes (resolved), rate limiting, and DB indexes. Refreshed with current metrics post-Iter 8.

## Week 4 — Structural improvements

| # | Improvement | Source | Effort | Risk |
| --- | --- | --- | --- | --- |
| 7a | ~~Decompose backend API routes module (`backend/app/api/routes.py`, ~912 lines)~~ **✅ Done (Iteration 6)** | [codebase_audit.md](refactor/codebase_audit.md), [ADR-ARCH-0001](adr/ADR-ARCH-0001-modular-monolith.md) | M | Medium |
| 7b | ~~Decompose `AppWorkspace.tsx` (~6 100 LOC) into ReviewWorkspace, StructuredDataView, PdfViewerContainer~~ **✅ Done (Iterations 3+7+8, F9-D / F13-G/H / F14-F)** | [CTO_REVIEW_VERDICT.md](refactor/CTO_REVIEW_VERDICT.md), [codebase_audit.md](refactor/codebase_audit.md) | L | Medium |
| 8 | ~~Modularize extraction observability module (`backend/app/application/extraction_observability.py`, ~846 lines)~~ **✅ Done (Iteration 7, F13-I)** | [codebase_audit.md](refactor/codebase_audit.md), [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) | M | Medium |
| 8a | ~~Decompose `interpretation.py` (1,398 LOC) into candidate_mining + confidence_scoring~~ **✅ Done (Iterations 7+8, F13-A/B/C/D + F14-K)** | [codebase_audit.md](refactor/codebase_audit.md) | M | Medium |
| 8b | ~~Decompose `pdf_extraction.py` (1,150 LOC) into thin dispatcher + nodeps fallback~~ **✅ Done (Iteration 7, F13-E/F)** | [codebase_audit.md](refactor/codebase_audit.md) | M | Medium |
| 8c | ~~Consolidate DRY constants across processing modules~~ **✅ Done (Iteration 7, F13-A)** | [codebase_audit.md](refactor/codebase_audit.md) | S | Low |
| 9 | ~~Add streaming and bounded upload guard~~ **✅ Done (Iteration 3, F9-B)** | [codebase_audit.md](refactor/codebase_audit.md), [BACKEND_IMPLEMENTATION.md](BACKEND_IMPLEMENTATION.md) | M | Medium |
| 10 | Expand backend failure-path tests | [codebase_audit.md](refactor/codebase_audit.md) | M | Low |
| 11 | Add SourcePanel and UploadDropzone full test suites | [codebase_audit.md](refactor/codebase_audit.md) | M | Low |
| 12 | Centralize PdfViewer mock helpers | [FRONTEND_IMPLEMENTATION.md](FRONTEND_IMPLEMENTATION.md) | S | Low |

7a. **~~Routes decomposition.~~** **✅ Done (Iteration 6).** `routes.py` reduced to 18-LOC aggregator. 5 domain modules: `routes_documents.py` (413), `routes_review.py` (223), `routes_processing.py` (127), `routes_calibration.py` (123), `routes_health.py` (12). All under 420 LOC.
7b. **~~AppWorkspace decomposition.~~** **✅ Done (Iterations 3+7+8, F9-D / F13-G/H / F14-F).** Iteration 3: extracted 7 modules (5,770 → 3,758 LOC, −35%): `documentApi.ts`, `ReviewFieldRenderers.tsx`, `ReviewSectionLayout.tsx`, `SourcePanelContent.tsx`, constants, utils, and types. Iteration 7: extracted 5 custom hooks (`useStructuredDataFilters`, `useFieldEditing`, `useUploadState`, `useReviewSplitPanel`, `useDocumentsSidebar`), reducing to 2,955 LOC (−49% from original). Iteration 8: extracted 3 render-section components (`PdfViewerPanel.tsx` 536 LOC, `StructuredDataPanel.tsx` 432 LOC, `UploadPanel.tsx` 68 LOC), reducing to 2,221 LOC (−62% from original). Unit tests added for all 5 extracted hooks (F14-G). All tests pass.
8. **~~Extraction observability modularization.~~** **✅ Done (Iteration 7, F13-I).** Split `extraction_observability.py` (995 LOC) into `extraction_observability/` package with 4 sub-modules: `snapshot.py` (196 LOC), `persistence.py` (175 LOC), `triage.py` (229 LOC), `reporting.py` (168 LOC). `__init__.py` re-exports public API unchanged. All existing tests pass.
8a. **~~Interpretation module decomposition.~~** **✅ Done (Iterations 7+8, F13-A/B/C/D + F14-K).** Decomposed `interpretation.py` (1,398 → 245 LOC, −82%): extracted `candidate_mining.py` and `confidence_scoring.py` (333 LOC). Iteration 8: further split `candidate_mining.py` (789 LOC) into `candidate_mining.py` (399 LOC) + `date_parsing.py` (399 LOC) under `processing/` package. `processing_runner.py` shim updated with re-exports. All tests pass.
8b. **~~PDF extraction decomposition.~~** **✅ Done (Iteration 7, F13-E/F).** Decomposed `pdf_extraction.py` (1,150 → 106 LOC, −91%): extracted `pdf_extraction_nodeps.py` (1,014 LOC) containing the pure-Python fallback parser. Dispatcher kept thin. 350 tests pass.
8c. **~~DRY constants consolidation.~~** **✅ Done (Iteration 7, F13-A).** Migrated ~97 lines of duplicated constants (field regexes, confidence thresholds, section mappings, stop-words) from `interpretation.py`, `pdf_extraction.py`, and `orchestrator.py` into `constants.py` (107 LOC). Zero duplication remaining.
9. **~~Upload size and streaming guard.~~** **✅ Done (Iteration 3, F9-B).** Early `Content-Length` header check rejects oversized uploads before full memory allocation. Chunked streaming read with size enforcement. 3 new integration tests.
10. **Backend failure-path coverage expansion.** Add tests for orchestrator partial failures and database lock/retry behavior. This targets reliability-critical paths where regressions can affect processing state integrity. **Acceptance criteria:** coverage in these modules improves with deterministic assertions on run-state transitions and error handling.
11. **Frontend interaction suite expansion.** Build comprehensive tests for `SourcePanel` and `UploadDropzone` where coverage remains shallow. These are high-touch components and merit stronger regression protection. **Acceptance criteria:** suites validate key user flows and significantly increase branch/line coverage in both components.
12. **Shared PdfViewer mock extraction.** Replace repeated local mocks with a single helper under test utilities. This reduces duplication and lowers maintenance overhead when viewer behavior changes. **Acceptance criteria:** test files reuse one helper and all existing viewer-related tests remain green.

## Week 8 — Architecture evolution

| # | Improvement | Source | Effort | Risk |
| --- | --- | --- | --- | --- |
| 13 | Split SQLite repository by aggregate (`backend/app/infra/sqlite_document_repository.py`, ~684 lines) | [ADR-ARCH-0003](adr/ADR-ARCH-0003-raw-sql-repository-pattern.md), [codebase_audit.md](refactor/codebase_audit.md) | L | Medium |
| 14 | Optional Compose worker profile for background processing | [ADR-ARCH-0004](adr/ADR-ARCH-0004-in-process-async-processing.md), [12_FACTOR_AUDIT.md](refactor/12_FACTOR_AUDIT.md) | L | High |
| 15 | ~~Add minimal auth/token boundary~~ **✅ Done (Iteration 3, F9-C)** | [codebase_audit.md](refactor/codebase_audit.md), [PRODUCT_DESIGN.md](PRODUCT_DESIGN.md) | L | Medium |
| 16 | Implement persistent event tracing and metrics | [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), [codebase_audit.md](refactor/codebase_audit.md) | L | Medium |
| 17 | Add PostgreSQL adapter behind DocumentRepository protocol | [ADR-ARCH-0002](adr/ADR-ARCH-0002-sqlite-database.md), [ADR-ARCH-0003](adr/ADR-ARCH-0003-raw-sql-repository-pattern.md) | L | High |
| 18 | Introduce migration tooling for schema evolution | [ADR-ARCH-0003](adr/ADR-ARCH-0003-raw-sql-repository-pattern.md), [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) | M | Medium |

13. **Repository split by aggregate.** Separate document, run, and calibration persistence concerns behind focused protocols and adapters. This contains growth in the current monolithic repository and improves ownership boundaries. **Acceptance criteria:** composition root wires the same public capabilities while each repository module remains cohesive and independently testable.
14. **Optional worker profile.** Introduce a dedicated worker service profile for processing workloads while preserving default evaluator flow. This advances process separation from [ADR-ARCH-0004](adr/ADR-ARCH-0004-in-process-async-processing.md) but depends on database concurrency guarantees. **Acceptance criteria:** worker profile is opt-in, documented, and validated only after PostgreSQL path is available.
15. **~~Minimal auth/token boundary.~~** **✅ Done (Iteration 3, F9-C).** New `AUTH_TOKEN` env var (optional, empty = disabled). When set, all `/api/` endpoints require `Authorization: Bearer <token>` header. When unset, behavior is identical to current. Integration tests cover both modes. `TECHNICAL_DESIGN.md` §13 updated.
16. **Persistent tracing and observability metrics.** Implement structured event tracing across document lifecycle and processing transitions. This provides production-grade debugging and trend analysis beyond ad-hoc logs. **Acceptance criteria:** trace events are queryable, correlated by document/run IDs, and covered by diagnostic docs.
17. **PostgreSQL adapter.** Implement a PostgreSQL-backed repository conforming to the existing repository protocol and composition root contracts. This enables multi-process scaling and reduces SQLite write-lock constraints documented in [ADR-ARCH-0002](adr/ADR-ARCH-0002-sqlite-database.md). **Acceptance criteria:** functional parity tests pass for both SQLite and PostgreSQL adapters.
18. **Migration tooling.** Replace bootstrap schema setup with a versioned migration workflow for controlled evolution. This improves operability and release safety as table count and complexity increase. **Acceptance criteria:** schema changes are reproducible via migration commands in CI and local setup.

## Beyond Week 8 — Candidates from DRAFT_ITER-10 triage

> Items below were evaluated during Iter 10 planning (2026-02-26). Those already addressed by the approved Iter 10 plan (security, coverage, health check) were discarded. The remaining novel items are preserved here for future prioritization.

| # | Improvement | Source | Effort | Evaluator impact |
|---|---|---|---|---|
| 19 | Performance benchmarks: latency baselines for upload, extraction, and query endpoints | DRAFT_ITER-10 D10-A | M | High — quantitative evidence of acceptable response times |
| 20 | Error UX: user-friendly error messages with error-code → copy mapping in frontend | DRAFT_ITER-10 D10-B | M | High — directly affects perceived quality |
| 21 | Accessibility audit: WCAG 2.1 AA compliance on upload, results, and navigation components | DRAFT_ITER-10 D10-C | L | Medium — demonstrates inclusive design awareness |
| 22 | API documentation: auto-generated OpenAPI spec + Swagger UI embed | DRAFT_ITER-10 D10-D | M | High — standard evaluator expectation for a REST API |
| 23 | Structured logging + Prometheus metrics: beyond `/health`, add structured log format and metrics endpoint | DRAFT_ITER-10 D10-I (partial — health check addressed in Iter 10 F16-I) | M | Medium — production-grade observability signal |
| 24 | ~~CI/CD optimization: dependency caching~~ **✅ Partial (Iteration 10, F16-CI)** — Python version matrix, deploy preview remain | DRAFT_ITER-10 D10-J | M | Low — internal DX, not user-visible |

19. **Latency benchmarks.** Add a `pytest-benchmark` or `locust` suite measuring P50/P95 latencies for the three most-used endpoints. Provides concrete performance evidence rather than "it works." **Acceptance criteria:** baseline numbers documented and reproducible in CI.
20. **Error UX mapping.** Replace raw HTTP status fallbacks with a frontend `errorCodeMap` that maps backend error codes to localized user-friendly messages. **Acceptance criteria:** upload failures, extraction errors, and validation rejections all show clear copy instead of generic toast.
21. **WCAG 2.1 AA compliance pass.** Run `axe-core` audit on critical views, fix contrast, focus management, and ARIA roles. **Acceptance criteria:** `axe-core` violations = 0 on upload and review views.
22. **OpenAPI auto-generation.** Add Pydantic response models + FastAPI metadata to auto-generate an OpenAPI spec, with Swagger UI exposed at `/docs`. **Acceptance criteria:** `/docs` renders interactive API explorer; spec validates with `openapi-spec-validator`.
23. **Structured logging + Prometheus.** Replace ad-hoc `logging.info` calls with `structlog` JSON output and expose `/metrics` endpoint with request counters + processing durations. **Acceptance criteria:** logs parseable by any JSON ingester; `/metrics` returns Prometheus-compatible output.
24. **~~CI dependency caching~~ + matrix.** **✅ Partial (Iteration 10, F16-CI).** `pip` and `npm` caching enabled via `actions/cache@v4`; `dorny/paths-filter@v3` path filtering + conditional E2E + `concurrency: cancel-in-progress` added. **Remaining:** Python 3.11 + 3.12 version matrix, deploy preview. **Acceptance criteria (remaining):** suite passes on both Python versions; preview deployments available on PRs.

This roadmap was generated from audit findings (F1-A, F2-A, F4-A/B, F5-A), architecture decision records (ADR-ARCH-0001 through 0004), TECHNICAL_DESIGN.md deferred items, and DRAFT_ITER-10 triage (2026-02-26). Updated after Iteration 10 (2026-02-27) to reflect resolved items: CI coverage thresholds (F16-E), CI caching + path filtering (F16-CI).
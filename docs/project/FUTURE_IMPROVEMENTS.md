# Future Improvements Roadmap

This roadmap describes prioritized engineering improvements for the next 2, 4, and 8 weeks. It consolidates outcomes from the architecture and codebase audits, aligns with architecture decisions in ADRs, and makes deferred work explicit for evaluator visibility and planning.

## Week 2 — Quick wins

| # | Improvement | Source | Effort | Risk |
| --- | --- | --- | --- | --- |
| 1 | Enable SQLite WAL mode and busy timeout | [ADR-ARCH-0002](adr/ADR-ARCH-0002-sqlite-database.md), [codebase_audit.md](refactor/codebase_audit.md) | S | Low |
| 2 | Add CI coverage threshold gates | [codebase_audit.md](refactor/codebase_audit.md), [F4-A/F4-B in AI plan](refactor/AI_ITERATIVE_EXECUTION_PLAN.md) | S | Low |
| 3 | Centralize remaining debug env reads in settings | [12_FACTOR_AUDIT.md](refactor/12_FACTOR_AUDIT.md), [ADR-ARCH-0001](adr/ADR-ARCH-0001-modular-monolith.md) | S | Low |
| 4 | Increase frontend coverage for `lib/utils.ts` error paths | [F4-A in AI plan](refactor/AI_ITERATIVE_EXECUTION_PLAN.md) | S | Low |
| 5 | Increase frontend coverage for AddFieldDialog + source panel hook | [F4-A in AI plan](refactor/AI_ITERATIVE_EXECUTION_PLAN.md) | S | Low |
| 6 | Add known limitations section in technical design | [F5-A in AI plan](refactor/AI_ITERATIVE_EXECUTION_PLAN.md), [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) | S | Low |

1. **SQLite WAL mode + busy timeout PRAGMA.** Update SQLite connection setup to apply `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000`. This addresses concurrent read/write resilience noted in [ADR-ARCH-0002](adr/ADR-ARCH-0002-sqlite-database.md) and the maintainability audit. **Acceptance criteria:** startup initializes PRAGMAs and concurrent document operations show fewer lock contention failures.
2. **CI coverage thresholds.** Enforce minimum coverage in backend and frontend quality jobs so regressions fail fast. This closes the audit gap where reporting exists without enforcement. **Acceptance criteria:** CI fails below threshold and passes when suite coverage remains above the configured gates.
3. **Centralize debug env reads.** Move debug-oriented environment lookups from processing modules into typed runtime settings. This completes the 12-Factor configuration boundary and avoids direct `os.getenv` drift in application code. **Acceptance criteria:** no direct env reads remain in those modules and behavior is unchanged under existing env values.
4. **Frontend utils error-path coverage.** Add tests for failure branches in API helpers used across the UI data layer. This reduces risk in a shared dependency that can silently affect multiple workflows. **Acceptance criteria:** `lib/utils.ts` branch coverage reaches ~80%+ with explicit assertions for fetch error handling.
5. **AddFieldDialog and source-panel state tests.** Extend tests for save-lock transitions and source panel state changes to cover interaction edge cases. This directly addresses critical frontend coverage gaps from F4-A. **Acceptance criteria:** targeted suites cover the critical state transitions and pass reliably in CI.
6. **Document known limitations.** Add an explicit limitations section in technical design covering single-process constraints, auth boundary, and SQLite write-lock characteristics. This improves evaluator trust by making trade-offs transparent. **Acceptance criteria:** section is present, current, and linked from core documentation.

## Week 4 — Structural improvements

| # | Improvement | Source | Effort | Risk |
| --- | --- | --- | --- | --- |
| 7 | Decompose backend API routes module (`backend/app/api/routes.py`, ~912 lines) | [codebase_audit.md](refactor/codebase_audit.md), [ADR-ARCH-0001](adr/ADR-ARCH-0001-modular-monolith.md) | M | Medium |
| 8 | Modularize extraction observability module (`backend/app/application/extraction_observability.py`, ~846 lines) | [codebase_audit.md](refactor/codebase_audit.md), [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) | M | Medium |
| 9 | Add streaming and bounded upload guard | [codebase_audit.md](refactor/codebase_audit.md), [BACKEND_IMPLEMENTATION.md](BACKEND_IMPLEMENTATION.md) | M | Medium |
| 10 | Expand backend failure-path tests | [F4-B in AI plan](refactor/AI_ITERATIVE_EXECUTION_PLAN.md), [codebase_audit.md](refactor/codebase_audit.md) | M | Low |
| 11 | Add SourcePanel and UploadDropzone full test suites | [F4-A in AI plan](refactor/AI_ITERATIVE_EXECUTION_PLAN.md) | M | Low |
| 12 | Centralize PdfViewer mock helpers | [F4-A in AI plan](refactor/AI_ITERATIVE_EXECUTION_PLAN.md), [FRONTEND_IMPLEMENTATION.md](FRONTEND_IMPLEMENTATION.md) | S | Low |

7. **Routes decomposition.** Split API endpoints by bounded context and keep a small router aggregator in `api/routes.py`. This reduces blast radius in one of the largest backend modules and aligns with modular-monolith boundaries from [ADR-ARCH-0001](adr/ADR-ARCH-0001-modular-monolith.md). **Acceptance criteria:** no route contract changes and each endpoint group module stays under the LOC guideline.
8. **Extraction observability modularization.** Break observability logic into storage, transform, and aggregate units with explicit interfaces. This improves testability and makes telemetry changes safer to ship. **Acceptance criteria:** all existing observability outputs remain equivalent and unit tests cover each sub-module independently.
9. **Upload size and streaming guard.** Enforce size limits and stream/validate uploads before allocating full payloads in memory. This closes a robustness and abuse-resistance gap identified by the audit. **Acceptance criteria:** oversized uploads fail early with clear errors and normal documents preserve current behavior.
10. **Backend failure-path coverage expansion.** Add tests for orchestrator partial failures and database lock/retry behavior. This targets reliability-critical paths where regressions can affect processing state integrity. **Acceptance criteria:** coverage in these modules improves with deterministic assertions on run-state transitions and error handling.
11. **Frontend interaction suite expansion.** Build comprehensive tests for `SourcePanel` and `UploadDropzone` where coverage remains shallow. These are high-touch components and merit stronger regression protection. **Acceptance criteria:** suites validate key user flows and significantly increase branch/line coverage in both components.
12. **Shared PdfViewer mock extraction.** Replace repeated local mocks with a single helper under test utilities. This reduces duplication and lowers maintenance overhead when viewer behavior changes. **Acceptance criteria:** test files reuse one helper and all existing viewer-related tests remain green.

## Week 8 — Architecture evolution

| # | Improvement | Source | Effort | Risk |
| --- | --- | --- | --- | --- |
| 13 | Split SQLite repository by aggregate (`backend/app/infra/sqlite_document_repository.py`, ~684 lines) | [ADR-ARCH-0003](adr/ADR-ARCH-0003-raw-sql-repository-pattern.md), [codebase_audit.md](refactor/codebase_audit.md) | L | Medium |
| 14 | Optional Compose worker profile for background processing | [ADR-ARCH-0004](adr/ADR-ARCH-0004-in-process-async-processing.md), [12_FACTOR_AUDIT.md](refactor/12_FACTOR_AUDIT.md) | L | High |
| 15 | Add minimal auth/token boundary | [codebase_audit.md](refactor/codebase_audit.md), [PRODUCT_DESIGN.md](PRODUCT_DESIGN.md) | L | Medium |
| 16 | Implement persistent event tracing and metrics | [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), [codebase_audit.md](refactor/codebase_audit.md) | L | Medium |
| 17 | Add PostgreSQL adapter behind DocumentRepository protocol | [ADR-ARCH-0002](adr/ADR-ARCH-0002-sqlite-database.md), [ADR-ARCH-0003](adr/ADR-ARCH-0003-raw-sql-repository-pattern.md) | L | High |
| 18 | Introduce migration tooling for schema evolution | [ADR-ARCH-0003](adr/ADR-ARCH-0003-raw-sql-repository-pattern.md), [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) | M | Medium |

13. **Repository split by aggregate.** Separate document, run, and calibration persistence concerns behind focused protocols and adapters. This contains growth in the current monolithic repository and improves ownership boundaries. **Acceptance criteria:** composition root wires the same public capabilities while each repository module remains cohesive and independently testable.
14. **Optional worker profile.** Introduce a dedicated worker service profile for processing workloads while preserving default evaluator flow. This advances process separation from [ADR-ARCH-0004](adr/ADR-ARCH-0004-in-process-async-processing.md) but depends on database concurrency guarantees. **Acceptance criteria:** worker profile is opt-in, documented, and validated only after PostgreSQL path is available.
15. **Minimal auth/token boundary.** Add a lightweight auth middleware suitable for non-local deployments without redesigning the domain model. This addresses a key security maturity gap while preserving current UX expectations. **Acceptance criteria:** protected endpoints require a valid token and local evaluator mode remains straightforward to run.
16. **Persistent tracing and observability metrics.** Implement structured event tracing across document lifecycle and processing transitions. This provides production-grade debugging and trend analysis beyond ad-hoc logs. **Acceptance criteria:** trace events are queryable, correlated by document/run IDs, and covered by diagnostic docs.
17. **PostgreSQL adapter.** Implement a PostgreSQL-backed repository conforming to the existing repository protocol and composition root contracts. This enables multi-process scaling and reduces SQLite write-lock constraints documented in [ADR-ARCH-0002](adr/ADR-ARCH-0002-sqlite-database.md). **Acceptance criteria:** functional parity tests pass for both SQLite and PostgreSQL adapters.
18. **Migration tooling.** Replace bootstrap schema setup with a versioned migration workflow for controlled evolution. This improves operability and release safety as table count and complexity increase. **Acceptance criteria:** schema changes are reproducible via migration commands in CI and local setup.

This roadmap was generated from audit findings (F1-A, F2-A, F4-A/B, F5-A), architecture decision records (ADR-ARCH-0001 through 0004), and TECHNICAL_DESIGN.md deferred items.
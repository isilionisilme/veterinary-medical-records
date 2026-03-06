# D4R-A — Full Documentation Inventory

> **Plan:** PLAN_2026-02-28_DOCS-IMPROVEMENT  
> **Date:** 2026-03-06  
> **Status:** Pending user approval  
> **Scope:** All canonical wiki files (`docs/shared/`, `docs/projects/veterinary-medical-records/`, `docs/README.md`). Excludes `docs/agent_router/`.

---

## How to read this inventory

| Column        | Meaning                                                         |
| ------------- | --------------------------------------------------------------- |
| **FM**        | Has YAML frontmatter (`✅` yes / `❌` no)                       |
| **Words**     | Approximate word count                                          |
| **Diátaxis**  | Classification: reference, explanation, how-to, tutorial, index |
| **Audience**  | Primary target: developer, contributor, all, staff-engineer     |
| **Staleness** | `current` · `needs-update` · `stale`                            |

---

## G — Wiki Index

| #   | Path             | Title                      | FM  | Words  | Diátaxis | Audience | Staleness | Notes                                                              |
| --- | ---------------- | -------------------------- | --- | ------ | -------- | -------- | --------- | ------------------------------------------------------------------ |
| G1  | `docs/README.md` | Wiki — Documentation Index | ✅  | ~1,500 | index    | all      | current   | Governance, site map, evaluator first-pass, authority & precedence |

## A — Project / 01-product

| #   | Path                           | Title                                                       | FM  | Words  | Diátaxis    | Audience    | Staleness | Notes                                                            |
| --- | ------------------------------ | ----------------------------------------------------------- | --- | ------ | ----------- | ----------- | --------- | ---------------------------------------------------------------- |
| A1  | `01-product/design-system.md`  | Lean Design System (Tokens + Primitives)                    | ✅  | ~2,000 | reference   | contributor | current   | Design tokens, primitives, UI contract; Tailwind + CSS variables |
| A2  | `01-product/product-design.md` | Product Design — Document Interpretation & Layout Evolution | ✅  | ~3,500 | explanation | all         | current   | Human-in-the-loop, confidence, learning signals, safety-first    |
| A3  | `01-product/ux-design.md`      | UX Design — Project Interaction Contract                    | ✅  | ~2,500 | reference   | contributor | current   | Interaction contract, review workflow, confidence visibility     |

## B — Project / 02-tech

| #   | Path                                                       | Title                                              | FM  | Words  | Diátaxis  | Audience    | Staleness | Notes                                                                |
| --- | ---------------------------------------------------------- | -------------------------------------------------- | --- | ------ | --------- | ----------- | --------- | -------------------------------------------------------------------- |
| B1  | `02-tech/adr/ADR-ARCH-0001-modular-monolith.md`            | ADR-ARCH-0001: Modular Monolith over Microservices | ❌  | ~1,500 | reference | developer   | current   | Hexagonal boundaries (2026-02-24)                                    |
| B2  | `02-tech/adr/ADR-ARCH-0002-sqlite-database.md`             | ADR-ARCH-0002: SQLite as Primary Database          | ❌  | ~1,200 | reference | developer   | current   | WAL mode, zero-config Docker (2026-02-24)                            |
| B3  | `02-tech/adr/ADR-ARCH-0003-raw-sql-repository-pattern.md`  | ADR-ARCH-0003: Raw SQL with Repository Pattern     | ❌  | ~1,100 | reference | developer   | current   | No ORM (2026-02-24)                                                  |
| B4  | `02-tech/adr/ADR-ARCH-0004-in-process-async-processing.md` | ADR-ARCH-0004: In-Process Async Processing         | ❌  | ~1,200 | reference | developer   | current   | Tick-based scheduler, DB-backed queue (2026-02-24)                   |
| B5  | `02-tech/adr/index.md`                                     | ADR Index                                          | ❌  | ~200   | reference | developer   | current   | Index of 4 ADRs                                                      |
| B6  | `02-tech/architecture.md`                                  | Architecture Overview                              | ✅  | ~2,000 | reference | all         | current   | One-page architecture, tech stack, data flow (2026-03-02)            |
| B7  | `02-tech/backend-implementation.md`                        | Backend Implementation Notes                       | ✅  | ~3,500 | reference | contributor | current   | Layering, persistence, filesystem, processing, API (2026-03-02)      |
| B8  | `02-tech/extraction-quality.md`                            | Extraction Quality                                 | ✅  | ~2,500 | reference | developer   | current   | 11 field guardrails, quality strategy, triage (2026-03-02)           |
| B9  | `02-tech/frontend-implementation.md`                       | Frontend Implementation Notes                      | ✅  | ~2,500 | reference | contributor | current   | Stack, architecture, PDF, confidence, testing (2026-03-02)           |
| B10 | `02-tech/technical-design.md`                              | Technical Design — Instructions for Implementation | ✅  | ~8,000 | reference | contributor | current   | Authoritative system design: contracts, invariants, API, persistence |

## C — Project / 03-ops

| #   | Path                                       | Title                                      | FM  | Words  | Diátaxis  | Audience    | Staleness     | Notes                                                                                                                                                                                               |
| --- | ------------------------------------------ | ------------------------------------------ | --- | ------ | --------- | ----------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `03-ops/execution-rules.md`                | Execution Rules — Shared Operational Rules | ❌  | ~2,000 | reference | developer   | **redundant** | 100% absorbed by `plan-execution-protocol.md` + `plan-management.md` + `way-of-working.md`. References deleted `ENGINEERING_PLAYBOOK.md` and UPPER_CASE paths. **→ D4R-B: propose archive/delete.** |
| C2  | `03-ops/manual-qa-regression-checklist.md` | Manual QA Regression Checklist             | ❌  | ~1,200 | how-to    | developer   | current       | 26 test cases across 6 blocks                                                                                                                                                                       |
| C3  | `03-ops/plan-e2e-test-coverage.md`         | Plan de cobertura E2E — Playwright         | ❌  | ~2,500 | reference | contributor | current       | Feature inventory, 65 tests / 22 specs (in Spanish)                                                                                                                                                 |
| C4  | `03-ops/plan-execution-protocol.md`        | Plan Execution Protocol                    | ❌  | ~3,000 | reference | developer   | current       | Canonical protocol for AI agent plan execution                                                                                                                                                      |
| C5  | `03-ops/plan-management.md`                | Plan Management                            | ❌  | ~1,500 | reference | developer   | current       | Plan creation, structure, execution traceability                                                                                                                                                    |

## D — Project / 04-delivery (top-level docs)

| #   | Path                                    | Title                                 | FM  | Words  | Diátaxis    | Audience       | Staleness | Notes                                                          |
| --- | --------------------------------------- | ------------------------------------- | --- | ------ | ----------- | -------------- | --------- | -------------------------------------------------------------- |
| D1  | `04-delivery/copilot-usage.md`          | Copilot Usage Metrics                 | ✅  | ~500   | reference   | all            | current   | Feb 2026: 11 accounts, $130.28, 3,257 Premium Requests         |
| D2  | `04-delivery/delivery-summary.md`       | Delivery Summary                      | ✅  | ~3,000 | reference   | all            | current   | 12 iterations: 395 backend (91%), 287 frontend (87%), 64 E2E   |
| D3  | `04-delivery/future-improvements.md`    | Known Limitations & Future Directions | ✅  | ~1,500 | explanation | staff-engineer | current   | 7 deferred items (worker profile, observability, PostgreSQL…)  |
| D4  | `04-delivery/implementation-history.md` | Implementation History                | ❌  | ~800   | reference   | all            | current   | 19 iterations timeline (2026-02-24 → 2026-03-05) with PR links |
| D5  | `04-delivery/implementation-plan.md`    | Implementation Plan                   | ✅  | ~4,000 | reference   | contributor    | current   | 14 releases, 45+ user stories, sequencing, acceptance criteria |

## E — Project / 99-archive

| #   | Path                               | Title                          | FM  | Words  | Diátaxis  | Audience  | Staleness | Notes                                                             |
| --- | ---------------------------------- | ------------------------------ | --- | ------ | --------- | --------- | --------- | ----------------------------------------------------------------- |
| E1  | `99-archive/12-factor-audit.md`    | 12-Factor Audit                | ❌  | ~2,500 | reference | developer | stale     | Historical snapshot (2026-02-23); items resolved Iter 2–11        |
| E2  | `99-archive/codebase-audit.md`     | Codebase Maintainability Audit | ❌  | ~3,000 | reference | developer | stale     | Historical snapshot (2026-02-23); 15 findings resolved by Iter 12 |
| E3  | `99-archive/cto-review-verdict.md` | CTO Review Verdict             | ❌  | ~2,000 | reference | all       | stale     | Historical snapshot (2026-02-24); superseded                      |

## F — Shared docs

| #   | Path                                         | Title                             | FM  | Words  | Diátaxis    | Audience    | Staleness | Notes                                                     |
| --- | -------------------------------------------- | --------------------------------- | --- | ------ | ----------- | ----------- | --------- | --------------------------------------------------------- |
| F1  | `shared/01-product/brand-guidelines.md`      | Barkibu — Brand Guidelines        | ✅  | ~1,500 | reference   | all         | current   | Colors (#FC4E1B), typography, layout, tone of voice       |
| F2  | `shared/01-product/ux-guidelines.md`         | UX Guidelines — Shared Principles | ✅  | ~1,000 | explanation | all         | current   | Clarity, cognitive load, human-in-the-loop, accessibility |
| F3  | `shared/02-tech/coding-standards.md`         | Coding Standards                  | ❌  | ~1,500 | reference   | contributor | current   | PEP 8, type hints, domain purity, testing discipline      |
| F4  | `shared/02-tech/documentation-guidelines.md` | Documentation Guidelines          | ❌  | ~1,200 | reference   | contributor | current   | Docstrings, API docs, types, Google-style format          |
| F5  | `shared/02-tech/llm-benchmarks.md`           | LLM Benchmarks System             | ✅  | ~1,000 | explanation | developer   | current   | Premium Request billing, tok_est proxy, data flow         |
| F6  | `shared/03-ops/way-of-working.md`            | Way of Working                    | ❌  | ~2,000 | reference   | developer   | current   | Branching, commits, PR, review, merge workflow            |

## P — Active Plans

| #   | Path                                                                   | Title                        | FM  | Words  | Staleness    | Notes                                  |
| --- | ---------------------------------------------------------------------- | ---------------------------- | --- | ------ | ------------ | -------------------------------------- |
| P1  | `04-delivery/plans/PLAN_2026-02-28_DOCS-IMPROVEMENT.md`                | Docs Improvement (this plan) | ❌  | ~2,500 | needs-update | Phase 4R re-baseline pending           |
| P2  | `04-delivery/plans/PLAN_2026-03-06_GOLDEN-LOOP-OWNER-ADDRESS.md`       | Golden Loop — owner_address  | ❌  | ~1,800 | current      | 4 phases; extraction hardening         |
| P3  | `04-delivery/plans/PLAN_2026-03-06_VISIT-SCOPED-WEIGHT.md`             | Visit-Scoped Weight          | ❌  | ~1,500 | current      | 3 phases; multi-visit weight (Spanish) |
| P4  | `04-delivery/plans/PLAN_2026-03-06_WORKTREE-PREFIXED-BRANCH-NAMING.md` | Worktree Branch Naming       | ❌  | ~1,200 | current      | 4 phases completed; enforcement active |

## H — Completed Plans (historical, not audited individually)

> 26 files in `04-delivery/plans/completed/`. All are historical records of executed plans.  
> Naming: mixed convention (some `COMPLETED_*`, some `completed-*`, some `PLAN_*`).  
> **Action needed (D4R-E):** Normalize naming convention across completed plans.

---

## Summary Statistics

| Metric                    | Value       |
| ------------------------- | ----------- |
| **Canonical wiki files**  | 33          |
| **Active plans**          | 4           |
| **Completed plans**       | 26          |
| **Total files**           | 63          |
| **With YAML frontmatter** | 17/37 (46%) |
| **Without frontmatter**   | 20/37 (54%) |
| **Estimated total words** | ~82,000     |

### Diátaxis distribution (33 canonical + 4 plans)

| Type                  | Count | %   |
| --------------------- | ----- | --- |
| reference             | 28    | 76% |
| explanation           | 4     | 11% |
| how-to                | 1     | 3%  |
| index                 | 1     | 3%  |
| plan (not classified) | 4     | —   |

### Staleness

| Status       | Count                 |
| ------------ | --------------------- |
| current      | 30                    |
| needs-update | 1 (this plan)         |
| stale        | 3 (all in 99-archive) |

### Frontmatter gaps (20 files without FM)

All ADRs (B1–B5), all 03-ops docs (C1–C5), D4, all 99-archive (E1–E3), F3, F4, F6, and all plans (P1–P4).

### Observations for subsequent D4R steps

1. **C1 (`execution-rules.md`) is fully redundant** — 100% absorbed by C4 (`plan-execution-protocol.md`) + C5 (`plan-management.md`) + F6 (`way-of-working.md`). Contains stale references (`ENGINEERING_PLAYBOOK.md`, UPPER_CASE paths). D4R-B should propose archive or delete.
2. **Naming inconsistency in completed plans** — mixed `COMPLETED_*`, `completed-*`, `PLAN_*` (D4R-E).
3. **Language inconsistency** — C3 is in Spanish, rest in English (D4R-E consideration).
4. **Diátaxis imbalance** — heavy on reference (76%), only 1 how-to, 0 tutorials (D4R-F consideration).
5. **03-ops has 0% frontmatter** — entire category needs FM added (Phase 5).

---

## D4R-B — Consolidation Report (2026-03-06)

### Findings

| #   | Type          | Sev | Files                                                      | Finding                                                                                                                                                                                | Recommendation                                                                                      |
| --- | ------------- | --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | redundant     | 🔴  | C1 `execution-rules.md`                                    | 100% absorbed by C4+C5+F6. Stale refs to deleted `ENGINEERING_PLAYBOOK.md` (line 20, 480) and UPPER_CASE `TECHNICAL_DESIGN.md` (line 33). ~2,000 LOC duplicated.                       | **Delete or archive to `99-archive/`.** Update any router/agent refs to point to C4.                |
| 2   | contradiction | 🔴  | D2 `delivery-summary.md` vs D4 `implementation-history.md` | E2E test count: D2 says "64 tests / 21 specs" while D4 says "65 tests / 22 specs" for Iter 12.                                                                                         | Verify from CI and fix the incorrect one.                                                           |
| 3   | stale-content | 🟠  | D2 `delivery-summary.md`                                   | Narrative stops at "Iteration 12 (current)" with PR #169 "in progress". Project is now at iteration 19.                                                                                | Add note: "This doc summarizes iterations 1–12. For full timeline see `implementation-history.md`." |
| 4   | stale-content | 🟠  | B6 `architecture.md`                                       | Metrics table title says "post-Iteration 12" but project is at iter 19. Project structure tree is incomplete (missing `processing/`, `documents/`, `confidence_calibration/` modules). | Update table header with current date. Audit tree against actual `backend/app/` structure.          |
| 5   | stale-content | 🟠  | B10 `technical-design.md` §14                              | "5 hooks + 3 panel components" — actual count is 8 custom hooks. Inline iteration references (Iter 10, Iter 11, Iter 2) scattered through text age the doc visibly.                    | Fix hooks count. Replace inline iteration refs with commit SHAs or ADR links.                       |
| 6   | overlap       | 🟡  | C4 vs C5                                                   | Boundaries are correct (C4=execution, C5=authoring) but relationship is implicit. Reader must infer the split.                                                                         | Add 1-line cross-reference at top of each file clarifying the split.                                |
| 7   | stale-content | 🟡  | E1, E2, E3 (archive)                                       | Historical markers present (✅) but no pointer to current state. Frozen metrics confuse readers.                                                                                       | Add footer to each: "Historical snapshot. For current state see `implementation-history.md`."       |
| 8   | stale-ref     | 🟡  | B10 `technical-design.md`                                  | Inline iteration number references (lines 507, 597, 610) make doc age visibly.                                                                                                         | Replace with feature IDs / PR links for stability.                                                  |
| 9   | overlap       | 🟢  | A3 `ux-design.md` vs F2 `ux-guidelines.md`                 | **No duplication.** A3 is project-specific, F2 is shared principles. A3 already cross-references F2.                                                                                   | No action needed.                                                                                   |
| 10  | overlap       | 🟢  | D3 `future-improvements.md` vs D5 `implementation-plan.md` | **No duplication.** D3 is conscious trade-offs, D5 is planned releases. Different scope.                                                                                               | No action needed.                                                                                   |

### Consolidation Decisions (pending user approval — D4R-C)

| #       | Action     | Target                                  | Decision                              |
| ------- | ---------- | --------------------------------------- | ------------------------------------- |
| **C-1** | 🗑️ Archive | C1 `execution-rules.md` → `99-archive/` | Redundant file, stale references      |
| **C-2** | 🔧 Fix     | D2 vs D4 E2E count contradiction        | Verify from CI, correct wrong value   |
| **C-3** | 🔧 Fix     | D2 `delivery-summary.md`                | Add scoping note ("iterations 1–12")  |
| **C-4** | 🔧 Fix     | B6 `architecture.md`                    | Update metrics table + project tree   |
| **C-5** | 🔧 Fix     | B10 `technical-design.md`               | Fix hooks count, clean iteration refs |
| **C-6** | 🔧 Fix     | C4 + C5 cross-references                | Add 1-line header clarifying split    |
| **C-7** | 🔧 Fix     | E1, E2, E3 archive footers              | Add "current state" pointer           |
| **C-8** | 🔧 Fix     | B10 iteration inline refs               | Replace with stable identifiers       |

**Awaiting user approval (D4R-C) to proceed with D4R-D (apply corrections).**

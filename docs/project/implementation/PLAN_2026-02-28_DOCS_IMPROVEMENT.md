# Plan: Documentation Improvement — Wiki audit, restructure & standardization

> **Operational rules:** See [EXECUTION_RULES.md](EXECUTION_RULES.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Rama:** `docs/documentation-refactor`
**PR:** [#154](https://github.com/isilionisilme/veterinary-medical-records/pull/154)
**Prerequisito:** Iteration 12 merged to `main`.

## Context

The project's canonical documentation (`docs/project/`, `docs/shared/`, `docs/README.md`) has grown organically across 12+ iterations. It needs an audit-first restructure to eliminate stale/duplicate content, establish a consistent taxonomy, normalize templates, and automate quality gates.

**Entry state:** Doc tooling installed (`markdownlint-cli2`, `markdown-link-check`, Prettier Markdown scope) via commit `a7c2c3d7`. No structural changes yet.

**Exit target:** Clean, navigable wiki with consistent templates, working TOCs, passing lint/link checks, and a CI docs-QA pipeline.

## Scope Boundary (strict)

- **In scope:** canonical human documentation (`docs/project/`, `docs/shared/`, `docs/README.md`).
- **Out of scope:** agent routing modules (`docs/agent_router/` — instructions, not wiki content).
- **Exception:** Broken Link Checker and Terminology Enforcer may run across wiki + router when explicitly required.
- **Out of scope:** application code (`backend/`, `frontend/`).

---

## Estado de ejecución — update on completion of each step

> **Rationale del orden:** Primero saber qué tenemos (inventario + auditoría de calidad) →
> decidir qué queda y cómo se organiza (estructura) → normalizar formato → pulir estilo → automatizar.

**Leyenda:**
- 🔄 **auto-chain** — Codex ejecuta; usuario revisa después.
- 🚧 **hard-gate** — Claude; requiere decisión del usuario.

### Phase 0 — Bootstrap

- [x] D0-A 🔄 — Install doc tooling, root config, docs scripts (Codex) — ✅ `a7c2c3d7`
- [x] D0-B 🚧 — Review + approve bootstrap changes (Claude) — ✅
- [x] D0-C 🚧 — Create docs PR, initialize PR tracking (Claude) — ✅ PR #154

### Phase 1 — Inventory and audit (know what we have)

- [x] D1-A 🚧 — Build current-state inventory of canonical docs: path, type, audience, staleness, status · skill: `microsoft-wiki-architect` (Claude) — ✅
- [x] D1-B 🚧 — Detect duplicate/stale content → consolidation report with keep/merge/delete recommendations · skill: `duplicate-stale-detector` (Claude) — ✅
- [ ] D1-C 🚧 — User approves consolidation decisions (Claude)
- [ ] D1-D 🔄 — Apply consolidation/deprecation updates (Codex)
- [ ] D1-E 🚧 — Full docs QA audit against current codebase reality · skill: `architecture-doc-auditor` (Claude)
- [ ] D1-F 🚧 — User prioritizes QA findings: fix now vs defer (Claude)
- [ ] D1-G 🔄 — Implement approved QA corrections (Codex)

### Phase 2 — Structure and taxonomy (organize what survives)

- [ ] D2-A 🚧 — Propose target taxonomy and folder hierarchy based on clean inventory; user approves · skill: `microsoft-wiki-architect` (Claude)
- [ ] D2-B 🔄 — Migrate files to approved structure and update internal links (Codex)
- [ ] D2-C 🚧 — User validation of migrated structure and content integrity · skill: `microsoft-wiki-qa` (Claude)

### Phase 3 — Templates and normalization

- [ ] D3-A 🚧 — Define templates per doc type (Diátaxis: tutorial, how-to, reference, explanation) · skill: `template-normalizer` (Claude)
- [ ] D3-B 🚧 — User approval of templates (Claude)
- [ ] D3-C 🔄 — Normalize existing docs to approved templates · skill: `template-normalizer` (Codex)
- [ ] D3-D 🚧 — User validation of normalized docs (Claude)

### Phase 4 — Navigation

- [ ] D4-A 🔄 — Build sitemap, TOCs, breadcrumbs for canonical docs · tool: `doctoc` (Codex)
- [ ] D4-B 🚧 — User validation of navigation quality (Claude)

### Phase 5 — Format and Markdown standardization

- [ ] D5-A 🔄 — Run markdown lint autofix + prettier write on docs scope · tools: `markdownlint-cli2`, `prettier` (Codex)
- [ ] D5-B 🚧 — User review formatting diff (Claude)
- [ ] D5-C 🚧 — Define frontmatter schema(s) and validation approach · skill: `frontmatter-validator` (Claude)
- [ ] D5-D 🔄 — Apply frontmatter + implement validator script · skill: `frontmatter-validator` (Codex)
- [ ] D5-E 🚧 — User review metadata correctness (Claude)
- [ ] D5-F 🔄 — Run broken link/anchor checks → produce report · tool: `markdown-link-check` (Codex)
- [ ] D5-G 🔄 — Fix broken links/anchors · tool: `markdown-link-check` (Codex)

### Phase 6 — Readability and style

- [ ] D6-A 🚧 — Readability analysis and prioritized report (Claude)
- [ ] D6-B 🚧 — Rewrite key pages for clarity/scannability with Mermaid diagrams and source citations · skill: `microsoft-wiki-page-writer` (Claude)
- [ ] D6-C 🚧 — User validation of rewritten technical content (Claude)
- [ ] D6-D 🚧 — Define canonical glossary and approved terminology · skill: `terminology-enforcer` (Claude)
- [ ] D6-E 🚧 — User approval of glossary (Claude)
- [ ] D6-F 🔄 — Apply terminology consistency updates across scope · skill: `terminology-enforcer` (Codex)

### Phase 7 — Onboarding and changelog

- [ ] D7-A 🚧 — Generate audience-tailored onboarding guides (Contributor, Staff Engineer, Executive, PM) · skill: `microsoft-wiki-onboarding` (Claude)
- [ ] D7-B 🚧 — User review + approve onboarding guides (Claude)
- [ ] D7-C 🚧 — Generate structured changelog from git history · skill: `microsoft-wiki-changelog` (Claude)
- [ ] D7-D 🚧 — User review changelog (Claude)

### Phase 8 — Maintenance and automation

- [ ] D8-A 🚧 — Design docs QA CI pipeline · skill: `docs-pr-gatekeeper` (Claude)
- [ ] D8-B 🔄 — Implement CI workflow + script wiring · skill: `docs-pr-gatekeeper` (Codex)
- [ ] D8-C 🚧 — User verifies expected pass/fail behavior in CI (Claude)

### Closure

- [ ] D9-A 🚧 — Final smoke review and acceptance decision for merge readiness · skill: `microsoft-wiki-qa` (Claude)

---

## Cola de prompts

> Pre-written prompts for semi-unattended execution. Codex reads these directly.
> Prompts that depend on prior results are marked "just-in-time" — Claude writes them after the dependency resolves.

_No prompts written yet. Claude will populate as phases begin._

---

## Prompt activo

### Paso objetivo

_Empty._

### Prompt

_Empty._

---

## Audit Results (source of truth)

> Each section is filled when the corresponding step is completed. Results stay here as the single reference for downstream steps.

### D1-A — Document inventory

**40 files** in scope | **~83,650 words** | Collected 2026-02-28

| Path | Title | Type | Audience | Status | Words | Notes |
|---|---|---|---|---|---|---|
| docs/README.md | Scope (Docs Index) | index | all | active | 528 | Reading order, authority chain |
| docs/project/ARCHITECTURE.md | Architecture Overview | reference | all | active | 527 | One-page summary with diagram |
| docs/project/BACKEND_IMPLEMENTATION.md | Backend Implementation Notes | guide | contributor | active | 1,870 | Layering, persistence, processing |
| docs/project/DESIGN_SYSTEM.md | Lean Design System | reference | contributor | active | 1,243 | Color/spacing tokens, a11y |
| docs/project/FRONTEND_IMPLEMENTATION.md | Frontend Implementation Notes | guide | contributor | active | 1,631 | Stack, PDF rendering, confidence UX |
| docs/project/FUTURE_IMPROVEMENTS.md | Known Limitations & Future Directions | explanation | staff-engineer | active | 765 | Reframed 2026-02-27 |
| docs/project/IMPLEMENTATION_PLAN.md | Implementation Plan | plan | contributor | active | 15,394 | **Very large**; 6 releases |
| docs/project/MANUAL_QA_REGRESSION_CHECKLIST.md | Manual QA Regression Checklist | how-to | all | active | 958 | All cases "Pending" |
| docs/project/PRODUCT_DESIGN.md | Product Design | explanation | all | active | 2,272 | Strategy, confidence, Global Schema |
| docs/project/TECHNICAL_DESIGN.md | Technical Design | reference | contributor | active | 9,637 | **Very large**; contracts, state machines |
| docs/project/UX_DESIGN.md | UX Design | reference | contributor | active | 2,131 | Review flow, rendering rules |
| docs/project/adr/ADR-ARCH-0001-modular-monolith.md | ADR-ARCH-0001 | adr | staff-engineer | active | 426 | |
| docs/project/adr/ADR-ARCH-0002-sqlite-database.md | ADR-ARCH-0002 | adr | staff-engineer | active | 369 | |
| docs/project/adr/ADR-ARCH-0003-raw-sql-repository-pattern.md | ADR-ARCH-0003 | adr | staff-engineer | active | 376 | |
| docs/project/adr/ADR-ARCH-0004-in-process-async-processing.md | ADR-ARCH-0004 | adr | staff-engineer | active | 368 | |
| docs/project/adr/README.md | ADR Index | index | all | active | 103 | |
| docs/project/implementation/EXECUTION_RULES.md | Execution Rules | reference | contributor | active | 5,197 | Agent protocol; large |
| docs/project/implementation/IMPLEMENTATION_HISTORY.md | Implementation History | changelog | all | active | 571 | 12 iterations |
| docs/project/implementation/PLAN_2026-02-28_DOCS_IMPROVEMENT.md | Plan: Docs Improvement | plan | contributor | active | 1,053 | This plan (active) |
| docs/project/implementation/completed/COMPLETED_ITER-1-2.md | Completed: Iter 1-2 | changelog | contributor | active | 517 | |
| docs/project/implementation/completed/COMPLETED_ITER-3.md | Completed: Iter 3 | changelog | contributor | active | 169 | |
| docs/project/implementation/completed/COMPLETED_ITER-4.md | Completed: Iter 4 | changelog | contributor | active | 172 | |
| docs/project/implementation/completed/COMPLETED_ITER-5.md | Completed: Iter 5 | changelog | contributor | active | 173 | |
| docs/project/implementation/completed/COMPLETED_ITER-6.md | Completed: Iter 6 | changelog | contributor | active | 258 | |
| docs/project/implementation/completed/COMPLETED_ITER-7.md | Completed: Iter 7 | changelog | contributor | active | 279 | |
| docs/project/implementation/completed/COMPLETED_ITER-8.md | Completed: Iter 8 | changelog | contributor | active | 367 | |
| docs/project/implementation/completed/COMPLETED_ITER-9.md | Completed: Iter 9 | changelog | contributor | active | 412 | |
| docs/project/implementation/completed/COMPLETED_2026-02-26_INSTALL_PLAYWRIGHT.md | Plan: Playwright Install | plan | contributor | active | 2,151 | Spanish; full plan |
| docs/project/implementation/completed/COMPLETED_2026-02-26_ITER-9-E2E.md | Plan: Iter 9 E2E | plan | contributor | active | 2,768 | Full step log |
| docs/project/implementation/completed/COMPLETED_2026-02-26_ITER-10-HARDENING.md | Plan: Iter 10 Hardening | plan | contributor | active | 2,895 | |
| docs/project/implementation/completed/COMPLETED_2026-02-27_ITER-11-FULLSTACK-HARDENING.md | Plan: Iter 11 Hardening | plan | contributor | active | 4,080 | Largest completed |
| docs/project/implementation/completed/COMPLETED_2026-02-27_ITER-12-FINAL.md | Plan: Iter 12 Final | plan | contributor | active | 3,600 | |
| docs/project/refactor/12_FACTOR_AUDIT.md | 12-Factor Audit | audit | staff-engineer | **stale** | 628 | Findings resolved in Iter 2+ |
| docs/project/refactor/CTO_REVIEW_VERDICT.md | CTO Review Verdict | audit | staff-engineer | **stale** | 1,880 | "Still open" resolved; **broken link** |
| docs/project/refactor/codebase_audit.md | Codebase Maintainability Audit | audit | staff-engineer | **stale** | 1,783 | Findings resolved in Iter 1-12 |
| docs/project/refactor/DELIVERY_SUMMARY.md | Delivery Summary | reference | all | active | 3,763 | Quantitative metrics |
| docs/project/testing/PLAN_E2E_TEST_COVERAGE.md | Plan E2E Test Coverage | plan | contributor | active | 7,508 | **Very large**; Spanish |
| docs/shared/BRAND_GUIDELINES.md | Brand Guidelines | reference | all | active | 494 | |
| docs/shared/ENGINEERING_PLAYBOOK.md | Engineering Guidelines | reference | contributor | active | 3,802 | Mandatory standards |
| docs/shared/UX_GUIDELINES.md | UX Guidelines | reference | all | active | 536 | |

**Key findings for downstream phases:**

1. **3 stale files** in `refactor/`: 12_FACTOR_AUDIT, CTO_REVIEW_VERDICT (broken link), codebase_audit — findings resolved in iterations 1-12
2. **Size concentration**: IMPLEMENTATION_PLAN (15K), TECHNICAL_DESIGN (9.6K), PLAN_E2E_TEST_COVERAGE (7.5K) = 39% of all words → split/TOC candidates
3. **Completed plan format inconsistency**: `COMPLETED_ITER-N.md` (summaries, 169-517w) vs `COMPLETED_<date>_<slug>.md` (full plans, 2K-4Kw) — two naming conventions coexist
4. **Language mixing**: PLAN_E2E_TEST_COVERAGE and INSTALL_PLAYWRIGHT are Spanish; Engineering Playbook mandates English
5. **EXECUTION_RULES.md** (5.2K) is agent protocol, not human wiki — may need reclassification
6. **12 completed files** total ~17.8K words — consider whether full plans or summaries should persist

### D1-B — Duplicate/stale findings

**4 stale** | **5 duplicate pairs** | **3 contradictions** | Collected 2026-02-28

#### Stale files (content-based; all committed within 90 days but content outdated)

| File | Severity | Evidence |
|---|---|---|
| DESIGN_SYSTEM.md | **High** | 6+ color tokens diverge from actual CSS in `index.css`; active implementation contract |
| refactor/CTO_REVIEW_VERDICT.md | **High** | Metrics (411 tests→682, 7 CI→10), all gaps resolved; broken link `../production/` |
| refactor/codebase_audit.md | **High** | All 15 findings resolved in Iter 1-12; score table misleading |
| refactor/12_FACTOR_AUDIT.md | Medium | All 5 backlog items resolved |

#### Duplicate / near-duplicate pairs

| File A | File B | Score | Suggested action |
|---|---|---|---|
| BRAND_GUIDELINES.md | DESIGN_SYSTEM.md | 0.70 | **MERGE** — DS should reference BRAND for color values, keep DS-only tokens |
| DELIVERY_SUMMARY.md | IMPLEMENTATION_HISTORY.md | 0.90 | **DEDUPLICATE** — remove cumulative table from HISTORY, keep in DELIVERY |
| CTO_REVIEW_VERDICT.md | codebase_audit.md | 0.85 | **ARCHIVE both** — historical artifacts, knowledge in completed files |
| COMPLETED_ITER-9.md | COMPLETED_2026-02-26_ITER-9-E2E.md | 0.85 | **CONSOLIDATE** — keep one canonical file per iteration |
| DELIVERY_SUMMARY.md | completed/* (collective) | 0.75 | **REVIEW** — acceptable rollup, no action now |

#### Contradictions

| Files | Topic | Severity |
|---|---|---|
| BRAND_GUIDELINES ↔ DESIGN_SYSTEM ↔ index.css | Color tokens (3-way divergence, 6+ tokens) | **High** |
| DELIVERY_SUMMARY ↔ ARCHITECTURE.md | CI job count (9+1 vs 10) | Low |
| CTO_REVIEW_VERDICT ↔ current state | Test counts, gap status | Medium (resolved by archiving) |

#### Recommended action priority

1. **UPDATE** DESIGN_SYSTEM.md — sync tokens to CSS (high-severity contradiction)
2. **UPDATE** CTO_REVIEW_VERDICT.md — fix broken link + archive banner
3. **ARCHIVE** codebase_audit.md — resolution banner + status column
4. **ARCHIVE** 12_FACTOR_AUDIT.md — resolution banner
5. **MERGE** BRAND↔DS color overlap — reference instead of restate
6. **DEDUPLICATE** IMPLEMENTATION_HISTORY cumulative table
7. **CONSOLIDATE** COMPLETED_ITER-9 with full plan file

### D1-E — QA audit findings

_To be filled._

### D2-A — Approved taxonomy

_To be filled._

### D6-A — Readability report

_To be filled._

### D6-D — Canonical glossary

_To be filled._

### D7-A — Onboarding guides

_To be filled._

### D7-C — Changelog

_To be filled._

### D9-A — Final smoke review

_To be filled._

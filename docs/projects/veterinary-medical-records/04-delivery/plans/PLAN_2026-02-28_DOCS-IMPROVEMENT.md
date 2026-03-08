# Plan: Documentation Improvement — Wiki audit, restructure & standardization

> **Operational rules:** See [plan-execution-protocol.md](../../03-ops/plan-execution-protocol.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Branch:** `docs/documentation-refactor`
**PR:** [#154](https://github.com/isilionisilme/veterinary-medical-records/pull/154)
**User Story:** [US-67](../implementation-plan.md)
**Prerequisite:** Iteration 12 merged to `main`.
**Worktree:** `D:/Git/veterinary-medical-records` (default — single worktree)
**CI Mode:** Pipeline depth-1 gate (mode 2, default)
**Agents:** Planning agent + Execution agent

## Objective

Audit, restructure, and standardize the project's canonical documentation to eliminate stale/duplicate content, apply consistent templates and navigation, and automate quality gates via CI.

## Context

The project's canonical documentation (`docs/projects/veterinary-medical-records/`, `docs/shared/`, `docs/README.md`) has grown organically across 12+ iterations. It needs an audit-first restructure to eliminate stale/duplicate content, establish a consistent taxonomy, normalize templates, and automate quality gates.

**Entry state:** Doc tooling installed (`markdownlint-cli2`, `markdown-link-check`, Prettier Markdown scope) via commit `a7c2c3d7`. No structural changes yet.

**Exit target:** Clean, navigable wiki with consistent templates, working TOCs, passing lint/link checks, and a CI docs-QA pipeline.

## Scope Boundary (strict)

- **In scope:** canonical human documentation (`docs/projects/veterinary-medical-records/`, `docs/shared/`, `docs/README.md`).
- **Out of scope:** assistant routing modules (execution instructions, not wiki content).
- **Exception:** Broken Link Checker and Terminology Enforcer may run across wiki + router when explicitly required.
- **Out of scope:** application code (`backend/`, `frontend/`).

## Commit plan

> This plan predates the formal commit-task schema. Phases 0–4 were executed with ad-hoc commits.
> From Phase 5 onward, commit tasks follow the required operational override step schema.

| Commit task | Trigger | Scope | Message | Push |
|---|---|---|---|---|
| CT-D5-1 | After D5-A | Lint/format fixes in `docs/` scope | `docs(plan-d5a): markdown lint autofix + prettier` | Immediate |
| CT-D5-2 | After D5-D | Frontmatter + validator script | `docs(plan-d5d): apply frontmatter schema + validator` | Immediate |
| CT-D5-3 | After D5-G | Broken link fixes | `docs(plan-d5g): fix broken links and anchors` | Immediate |
| CT-D6-1 | After D6-B | Rewritten pages | `docs(plan-d6b): rewrite key pages for readability` | Immediate |
| CT-D6-2 | After D6-F | Terminology updates | `docs(plan-d6f): apply terminology consistency` | Immediate |
| CT-D7-1 | After D7-A | Onboarding guides | `docs(plan-d7a): add onboarding guides` | Immediate |
| CT-D7-2 | After D7-C | Changelog | `docs(plan-d7c): add structured changelog` | Immediate |
| CT-D8-1 | After D8-B | CI pipeline + scripts | `ci(plan-d8b): docs QA CI pipeline` | Immediate |

## Operational override steps

> Phases 0–4 were completed before this schema was required. Retroactive documentation only.
> From Phase 5 onward, override steps follow the required schema.

### CT-D5-1 — Commit lint/format fixes

- **type:** `commit-task`
- **trigger:** After D5-A completion
- **preconditions:** D5-A changes staged, L1 green
- **commands:** `git add docs/; git commit -m "docs(plan-d5a): markdown lint autofix + prettier"`; `git push origin <branch>`
- **approval:** `auto`
- **fallback:** Revert staged changes and report formatter errors

### CT-D5-2 — Commit frontmatter + validator

- **type:** `commit-task`
- **trigger:** After D5-D completion
- **preconditions:** D5-C schema approved (D5-E), D5-D applied, L1 green
- **commands:** `git add docs/ scripts/; git commit -m "docs(plan-d5d): apply frontmatter schema + validator"`; `git push origin <branch>`
- **approval:** `auto`
- **fallback:** Revert staged changes and report validation errors

### CT-D5-3 — Commit broken link fixes

- **type:** `commit-task`
- **trigger:** After D5-G completion
- **preconditions:** D5-F report generated, D5-G fixes applied, L1 green
- **commands:** `git add docs/; git commit -m "docs(plan-d5g): fix broken links and anchors"`; `git push origin <branch>`
- **approval:** `auto`
- **fallback:** Document unfixable links and continue

### CT-D8-1 — Commit CI pipeline

- **type:** `commit-task`
- **trigger:** After D8-B completion
- **preconditions:** D8-A design approved, D8-B implemented, L1 green
- **commands:** `git add .github/ scripts/; git commit -m "ci(plan-d8b): docs QA CI pipeline"`; `git push origin <branch>`
- **approval:** `auto`
- **fallback:** Report CI configuration issues

## Acceptance criteria

1. All canonical docs pass `markdownlint-cli2` with zero errors.
2. All canonical docs pass `markdown-link-check` with zero broken links.
3. All canonical docs have valid frontmatter per the approved schema.
4. Navigation (TOCs, sitemap, breadcrumbs) is complete and verified.
5. Key technical pages have been rewritten for readability with Mermaid diagrams.
6. Canonical glossary is defined and terminology is consistent across scope.
7. Onboarding guides exist for all four audiences.
8. CI pipeline runs docs QA on every PR touching `docs/`.
9. All templates are applied per Diátaxis classification.

## How to test

1. `npx markdownlint-cli2 "docs/**/*.md"` — zero errors.
2. `npx markdown-link-check docs/**/*.md --config .markdown-link-check.json` — zero broken links.
3. `node scripts/docs/validate-frontmatter.js` (or equivalent) — all files valid.
4. Manual review: navigate wiki from `docs/README.md` through all TOC links — no dead ends.
5. CI: push a docs-only change and verify the docs QA pipeline runs and passes.

---

## Execution Status — update on completion of each step

> **Rationale:** First know what we have (inventory + quality audit) →
> decide what stays and how it's organized (structure) → normalize format → polish style → automate.

**Legend:**
- 🔄 **auto-chain** — Execution agent executes; user reviews afterwards.
- 🚧 **hard-gate** — Planning agent; requires user decision.

> **Note:** 🔄/🚧 classify step *type* (auto-chain vs hard-gate). The protocol's ⏳/🚫/🔒 markers in §3 classify *execution state* at runtime.

### Phase 0 — Bootstrap

- [x] D0-A 🔄 — Install doc tooling, root config, docs scripts (Execution agent) — ✅ `a7c2c3d7`
- [x] D0-B 🚧 — Review + approve bootstrap changes (Planning agent) — ✅ `no-commit (review/approval)`
- [x] D0-C 🚧 — Create docs PR, initialize PR tracking (Planning agent) — ✅ `no-commit (PR #154 creation)`

### Phase 1 — Inventory and audit (know what we have)

- [x] D1-A 🚧 — Build current-state inventory of canonical docs: path, type, audience, staleness, status · skill: `microsoft-wiki-architect` (Planning agent) — ✅ `no-commit (analysis)`
- [x] D1-B 🚧 — Detect duplicate/stale content → consolidation report with keep/merge/delete recommendations · skill: `duplicate-stale-detector` (Planning agent) — ✅ `no-commit (analysis)`
- [x] D1-C 🚧 — User approves consolidation decisions (Planning agent) — ✅ `no-commit (user approval)`
- [x] D1-D 🔄 — Apply consolidation/deprecation updates (Execution agent) — ✅ `9653c790`
- [x] D1-E 🚧 — Full docs QA audit against current codebase reality · skill: `architecture-doc-auditor` (Planning agent) — ✅ `no-commit (analysis)`
- [x] D1-F 🚧 — User prioritizes QA findings: fix now vs defer (Planning agent) — ✅ `no-commit (user approval)`
- [x] D1-G 🔄 — Implement approved QA corrections (Execution agent) — ✅ `681e38e7`

### Phase 2 — Structure and taxonomy (organize what survives)

- [x] D2-A 🚧 — Propose target taxonomy and folder hierarchy based on clean inventory; user approves · skill: `microsoft-wiki-architect` (Planning agent) — ✅ `no-commit (analysis + user approval v2)`
- [x] D2-B 🔄 — Migrate files to approved structure and update internal links (Execution agent) — ✅ `no-commit (implemented in PR #154 merge)`
- [x] D2-C 🚧 — User validation of migrated structure and content integrity · skill: `microsoft-wiki-qa` (Planning agent) — ✅ `no-commit (validated in PR-A docs/wiki-naming-cleanup)`

### Phase 3 — Templates and normalization

- [x] D3-A 🚧 — Define templates per doc type (Diátaxis: tutorial, how-to, reference, explanation) · skill: `template-normalizer` (Planning agent) — ✅ `no-commit (analysis + user approval 2026-03-02)`
- [x] D3-B 🚧 — User approval of templates (Planning agent) — ✅ `no-commit (user approval 2026-03-02)`
- [x] D3-C 🔄 — Normalize existing docs to approved templates · skill: `template-normalizer` (Execution agent) — ✅ `no-commit (applied 2026-03-02, committed in D3-D)`
- [x] D3-D 🚧 — User validation of normalized docs (Planning agent) — ✅ `c8daa6c8` (PR #184, CI green)

### Phase 4 — Navigation

- [x] D4-A 🔄 — Build sitemap, TOCs, breadcrumbs for canonical docs · tool: `doctoc` (Execution agent) — ✅ `01375f23`
- [ ] D4-B 🚧 — User validation of navigation quality (Planning agent)

### Phase 5 — Format and Markdown standardization

- [ ] D5-A 🔄 — Run markdown lint autofix + prettier write on docs scope · tools: `markdownlint-cli2`, `prettier` (Execution agent)
- [ ] D5-B 🚧 — User review formatting diff (Planning agent)
- [ ] D5-C 🚧 — Define frontmatter schema(s) and validation approach · skill: `frontmatter-validator` (Planning agent)
- [ ] D5-D 🔄 — Apply frontmatter + implement validator script · skill: `frontmatter-validator` (Execution agent)
- [ ] D5-E 🚧 — User review metadata correctness (Planning agent)
- [ ] D5-F 🔄 — Run broken link/anchor checks → produce report · tool: `markdown-link-check` (Execution agent)
- [ ] D5-G 🔄 — Fix broken links/anchors · tool: `markdown-link-check` (Execution agent)

### Phase 6 — Readability and style

- [ ] D6-A 🚧 — Readability analysis and prioritized report (Planning agent)
- [ ] D6-B 🚧 — Rewrite key pages for clarity/scannability with Mermaid diagrams and source citations · skill: `microsoft-wiki-page-writer` (Planning agent)
- [ ] D6-C 🚧 — User validation of rewritten technical content (Planning agent)
- [ ] D6-D 🚧 — Define canonical glossary and approved terminology · skill: `terminology-enforcer` (Planning agent)
- [ ] D6-E 🚧 — User approval of glossary (Planning agent)
- [ ] D6-F 🔄 — Apply terminology consistency updates across scope · skill: `terminology-enforcer` (Execution agent)

### Phase 7 — Onboarding and changelog

- [ ] D7-A 🚧 — Generate audience-tailored onboarding guides (Contributor, Staff Engineer, Executive, PM) · skill: `microsoft-wiki-onboarding` (Planning agent)
- [ ] D7-B 🚧 — User review + approve onboarding guides (Planning agent)
- [ ] D7-C 🚧 — Generate structured changelog from git history · skill: `microsoft-wiki-changelog` (Planning agent)
- [ ] D7-D 🚧 — User review changelog (Planning agent)

### Phase 8 — Maintenance and automation

- [ ] D8-A 🚧 — Design docs QA CI pipeline · skill: `docs-pr-gatekeeper` (Planning agent)
- [ ] D8-B 🔄 — Implement CI workflow + script wiring · skill: `docs-pr-gatekeeper` (Execution agent)
- [ ] D8-C 🚧 — User verifies expected pass/fail behavior in CI (Planning agent)

### Closure

- [ ] D9-A 🚧 — Final smoke review and acceptance decision for merge readiness · skill: `microsoft-wiki-qa` (Planning agent)

---

## Prompt Queue

> Pre-written prompts for semi-unattended execution. Execution agent reads these directly.
> Prompts that depend on prior results are marked "just-in-time" — Planning agent writes them after the dependency resolves.

### D5-A — Markdown lint + Prettier

Run `npx markdownlint-cli2 "docs/**/*.md" --fix` then `npx prettier --write "docs/**/*.md"`. Stage only files in the plan's scope boundary. Report the diff summary.

### D5-D — Frontmatter + validator script

Just-in-time — Planning agent writes after D5-C defines schema.

### D5-F — Broken link/anchor check

Run `npx markdown-link-check docs/**/*.md --config .markdown-link-check.json`. Collect all failures into a report table in the Audit Results section (D5-F).

### D5-G — Fix broken links

Just-in-time — Planning agent writes after D5-F report.

### D6-F — Terminology consistency

Just-in-time — Planning agent writes after D6-D/D6-E glossary approval.

### D8-B — CI workflow wiring

Just-in-time — Planning agent writes after D8-A pipeline design.

---

## Active Prompt

### Step objective

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
| docs/projects/veterinary-medical-records/02-tech/ARCHITECTURE.md | Architecture Overview | reference | all | active | 527 | One-page summary with diagram |
| docs/projects/veterinary-medical-records/02-tech/BACKEND_IMPLEMENTATION.md | Backend Implementation Notes | guide | contributor | active | 1,870 | Layering, persistence, processing |
| docs/projects/veterinary-medical-records/01-product/DESIGN_SYSTEM.md | Lean Design System | reference | contributor | active | 1,243 | Color/spacing tokens, a11y |
| docs/projects/veterinary-medical-records/02-tech/FRONTEND_IMPLEMENTATION.md | Frontend Implementation Notes | guide | contributor | active | 1,631 | Stack, PDF rendering, confidence UX |
| docs/projects/veterinary-medical-records/04-delivery/FUTURE_IMPROVEMENTS.md | Known Limitations & Future Directions | explanation | staff-engineer | active | 765 | Reframed 2026-02-27 |
| docs/projects/veterinary-medical-records/04-delivery/IMPLEMENTATION_PLAN.md | Implementation Plan | plan | contributor | active | 15,394 | **Very large**; 6 releases |
| docs/projects/veterinary-medical-records/03-ops/MANUAL_QA_REGRESSION_CHECKLIST.md | Manual QA Regression Checklist | how-to | all | active | 958 | All cases "Pending" |
| docs/projects/veterinary-medical-records/01-product/PRODUCT_DESIGN.md | Product Design | explanation | all | active | 2,272 | Strategy, confidence, Global Schema |
| docs/projects/veterinary-medical-records/02-tech/TECHNICAL_DESIGN.md | Technical Design | reference | contributor | active | 9,637 | **Very large**; contracts, state machines |
| docs/projects/veterinary-medical-records/01-product/UX_DESIGN.md | UX Design | reference | contributor | active | 2,131 | Review flow, rendering rules |
| docs/projects/veterinary-medical-records/02-tech/adr/ADR-ARCH-0001-modular-monolith.md | ADR-ARCH-0001 | adr | staff-engineer | active | 426 | |
| docs/projects/veterinary-medical-records/02-tech/adr/ADR-ARCH-0002-sqlite-database.md | ADR-ARCH-0002 | adr | staff-engineer | active | 369 | |
| docs/projects/veterinary-medical-records/02-tech/adr/ADR-ARCH-0003-raw-sql-repository-pattern.md | ADR-ARCH-0003 | adr | staff-engineer | active | 376 | |
| docs/projects/veterinary-medical-records/02-tech/adr/ADR-ARCH-0004-in-process-async-processing.md | ADR-ARCH-0004 | adr | staff-engineer | active | 368 | |
| docs/projects/veterinary-medical-records/02-tech/adr/index.md | ADR Index | index | all | active | 103 | |
| docs/projects/veterinary-medical-records/03-ops/EXECUTION_RULES.md | Execution Rules | reference | contributor | active | 5,197 | Agent protocol; large |
| docs/projects/veterinary-medical-records/04-delivery/IMPLEMENTATION_HISTORY.md | Implementation History | changelog | all | active | 571 | 12 iterations |
| docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_2026-02-28_DOCS_IMPROVEMENT.md | Plan: Docs Improvement | plan | contributor | active | 1,053 | This plan (active) |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_ITER-1-2.md | Completed: Iter 1-2 | changelog | contributor | active | 517 | |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_ITER-3.md | Completed: Iter 3 | changelog | contributor | active | 169 | |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_ITER-4.md | Completed: Iter 4 | changelog | contributor | active | 172 | |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_ITER-5.md | Completed: Iter 5 | changelog | contributor | active | 173 | |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_ITER-6.md | Completed: Iter 6 | changelog | contributor | active | 258 | |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_ITER-7.md | Completed: Iter 7 | changelog | contributor | active | 279 | |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_ITER-8.md | Completed: Iter 8 | changelog | contributor | active | 367 | |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_ITER-9.md | Completed: Iter 9 | changelog | contributor | active | 412 | |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_2026-02-26_INSTALL_PLAYWRIGHT.md | Plan: Playwright Install | plan | contributor | active | 2,151 | Spanish; full plan |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_2026-02-26_ITER-9-E2E.md | Plan: Iter 9 E2E | plan | contributor | active | 2,768 | Full step log |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_2026-02-26_ITER-10-HARDENING.md | Plan: Iter 10 Hardening | plan | contributor | active | 2,895 | |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_2026-02-27_ITER-11-FULLSTACK-HARDENING.md | Plan: Iter 11 Hardening | plan | contributor | active | 4,080 | Largest completed |
| docs/projects/veterinary-medical-records/04-delivery/plans/completed/COMPLETED_2026-02-27_ITER-12-FINAL.md | Plan: Iter 12 Final | plan | contributor | active | 3,600 | |
| docs/projects/veterinary-medical-records/99-archive/12_FACTOR_AUDIT.md | 12-Factor Audit | audit | staff-engineer | **stale** | 628 | Findings resolved in Iter 2+ |
| docs/projects/veterinary-medical-records/99-archive/CTO_REVIEW_VERDICT.md | CTO Review Verdict | audit | staff-engineer | **stale** | 1,880 | "Still open" resolved; **broken link** |
| docs/projects/veterinary-medical-records/99-archive/codebase_audit.md | Codebase Maintainability Audit | audit | staff-engineer | **stale** | 1,783 | Findings resolved in Iter 1-12 |
| docs/projects/veterinary-medical-records/04-delivery/DELIVERY_SUMMARY.md | Delivery Summary | reference | all | active | 3,763 | Quantitative metrics |
| docs/projects/veterinary-medical-records/03-ops/PLAN_E2E_TEST_COVERAGE.md | Plan E2E Test Coverage | plan | contributor | active | 7,508 | **Very large**; Spanish |
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

**13 findings** — Critical: 2, High: 2, Medium: 6, Low: 3 | Collected 2026-02-28

| # | Sev | File | Finding | Suggested fix |
|---|---|---|---|---|
| 1 | **Crit** | ARCHITECTURE.md | `processing/` shown as top-level under `backend/app/`; actual: `application/processing/` | Nest under `application/` in tree |
| 2 | **Crit** | ARCHITECTURE.md | E2E metrics say "20 (8 spec files)" — actual: 64 tests, 21 specs | Update to `64 (21 spec files)` |
| 3 | **High** | ARCHITECTURE.md | `ports/` layer entirely missing from project tree | Add `ports/` entry |
| 4 | **High** | ARCHITECTURE.md | Tree says `infrastructure/` but folder is `infra/` | Rename in tree |
| 5 | **Med** | ARCHITECTURE.md | `domain/` described as "entities, protocols (DocumentRepository)" — protocols are in `ports/` | Fix description |
| 6 | **Med** | ARCHITECTURE.md | Hooks: "5 custom hooks" — actual: 8 hook files | Update count + list |
| 7 | **Med** | ARCHITECTURE.md | Frontend tree missing `api/`, `constants/`, `extraction/` dirs | Add 3 dirs |
| 8 | **Med** | ARCHITECTURE.md | `application/` description omits documents/, confidence_calibration, etc. | Expand description |
| 9 | **Med** | TECHNICAL_DESIGN.md | §14 says "5 hooks + 3 panel components" — hooks = 8 | Update to 8 |
| 10 | **Med** | DELIVERY_SUMMARY + TECHNICAL_DESIGN | "65 tests across 22 spec files" — actual: 64/21 | Update both |
| 11 | **Low** | DELIVERY_SUMMARY | CI count "9 (+ a11y audit)" vs "10" in ARCHITECTURE | Align convention |
| 12 | **Low** | DESIGN_SYSTEM.md | Primitives list missing Badge, Card, Dialog | Add 3 primitives |
| 13 | **Low** | DELIVERY_SUMMARY | Iter 11 references deleted `review-flow.spec.ts` | Note merged file |

**Verified correct:** DESIGN_SYSTEM tokens (post-D1-D), tech stack versions, backend test count (~396), frontend test count (287), all 4 ADRs, cross-references, language compliance, API route count, AppWorkspace LOC.

### D2-A — Approved taxonomy (v2 — user-approved 2026-03-01)

**Revision history:**
- v1 (2026-02-28): initial proposal with architecture/design/guides/ categories
- v2 (2026-03-01): user feedback — eliminated overlap between categories; adopted intent-based grouping (01-product/tech/ops/delivery/metrics); wiki promoted to multi-project platform

#### Current structure (problems)

| # | Problem | Impact |
|---|---------|--------|
| 1 | `project/` flat — 10 files with no grouping | Hard to navigate; evaluators waste time searching |
| 2 | `refactor/` legacy name — 3 of 4 files are stale/archived | Ambiguous: what is active vs historical? |
| 3 | `testing/` folder with 1 file | Structural noise |
| 4 | DELIVERY_SUMMARY, IMPLEMENTATION_HISTORY scattered | Delivery evidence fragmented |
| 5 | No separation between human wiki and agent protocol | EXECUTION_RULES next to IMPLEMENTATION_HISTORY |
| 6 | `project/` is singular — no room for multiple initiatives | Wiki can't grow beyond one project |
| 7 | v1 categories had overlap (architecture/guides both tech, guides/delivery/implementation all had plans) | Ambiguous placement |

#### Approved target structure (v2)

```
docs/
├── README.md                                  ← wiki index (multi-project)
│
├── shared/                                    ← transversal to all initiatives
│   ├── BRAND_GUIDELINES.md
│   ├── ENGINEERING_PLAYBOOK.md
│   ├── UX_GUIDELINES.md
│   └── LLM_BENCHMARKS.md
│
├── projects/                                  ← NEW: multi-project root
│   ├── README.md                              ← initiative listing
│   │
│   └── veterinary-medical-records/            ← current initiative
│       ├── README.md                          ← project landing page + category table
│       │
│       ├── design/                            ← ¿Qué construimos y para quién?
│       │   ├── PRODUCT_DESIGN.md
│       │   ├── UX_DESIGN.md
│       │   └── DESIGN_SYSTEM.md
│       │
│       ├── tech/                              ← ¿Cómo está construido?
│       │   ├── ARCHITECTURE.md
│       │   ├── TECHNICAL_DESIGN.md
│       │   ├── BACKEND_IMPLEMENTATION.md
│       │   ├── FRONTEND_IMPLEMENTATION.md
│       │   └── adr/
│       │       ├── README.md
│       │       └── ADR-ARCH-000{1..4}*.md
│       │
│       ├── ops/                               ← ¿Cómo trabajamos?
│       │   ├── EXECUTION_RULES.md
│       │   ├── MANUAL_QA_REGRESSION_CHECKLIST.md
│       │   └── PLAN_E2E_TEST_COVERAGE.md
│       │
│       ├── delivery/                          ← ¿Qué hicimos y cómo fue?
│       │   ├── IMPLEMENTATION_PLAN.md
│       │   ├── IMPLEMENTATION_HISTORY.md
│       │   ├── DELIVERY_SUMMARY.md
│       │   ├── FUTURE_IMPROVEMENTS.md
│       │   ├── plans/
│       │   │   ├── PLAN_*.md                  (active)
│       │   │   └── completed/                 (closed)
│       │   └── ...
│       │
│       ├── metrics/                           ← ¿Cuánto costó?
│       │   └── COPILOT_USAGE.md
│       │
│       └── archive/                           ← sin ubicación clara de momento
│           ├── 12_FACTOR_AUDIT.md
│           ├── CTO_REVIEW_VERDICT.md
│           └── codebase_audit.md
│
├── agent_router/                              (out of scope)
└── metrics/                                   (scripts + data, unchanged)
    └── llm_benchmarks/
```

#### Category rationale

| Folder | Question it answers | Content |
|---|---|---|
| `design/` | ¿Qué construimos y para quién? | Product design, UX design, design system |
| `tech/` | ¿Cómo está construido? | Architecture, technical design, backend/frontend impl, ADRs |
| `ops/` | ¿Cómo trabajamos? | Execution rules, QA checklist, E2E test plan |
| `delivery/` | ¿Qué hicimos y cómo fue? | Plans, history, delivery summary, future improvements |
| `metrics/` | ¿Cuánto costó? | Copilot usage |

#### File move map (26 files + 3 new)

| Current path | Target path | Reason |
|---|---|---|
| `project/PRODUCT_DESIGN.md` | `projects/veterinary-medical-records/01-product/PRODUCT_DESIGN.md` | design/ |
| `project/UX_DESIGN.md` | `projects/veterinary-medical-records/01-product/UX_DESIGN.md` | design/ |
| `project/DESIGN_SYSTEM.md` | `projects/veterinary-medical-records/01-product/DESIGN_SYSTEM.md` | design/ |
| `project/ARCHITECTURE.md` | `projects/veterinary-medical-records/02-tech/ARCHITECTURE.md` | tech/ |
| `project/TECHNICAL_DESIGN.md` | `projects/veterinary-medical-records/02-tech/TECHNICAL_DESIGN.md` | tech/ |
| `project/BACKEND_IMPLEMENTATION.md` | `projects/veterinary-medical-records/02-tech/BACKEND_IMPLEMENTATION.md` | tech/ |
| `project/FRONTEND_IMPLEMENTATION.md` | `projects/veterinary-medical-records/02-tech/FRONTEND_IMPLEMENTATION.md` | tech/ |
| `project/adr/index.md` | `projects/veterinary-medical-records/02-tech/adr/index.md` | tech/adr/ |
| `project/adr/ADR-ARCH-0001*.md` | `projects/veterinary-medical-records/02-tech/adr/ADR-ARCH-0001*.md` | tech/adr/ |
| `project/adr/ADR-ARCH-0002*.md` | `projects/veterinary-medical-records/02-tech/adr/ADR-ARCH-0002*.md` | tech/adr/ |
| `project/adr/ADR-ARCH-0003*.md` | `projects/veterinary-medical-records/02-tech/adr/ADR-ARCH-0003*.md` | tech/adr/ |
| `project/adr/ADR-ARCH-0004*.md` | `projects/veterinary-medical-records/02-tech/adr/ADR-ARCH-0004*.md` | tech/adr/ |
| `project/implementation/EXECUTION_RULES.md` | `projects/veterinary-medical-records/03-ops/EXECUTION_RULES.md` | ops/ |
| `project/MANUAL_QA_REGRESSION_CHECKLIST.md` | `projects/veterinary-medical-records/03-ops/MANUAL_QA_REGRESSION_CHECKLIST.md` | ops/ |
| `project/testing/PLAN_E2E_TEST_COVERAGE.md` | `projects/veterinary-medical-records/03-ops/PLAN_E2E_TEST_COVERAGE.md` | ops/ |
| `project/IMPLEMENTATION_PLAN.md` | `projects/veterinary-medical-records/04-delivery/IMPLEMENTATION_PLAN.md` | delivery/ |
| `project/implementation/IMPLEMENTATION_HISTORY.md` | `projects/veterinary-medical-records/04-delivery/IMPLEMENTATION_HISTORY.md` | delivery/ |
| `project/refactor/DELIVERY_SUMMARY.md` | `projects/veterinary-medical-records/04-delivery/DELIVERY_SUMMARY.md` | delivery/ |
| `project/FUTURE_IMPROVEMENTS.md` | `projects/veterinary-medical-records/04-delivery/FUTURE_IMPROVEMENTS.md` | delivery/ |
| `project/implementation/PLAN_*.md` | `projects/veterinary-medical-records/04-delivery/plans/PLAN_*.md` | delivery/plans/ |
| `project/implementation/completed/*` (14 files) | `projects/veterinary-medical-records/04-delivery/plans/completed/*` | delivery/plans/completed/ |
| `project/metrics/COPILOT_USAGE.md` | `projects/veterinary-medical-records/04-delivery/COPILOT_USAGE.md` | metrics/ |
| `project/refactor/12_FACTOR_AUDIT.md` | `projects/veterinary-medical-records/99-archive/12_FACTOR_AUDIT.md` | archive/ |
| `project/refactor/CTO_REVIEW_VERDICT.md` | `projects/veterinary-medical-records/99-archive/CTO_REVIEW_VERDICT.md` | archive/ |
| `project/refactor/codebase_audit.md` | `projects/veterinary-medical-records/99-archive/codebase_audit.md` | archive/ |

**New files:**
- `docs/README.md` — rewritten as multi-project wiki index
- `docs/projects/README.md` — initiative listing
- `veterinary-medical-records` (wiki generated by `scripts/sync_docs_to_wiki.py`) — project landing page with category table

**Folders deleted** (empty after migration): `project/` (entire tree)

#### Design principles

| Principle | Applied how |
|---|---|
| **Intent-based grouping** | Each folder answers exactly one question — no overlap |
| **Multi-project ready** | `projects/` allows adding initiatives without restructuring |
| **Minimal disruption** | Filenames preserved (ALL_CAPS), only paths change |
| **Explicit lifecycle** | `archive/` separates stale from active unambiguously |
| **Max depth = 4** | Deepest: `projects/veterinary-medical-records/04-delivery/plans/completed/` |

#### D2-B impact estimate

- ~50+ cross-references to update across all docs
- `docs/README.md` rewritten as multi-project wiki index
- 3 new README files (wiki root, projects listing, project landing)
- Git moves with `git mv` to preserve history
- `EXECUTION_RULES.md` references to plans and history must update
- `agent_router` references to `docs/projects/veterinary-medical-records/` paths must update

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

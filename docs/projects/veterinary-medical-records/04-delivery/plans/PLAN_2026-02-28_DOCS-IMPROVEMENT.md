# Plan: Documentation Improvement — Wiki audit, restructure & standardization

> **Operational rules:** See [plan-execution-protocol.md](../../03-ops/plan-execution-protocol.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Branch:** _TBD — new branch required for Phase 5+ execution_
**PR (historical):** [#154](https://github.com/isilionisilme/veterinary-medical-records/pull/154) — merged Phases 0–4.
**Prerequisite:** Iteration 12 merged to `main`.
**Worktree:** `D:/Git/veterinary-medical-records` (default — single worktree)
**CI Mode:** Pipeline depth-1 gate (mode 2, default)
**Agents:** Planning agent (Claude Opus 4.6) + Execution agent (Codex 5.3)

## Objective

Audit, restructure, and standardize the project's canonical documentation to eliminate stale/duplicate content, apply consistent templates and navigation, and automate quality gates via CI.

## Context

The project's canonical documentation (`docs/projects/veterinary-medical-records/`, `docs/shared/`, `docs/README.md`) has grown organically across 12+ iterations. It needs an audit-first restructure to eliminate stale/duplicate content, establish a consistent taxonomy, normalize templates, and automate quality gates.

**Entry state (original, 2026-02-28):** Doc tooling installed (`markdownlint-cli2`, `markdown-link-check`, Prettier Markdown scope) via commit `a7c2c3d7`. No structural changes yet.

**Resumed state (2026-03-06):** Phases 0–4 merged (PR #154 + subsequent PRs). Taxonomy applied, files migrated to kebab-case (`COMPLETED_2026-03-04_CANONICAL-DOC-RESTRUCTURE`), templates normalized, TOCs/sitemap generated. Shared docs restructured into `01-product/`, `02-tech/`, `03-ops/` subcategories. 6 doc QA CI guards already active. New canonical files created since freeze: `extraction-quality.md`, `plan-execution-protocol.md`, `plan-management.md`, `coding-standards.md`, `documentation-guidelines.md`, `way-of-working.md`, `llm-benchmarks.md`. Project at iteration 18+.

**Exit target:** Clean, navigable wiki with consistent templates, working TOCs, passing lint/link checks, and a CI docs-QA pipeline.

## Resume Note (2026-03-06)

This plan was paused after D4-A (Phase 4 navigation). Since then:

1. **Kebab-case migration** completed (`COMPLETED_2026-03-04_CANONICAL-DOC-RESTRUCTURE`) — all filenames renamed from `ALL_CAPS.md` to `kebab-case.md`.
2. **Shared docs restructured** — flat `shared/` split into `shared/01-product/`, `shared/02-tech/`, `shared/03-ops/`. `ENGINEERING_PLAYBOOK.md` superseded by 3 focused files.
3. **7 new canonical files** added: `coding-standards.md`, `documentation-guidelines.md`, `way-of-working.md`, `llm-benchmarks.md`, `extraction-quality.md`, `plan-execution-protocol.md`, `plan-management.md`.
4. **CI doc guards** added (6 guards) — but markdownlint, link-check, and frontmatter validation are still missing from CI.
5. **14 new completed plans** added (26 total completed files).
6. **Project advanced** from iteration 12 to 18+.
7. **D1-A inventory** and **D2-A taxonomy** updated in this file to reflect current state.

**Remaining phases** (5–9) are still valid. Phase 5 now operates on kebab-case paths and includes 7 new files in scope. Phase 8 now extends existing CI rather than building from scratch.

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
8. CI pipeline runs markdownlint + link-check + frontmatter validation on every PR touching `docs/` (extending existing 6 doc guards).
9. All templates are applied per Diátaxis classification.

## How to test

1. `npx markdownlint-cli2 "docs/projects/veterinary-medical-records/**/*.md" "docs/shared/**/*.md" "docs/README.md"` — zero errors.
2. `node scripts/docs/check_docs_links.mjs` — zero broken links.
3. `node scripts/docs/validate-frontmatter.js` (or equivalent) — all files valid.
4. Manual review: navigate wiki from `docs/README.md` through all TOC links — no dead ends.
5. CI: push a docs-only change and verify all doc QA gates pass (existing 6 + new markdownlint/link-check/frontmatter).

---

## Execution Status — update on completion of each step

> **Rationale:** First know what we have (inventory + quality audit) →
> decide what stays and how it's organized (structure) → normalize format → polish style → automate.

**Agent model mapping:**
- `Planning agent` = `Claude Opus 4.6`
- `Execution agent` = `Codex 5.3`

**Legend:**
- 🔄 **auto-chain** — Execution agent (`Codex 5.3`) executes; user reviews afterwards.
- 🚧 **hard-gate** — Planning agent (`Claude Opus 4.6`); requires user decision.

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
- [ ] ~~D4-B 🚧 — User validation of navigation quality (Planning agent)~~ — absorbed into D4R-H

### Phase 4R — Re-baseline (added 2026-03-06)

> **Rationale:** The project advanced from iteration 12 to 18+ since Phase 4. Files renamed (kebab-case),
> shared docs restructured, 7+ new files created, content evolved. A full re-inventory and re-audit
> is required before Phase 5 can execute on a reliable foundation.

- [x] D4R-A 🚧 — **Full re-inventory** of all canonical docs: path, title, type (Diátaxis), audience, status, staleness, word count, frontmatter status. Complete from scratch — not a delta. User approves the full inventory before proceeding. · skill: `microsoft-wiki-architect` (Planning agent) — ✅ `no-commit (D4R-A_INVENTORY.md, user approved 2026-03-06)`
- [x] D4R-B 🚧 — Detect duplicate/stale/contradictory content across full inventory → consolidation report · skill: `duplicate-stale-detector` (Planning agent) — ✅ `no-commit (D4R-B report in D4R-A_INVENTORY.md, 2026-03-06)`
- [x] D4R-C 🚧 — User approves consolidation decisions (Planning agent) — ✅ `no-commit (user approved all 8 actions C-1..C-8, 2026-03-06)`
- [x] D4R-D 🔄 — Apply approved consolidation/correction updates (Execution agent) — ✅ `no-commit (C-1..C-8 applied: 10 files modified, 2026-03-06)`
- [x] D4R-E 🚧 — QA audit refresh: verify metrics, test counts, architecture trees, and technical data against current codebase (iteration 18+) · skill: `architecture-doc-auditor` (Planning agent) — ✅ `no-commit (14 findings, all approved 2026-03-06)`
- [x] D4R-F 🔄 — Apply D4R-E corrections + translate plan-e2e-test-coverage.md to English (Execution agent) — ✅ `abbeebb4`
- [x] D4R-G 🔄 — Update navigation: sitemap, TOCs, breadcrumbs for all current files · tool: `doctoc` (Execution agent) — ✅ `no-commit (await D4R-H user validation)`
- [x] D4R-H 🚧 — User validation of full navigation quality (Planning agent) — replaces original D4-B — ✅ `no-commit (user approved via commit/push/PR request, 2026-03-06)`

### Phase 5 — Format and Markdown standardization

> **Note (2026-03-06):** Tooling exists (`.markdownlint.yml` config, `.markdown-link-check.json`, `markdownlint-cli2` + `prettier` in devDeps).
> Frontmatter coverage: 16/34 files (47%). 18 files missing frontmatter — see updated D1-A inventory.

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

> **Note (2026-03-06):** Significant CI infrastructure already exists. 6 doc quality guards are active in `.github/workflows/ci.yml`:
> canonical-router guard, doc-test sync, doc-router parity, router directionality, router drift, doc change classification.
> Plus: Prettier format check (frontend scope only). Missing from CI: markdownlint, link-check, frontmatter validation.

- [ ] D8-A 🚧 — Design docs QA CI pipeline (delta: markdownlint + link-check + frontmatter gates) · skill: `docs-pr-gatekeeper` (Planning agent)
- [ ] D8-B 🔄 — Implement CI workflow additions + script wiring · skill: `docs-pr-gatekeeper` (Execution agent)
- [ ] D8-C 🚧 — User verifies expected pass/fail behavior in CI (Planning agent)

### Closure

- [ ] D9-A 🚧 — Final smoke review and acceptance decision for merge readiness · skill: `microsoft-wiki-qa` (Planning agent)

---

## Prompt Queue

> Pre-written prompts for semi-unattended execution. Execution agent reads these directly.
> Prompts that depend on prior results are marked "just-in-time" — Planning agent writes them after the dependency resolves.

### D4R-F — Apply D4R-E corrections + translate Spanish file

Apply all 14 approved corrections from the D4R-E audit. User decisions:
- **Policy:** Use latest test counts (not historical Iter 11 freeze).
- **E-14:** Translate `plan-e2e-test-coverage.md` to English (do NOT archive).

#### Corrections to apply

| # | File | Change |
|---|---|---|
| E-1 | `docs/projects/.../02-tech/architecture.md` L122 | E2E specs: `65 (21 spec files)` → `64 (21 spec files)` |
| E-2 | `docs/projects/.../02-tech/architecture.md` L120 | Backend tests: `~395 (≥91% coverage)` → `~566 (67 files)` |
| E-3 | `docs/projects/.../02-tech/architecture.md` L121 | Frontend tests: `~287 (≥87% coverage)` → `~327 (52 files)` |
| E-4 | `docs/projects/.../02-tech/architecture.md` L111 | `35 custom hooks` → `28 custom hooks` |
| E-5 | `docs/projects/.../02-tech/architecture.md` L123 | CI jobs: `10 (path-filtered, ~4 min)` → `13 (path-filtered, ~4 min)` |
| E-6 | `docs/projects/.../02-tech/architecture.md` L97 | `5 route modules (documents, review, processing, calibration, health)` → `6 route modules (documents, review, processing, calibration, health, clinics)` |
| E-7 | `docs/projects/.../02-tech/technical-design.md` L612 | `35 hooks + 3 panel components` → `28 hooks + 3 panel components` |
| E-8 | `docs/projects/.../02-tech/technical-design.md` L613 | `5 domain modules` → `6 domain modules` |
| E-9 | `docs/projects/.../04-delivery/delivery-summary.md` L530 | `65 tests across 22 spec files` → `64 tests across 21 spec files` |
| E-10 | `docs/projects/.../04-delivery/delivery-summary.md` L573 | `395 backend, 287 frontend, 65 E2E` → `566 backend, 327 frontend, 64 E2E` |
| E-11 | `docs/projects/.../04-delivery/delivery-summary.md` L576 | `22 files, 65 tests` → `21 files, 64 tests` |
| E-12 | `docs/projects/.../02-tech/architecture.md` L54 | Mermaid: `(5 domain modules)` → `(6 domain modules)` |
| E-13 | `docs/projects/.../99-archive/cto-review-verdict.md` L3 | Archive banner: `682 tests, 10 CI jobs` → `957 tests, 13 CI jobs` |
| E-14 | `docs/projects/.../03-ops/plan-e2e-test-coverage.md` | Translate entire file from Spanish to English. Preserve structure, section numbering, tables, test IDs, and data-testid selectors exactly. |

#### Additional delivery-summary updates (affected by latest counts)

The Iter 12 column in delivery-summary.md progression table (L75-80) shows `395`/`287`/`65 tests (21 specs)`. These are **point-in-time Iter 12 values** — keep them as historical. Only update the **final metrics** rows (L573, L576) which should reflect current state.

#### Commit

After all corrections: `git add docs/; git commit -m "docs(plan-d4r-f): apply QA audit corrections + translate E2E plan to English"; git push origin <branch>`.

### D5-A — Markdown lint + Prettier

Run `npx markdownlint-cli2 "docs/projects/veterinary-medical-records/**/*.md" "docs/shared/**/*.md" "docs/README.md" --fix` then `npx prettier --write "docs/projects/veterinary-medical-records/**/*.md" "docs/shared/**/*.md" "docs/README.md"`. Stage only files in the plan's scope boundary (exclude `docs/agent_router/`). Report the diff summary.

### D5-D — Frontmatter + validator script

Just-in-time — Planning agent writes after D5-C defines schema.

### D5-F — Broken link/anchor check

Run `node scripts/docs/check_docs_links.mjs` (existing script) or `npx markdown-link-check` on scope files. Collect all failures into a report table in the Audit Results section (D5-F). Note: `.markdown-link-check.json` config exists; `check_docs_links.mjs` already available in `scripts/docs/`.

### D5-G — Fix broken links

Just-in-time — Planning agent writes after D5-F report.

### D6-F — Terminology consistency

Just-in-time — Planning agent writes after D6-D/D6-E glossary approval.

### D8-B — CI workflow wiring

Just-in-time — Planning agent writes after D8-A pipeline design. Note: 6 doc CI guards already exist in `ci.yml`. D8-B only adds the missing gates (markdownlint, link-check, frontmatter validation).

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

> **Updated 2026-03-06** — Reflects current state after kebab-case migration, shared restructuring, and new files.
> Original inventory (2026-02-28) had 40 files with ALL_CAPS names. Current state: 34 canonical wiki files + plan/completed files.

**34 canonical wiki files** in scope (excluding plans/completed) | Collected 2026-03-06

| Path | Title | Type | Audience | Status | Has Frontmatter | Notes |
|---|---|---|---|---|---|---|
| docs/README.md | Wiki — Documentation Index | index | all | active | ✅ | Root wiki index, sitemap, reading order |
| docs/shared/01-product/brand-guidelines.md | Brand Guidelines (Project Canonical) | reference | all | active | ✅ | |
| docs/shared/01-product/ux-guidelines.md | UX Guidelines — Shared Principles | explanation | all | active | ✅ | |
| docs/shared/02-tech/coding-standards.md | Coding Standards | reference | contributor | active | ❌ | **NEW** since original inventory |
| docs/shared/02-tech/documentation-guidelines.md | Documentation Guidelines | reference | contributor | active | ❌ | **NEW** since original inventory |
| docs/shared/02-tech/llm-benchmarks.md | LLM Benchmarks System | explanation | all | active | ✅ | **NEW** since original inventory |
| docs/shared/03-ops/way-of-working.md | Way of Working | reference | contributor | active | ❌ | **NEW** since original inventory |
| docs/projects/.../01-product/design-system.md | Lean Design System | reference | contributor | active | ✅ | |
| docs/projects/.../01-product/product-design.md | Product Design | explanation | all | active | ✅ | |
| docs/projects/.../01-product/ux-design.md | UX Design | reference | contributor | active | ✅ | |
| docs/projects/.../02-tech/architecture.md | Architecture Overview | reference | all | active | ✅ | |
| docs/projects/.../02-tech/backend-implementation.md | Backend Implementation Notes | reference | contributor | active | ✅ | |
| docs/projects/.../02-tech/extraction-quality.md | Extraction Quality | reference | contributor | active | ❌ | **NEW** since original inventory |
| docs/projects/.../02-tech/frontend-implementation.md | Frontend Implementation Notes | reference | contributor | active | ✅ | |
| docs/projects/.../02-tech/technical-design.md | Technical Design | reference | contributor | active | ✅ | |
| docs/projects/.../02-tech/adr/index.md | ADR Index | index | all | active | ❌ | |
| docs/projects/.../02-tech/adr/ADR-ARCH-0001-modular-monolith.md | ADR-ARCH-0001 | adr | staff-engineer | active | ❌ | |
| docs/projects/.../02-tech/adr/ADR-ARCH-0002-sqlite-database.md | ADR-ARCH-0002 | adr | staff-engineer | active | ❌ | |
| docs/projects/.../02-tech/adr/ADR-ARCH-0003-raw-sql-repository-pattern.md | ADR-ARCH-0003 | adr | staff-engineer | active | ❌ | |
| docs/projects/.../02-tech/adr/ADR-ARCH-0004-in-process-async-processing.md | ADR-ARCH-0004 | adr | staff-engineer | active | ❌ | |
| docs/projects/.../03-ops/execution-rules.md | Execution Rules | reference | contributor | active | ❌ | Agent protocol |
| docs/projects/.../03-ops/manual-qa-regression-checklist.md | Manual QA Regression Checklist | how-to | all | active | ❌ | |
| docs/projects/.../03-ops/plan-e2e-test-coverage.md | Plan E2E Test Coverage | plan | contributor | active | ❌ | Spanish; large |
| docs/projects/.../03-ops/plan-execution-protocol.md | Plan Execution Protocol | reference | contributor | active | ⚠️ | **NEW**; partial frontmatter |
| docs/projects/.../03-ops/plan-management.md | Plan Management | reference | contributor | active | ❌ | **NEW** since original inventory |
| docs/projects/.../04-delivery/copilot-usage.md | Copilot Usage Metrics | reference | all | active | ✅ | |
| docs/projects/.../04-delivery/delivery-summary.md | Delivery Summary | reference | all | active | ✅ | |
| docs/projects/.../04-delivery/future-improvements.md | Known Limitations & Future Directions | explanation | staff-engineer | active | ✅ | |
| docs/projects/.../04-delivery/implementation-history.md | Implementation History | changelog | all | active | ❌ | |
| docs/projects/.../04-delivery/implementation-plan.md | Implementation Plan | plan | contributor | active | ✅ | Very large |
| docs/projects/.../99-archive/12-factor-audit.md | 12-Factor Audit | audit | staff-engineer | archived | ❌ | Archived |
| docs/projects/.../99-archive/codebase-audit.md | Codebase Maintainability Audit | audit | staff-engineer | archived | ❌ | Archived |
| docs/projects/.../99-archive/cto-review-verdict.md | CTO Review Verdict | audit | staff-engineer | archived | ❌ | Archived |

**Frontmatter coverage:** 16/34 files (47%) ✅ — 18 files (53%) missing frontmatter.

**Key changes since original inventory (2026-02-28):**

1. **Naming convention:** ALL_CAPS → kebab-case (via `COMPLETED_2026-03-04_CANONICAL-DOC-RESTRUCTURE`)
2. **Shared docs restructured:** flat `shared/` → `shared/01-product/`, `shared/02-tech/`, `shared/03-ops/`
3. **`ENGINEERING_PLAYBOOK.md` superseded:** split into `coding-standards.md`, `documentation-guidelines.md`, `way-of-working.md`
4. **7 new files added:** `coding-standards.md`, `documentation-guidelines.md`, `way-of-working.md`, `llm-benchmarks.md`, `extraction-quality.md`, `plan-execution-protocol.md`, `plan-management.md`
5. **Completed plans:** grew from 12 to 26 files (14 new since freeze)

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

### D4R-E — QA audit refresh (2026-03-06)

**Method:** Full codebase scan against all 34 canonical wiki files (iteration 18+ reality).

**Codebase reality baseline:**

| Metric | Actual | Source |
|---|---|---|
| E2E spec files | 21 | `frontend/e2e/*.spec.ts` |
| E2E test cases | 64 | `test(` in spec files |
| Custom hooks | 28 | `frontend/src/hooks/use*.ts` (non-test) |
| Frontend test files | 52 | `*.test.ts*` in `frontend/src/` |
| Frontend test functions | 327 | `it(`/`test(` matches |
| Backend test files | 67 | `test_*.py` in `backend/tests/` |
| Backend test functions | 566 | `def test_` matches |
| API route modules | 6 | documents, review, processing, calibration, health, clinics |
| API endpoints | 18 | across 6 route modules |
| CI jobs | 13 | `.github/workflows/ci.yml` |
| GitHub workflows | 3 | ci.yml, llm-benchmarks.yml, wiki-sync.yml |

**14 findings** — Critical: 3, High: 3, Medium: 5, Low: 2, Language: 1

| # | Sev | File | Finding | Correct value |
|---|---|---|---|---|
| E-1 | Crit | architecture.md L122 | E2E: "65 (21 spec files)" | 64 (21 spec files) |
| E-2 | Crit | architecture.md L120 | Backend tests: "~395 (≥91%)" | ~566 (67 files) |
| E-3 | Crit | architecture.md L121 | Frontend tests: "~287 (≥87%)" | ~327 (52 files) |
| E-4 | High | architecture.md L111 | "35 custom hooks" | 28 hooks |
| E-5 | High | architecture.md L123 | CI jobs: 10 | 13 |
| E-6 | High | architecture.md L97 | 5 route modules | 6 (+clinics) |
| E-7 | Med | technical-design.md L612 | 35 hooks | 28 hooks |
| E-8 | Med | technical-design.md L613 | 5 domain modules | 6 domain modules |
| E-9 | Med | delivery-summary.md L530 | "65 tests across 22 spec files" | 64 / 21 |
| E-10 | Med | delivery-summary.md L573 | "395 backend, 287 frontend, 65 E2E" | 566 / 327 / 64 |
| E-11 | Med | delivery-summary.md L576 | "22 files, 65 tests" | 21 / 64 |
| E-12 | Low | architecture.md L54 | Mermaid: "5 domain modules" | 6 |
| E-13 | Low | cto-review-verdict.md L3 | "682 tests, 10 CI jobs" | ~957 / 13 |
| E-14 | Lang | plan-e2e-test-coverage.md | Entire file in Spanish | Translate to English |

**Language audit:** All canonical wiki files (non-plan) confirmed English. One exception: `plan-e2e-test-coverage.md` (in `03-ops/`, not `04-delivery/plans/`) — approved for translation.

**Verified correct:** Backend project tree, tech stack versions, 4 ADRs, frontend component dirs, data flow description, historical iteration metrics in implementation-history.md (point-in-time), delivery-summary progression table (historical rows).

**User decisions (2026-03-06):** All 14 approved. E-14: translate (not archive). Policy: reflect latest counts in "current" metrics sections.

### D2-A — Approved taxonomy (v2 — implemented)

> **Status:** ✅ Fully implemented and migrated. Updated 2026-03-06 to reflect actual current state.
> The taxonomy below was approved 2026-03-01 and implemented via PR #154 merge + `COMPLETED_2026-03-04_CANONICAL-DOC-RESTRUCTURE` (kebab-case migration).

**Revision history:**
- v1 (2026-02-28): initial proposal with architecture/design/guides/ categories
- v2 (2026-03-01): user feedback — eliminated overlap; adopted intent-based grouping
- v3 (2026-03-04): kebab-case migration applied to all filenames
- v4 (2026-03-06): shared/ restructured into subcategories; ENGINEERING_PLAYBOOK split into 3 files

#### Actual current structure (2026-03-06)

```
docs/
├── README.md                                  ← wiki index (multi-project)
│
├── shared/                                    ← transversal to all initiatives
│   ├── 01-product/
│   │   ├── brand-guidelines.md
│   │   └── ux-guidelines.md
│   ├── 02-tech/
│   │   ├── coding-standards.md               ← split from ENGINEERING_PLAYBOOK
│   │   ├── documentation-guidelines.md        ← split from ENGINEERING_PLAYBOOK
│   │   └── llm-benchmarks.md
│   └── 03-ops/
│       └── way-of-working.md                  ← split from ENGINEERING_PLAYBOOK
│
├── projects/
│   └── veterinary-medical-records/
│       ├── 01-product/
│       │   ├── design-system.md
│       │   ├── product-design.md
│       │   └── ux-design.md
│       ├── 02-tech/
│       │   ├── architecture.md
│       │   ├── backend-implementation.md
│       │   ├── extraction-quality.md          ← NEW
│       │   ├── frontend-implementation.md
│       │   ├── technical-design.md
│       │   └── adr/
│       │       ├── index.md
│       │       └── ADR-ARCH-000{1..4}*.md
│       ├── 03-ops/
│       │   ├── execution-rules.md
│       │   ├── manual-qa-regression-checklist.md
│       │   ├── plan-e2e-test-coverage.md
│       │   ├── plan-execution-protocol.md     ← NEW
│       │   └── plan-management.md             ← NEW
│       ├── 04-delivery/
│       │   ├── copilot-usage.md
│       │   ├── delivery-summary.md
│       │   ├── future-improvements.md
│       │   ├── implementation-history.md
│       │   ├── implementation-plan.md
│       │   └── plans/
│       │       ├── PLAN_*.md                  (active)
│       │       └── completed/                 (26 files)
│       └── 99-archive/
│           ├── 12-factor-audit.md
│           ├── codebase-audit.md
│           └── cto-review-verdict.md
│
├── agent_router/                              (out of scope)
└── metrics/                                   (scripts + data, unchanged)
    └── llm_benchmarks/
```

#### Category rationale (unchanged)

| Folder | Question it answers | Content |
|---|---|---|
| `01-product/` | ¿Qué construimos y para quién? | Product design, UX design, design system |
| `02-tech/` | ¿Cómo está construido? | Architecture, technical design, backend/frontend impl, ADRs |
| `03-ops/` | ¿Cómo trabajamos? | Execution rules, QA checklist, E2E test plan, plan protocol |
| `04-delivery/` | ¿Qué hicimos y cómo fue? | Plans, history, delivery summary, future improvements, copilot usage |
| `99-archive/` | Información histórica | Archived audits |

#### File move map — ✅ COMPLETED

> All moves executed. Original `project/` tree deleted. Kebab-case migration applied.
> File move map preserved for historical reference only.

<details>
<summary>Original file move map (26 files + 3 new) — collapsed</summary>

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

</details>

#### Design principles (unchanged)

| Principle | Applied how |
|---|---|
| **Intent-based grouping** | Each folder answers exactly one question — no overlap |
| **Multi-project ready** | `projects/` allows adding initiatives without restructuring |
| **Kebab-case naming** | All filenames migrated from ALL_CAPS to kebab-case |
| **Explicit lifecycle** | `99-archive/` separates stale from active unambiguously |
| **Max depth = 4** | Deepest: `projects/veterinary-medical-records/04-delivery/plans/completed/` |

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

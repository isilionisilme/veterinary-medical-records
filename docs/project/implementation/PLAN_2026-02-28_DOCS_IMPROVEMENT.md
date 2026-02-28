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

- [ ] D1-A 🚧 — Build current-state inventory of canonical docs: path, type, audience, staleness, status · skill: `microsoft-wiki-architect` (Claude)
- [ ] D1-B 🚧 — Detect duplicate/stale content → consolidation report with keep/merge/delete recommendations · skill: `duplicate-stale-detector` (Claude)
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

_To be filled._

### D1-B — Duplicate/stale findings

_To be filled._

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

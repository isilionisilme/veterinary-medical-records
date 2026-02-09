This file defines:
- what each document is in this repository
- reading order

# Assistant entrypoint (operational)
- `docs/00_AUTHORITY.md` — router for small, intent-based modules (token-optimized).

AI assistants should follow `AGENTS.md` (repo root) and then `docs/00_AUTHORITY.md`, loading only the module(s)
needed for the current intent. The rest of this file is primarily for humans.

# Folder structure

This folder is split into two areas:
- [`docs/shared/`](shared/): company-wide, project-agnostic standards and guidelines
- [`docs/project/`](project/): documents specific to this initiative (if applicable) 

## Reading order (mandatory)
### Documentation shared across projects
- [`docs/shared/AGENTS.md`](shared/AGENTS.md) — AI Coding Assistant rules for this repo (STOP rules, safety, behavior).
- [`docs/shared/ENGINEERING_PLAYBOOK.md`](shared/ENGINEERING_PLAYBOOK.md) — engineering standards (architecture discipline, testing, observability).
- [`docs/shared/UX_GUIDELINES.md`](shared/UX_GUIDELINES.md) — global UX principles and shared interaction heuristics.

### Tooling (optional)
- [`metrics/llm_benchmarks/README.md`](../metrics/llm_benchmarks/README.md) — assistant usage benchmarks (opt-in; used only when requested, e.g. `#metrics`).

### Documentation specific to the project
- [`docs/project/PRODUCT_DESIGN.md`](project/PRODUCT_DESIGN.md) — product summary for technical context (project-specific)
- [`docs/project/UX_DESIGN.md`](project/UX_DESIGN.md) — project UX interaction contract (project-specific)
- [`docs/project/BRAND_GUIDELINES.md`](project/BRAND_GUIDELINES.md) — visual identity + tone for user-facing copy (project-specific)
- [`docs/project/TECHNICAL_DESIGN.md`](project/TECHNICAL_DESIGN.md) — architecture + contracts + invariants (project-specific)
- [`docs/project/BACKEND_IMPLEMENTATION.md`](project/BACKEND_IMPLEMENTATION.md) — backend implementation details (if applicable) (project-specific)
- [`docs/project/FRONTEND_IMPLEMENTATION.md`](project/FRONTEND_IMPLEMENTATION.md) — frontend implementation details (if applicable) (project-specific)
- [`docs/project/IMPLEMENTATION_PLAN.md`](project/IMPLEMENTATION_PLAN.md) — scope + story order + acceptance criteria (if applicable) (project-specific)

## Authority & precedence

If documents conflict, resolve in this order:
1) [`docs/project/TECHNICAL_DESIGN.md`](project/TECHNICAL_DESIGN.md) — contracts and invariants
2) [`docs/project/UX_DESIGN.md`](project/UX_DESIGN.md) — interaction contract
3) [`docs/project/PRODUCT_DESIGN.md`](project/PRODUCT_DESIGN.md) — system meaning and governance boundary
4) [`docs/project/IMPLEMENTATION_PLAN.md`](project/IMPLEMENTATION_PLAN.md) — sequencing and acceptance criteria
5) [`docs/project/BACKEND_IMPLEMENTATION.md`](project/BACKEND_IMPLEMENTATION.md) and [`docs/project/FRONTEND_IMPLEMENTATION.md`](project/FRONTEND_IMPLEMENTATION.md) — implementation notes

Shared docs (`docs/shared/*`) apply globally within their scope.

## Dependency justification (Technical Design Appendix E3)

PDF text extraction uses **PyMuPDF** because it provides strong extraction quality for “digital text” PDFs with a small dependency footprint and straightforward integration.

Language detection uses **langdetect** because it is lightweight and sufficient to populate a best-effort `language_used` value for processing runs.

Current extraction and processing stories rely on text extraction; OCR for scanned PDFs is not required by the currently scheduled stories. OCR may be introduced by a future user story if/when needed.

## Running (Evaluator Path)

Follow the run instructions in the repository root [`README.md`](../README.md).

This file defines:
- what each document is in this repository
- reading order

# Assistant entrypoint (operational)
- `docs/agent_router/00_AUTHORITY.md` — router for small, intent-based modules (token-optimized).

AI assistants should follow `AGENTS.md` (repo root) and then `docs/agent_router/00_AUTHORITY.md`, loading only the module(s)
needed for the current intent. The rest of this file is primarily for humans.

# Folder structure

This folder is split into three areas:
- [`docs/agent_router/`](agent_router/): token-optimized operational modules for AI assistants.
- [`docs/shared/`](shared/): human-oriented, company-wide, project-agnostic standards and guidelines.
- [`docs/project/`](project/): human-oriented documents specific to this initiative.

## Reading order (mandatory)
### Documentation shared across projects
- [`AGENTS.md`](../AGENTS.md) — canonical AI assistant entrypoint and routing triggers for this repo.
- [`docs/agent_router/03_SHARED/ENGINEERING_PLAYBOOK/00_entry.md`](agent_router/03_SHARED/ENGINEERING_PLAYBOOK/00_entry.md) — engineering standards (split into small modules).
- [`docs/agent_router/03_SHARED/UX_GUIDELINES/00_entry.md`](agent_router/03_SHARED/UX_GUIDELINES/00_entry.md) — global UX principles (split into small modules).
- [`docs/agent_router/03_SHARED/BRAND_GUIDELINES/00_entry.md`](agent_router/03_SHARED/BRAND_GUIDELINES/00_entry.md) — global brand rules (split into small modules).

### Tooling (optional)
- [`metrics/llm_benchmarks/README.md`](../metrics/llm_benchmarks/README.md) — assistant usage benchmarks (opt-in; used only when requested, e.g. `#metrics`).

### Tooling (optional)
- [`metrics/llm_benchmarks/README.md`](../metrics/llm_benchmarks/README.md) — assistant usage benchmarks (opt-in; used only when requested, e.g. `#metrics`).

### Documentation specific to the project
- [`docs/agent_router/04_PROJECT/PRODUCT_DESIGN/00_entry.md`](agent_router/04_PROJECT/PRODUCT_DESIGN/00_entry.md) — product summary (split into small modules)
- [`docs/agent_router/04_PROJECT/UX_DESIGN/00_entry.md`](agent_router/04_PROJECT/UX_DESIGN/00_entry.md) — UX interaction contract (split into small modules)
- [`docs/agent_router/04_PROJECT/TECHNICAL_DESIGN/00_entry.md`](agent_router/04_PROJECT/TECHNICAL_DESIGN/00_entry.md) — architecture + contracts (split into small modules)
- [`docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/00_entry.md`](agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/00_entry.md) — backend implementation notes (split into small modules)
- [`docs/agent_router/04_PROJECT/FRONTEND_IMPLEMENTATION/00_entry.md`](agent_router/04_PROJECT/FRONTEND_IMPLEMENTATION/00_entry.md) — frontend implementation notes (split into small modules)
- [`docs/agent_router/04_PROJECT/IMPLEMENTATION_PLAN/00_entry.md`](agent_router/04_PROJECT/IMPLEMENTATION_PLAN/00_entry.md) — scope + story order + acceptance criteria (split into small modules)

## Authority & precedence

If documents conflict, resolve in this order:
1) [`docs/agent_router/04_PROJECT/TECHNICAL_DESIGN/00_entry.md`](agent_router/04_PROJECT/TECHNICAL_DESIGN/00_entry.md) — contracts and invariants
2) [`docs/agent_router/04_PROJECT/UX_DESIGN/00_entry.md`](agent_router/04_PROJECT/UX_DESIGN/00_entry.md) — interaction contract
3) [`docs/agent_router/04_PROJECT/PRODUCT_DESIGN/00_entry.md`](agent_router/04_PROJECT/PRODUCT_DESIGN/00_entry.md) — system meaning and governance boundary
4) [`docs/agent_router/04_PROJECT/IMPLEMENTATION_PLAN/00_entry.md`](agent_router/04_PROJECT/IMPLEMENTATION_PLAN/00_entry.md) — sequencing and acceptance criteria
5) [`docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/00_entry.md`](agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/00_entry.md) and [`docs/agent_router/04_PROJECT/FRONTEND_IMPLEMENTATION/00_entry.md`](agent_router/04_PROJECT/FRONTEND_IMPLEMENTATION/00_entry.md) — implementation notes

Shared docs (`docs/shared/*`) apply globally within their scope.

## Dependency justification (Technical Design Appendix E3)

PDF text extraction uses **PyMuPDF** because it provides strong extraction quality for “digital text” PDFs with a small dependency footprint and straightforward integration.

Language detection uses **langdetect** because it is lightweight and sufficient to populate a best-effort `language_used` value for processing runs.

Current extraction and processing stories rely on text extraction; OCR for scanned PDFs is not required by the currently scheduled stories. OCR may be introduced by a future user story if/when needed.

## Running (Evaluator Path)

Follow the run instructions in the repository root [`README.md`](../README.md).

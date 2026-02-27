This file defines:
- what each document is in this repository
- reading order

# Scope

This file is a human-oriented index for canonical documentation.

# Folder structure

Canonical documentation is organized into:
- [`docs/shared/`](shared/): company-wide, project-agnostic standards and guidelines.
- [`docs/project/`](project/): documents specific to this initiative.

## Documentation governance (normative)

- **Canonical source docs (human SoT):** `docs/project/*` and `docs/shared/*`.
- **Directionality rule:** canonical docs are human-facing sources and should remain self-contained.

## Top-level folders policy (normative)

Only these top-level folders are allowed under `docs/`:
- `docs/shared/` — human-facing, cross-project standards and guidance.
- `docs/project/` — human-facing, project-specific documentation.
- one operational router folder — assistant execution/router material (non-canonical).

Classification rule:
- Human-readable source documentation must live in `docs/shared/` or `docs/project/`.
- Operational assistant material must live in the operational router folder under `docs/`.

## Reading order (mandatory)
### Evaluator first-pass (recommended, 10-15 min)
1. [`README.md`](../README.md) — Docker-first quickstart, smoke path, and repository overview.
2. [`docs/project/PRODUCT_DESIGN.md`](project/PRODUCT_DESIGN.md) — problem framing and intended outcomes.
3. [`docs/project/TECHNICAL_DESIGN.md`](project/TECHNICAL_DESIGN.md) — architecture, contracts, and invariants.
4. [`docs/project/adr/README.md`](project/adr/README.md) — architecture decision records and trade-off rationale.
5. [`docs/project/UX_DESIGN.md`](project/UX_DESIGN.md) — review workflow and UX interaction guarantees.
6. [`docs/project/BACKEND_IMPLEMENTATION.md`](project/BACKEND_IMPLEMENTATION.md) and [`docs/project/FRONTEND_IMPLEMENTATION.md`](project/FRONTEND_IMPLEMENTATION.md) — implementation details.

### Documentation shared across projects
- [`docs/shared/ENGINEERING_PLAYBOOK.md`](shared/ENGINEERING_PLAYBOOK.md) — engineering standards and working agreements.
- [`docs/shared/UX_GUIDELINES.md`](shared/UX_GUIDELINES.md) — global UX principles.
- [`docs/shared/BRAND_GUIDELINES.md`](shared/BRAND_GUIDELINES.md) — global brand rules.

### Tooling (optional)
- [`metrics/llm_benchmarks/README.md`](../metrics/llm_benchmarks/README.md) — assistant usage benchmarks (opt-in; used only when requested, e.g. `#metrics`).

### Documentation specific to the project
- [`docs/project/PRODUCT_DESIGN.md`](project/PRODUCT_DESIGN.md) — product meaning, scope, and governance.
- [`docs/project/UX_DESIGN.md`](project/UX_DESIGN.md) — UX interaction contract.
- [`docs/project/DESIGN_SYSTEM.md`](project/DESIGN_SYSTEM.md) — design tokens, primitives, and wrappers.
- [`docs/project/TECHNICAL_DESIGN.md`](project/TECHNICAL_DESIGN.md) — architecture, contracts, and invariants.
- [`docs/project/BACKEND_IMPLEMENTATION.md`](project/BACKEND_IMPLEMENTATION.md) — backend implementation notes.
- [`docs/project/FRONTEND_IMPLEMENTATION.md`](project/FRONTEND_IMPLEMENTATION.md) — frontend implementation notes.
- [`docs/project/IMPLEMENTATION_PLAN.md`](project/IMPLEMENTATION_PLAN.md) — scope, story ordering, and acceptance criteria.
- [`docs/project/FUTURE_IMPROVEMENTS.md`](project/FUTURE_IMPROVEMENTS.md) — 2/4/8-week roadmap with prioritized next steps.

### Audit trail and incremental evidence
- [`docs/project/refactor/DELIVERY_SUMMARY.md`](project/refactor/DELIVERY_SUMMARY.md) — quantitative summary of what was delivered (start here for the delta).
- [`docs/project/refactor/12_FACTOR_AUDIT.md`](project/refactor/12_FACTOR_AUDIT.md) — architecture and deployment-factor audit findings.
- [`docs/project/refactor/codebase_audit.md`](project/refactor/codebase_audit.md) — maintainability and structural quality audit findings.
- [`docs/project/implementation/IMPLEMENTATION_HISTORY.md`](project/implementation/IMPLEMENTATION_HISTORY.md) — iterative improvement timeline and execution log.
- [`docs/project/FUTURE_IMPROVEMENTS.md`](project/FUTURE_IMPROVEMENTS.md) — forward roadmap derived from audits and ADRs.
- [`docs/project/adr/README.md`](project/adr/README.md) — architecture ADR index.

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

## Contribution and quality gates

For daily development and pull-request readiness checks, use the local quality-gate commands listed in [`README.md`](../README.md#local-quality-gates-before-pushing).

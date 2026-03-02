# Wiki — Documentation Index

Human-oriented index for all canonical documentation in this repository.

## Folder structure

```
docs/
├── shared/           ← standards and guidelines shared across all projects
├── projects/         ← per-initiative documentation
│   └── veterinary-medical-records/
└── metrics/          ← tooling data (llm_benchmarks)
```

## Documentation governance (normative)

- **Canonical source docs (human SoT):** `docs/shared/*` and `docs/projects/*`.
- **Directionality rule:** canonical docs are human-facing sources and should remain self-contained.
- Human-readable documentation → `docs/shared/` or `docs/projects/`.

## Shared documentation

Standards that apply across all initiatives:

- [ENGINEERING_PLAYBOOK.md](shared/ENGINEERING_PLAYBOOK.md) — engineering standards and working agreements.
- [UX_GUIDELINES.md](shared/UX_GUIDELINES.md) — global UX principles.
- [BRAND_GUIDELINES.md](shared/BRAND_GUIDELINES.md) — global brand rules.
- [LLM_BENCHMARKS.md](shared/LLM_BENCHMARKS.md) — LLM benchmarks system explanation.

## Projects

- [veterinary-medical-records](projects/veterinary-medical-records/README.md) — AI-assisted veterinary clinical records processing.

See [projects/README.md](projects/README.md) for the full initiative listing.

## Evaluator first-pass (recommended, 10-15 min)

1. [README.md](../README.md) — Docker-first quickstart, smoke path, and repository overview.
2. [PRODUCT_DESIGN.md](projects/veterinary-medical-records/design/PRODUCT_DESIGN.md) — problem framing and intended outcomes.
3. [TECHNICAL_DESIGN.md](projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md) — architecture, contracts, and invariants.
4. [ADR index](projects/veterinary-medical-records/tech/adr/README.md) — architecture decision records and trade-off rationale.
5. [UX_DESIGN.md](projects/veterinary-medical-records/design/UX_DESIGN.md) — review workflow and UX interaction guarantees.
6. [BACKEND_IMPLEMENTATION.md](projects/veterinary-medical-records/tech/BACKEND_IMPLEMENTATION.md) and [FRONTEND_IMPLEMENTATION.md](projects/veterinary-medical-records/tech/FRONTEND_IMPLEMENTATION.md) — implementation details.

## Tooling (optional)

- [metrics/llm_benchmarks/README.md](../metrics/llm_benchmarks/README.md) — assistant usage benchmarks.

## Authority & precedence

If documents conflict, resolve in this order:

1. [TECHNICAL_DESIGN.md](projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md) — contracts and invariants
2. [UX_DESIGN.md](projects/veterinary-medical-records/design/UX_DESIGN.md) — interaction contract
3. [PRODUCT_DESIGN.md](projects/veterinary-medical-records/design/PRODUCT_DESIGN.md) — system meaning and governance boundary
4. [IMPLEMENTATION_PLAN.md](projects/veterinary-medical-records/delivery/IMPLEMENTATION_PLAN.md) — sequencing and acceptance criteria
5. [BACKEND_IMPLEMENTATION.md](projects/veterinary-medical-records/tech/BACKEND_IMPLEMENTATION.md) and [FRONTEND_IMPLEMENTATION.md](projects/veterinary-medical-records/tech/FRONTEND_IMPLEMENTATION.md) — implementation notes

Shared docs (`docs/shared/*`) apply globally within their scope.

## Contribution and quality gates

For daily development and pull-request readiness checks, use the local quality-gate commands listed in [README.md](../README.md#local-quality-gates-before-pushing).

## Dependency justification (Technical Design Appendix E3)

PDF text extraction uses **PyMuPDF** because it provides strong extraction quality for "digital text" PDFs with a small dependency footprint and straightforward integration.

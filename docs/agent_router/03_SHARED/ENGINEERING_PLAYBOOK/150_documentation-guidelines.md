# Documentation Guidelines

Documentation is a code quality requirement. All AI coding assistants must treat documentation as part of the deliverable and keep it consistent with the implementation.

## Purpose

Documentation must make the system understandable, maintainable, and reviewable by other engineers.

Document:
- Intent and responsibility
- Contracts and schemas
- Design decisions and tradeoffs

Do not restate obvious code behavior.

Documentation is reviewed together with the code.

## Documentation layers

The project uses three complementary documentation layers. All must stay consistent:

- In-code documentation (docstrings and types)
- API documentation (auto-generated from FastAPI + schemas)
- Repository and architecture documentation (Engineering Playbook; ADR-style notes when explicitly requested)

## In-code documentation rules

AI assistants must add docstrings to:

- Public modules
- Domain and application services
- Public functions and methods
- Non-trivial orchestration logic
- Integration and adapter boundaries

Docstrings must include when relevant:

- Purpose and responsibility
- Inputs and outputs
- Requirements and invariants
- Error conditions and exceptions
- Side effects and state changes

Docstring style requirements:

- Use Google-style docstrings
- Follow PEP 257 structure
- First line: short summary sentence
- Then structured sections when applicable (Args, Returns, Raises, Side Effects, Notes)

Do NOT add docstrings for:

- Trivial helpers
- Self-explanatory one-liners
- Simple pass-through logic
- Code already fully clear from names and types

## Types and contracts

- All public functions and methods must include type hints.
- Treat **type annotations, signatures, and schemas** as part of the documentation contract.
- Ensure all public interfaces include explicit types or schemas when supported.
- Do not duplicate type information in docstrings when already explicit in signatures.

## API documentation rules

For every HTTP endpoint, AI assistants must ensure:

- Route includes summary and description
- Explicit request and response models are defined
- Schema fields include meaningful descriptions

API documentation generated via OpenAPI/Swagger from:

- FastAPI route metadata
- Pydantic model field descriptions
- Type annotations

This auto-generated API documentation is considered part of the deliverable.

## Public interface documentation

For any public interface (API, service, adapter, or module boundary):

- Add a short summary.
- Add a behavior description if not obvious.
- Document input/output contracts.
- Add parameter/field descriptions where they add clarity.
- Prefer metadata compatible with automatic documentation generators when available.

## Architecture and design documentation

Architecture and structural rules must be documented outside the code in the Engineering Playbook.

AI assistants must NOT invent or modify architecture or design documents unless explicitly instructed.

When explicitly requested, record non-obvious technical decisions as short ADR-style notes including:

- Decision
- Rationale
- Tradeoffs

## Commenting rules

Comments must explain:

- Why a decision was made
- Why alternatives were rejected
- Domain assumptions
- Non-obvious requirements

Comments must NOT:

- Repeat what the code literally does
- Describe syntax-level behavior
- Drift from the implementation

Outdated comments must be removed or updated in the same change.

## Documentation maintenance rule

When a change modifies:

- Public behavior
- Contracts
- Data schemas
- Module responsibilities

AI assistants must update the corresponding documentation in the same change set.

A change is not complete if implementation and documentation diverge.

---

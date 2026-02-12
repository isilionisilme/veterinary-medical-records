# Structured interpretation schema 
Authority: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix D (Structured Interpretation Schema v0).

Alignment note:
- Interpretation output may be partial with respect to the full Global Schema v0 key universe.
- Backend does not backfill missing keys for presentation; frontend materializes the full schema view per Product Design authority.

## Storage contract
Authority:
- [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix D3 (Relationship to Persistent Model)
- [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B2.4 (InterpretationVersion)
- [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix A3 (Interpretation & Versioning Invariants)

Implementation responsibility:
- Store the structured interpretation JSON as `InterpretationVersion.data`.
- Any edit creates a new `InterpretationVersion` (append-only).
- Exactly one active interpretation version per run.

## Critical keys
`StructuredField.is_critical` MUST be derived from `key ∈ CRITICAL_KEYS_V0`.
Source of truth: [`docs/project/PRODUCT_DESIGN.md`](../PRODUCT_DESIGN/00_entry.md).

Backend responsibility:
- Apply deterministic derivation at write-time (or validate on write).
- Do not allow the model to decide criticality.

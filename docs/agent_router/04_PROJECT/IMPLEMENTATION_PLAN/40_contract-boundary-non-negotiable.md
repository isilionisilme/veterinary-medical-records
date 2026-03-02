# Contract boundary (non-negotiable)

This plan MUST NOT specify or restate cross-cutting technical contracts, even as “examples”:
- endpoint paths, request/response payload shapes, or per-endpoint semantics,
- error codes or error semantics,
- persistence schemas/tables/entities or field-level models,
- structured interpretation schema fields,
- logging `event_type` values,
- library/framework choices, module structure, or code patterns.

If a story depends on any of the above, it MUST reference the authoritative sections in:
- [`docs/projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) (Appendices A/B/C/D)
- [`docs/projects/veterinary-medical-records/design/UX_DESIGN.md`](../UX_DESIGN/00_entry.md)
- [`docs/projects/veterinary-medical-records/design/PRODUCT_DESIGN.md`](../PRODUCT_DESIGN/00_entry.md)

---

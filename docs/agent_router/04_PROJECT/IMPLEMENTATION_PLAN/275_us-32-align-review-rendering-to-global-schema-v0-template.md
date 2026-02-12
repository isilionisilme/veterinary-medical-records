# US-32 — Align review rendering to Global Schema v0 template

**User Story**
As a veterinarian, I want the review view to always use the full Global Schema v0 template so that scanning is consistent across documents.

**Acceptance Criteria**
- The UI renders the complete Global Schema v0 in fixed order and by sections, regardless of how many fields were extracted.
- Non-extracted keys render explicit placeholders (no blank gaps).
- While structured data is loading, the UI shows a loading state and does not render missing placeholders yet.
- Repeatable fields render as lists and show an explicit empty-list state when no items are present.
- Extracted keys outside Global Schema v0 are rendered in a separate section named `Other extracted fields`.
- Veterinarian-facing copy does not expose governance terminology such as `pending_review`, `reviewer`, or `governance`.

**Scope Clarification**
- This story does not introduce new endpoints.
- This story does not change persistence schema.
- This story does not redefine error codes.
- This story does not change run semantics; it defines review rendering behavior only.

**Authoritative References**
- Product: Global schema authority and field list: [`docs/project/PRODUCT_DESIGN.md`](../PRODUCT_DESIGN/00_entry.md) section **Global Schema v0 (Canonical Field List)**.
- UX: Rendering and placeholder behavior: [`docs/project/UX_DESIGN.md`](../UX_DESIGN/00_entry.md) section **Review UI Rendering Rules (Global Schema v0 Template)**.
- Tech: Structured interpretation schema and partial payload boundary: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix D.
- Frontend implementation notes: [`docs/project/FRONTEND_IMPLEMENTATION.md`](../FRONTEND_IMPLEMENTATION/00_entry.md) section **Review Rendering Backbone (Global Schema v0)**.

**Test Expectations**
- Review screens always show the same section/key structure, independent of extraction completeness.
- Missing scalar values, missing repeatable values, and loading states are visually distinguishable and deterministic.
- Non-schema extracted keys are visible under `Other extracted fields`.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per [docs/project/TECHNICAL_DESIGN.md](../TECHNICAL_DESIGN/00_entry.md) Appendix B7.
- Follow UX guidance from [docs/shared/UX_GUIDELINES.md](../../03_SHARED/UX_GUIDELINES/00_entry.md) and [docs/project/UX_DESIGN.md](../UX_DESIGN/00_entry.md), if applicable.
- Apply [docs/shared/BRAND_GUIDELINES.md](../../03_SHARED/BRAND_GUIDELINES/00_entry.md), if applicable.

---

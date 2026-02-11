# US-09 — Capture correction signals

**User Story**
As a veterinarian, I want the system to record my normal corrections as append-only signals so the system can improve later, without asking me for feedback.

**Acceptance Criteria**
- Corrections do not require extra steps.
- Recording signals does not change system behavior.
- No confidence adjustment is visible or used for decisions.
- No new veterinarian UI is introduced for “learning” or “feedback”.

**Scope Clarification**
- Capture-only in this story: no confidence adjustment, no model training, no schema changes.

**Authoritative References**
- Product: Learning and governance principles: [`docs/project/PRODUCT_DESIGN.md`](../PRODUCT_DESIGN/00_entry.md) Section 6
- Tech: Field change log is append-only and can serve as correction signal storage: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B2.5
- UX: No explicit feedback flows: [`docs/project/UX_DESIGN.md`](../UX_DESIGN/00_entry.md) Section 4

**Test Expectations**
- Corrections are persisted append-only and do not alter current review/edit workflows.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per [docs/project/TECHNICAL_DESIGN.md](../TECHNICAL_DESIGN/00_entry.md) Appendix B7.
- Follow UX guidance from [docs/shared/UX_GUIDELINES.md](../../03_SHARED/UX_GUIDELINES/00_entry.md) and [docs/project/UX_DESIGN.md](../UX_DESIGN/00_entry.md), if applicable.
- Apply [docs/shared/BRAND_GUIDELINES.md](../BRAND_GUIDELINES/00_entry.md), if applicable.

---

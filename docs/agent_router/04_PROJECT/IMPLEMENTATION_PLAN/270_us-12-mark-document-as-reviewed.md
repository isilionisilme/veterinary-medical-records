# US-12 — Mark document as reviewed

**User Story**
As a veterinarian, I want to mark a document as reviewed so that I can explicitly close out my work.

**Acceptance Criteria**
- I can mark a document as reviewed.
- Reviewed status is independent from processing status.
- Editing after marking reviewed automatically reopens review.
- Reprocessing does not change review status.

**Scope Clarification**
- No reviewer/governance behavior is introduced.

**Authoritative References**
- Tech: Review status rules: [`docs/projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix A1.3
- Tech: Mark-reviewed endpoint idempotency and retry rules: [`docs/projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B4

**Test Expectations**
- Review status transitions follow the authoritative rules.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per [docs/projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md](../TECHNICAL_DESIGN/00_entry.md) Appendix B7.
- Follow UX guidance from [docs/shared/UX_GUIDELINES.md](../../03_SHARED/UX_GUIDELINES/00_entry.md) and [docs/projects/veterinary-medical-records/design/UX_DESIGN.md](../UX_DESIGN/00_entry.md), if applicable.
- Apply [docs/shared/BRAND_GUIDELINES.md](../../03_SHARED/BRAND_GUIDELINES/00_entry.md), if applicable.

---

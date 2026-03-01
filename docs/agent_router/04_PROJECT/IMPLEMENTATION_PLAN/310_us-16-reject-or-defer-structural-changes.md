# US-16 — Reject or defer structural changes

**User Story**
As a reviewer, I want to reject or defer structural changes so that unsafe or low-quality candidates do not become part of the canonical schema.

**Acceptance Criteria**
- I can reject a candidate.
- I can defer a candidate.
- Decisions are auditable and append-only.
- Decisions do not affect veterinarian workflows.

**Scope Clarification**
- Rejection/deferral does not delete candidate history.

**Authoritative References**
- Tech: Governance decision log: [`docs/projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B2.9
- Tech: Governance endpoints: [`docs/projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B3
- Tech: Governance invariants: [`docs/projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix A7

**Test Expectations**
- Decisions append to the audit trail and update candidate status consistently.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per [docs/projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md](../TECHNICAL_DESIGN/00_entry.md) Appendix B7.
- Follow UX guidance from [docs/shared/UX_GUIDELINES.md](../../03_SHARED/UX_GUIDELINES/00_entry.md) and [docs/projects/veterinary-medical-records/design/UX_DESIGN.md](../UX_DESIGN/00_entry.md), if applicable.
- Apply [docs/shared/BRAND_GUIDELINES.md](../../03_SHARED/BRAND_GUIDELINES/00_entry.md), if applicable.

---

# US-15 — Approve structural changes into the global schema

**User Story**
As a reviewer, I want to approve structural changes so that future interpretations use an updated canonical schema.

**Acceptance Criteria**
- I can approve a candidate.
- Approval creates a new canonical schema version.
- Approved changes apply prospectively to new runs only.
- Past documents and past runs remain unchanged.
- Approval does not trigger implicit reprocessing.

**Scope Clarification**
- No automatic promotion without explicit reviewer action.

**Authoritative References**
- Tech: Schema version persistence and current schema rule: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B2.7
- Tech: `schema_version_used` persisted per run: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B2.2
- Tech: Governance invariants: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix A7

**Test Expectations**
- Approval creates a new schema version and new runs use it.
- Existing runs retain their historical schema association.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per [docs/project/TECHNICAL_DESIGN.md](../TECHNICAL_DESIGN/00_entry.md) Appendix B7.
- Follow UX guidance from [docs/shared/UX_GUIDELINES.md](../../03_SHARED/UX_GUIDELINES/00_entry.md) and [docs/project/UX_DESIGN.md](../UX_DESIGN/00_entry.md), if applicable.
- Apply [docs/shared/BRAND_GUIDELINES.md](../../03_SHARED/BRAND_GUIDELINES/00_entry.md), if applicable.

---

# US-14 — Filter and prioritize pending structural changes

**User Story**
As a reviewer, I want to filter and prioritize pending structural changes so I can focus on the most impactful candidates.

**Acceptance Criteria**
- I can filter candidates by status and basic attributes.
- I can prioritize candidates by frequency and criticality.
- Filtering/prioritization never blocks veterinarians.

**Scope Clarification**
- This story does not introduce automatic decisions.

**Authoritative References**
- Product: Critical keys policy: [`docs/project/PRODUCT_DESIGN.md`](../PRODUCT_DESIGN/00_entry.md) CRITICAL_KEYS_V0
- Tech: Critical concept derivation: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix D7.4
- Tech: Governance endpoints: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B3

**Test Expectations**
- Filters do not change underlying candidate data; they only change views.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per [docs/project/TECHNICAL_DESIGN.md](../TECHNICAL_DESIGN/00_entry.md) Appendix B7.
- Follow UX guidance from [docs/shared/UX_GUIDELINES.md](../../03_SHARED/UX_GUIDELINES/00_entry.md) and [docs/project/UX_DESIGN.md](../UX_DESIGN/00_entry.md), if applicable.
- Apply [docs/shared/BRAND_GUIDELINES.md](../../03_SHARED/BRAND_GUIDELINES/00_entry.md), if applicable.

---

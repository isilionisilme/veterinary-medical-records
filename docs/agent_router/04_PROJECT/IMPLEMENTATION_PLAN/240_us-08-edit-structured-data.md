# US-08 — Edit structured data

**User Story**
As a veterinarian, I want to edit structured information extracted from a document so that it accurately reflects the original document.

**Acceptance Criteria**
- I can edit existing fields.
- I can create new fields.
- I can see which fields I have modified.
- Edits are immediate and local to the current document; no extra steps exist “to help the system”.
- Editing never blocks on confidence.
- Reprocessing resets edits by creating a new run and new machine output.

**Scope Clarification**
- This story covers veterinarian edits only.
- No reviewer workflow or schema evolution UI is introduced here.
- Editing applies to runs that have an active interpretation; this is expected for PDFs (see Technical Design Appendix E).

**Authoritative References**
- Tech: Versioning invariants (append-only interpretations): [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix A3 + Appendix B2.4
- Tech: Field change log contract: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B2.5
- Tech: Edit endpoint contract: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B3.1
- UX: Immediate local correction, no extra feedback steps: [`docs/project/UX_DESIGN.md`](../UX_DESIGN/00_entry.md) Section 4
- Tech: Extraction/interpretation scope (PDF): [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix E

**Test Expectations**
- Each edit produces a new interpretation version and appends change-log entries.
- Editing is blocked only by the authoritative “active run” rule.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per [docs/project/TECHNICAL_DESIGN.md](../TECHNICAL_DESIGN/00_entry.md) Appendix B7.
- Follow UX guidance from [docs/shared/UX_GUIDELINES.md](../../03_SHARED/UX_GUIDELINES/00_entry.md) and [docs/project/UX_DESIGN.md](../UX_DESIGN/00_entry.md), if applicable.
- Apply [docs/shared/BRAND_GUIDELINES.md](../../03_SHARED/BRAND_GUIDELINES/00_entry.md), if applicable.

---

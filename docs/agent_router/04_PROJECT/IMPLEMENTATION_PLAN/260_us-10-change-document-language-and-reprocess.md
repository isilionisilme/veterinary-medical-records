# US-10 — Change document language and reprocess

**User Story**
As a veterinarian, I want to change the detected language of a document so that it can be reprocessed correctly if automatic detection was wrong.

**Acceptance Criteria**
- The user can see the language used for the latest processing attempt.
- The user can set or clear a language override.
- The user can trigger reprocessing after changing the override.
- The system clearly indicates which language was used for each run.
- Language override does not block review or editing and affects only subsequent runs.

**Scope Clarification**
- Changing the language does not automatically reprocess.

**Authoritative References**
- Tech: Language detection rules: [`docs/projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix E
- Tech: Language override endpoint + rules: [`docs/projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B3/B3.1
- Tech: Run persistence of `language_used`: [`docs/projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B2.2

**Test Expectations**
- New runs created after setting an override persist the overridden `language_used`.
- Existing runs remain unchanged.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per [docs/projects/veterinary-medical-records/tech/TECHNICAL_DESIGN.md](../TECHNICAL_DESIGN/00_entry.md) Appendix B7.
- Follow UX guidance from [docs/shared/UX_GUIDELINES.md](../../03_SHARED/UX_GUIDELINES/00_entry.md) and [docs/projects/veterinary-medical-records/design/UX_DESIGN.md](../UX_DESIGN/00_entry.md), if applicable.
- Apply [docs/shared/BRAND_GUIDELINES.md](../../03_SHARED/BRAND_GUIDELINES/00_entry.md), if applicable.

---

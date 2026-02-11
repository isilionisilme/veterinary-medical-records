# US-20 — Add Images end-to-end support

**User Story**
As a user, I want to upload, access, and process image documents so that scans and photographs can be handled in the same workflow.

**Acceptance Criteria**
- I can upload supported image types (at minimum PNG and JPEG).
- I can download and preview the original image at any time without blocking on processing.
- Image documents are processed in the same step-based, non-blocking pipeline as PDFs, producing the same visibility and artifacts.
- Extraction for images uses OCR to produce raw text suitable for downstream interpretation and review.
- Review-in-context and editing behave the same as for PDFs once extracted text exists.

**Scope Clarification**
- This story changes format support only; the processing pipeline, contracts, versioning rules, and review workflow semantics remain unchanged.
- This story requires updating the authoritative format support contract in [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) (supported upload types and any related filesystem rules).

**Authoritative References**
- Tech: Endpoint surface and error semantics: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix B3/B3.2
- Tech: Processing model and run invariants: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Sections 3–4 + Appendix A2
- Tech: Step model + failure mapping: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix C
- Tech: Extraction library decisions (appendix): [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix E
- UX: Review flow guarantees: [`docs/project/UX_DESIGN.md`](../UX_DESIGN/00_entry.md) Sections 2–4

**Story-specific technical requirements**
- Add server-side type detection for images based on server-side inspection.
- Define the OCR extraction approach in [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix E during this story, then implement it.
- Store the original under the deterministic path rules with the appropriate extension (e.g., `original.png`, `original.jpg`).

**Test Expectations**
- Image inputs behave like PDFs for upload/download/status visibility.
- OCR extraction produces a raw-text artifact for image runs, enabling the same review/edit endpoints once processing completes.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per [docs/project/TECHNICAL_DESIGN.md](../TECHNICAL_DESIGN/00_entry.md) Appendix B7.
- Follow UX guidance from [docs/shared/UX_GUIDELINES.md](../../03_SHARED/UX_GUIDELINES/00_entry.md) and [docs/project/UX_DESIGN.md](../UX_DESIGN/00_entry.md), if applicable.
- Apply [docs/shared/BRAND_GUIDELINES.md](../BRAND_GUIDELINES/00_entry.md), if applicable.

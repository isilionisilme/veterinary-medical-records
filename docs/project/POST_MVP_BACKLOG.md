# Post-MVP Backlog

This document contains story cards that are explicitly **out of MVP scope**.

It is a backlog/reference only:
- it does **not** define sequencing authority for MVP,
- it does **not** define API/persistence/contracts (those remain in `docs/project/TECHNICAL_DESIGN.md`),
- it preserves future work items so they remain visible without polluting `docs/project/IMPLEMENTATION_PLAN.md`.

---

## US-19 — Full DOCX support (end-to-end)

**User Story**
As a user, I want to upload, access, and process DOCX documents so that the same workflow supported for PDFs applies to Word documents.

**Acceptance Criteria**
- I can upload a supported DOCX document type.
- I can download the original DOCX at any time without blocking on processing.
- The system can process DOCX documents and expose the same processing visibility as PDFs.
- Review-in-context remains non-blocking and preserves traceability for DOCX inputs.

**Scope Clarification**
- This story expands file-type support beyond PDF.

**Authoritative References**
- Tech: Endpoint surface and error semantics: `docs/project/TECHNICAL_DESIGN.md` Appendix B3/B3.2
- Tech: Processing model and run invariants: `docs/project/TECHNICAL_DESIGN.md` Sections 3–4 + Appendix A2
- UX: Review flow guarantees: `docs/project/UX_DESIGN.md`

**Test Expectations**
- DOCX inputs behave like PDFs for upload/download/status visibility.

---

## US-20 — Full Image support (end-to-end)

**User Story**
As a user, I want to upload, access, and process image documents so that scans and photographs can be handled in the same workflow.

**Acceptance Criteria**
- I can upload a supported image document type.
- I can download and preview the original image at any time without blocking on processing.
- The system can process image documents and expose the same processing visibility as PDFs.
- Review-in-context remains non-blocking and preserves traceability for image inputs.

**Scope Clarification**
- This story expands file-type support beyond PDF.

**Authoritative References**
- Tech: Endpoint surface and error semantics: `docs/project/TECHNICAL_DESIGN.md` Appendix B3/B3.2
- Tech: Processing model and run invariants: `docs/project/TECHNICAL_DESIGN.md` Sections 3–4 + Appendix A2
- UX: Review flow guarantees: `docs/project/UX_DESIGN.md`

**Test Expectations**
- Image inputs behave like PDFs for upload/download/status visibility.


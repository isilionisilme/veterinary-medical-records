# Note for readers:
This document is intended to provide structured context to an AI Coding Assistant during implementation.

The version of this document written for evaluators and reviewers is available here:
https://docs.google.com/document/d/1b1rvBJu9bGjv8Z42OdDz9qwjecbqDbpilkn0KkYuD-M

Reading order, document authority, and precedence rules are defined in `docs/README.md`.
If any conflict is detected, **STOP and ask before proceeding**.

# Implementation Plan

## Purpose

This document is the **sequencing and scope authority** for the project.

It defines:
- the **order of implementation**,
- the **scope boundaries** of each user story,
- the **acceptance criteria** that determine completion.

This document does **not** define:
- product meaning or governance,
- UX semantics or interaction contracts,
- architecture, system invariants, or API contracts,
- cross-cutting implementation principles,
- backend/frontend implementation details.

Those are defined in their respective authoritative documents as described in `docs/README.md`.

Features or behaviors not explicitly listed here are considered **out of scope**.

---

## How to use this document

The AI Coding Assistant must:
- read all prerequisite documents defined in `docs/README.md`,
- implement user stories **strictly in the order defined here**,
- treat acceptance criteria as **exit conditions**, not suggestions.

Ordering rule:
- Story order is defined by the **order of story sections in this document**, not by story numeric identifiers.

If a user story appears underspecified or conflicts with an authoritative document,
**STOP and ask before implementing**.

---

## Contract boundary (non-negotiable)

This plan MUST NOT specify or restate cross-cutting technical contracts, even as “examples”:
- endpoint paths, request/response payload shapes, or per-endpoint semantics,
- error codes or error semantics,
- persistence schemas/tables/entities or field-level models,
- structured interpretation schema fields,
- logging `event_type` values,
- library/framework choices, module structure, or code patterns.

If a story depends on any of the above, it MUST reference the authoritative sections in:
- `docs/project/TECHNICAL_DESIGN.md` (Appendices A/B/C/D)
- `docs/project/UX_DESIGN.md`
- `docs/project/PRODUCT_DESIGN.md`

---

## Scope and Non-Goals

This plan covers the **Veterinary Medical Records Processing MVP** only.

MVP scope boundary (file types):
- The MVP supports **PDF-only** end-to-end (upload + download + preview + review-in-context).
- DOCX and image uploads are **out of scope for the MVP** and are delivered as post-MVP stories (Release 8).

Explicit non-goals:
- Production hardening
- Multi-tenant support
- Advanced ML training loops
- Full policy automation
- Performance optimization beyond correctness

---

## Execution Rules

- Work is executed **one user story at a time**
- A story is complete only when all acceptance criteria pass
- No story may redefine contracts owned elsewhere
- Any change to contracts requires updating the authoritative document first

---

## Release 1 — Document upload & access

### Goal
Allow users to upload documents and access them reliably, establishing a stable and observable foundation.

### Scope
- Upload documents
- Persist original documents
- Initialize and expose document status
- Download and preview original documents
- List uploaded documents with their status

### User Stories (in order)
- US-01 — Upload document
- US-02 — View document status
- US-03 — Download / preview original document
- US-04 — List uploaded documents and their status

---

## Release 2 — Automatic processing & traceability

### Goal
Automatically process uploaded documents in a **non-blocking** way, with full traceability and safe reprocessing.

### Scope
- Automatic processing after upload
- Explicit processing states
- Failure classification
- Manual reprocessing
- Append-only processing history

### User Stories (in order)
- US-05 — Process document
- US-11 — View document processing history

---

## Release 3 — Extraction transparency (trust & debuggability)

### Goal
Make visible and explainable **what the system has read**, before any interpretation is applied.

### Scope
- Raw text extraction visibility
- Language visibility
- Persistent extraction artifacts
- On-demand access via progressive disclosure

### User Stories (in order)
- US-06 — View extracted text

---

## Release 4 — Assisted review in context (high value / higher risk)

### Goal
Enable veterinarians to review the system’s interpretation **in context**, side-by-side with the original document.

### Scope
- Structured extracted data
- Per-field confidence signals
- Evidence via page + snippet (approximate by design)
- Side-by-side document review
- Progressive enhancement (review usable even if highlighting fails)
- Non-blocking, explainable UX

### User Stories (in order)
- US-07 — Review document in context

---

## Release 5 — Editing & learning signals (human corrections)

### Goal
Allow veterinarians to correct structured data naturally, while capturing append-only correction signals—without changing their workflow.

### Scope
- Edit existing structured fields
- Create new structured fields
- Versioned structured records
- Field-level change logs
- Capture append-only correction signals (no behavior change in MVP)

### User Stories (in order)
- US-08 — Edit structured data
- US-09 — Capture correction signals

---

## Release 6 — Explicit overrides & workflow closure

### Goal
Give veterinarians explicit control over processing context and a clear way to close work on a document.

### Scope
- Manual language override
- Reprocessing with new language context
- Explicit “reviewed” status
- Automatic reopening on edits

### User Stories (in order)
- US-10 — Change document language and reprocess
- US-12 — Mark document as reviewed

---

## Release 7 — Schema evolution (isolated reviewer workflows)

### Goal
Introduce reviewer-facing governance for global schema evolution, fully isolated from veterinarian workflows.

### Scope
- Aggregation of pending structural change candidates
- Reviewer-facing inspection, filtering, and prioritization
- Approval, rejection, and deferral
- Canonical schema versioning (prospective only)
- Append-only governance audit trail

### User Stories (in order)
- US-13 — Review aggregated pending structural changes
- US-14 — Filter and prioritize pending structural changes
- US-15 — Approve structural changes into the global schema
- US-16 — Reject or defer structural changes
- US-17 — Govern critical (non-reversible) structural changes
- US-18 — Audit trail of schema governance decisions

---

## Release 8 — Additional file types (post-MVP)

### Goal
Add end-to-end support for additional upload types beyond PDF.

### Scope
- DOCX end-to-end support (post-MVP)
- Image end-to-end support (post-MVP)

### User Stories (in order)
- US-19 — Full DOCX support (post-MVP)
- US-20 — Full Image support (post-MVP)

---

# User Story Details

Each story below contains only:
- user intent
- user-observable acceptance criteria
- story-specific scope boundaries
- authoritative references
- story-specific test expectations (high-level)

All contracts (API map, persistence model, schema, error semantics, invariants, logging taxonomy) MUST be taken from authoritative docs.

---

## US-01 — Upload document

**User Story**
As a user, I want to upload a document so that it is stored and available for processing.

**Acceptance Criteria**
- I can upload a supported document type.
- I receive immediate confirmation that the document was uploaded.
- The document appears in the system with the initial derived status.
- The UI communicates that processing is assistive and may be incomplete, without blocking the user.

**Scope Clarification**
- This story does not start processing.
- Background processing is introduced later (US-05).

**Authoritative References**
- Tech: API surface + upload constraints + errors: `docs/project/TECHNICAL_DESIGN.md` Appendix B3/B3.2
- Tech: Derived document status: `docs/project/TECHNICAL_DESIGN.md` Appendix A1.2
- Tech: Filesystem rules: `docs/project/TECHNICAL_DESIGN.md` Appendix B5

**Test Expectations**
- Uploading a supported type succeeds and persists the document.
- Uploading an unsupported type fails with the normative error contract.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests added/updated per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-02 — View document status

**User Story**
As a user, I want to see the current status of a document so that I understand its processing state.

**Acceptance Criteria**
- I can view the current derived status of a document at any time.
- I can see whether processing has succeeded, failed, or timed out.
- If processing fails, the UI can explain the failure category in non-technical terms.
- Pending review and schema governance concepts never block veterinarians and are not exposed in veterinarian UI.

**Scope Clarification**
- This story does not start or control processing.
- This story does not expose run history or per-step details (US-11 covers history).

**Authoritative References**
- Tech: Derived status rules: `docs/project/TECHNICAL_DESIGN.md` Appendix A1.2
- Tech: Failure types and mapping: `docs/project/TECHNICAL_DESIGN.md` Appendix C3
- UX: Separation of responsibilities: `docs/project/UX_DESIGN.md` Sections 1 and 8

**Test Expectations**
- Derived status matches the latest run state across all states.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-03 — Download / preview original document

**User Story**
As a user, I want to download and preview the original uploaded document so that I can access the source material.

**Acceptance Criteria**
- I can access the original uploaded file for a document.
- Preview is supported for PDFs in the MVP.
- If the stored file is missing, the system returns the normative missing-artifact behavior.
- Accessing the original file is non-blocking and does not depend on processing success.

**Scope Clarification**
- This story does not implement evidence overlays or highlighting.

**Authoritative References**
- Tech: API surface + errors: `docs/project/TECHNICAL_DESIGN.md` Appendix B3/B3.2
- Tech: Filesystem artifact rules: `docs/project/TECHNICAL_DESIGN.md` Appendix B5

**Test Expectations**
- Successful download works for an uploaded document.
- Missing artifact behavior matches the Technical Design contract.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-04 — List uploaded documents and their status

**User Story**
As a user, I want to list uploaded documents and see their status so that I can navigate my work.

**Acceptance Criteria**
- I can see a stable list of documents.
- Each item includes basic metadata and derived status.
- The list remains accessible regardless of processing state.

**Scope Clarification**
- This story does not add filtering/search (future concern).

**Authoritative References**
- Tech: Listing semantics and run resolution: `docs/project/TECHNICAL_DESIGN.md` Appendix B3/B3.1
- Tech: Derived status rules: `docs/project/TECHNICAL_DESIGN.md` Appendix A1.2

**Test Expectations**
- Documents with no runs show the correct derived status.
- Documents with queued/running/latest terminal runs show the correct derived status.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-05 — Process document

**User Story**
As a veterinarian, I want uploaded documents to be processed automatically so that I can review the system’s interpretation without changing my workflow.

**Acceptance Criteria**
- Processing starts automatically after upload and is non-blocking.
- I can see when a document is processing and when it completes.
- If processing fails or times out, failure category is visible.
- I can manually reprocess a document at any time.
- Each processing attempt is traceable and does not overwrite prior runs/artifacts.

**Scope Clarification**
- No external queues or distributed infrastructure are introduced in the MVP.

**Authoritative References**
- Tech: Processing model and run invariants: `docs/project/TECHNICAL_DESIGN.md` Sections 3–4 + Appendix A2
- Tech: Step model + failure mapping: `docs/project/TECHNICAL_DESIGN.md` Appendix C
- Tech: Reprocess endpoint and idempotency rules: `docs/project/TECHNICAL_DESIGN.md` Appendix B3 + Appendix B4

**Test Expectations**
- Upload triggers background processing without blocking the request.
- Reprocess creates a new run and preserves prior runs/artifacts.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-11 — View document processing history

**User Story**
As a veterinarian, I want to see the processing history of a document so that I can understand which steps were executed and whether any failures occurred.

**Acceptance Criteria**
- I can see a chronological history of processing runs and their steps.
- Each step shows status and timestamps.
- Failures are clearly identified and explained in non-technical terms.
- The history is read-only and non-blocking.

**Scope Clarification**
- This story does not introduce actions from the history view.

**Authoritative References**
- Tech: Processing history endpoint contract: `docs/project/TECHNICAL_DESIGN.md` Appendix B3.1
- Tech: Step artifacts are the source of truth: `docs/project/TECHNICAL_DESIGN.md` Appendix C4

**Test Expectations**
- History reflects persisted step artifacts accurately.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-06 — View extracted text

**User Story**
As a veterinarian, I want to view the raw text extracted from a document so that I understand what the system has read before any structured interpretation is applied.

**Acceptance Criteria**
- I can view extracted raw text for a completed run.
- The UI distinguishes “not ready yet” vs “not available (e.g., extraction failed)” without blocking workflow.
- Raw text is hidden by default and shown on demand in no more than one interaction.
- Raw text is clearly framed as an intermediate artifact, not ground truth.

**Scope Clarification**
- This story is read-only.

**Authoritative References**
- Tech: Raw-text artifact endpoint + “not ready vs not available” semantics: `docs/project/TECHNICAL_DESIGN.md` Appendix B3/B3.2
- Tech: Extraction + language detection libraries: `docs/project/TECHNICAL_DESIGN.md` Appendix E

**Test Expectations**
- Raw text retrieval behaves correctly across run states and extraction failures.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-07 — Review document in context

**User Story**
As a veterinarian, I want to review the system’s interpretation while viewing the original document so that I can verify it.

**Acceptance Criteria**
- I can see structured extracted data and the original document together.
- Confidence is visible and non-blocking (guides attention, not decisions).
- Evidence is available per field as page + snippet, accessible with minimal interaction.
- Highlighting in the document is progressive enhancement: review remains usable if highlighting fails.
- I can optionally view raw extracted text from the review context.
- Reviewer/governance concepts are not exposed to veterinarians.

**Scope Clarification**
- No approval/gating flows are introduced.
- Exact coordinate evidence is out of scope.

**Authoritative References**
- UX: Review flow + confidence meaning: `docs/project/UX_DESIGN.md` Sections 2–4
- Tech: Review endpoint semantics (latest completed run): `docs/project/TECHNICAL_DESIGN.md` Appendix B3.1
- Tech: Structured interpretation schema + evidence model: `docs/project/TECHNICAL_DESIGN.md` Appendix D + D6

**Test Expectations**
- Review uses the latest completed run rules.
- Lack of a completed run yields the normative conflict behavior.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-08 — Edit structured data

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

**Authoritative References**
- Tech: Versioning invariants (append-only interpretations): `docs/project/TECHNICAL_DESIGN.md` Appendix A3 + Appendix B2.4
- Tech: Field change log contract: `docs/project/TECHNICAL_DESIGN.md` Appendix B2.5
- Tech: Edit endpoint contract: `docs/project/TECHNICAL_DESIGN.md` Appendix B3.1
- UX: Immediate local correction, no extra feedback steps: `docs/project/UX_DESIGN.md` Section 4

**Test Expectations**
- Each edit produces a new interpretation version and appends change-log entries.
- Editing is blocked only by the authoritative “active run” rule.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-09 — Capture correction signals

**User Story**
As a veterinarian, I want the system to record my normal corrections as append-only signals so the system can improve later, without asking me for feedback.

**Acceptance Criteria**
- Corrections do not require extra steps.
- Recording signals does not change system behavior in the MVP.
- No confidence adjustment is visible or used for decisions in the MVP.
- No new veterinarian UI is introduced for “learning” or “feedback”.

**Scope Clarification**
- Capture-only in MVP: no confidence adjustment, no model training, no schema changes.

**Authoritative References**
- Product: MVP non-goals (no implicit learning behavior changes): `docs/project/PRODUCT_DESIGN.md` Section 6
- Tech: Field change log is append-only and can serve as correction signal storage: `docs/project/TECHNICAL_DESIGN.md` Appendix B2.5
- UX: No explicit feedback flows: `docs/project/UX_DESIGN.md` Section 4

**Test Expectations**
- Corrections are persisted append-only and do not alter current review/edit workflows.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-10 — Change document language and reprocess

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
- Tech: Language detection rules: `docs/project/TECHNICAL_DESIGN.md` Appendix E
- Tech: Language override endpoint + rules: `docs/project/TECHNICAL_DESIGN.md` Appendix B3/B3.1
- Tech: Run persistence of `language_used`: `docs/project/TECHNICAL_DESIGN.md` Appendix B2.2

**Test Expectations**
- New runs created after setting an override persist the overridden `language_used`.
- Existing runs remain unchanged.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-12 — Mark document as reviewed

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
- Tech: Review status rules: `docs/project/TECHNICAL_DESIGN.md` Appendix A1.3
- Tech: Mark-reviewed endpoint idempotency and retry rules: `docs/project/TECHNICAL_DESIGN.md` Appendix B4

**Test Expectations**
- Review status transitions follow the authoritative rules.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-13 — Review aggregated pending structural changes

**User Story**
As a reviewer, I want to review aggregated pending structural changes so that I can validate or reject schema-level evolution based on recurring patterns.

**Acceptance Criteria**
- I can see pending structural change candidates grouped by pattern, not by individual documents.
- Each candidate includes summary, occurrence counts, and representative evidence.
- This review flow never blocks veterinarians or document processing.
- This flow is reviewer-facing only and not exposed in veterinarian UI.

**Scope Clarification**
- No retroactive changes to past documents.

**Authoritative References**
- Product: Separation of responsibilities and governance boundary: `docs/project/PRODUCT_DESIGN.md` Sections 5 and 4.3
- Tech: Governance invariants: `docs/project/TECHNICAL_DESIGN.md` Appendix A7
- Tech: Governance persistence + endpoints: `docs/project/TECHNICAL_DESIGN.md` Appendix B2.8–B2.9 + Appendix B3.1

**Test Expectations**
- Candidates are isolated from document workflows and apply prospectively only.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-14 — Filter and prioritize pending structural changes

**User Story**
As a reviewer, I want to filter and prioritize pending structural changes so I can focus on the most impactful candidates.

**Acceptance Criteria**
- I can filter candidates by status and basic attributes.
- I can prioritize candidates by frequency and criticality.
- Filtering/prioritization never blocks veterinarians.

**Scope Clarification**
- This story does not introduce automatic decisions.

**Authoritative References**
- Product: Critical keys policy: `docs/project/PRODUCT_DESIGN.md` CRITICAL_KEYS_V0
- Tech: Critical concept derivation: `docs/project/TECHNICAL_DESIGN.md` Appendix D7.4
- Tech: Governance endpoints: `docs/project/TECHNICAL_DESIGN.md` Appendix B3

**Test Expectations**
- Filters do not change underlying candidate data; they only change views.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-15 — Approve structural changes into the global schema

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
- Tech: Schema version persistence and current schema rule: `docs/project/TECHNICAL_DESIGN.md` Appendix B2.7
- Tech: `schema_version_used` persisted per run: `docs/project/TECHNICAL_DESIGN.md` Appendix B2.2
- Tech: Governance invariants: `docs/project/TECHNICAL_DESIGN.md` Appendix A7

**Test Expectations**
- Approval creates a new schema version and new runs use it.
- Existing runs retain their historical schema association.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-16 — Reject or defer structural changes

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
- Tech: Governance decision log: `docs/project/TECHNICAL_DESIGN.md` Appendix B2.9
- Tech: Governance endpoints: `docs/project/TECHNICAL_DESIGN.md` Appendix B3
- Tech: Governance invariants: `docs/project/TECHNICAL_DESIGN.md` Appendix A7

**Test Expectations**
- Decisions append to the audit trail and update candidate status consistently.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-17 — Govern critical (non-reversible) structural changes

**User Story**
As a reviewer, I want stricter handling for critical structural changes so that high-risk evolutions require deliberate review.

**Acceptance Criteria**
- Critical candidates are clearly distinguished from non-critical candidates.
- Critical candidates are not auto-promoted.
- Critical decisions are explicitly recorded and auditable.
- Critical governance is isolated from veterinarian workflows.

**Scope Clarification**
- No veterinarian friction is introduced.

**Authoritative References**
- Product: Critical concept policy: `docs/project/PRODUCT_DESIGN.md` Section 4
- Tech: Critical derivation rule: `docs/project/TECHNICAL_DESIGN.md` Appendix D7.4
- UX: Sensitive changes never add veterinarian friction: `docs/project/UX_DESIGN.md` Section 6

**Test Expectations**
- Critical designation affects reviewer prioritization only; it does not block veterinarian workflows.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-18 — Audit trail of schema governance decisions

**User Story**
As a reviewer, I want to see an audit trail of schema governance decisions so that structural evolution is transparent and traceable.

**Acceptance Criteria**
- I can see a chronological list of governance decisions.
- Each entry shows decision type, reviewer identity, and timestamp.
- The audit trail is read-only, immutable, and append-only.

**Scope Clarification**
- This story provides visibility only.

**Authoritative References**
- Tech: Governance decision log persistence: `docs/project/TECHNICAL_DESIGN.md` Appendix B2.9
- Tech: Audit trail endpoint: `docs/project/TECHNICAL_DESIGN.md` Appendix B3
- Tech: Audit immutability and separation: `docs/project/TECHNICAL_DESIGN.md` Appendix A8

**Test Expectations**
- Audit trail ordering is chronological and records are immutable.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-19 — Full DOCX support (post-MVP)

**User Story**
As a user, I want to upload, access, and process DOCX documents so that the same workflow supported for PDFs applies to Word documents.

**Acceptance Criteria**
- I can upload a supported DOCX document type.
- I can download the original DOCX at any time without blocking on processing.
- The system can process DOCX documents and expose the same processing visibility as PDFs.
- Review-in-context remains non-blocking and preserves traceability for DOCX inputs.

**Scope Clarification**
- This story expands file-type support beyond the PDF-only MVP scope.

**Authoritative References**
- Tech: Endpoint surface and error semantics: `docs/project/TECHNICAL_DESIGN.md` Appendix B3/B3.2
- Tech: Processing model and run invariants: `docs/project/TECHNICAL_DESIGN.md` Sections 3–4 + Appendix A2
- UX: Review flow guarantees: `docs/project/UX_DESIGN.md`

**Test Expectations**
- DOCX inputs behave like PDFs for upload/download/status visibility.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

---

## US-20 — Full Image support (post-MVP)

**User Story**
As a user, I want to upload, access, and process image documents so that scans and photographs can be handled in the same workflow.

**Acceptance Criteria**
- I can upload a supported image document type.
- I can download and preview the original image at any time without blocking on processing.
- The system can process image documents and expose the same processing visibility as PDFs.
- Review-in-context remains non-blocking and preserves traceability for image inputs.

**Scope Clarification**
- This story expands file-type support beyond the PDF-only MVP scope.

**Authoritative References**
- Tech: Endpoint surface and error semantics: `docs/project/TECHNICAL_DESIGN.md` Appendix B3/B3.2
- Tech: Processing model and run invariants: `docs/project/TECHNICAL_DESIGN.md` Sections 3–4 + Appendix A2
- UX: Review flow guarantees: `docs/project/UX_DESIGN.md`

**Test Expectations**
- Image inputs behave like PDFs for upload/download/status visibility.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

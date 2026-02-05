# Note for readers:
This document is intended to provide structured context to an AI Coding Assistant during implementation.

The version of this document written for evaluators and reviewers is available here:
https://docs.google.com/document/d/1b1rvBJu9bGjv8Z42OdDz9qwjecbqDbpilkn0KkYuD-M


# Implementation Plan — Incremental Document Processing MVP

## Purpose

This document defines the implementation plan for the Veterinary Medical Records Processing MVP.

It is the **primary source of truth for development sequencing, scope, and user story requirements** and must be followed by the AI Coding Assistant (Codex).

All architectural and system-level decisions referenced in this plan are defined in:

- `docs/TECHNICAL_DESIGN.md`

If any requirement in this plan conflicts with the technical design, **STOP and ask before implementing**.

---

## How to use this document

The AI Coding Assistant must implement user stories **strictly in the order and scope defined in this plan**.

- User-facing intent is expressed in the user story descriptions and acceptance criteria.
- Technical constraints and implementation rules are defined in `docs/TECHNICAL_DESIGN.md`.
- Story-specific technical requirements are defined in the **User Story Details** section of this document.
- Features or behaviors not explicitly listed here are considered **out of scope**.

If any story is unclear or appears underspecified, **STOP and ask before proceeding**.

---

## Release 1 — Document upload & access

### Goal

Allow users to upload documents and download them.

### Scope

- Upload PDF documents
- Persist original documents
- View document status
- Download / preview original documents

### User Stories

- **US-01 - Upload document**
- **US-02 - View document status**
- **US-03 - Download / preview original document**

---

## Release 2 — Document interpretation & visualization

### Goal

Extract information from uploaded documents and show it.

### Scope

- Automatic document processing after upload
- Explicit processing states and failure types
- Raw text extraction
- Detected language visibility
- Structured data visualization
- Confidence indicators per field
- Original document shown side-by-side with extracted data

### User Stories

- **US-05 - Process document**
- **US-06 - View extracted text**
- **US-07 - Review document in context**

---

## Release 3 — Document correction & closure

### Goal

Allow veterinarians to edit extracted information.

### Scope

- Edit structured data
- Create new structured fields
- Visual indicators for modified fields
- Reset all changes via document reprocessing
- Passive capture of confidence signals
- Explicit document review completion

### User Stories

- **US-08 - Edit structured data**
- **US-09 - Capture confidence signals**
- **US-12 - Mark document as reviewed**

---

## Out of scope (explicit)

The following user stories and capabilities are intentionally excluded from the MVP:

- **US-10 - Change document language and reprocess**
- **US-11 - Add review comments**

Additional non-goals:

- Operator review workflows
- Automatic layout evolution
- Confidence-driven automation
- Model retraining or fine-tuning
- Field-level undo functionality

These items are deliberately deferred to avoid over-engineering and reduce implementation risk.

---

## Implementation principles

- Favor clarity and explicitness over cleverness.
- Keep all intermediate artifacts explicit and inspectable.
- Use append-only persistence for extracted and structured data.
- Avoid global side effects derived from individual user actions.
- Never silently overwrite data.
- If a requirement or expected behavior is unclear, **STOP and ask before implementing**.

---

# User Story Details

This section defines the **complete, authoritative specification** for each user story in scope of the MVP.

---

## US-01 — Upload document

**User Story**  
As a user, I want to upload a PDF document so that it is stored and available for processing.

**Acceptance Criteria**
- I can upload a PDF document.
- I receive immediate confirmation that the document was uploaded.
- The document appears in the system with an initial status.
- The UI communicates that processing is assistive and may be incomplete, without blocking the user.
- The UI follows progressive disclosure: status is visible immediately, details are on demand.

**Technical Requirements**
- Accept only PDF files.
- Validate file size and content type.
- Persist document metadata in the database.
- Store the original file in filesystem storage.
- Initialize document state as `UPLOADED`.
- Record initial status in status history.
- The API response includes the document id and current status so the frontend can render state immediately.

---

## US-02 — View document status

**User Story**  
As a user, I want to see the current status of a document so that I understand its processing state.

**Acceptance Criteria**
- I can view the current status of a document at any time.
- I can see whether processing has succeeded or failed.
- Status is human-readable and explains whether the system is still processing, succeeded, or failed (and why).
- Pending review must never block veterinarians; it only affects global schema evolution.
- The UI does not expose reviewer workflows or governance concepts to veterinarians.

**Technical Requirements**
- Expose document status via API.
- Persist status transitions explicitly.
- Ensure status reflects the latest processing run.
- Expose failure type / category in the status response when processing fails (to keep uncertainty explainable).
- Ensure “pending_review” is not used as a blocking status for veterinary workflow.

---

## US-03 — Download / preview original document

**User Story**  
As a user, I want to download or preview the original uploaded document so that I can view it.

**Acceptance Criteria**
- I can download the original document.
- I receive a clear error if the document is unavailable.
- The original document can be previewed in the UI as part of side-by-side review (not only downloaded).
- Preview supports evidence-based navigation (page + snippet) without requiring precise PDF coordinates.

**Technical Requirements**
- Retrieve files from filesystem storage.
- Handle missing files gracefully.
- Expose download endpoint.
- Frontend renders PDFs using PDF.js (pdfjs-dist) to enable side-by-side review.
- No exact PDF coordinate overlays are implemented in the MVP.

---

## US-04 — List uploaded documents and their status

### User Story
As a veterinarian, I want to see a list of uploaded documents and their current status so that I can understand what has been processed and what still requires review.

### Acceptance Criteria
- I can see a list of all uploaded documents.
- For each document, I can see its filename, upload date, and current processing status.
- The status clearly reflects the document lifecycle (e.g. uploaded, processing, extracted, ready for review, failed).
- Failed documents are clearly distinguishable from successfully processed ones.
- **Statuses are informative and non-blocking; documents marked as requiring review do not prevent veterinarians from continuing their workflow.**
- **List-level statuses communicate system progress and confidence, not approval requirements or mandatory actions.**

### Technical Requirements
- Expose an API endpoint to list documents with metadata and current status.
- Persist document status consistently across processing steps.
- Ensure the list can be refreshed to reflect ongoing processing.
- Map internal processing states to user-friendly status labels.

---

## US-05 — Process document

**User Story**  
As a veterinarian, I want uploaded PDF documents to be processed automatically so that I can review how the system interprets them without changing my workflow.

**Acceptance Criteria**
- Document processing starts automatically after upload.
- I can see when a document is being processed.
- I can see whether processing succeeded or failed.
- If processing fails, I can see the type of failure (e.g. extraction vs interpretation).
- I can clearly tell which processing attempt produced the current interpretation.
- I can manually reprocess a document at any time.
- Processing visibility is non-blocking: veterinarians can always continue their workflow even if processing is incomplete or failed.
- Interpretation outputs are always assistive and must not be presented as correctness.


**Technical Requirements**
- Trigger processing automatically after upload.
- Transition document state through `PROCESSING` to a terminal state.
- Classify and persist failure types.
- Create a new processing run on each (re)processing attempt.
- Never overwrite artifacts from previous runs.
- Expose a reprocess endpoint.
- Persist processing runs as first-class entities, each with their own extracted artifacts and outcomes.
- Ensure downstream features (raw text, structured data, confidence) are always linked to a specific processing run.
- Expose enough processing context (latest run + failure type) for the frontend to explain what happened without additional screens.

---

## US-06 — View extracted text

**User Story**  
As a veterinarian, I want to view the raw text extracted from a document so that I understand what the system has read before any structured interpretation is applied.

**Acceptance Criteria**
- I can view the extracted raw text produced by the system during processing.
- I can see the detected language of the document alongside the extracted text.
- Raw text is hidden by default and shown on demand in no more than one interaction.
- The raw text is clearly presented as an intermediate technical artifact, not as the final structured output.
- I understand that this raw text may contain noise, repetitions, or formatting issues, and is intended for transparency and traceability.
- Evidence must be accessible in ≤ 1 interaction from the review context (progressive disclosure, not a separate workflow).
- The UI frames extracted text as assistive context to calibrate confidence, not as ground truth.

**Technical Requirements**
- Persist extracted raw text as a first-class artifact.
- Detect and persist document language.
- Expose an API endpoint to retrieve extraction artifacts.
- Ensure extracted text is linked to a specific processing run.
- Allow the frontend to toggle visibility of raw text without reprocessing the document.
- Frontend uses TanStack Query to manage loading/error states for extracted text (no custom client caching logic).

---

## US-07 — Review document in context

**User Story**  
As a veterinarian, I want to review the system’s interpretation of a document while viewing the original document at the same time so that I can verify it.

**Acceptance Criteria**
- I can see structured extracted data.
- I can see the original document side-by-side.
- I can clearly identify the confidence of each field.
- Low-confidence fields are visually distinguishable.
- When I select a field, I can see where it comes from in the original document.
- I can optionally view the raw extracted text.
- The frontend’s primary job is to help veterinarians understand and trust (or question) the system’s interpretation, not to manage data records
- Confidence is visible, non-blocking, and explainable (confidence guides attention, not decisions).
- Evidence is accessible in ≤ 1 interaction from a field (snippet visible and page navigation immediate).
- Highlighting inside the PDF is progressive enhancement: review remains usable if highlighting fails.
- Pending review must never block veterinarians; it only affects global schema evolution.
- Must NOT be implemented: blocking approvals, exact PDF coordinates, automatic schema promotion.


**Technical Requirements**
- Generate structured interpretations with per-field confidence.
- Persist structured data as versioned records.
- Persist approximate source mappings per field.
- Allow source highlighting to be approximate and non-blocking.
- Aggregate interpretation data into a single review API response.
- Backend provides evidence as page number + snippet per field (not bounding boxes).
- Frontend renders PDF with PDF.js; selecting a field navigates to the page and shows the snippet as explicit evidence.
- Frontend attempts best-effort snippet highlighting using the PDF.js text layer; if it fails, it shows no highlight and does not fake precision.
- Confidence is rendered as a visual attention signal (qualitative first, numeric optional), and never disables actions or triggers confirmation flows.
- Frontend uses TanStack Query (useQuery / useMutation) and invalidation for status/interpretation/edits/review completion.

---

## US-08 — Edit structured data

**User Story**  
As a veterinarian, I want to edit the structured information extracted from a document so that it accurately reflects the original document.

**Acceptance Criteria**
- I can edit existing fields.
- I can create new fields.
- I can see which fields I have modified.
- I can reset all my changes by reprocessing the document.
- Edits are immediate and local to the current document; no extra steps exist “to help the system”.
- Confidence never blocks editing.
- Pending review states are not exposed to veterinarians and do not add warnings or responsibilities.
- Must NOT be implemented as part of the veterinarian edit experience: blocking approvals or any reviewer-facing UI.

**Technical Requirements**
- Accept structured data edits via API.
- Create a new structured record version for each edit.
- Persist a field-level change log.
- Mark structural changes as `pending_review`.
- Never mutate existing structured records.
- pending_review only affects global schema evolution; it must not change or block the veterinarian workflow in the MVP.
- Frontend clearly distinguishes machine-extracted values from veterinarian-edited values (scan-friendly visual indicator).

---

## US-09 — Capture confidence signals

**User Story**  
As a veterinarian, I want the system to learn from my normal corrections without asking me for feedback.

**Acceptance Criteria**
- My corrections do not require extra steps.
- My corrections do not change system behavior immediately.
- The system becomes more confident only through repeated evidence.
- The UI does not ask for explicit feedback, confirmations, or labels to drive learning.
- Learning is invisible during normal work and never changes the veterinarian flow.

**Technical Requirements**
- Record learning signals for each correction.
- Associate signals with context and field identity.
- Adjust confidence conservatively and locally.
- Do not trigger global behavior changes in the MVP.
- Do not implement confidence-driven automation or any action gating based on confidence.

---

## US-10 — Change document language and reprocess

### User Story
As a veterinarian, I want to change the detected language of a document so that it can be reprocessed correctly if the automatic detection was wrong.

### Acceptance Criteria
- I can see the language automatically detected for a document.
- I can manually select a different language.
- I can trigger reprocessing of the document after changing the language.
- The system clearly indicates that the document has been reprocessed using the new language.
- **Changing the language is an explicit context override and does not block review or editing.**
- **Previous interpretations remain visible for traceability and confidence comparison.**

### Technical Requirements
- Persist detected language as part of document metadata.
- Allow manual override of the detected language.
- Trigger reprocessing using the selected language.
- Version document interpretations so previous results remain traceable.

---

## US-11 — View document processing history

### User Story
As a veterinarian, I want to see the processing history of a document so that I can understand which steps were executed and whether any failures occurred.

### Acceptance Criteria
- I can see a chronological list of processing steps for a document.
- Each step shows its status (success or failure) and timestamp.
- Failures are clearly identified and explained in non-technical terms.
- The processing history is read-only.
- **Processing history is explanatory and non-blocking; it does not introduce actions, approvals, or workflow decisions.**
- **History helps understand system behavior and limitations, not to drive clinical decisions.**

### Technical Requirements
- Persist processing events as an append-only history.
- Expose an API endpoint to retrieve processing history.
- Translate technical failures into user-friendly explanations.
- Ensure historical records cannot be modified.

---

## US-12 — Mark document as reviewed

**User Story**  
As a veterinarian, I want to mark a document as reviewed once I have finished checking it.

**Acceptance Criteria**
- I can explicitly mark a document as reviewed.
- Reviewed documents are clearly identifiable.
- Editing a reviewed document reopens it for review.
- Marking as reviewed is the single explicit “done” action and refers only to closing work on the current document (no learning/governance implications).
- This action must never be blocked by pending review or any global schema evolution state.

**Technical Requirements**
- Persist review status separately from processing state.
- Expose mark-reviewed endpoint.
- Ensure review status remains consistent with edits.
- Frontend uses a single primary action for completion and keeps the rest of the flow non-blocking.

---

## US-13 — Review aggregated pending structural changes

### User Story
As a reviewer, I want to review aggregated pending structural changes so that I can validate or reject schema-level evolution based on recurring patterns.

### Acceptance Criteria
- I can see pending structural changes grouped by pattern, not by individual documents.
- For each pending change, I can see:
  - the affected field
  - the proposed mapping or new field
  - confidence evolution
  - representative evidence snippets
- Reviewing pending changes never blocks veterinarians or document processing.
- **This review flow is strictly reviewer-facing and is never exposed in veterinarian-facing UIs.**
- **Reviewer actions affect schema evolution only and do not alter document-level workflows.**

### Technical Requirements
- Aggregate document-level corrections into structural change candidates.
- Persist pending structural changes separately from document revisions.
- Expose aggregated pending changes via a reviewer-facing API.
- Ensure reviewer actions do not affect document-level workflows.

---

## US-14 — Filter and prioritize pending structural changes

### User Story
As a reviewer, I want to filter and prioritize pending structural changes so that I can focus on the most relevant and stable patterns.

### Acceptance Criteria
- I can filter pending changes by confidence range.
- I can sort pending changes by frequency or stability over time.
- Low-signal and high-signal changes are clearly distinguishable.
- **Filtering and prioritization affect reviewer focus only and do not change system behavior or schema application.**

### Technical Requirements
- Compute and persist confidence metrics for each pending change.
- Support filtering and sorting parameters in the reviewer API.
- Keep confidence thresholds configurable.
- Ensure prioritization affects only visibility, not system behavior.

---

## US-15 — Approve structural changes into the global schema

### User Story
As a reviewer, I want to approve a structural change so that future documents are interpreted using the updated global schema.

### Acceptance Criteria
- I can explicitly approve a pending structural change.
- Approved changes apply only to newly processed documents.
- Past documents remain unchanged.
- Approval actions are fully traceable.
- **Approval does not trigger reprocessing of existing documents unless explicitly requested.**
- **Approval never blocks veterinarian workflows.**

### Technical Requirements
- Promote approved changes into the canonical schema.
- Version the schema upon each approval.
- Persist reviewer identity and timestamp.
- Apply schema updates prospectively only.

---
## US-16 — Reject or defer structural changes

### User Story
As a reviewer, I want to reject or defer a structural change so that unstable or incorrect patterns do not affect the global schema.

### Acceptance Criteria
- I can reject a pending change with an optional explanation.
- I can defer a change without making a final decision.
- Rejected changes stop accumulating confidence.
- Rejecting or deferring a change never blocks veterinarians.
- **Rejecting or deferring changes affects only schema evolution, not document interpretations already delivered.**

### Technical Requirements
- Support explicit states for pending changes (pending, approved, rejected).
- Persist rejection reasons and timestamps.
- Exclude rejected changes from future confidence aggregation.
- Keep deferred changes visible and reviewable.

---

## US-17 — Govern critical (non-reversible) structural changes

### User Story
As a reviewer, I want to identify and govern critical structural changes so that high-impact concepts are handled with extra care.

### Acceptance Criteria
- The system flags changes involving critical concepts.
- Critical changes are never auto-promoted, regardless of confidence.
- I can see why a change is classified as critical.
- Criticality does not block document-level edits by veterinarians.
- **Critical governance decisions are isolated from veterinarian-facing workflows and never introduce blocking behavior.**

### Technical Requirements
- Define and persist criticality metadata for structural changes.
- Associate criticality information with pending changes.
- Prevent automatic promotion of critical changes.
- Ensure all critical decisions are auditable.

---

## US-18 — Audit trail of schema governance decisions

### User Story
As a reviewer, I want to see an audit trail of schema governance decisions so that all structural evolution is transparent and traceable.

### Acceptance Criteria
- I can see a chronological list of schema governance decisions.
- Each entry shows the decision taken, the reviewer, and the timestamp.
- The audit trail is read-only and append-only.

### Technical Requirements
- Persist all governance decisions in an append-only log.
- Expose a read-only API to retrieve governance history.
- Prevent modification or deletion of audit records.
- Keep governance data separate from document-level data.

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
- `docs/FRONTEND_IMPLEMENTATION.md` 
- `docs/UX_GUIDELINES.md` 

If any requirement in this plan conflicts with the technical design, **STOP and ask before implementing**.

---

## How to use this document

The AI Coding Assistant must implement user stories **strictly in the order and scope defined in this plan**.

- User-facing intent is expressed in the user story descriptions and acceptance criteria.
- Technical constraints and implementation rules are defined in `docs/TECHNICAL_DESIGN.md`, `docs/FRONTEND_IMPLEMENTATION.md` and `docs/UX_GUIDELINES.md`.
- Story-specific technical requirements are defined in the **User Story Details** section of this document.
- Features or behaviors not explicitly listed here are considered **out of scope**.

If any story is unclear or appears underspecified, **STOP and ask before proceeding**.

## API Error Response Format (Normative)

All API errors MUST return a JSON body with a stable, machine-readable structure:

```json
{
  "error_code": "STRING_ENUM",
  "message": "Human-readable explanation",
  "details": { "optional": "object" }
}
```

Rules:
- `error_code` is stable and suitable for frontend branching.
- `message` is safe for user display (no stack traces).
- `details` is optional and must not expose filesystem paths or secrets.

---

## Release 1 — Document upload & access

### Goal

Allow users to upload documents and access them reliably, establishing a stable and observable foundation.

### Release deliverables (Normative)
Each release includes both backend and frontend deliverables (when a story defines UI/UX requirements).

### Scope

- Upload PDF documents
- Persist original documents
- Initialize and expose document status
- Download and preview original documents
- List uploaded documents with their status

### User Stories

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

### User Stories

- US-05 — Process document  
- US-11 — View document processing history  

---

## Release 3 — Extraction transparency (trust & debuggability)

### Goal

Make visible and explainable **what the system has read**, before any interpretation is applied, to build trust and enable debugging.

This release is explicitly about **observability, transparency, and confidence calibration**, not productivity.

### Scope

- Raw text extraction
- Language detection
- Persistent extraction artifacts
- On-demand visibility via progressive disclosure

### User Stories

- US-06 — View extracted text  

---

## Release 4 — Assisted review in context (high value / higher risk)

### Goal

Enable veterinarians to review the system’s interpretation **in context**, side-by-side with the original document, supported by confidence and evidence.

This is a **high-value but higher-risk release**, due to UI complexity and interaction design.

### Scope

- Structured extracted data
- Per-field confidence signals
- Evidence via page + snippet (no exact coordinates)
- Side-by-side document review
- Progressive enhancement (review usable even if highlighting fails)
- Non-blocking, explainable UX

### User Stories

- US-07 — Review document in context  

---

## Release 5 — Editing & learning signals (human corrections)

### Goal

Allow veterinarians to correct structured data naturally, while implicitly capturing learning signals—without changing their workflow.

### Scope

- Edit existing structured fields
- Create new structured fields
- Versioned structured records
- Field-level change logs
- Capture implicit confidence signals
- Clear separation between document edits and schema governance

### User Stories

- US-08 — Edit structured data  
- US-09 — Capture confidence signals  

---

## Release 6 — Explicit overrides & workflow closure

### Goal

Give veterinarians explicit control over processing context and a clear way to close work on a document.

This release groups **explicit human overrides** (language) with **workflow completion** (reviewed).

### Scope

- Manual language override
- Reprocessing with new language context
- Explicit “reviewed” status
- Automatic reopening on edits

### User Stories

- US-10 — Change document language and reprocess  
- US-12 — Mark document as reviewed  

---

## Release 7 — Schema evolution (isolated reviewer workflows)

### Goal

Introduce explicit, reviewer-facing governance for global schema evolution, fully isolated from veterinary workflows.

Governance latency **never blocks or retroactively alters** veterinary work or document interpretations.

### Scope

- Aggregation of pending structural changes
- Reviewer-facing inspection
- Filtering and prioritization
- Approval, rejection, or deferral
- Schema versioning
- Audit trail of governance decisions

### User Stories

- US-13 — Review aggregated pending structural changes  
- US-14 — Filter and prioritize pending structural changes  
- US-15 — Approve structural changes into the global schema  
- US-16 — Reject or defer structural changes  
- US-17 — Govern critical structural changes  
- US-18 — Audit trail of schema governance decisions  

---

## Implementation principles

- Favor clarity and explicitness over cleverness.
- Keep all intermediate artifacts explicit and inspectable.
- Use append-only persistence for extracted and structured data.
- Avoid global side effects derived from individual user actions.
- Never silently overwrite data.
- If a requirement or expected behavior is unclear, **STOP and ask before implementing**.

---

## API Naming Authority (Normative)

The authoritative endpoint map is defined in `docs/TECHNICAL_DESIGN.md` Appendix B3 (+ B3.1).

If any user story lists different endpoint paths, treat them as non-normative examples and implement the authoritative map.

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

## Scope Clarification 
- This story **does not** start processing.
- This story **only** handles upload, persistence, and initial state.
- Any background processing is triggered by later stories.
- Note: automatic post-upload processing is introduced in **Release 2 (US-05)**, not in Release 1.
- When **US-05 is implemented**, `POST /documents` MUST enqueue or create a ProcessingRun asynchronously (non-blocking).

---

## API (Contract Checklist)

### Endpoint
- `POST /documents`

### Request
- `multipart/form-data`
  - `file` (required): PDF file

### Validation
- Reject non-PDF files (`Content-Type`, extension).
- Enforce maximum file size (configurable constant).
- Reject empty uploads (0 bytes).
- Deep PDF validity (e.g., unreadable/corrupted structure) is NOT enforced at upload time in Release 1; it is handled during extraction (US-05).
 

### Response (success)
- HTTP `201 Created`
- Body includes:
  - `document_id`
  - `status` = `UPLOADED`
  - `created_at`

### Response (failure)
- `400 Bad Request`: invalid file type or empty upload
- `413 Payload Too Large`: file exceeds max size
- `500 Internal Server Error`: unexpected storage/database failure

Error body MUST follow **API Error Response Format (Normative)**.
---

## Database (Persistence Checklist)

### Tables / Entities
**Document**
- `id` (UUID, PK)
- `original_filename`
- `content_type`
- `file_size`
- `storage_path`
- `created_at`
- `updated_at`
- `review_status` (`IN_REVIEW | REVIEWED`)  # optional here, or introduced in US-12

**DocumentStatusHistory**
- `id` (UUID, PK)
- `document_id` (FK)
- `status` (`UPLOADED | PROCESSING | COMPLETED | FAILED | TIMED_OUT`)
- `run_id` (nullable; FK to ProcessingRun if status is derived from a run)
- `created_at`

**Rule**
- `Document.status` is **derived** (Appendix A). It is never persisted as a source of truth.

Note:
- `DocumentStatusHistory` is retained for auditability; derived status uses the latest run (or `UPLOADED` if no runs exist).

### Invariants
- A document must exist before any processing run.
- A document has status `UPLOADED` if no processing run exists.

### Status History Rule (Normative)
- For any ProcessingRun state transition that changes the derived Document status,
  the system MUST append one `DocumentStatusHistory` entry referencing that `run_id`.

---

## Filesystem Storage Checklist

- Store the original PDF in filesystem storage.
- Storage path must be deterministic and unique (e.g. by `document_id`).
- The filesystem write must complete **before** returning success.
- No processing or transformation of the file is done at this stage.

---

## State & Processing Model

- Initial document state: `UPLOADED`
- No processing run is created in this story.
- Status history records the `UPLOADED` state as the first entry.

---

## UI / UX Checklist

- After upload:
  - Show document immediately in list/detail view.
  - Display status: `UPLOADED`.
- Include a clear message:
  - “This document will be processed automatically. Results may be incomplete and require review.”
- Do not block the user or require waiting for processing.
- Hide processing details unless explicitly requested (progressive disclosure).

---

## Observability Checklist (MVP)

- Emit structured log on upload success:
  - `document_id`
  - `event_type = DOCUMENT_UPLOADED`
  - `timestamp`
- Emit structured log on upload failure with:
  - `error_code`
  - `failure_reason`
- Logging must be best-effort and never block the request.

---

## Tests Checklist

### Unit Tests
- File validation (PDF only).
- File size validation.
- Metadata persistence logic.

### Integration Tests
- Successful upload returns `201` and persists data.
- Invalid file type is rejected.
- File is present in filesystem after upload.
- Status history contains exactly one entry with `UPLOADED`.

---

## Definition of Done (DoD)

- [ ] API endpoint implemented and documented
- [ ] PDF-only validation enforced
- [ ] File stored in filesystem
- [ ] Document metadata persisted in DB
- [ ] Initial status set to `UPLOADED`
- [ ] Status history entry created
- [ ] API returns `document_id` and `status`
- [ ] Structured logs emitted
- [ ] Unit and integration tests passing
- [ ] UI can render document immediately after upload

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

## Scope Clarification
- This story **does not** start or control processing.
- This story **does not** expose processing internals beyond status and failure category.
- This story **does not** expose run history or per-step details (future concern).
- This story focuses on **current, derived document status**.

---

## Status Model (Conceptual)

### Document-level Status (derived)
The document exposes a single **current status**, derived from its processing runs:

- `UPLOADED`
- `PROCESSING`
- `COMPLETED`
- `FAILED`
- `TIMED_OUT`

The document status always reflects the **latest known state** of the system.

---

### Failure Categories (high-level)
When status is `FAILED` or `TIMED_OUT`, a failure category is exposed:

- `EXTRACTION_FAILED`
- `INTERPRETATION_FAILED`
- `UNKNOWN_ERROR`

These categories are **explanatory**, not technical diagnostics.

Note:
- Upload failures are returned as request errors from `POST /documents` and do not create a ProcessingRun.

---

## API (Contract Checklist)

### Endpoint
- `GET /documents/{document_id}`

### Response (success)
- HTTP `200 OK`
- Body includes:
  - `document_id`
  - `status`
  - `status_message` (human-readable)
  - `failure_type` (nullable)
  - `latest_run` (nullable)
    - `run_id`
    - `state` (`QUEUED | RUNNING | COMPLETED | FAILED | TIMED_OUT`)
    - `failure_type` (nullable)
  - `updated_at`

### Response (failure)
- `404 Not Found`: document does not exist
- `500 Internal Server Error`: unexpected system failure

Error body MUST follow **API Error Response Format (Normative)**
---

## Database (Persistence Checklist)

### Source of Truth
- Document status is **derived**, not manually set.
- The system determines status based on:
  - latest processing run state,
  - upload state if no runs exist.

### Tables / Entities
Uses:
- `Document`
- `DocumentStatusHistory`
- `ProcessingRun` (read-only dependency)

No new tables are introduced by this story.

---

## State Derivation Rules

- If no processing run exists:
  - status = `UPLOADED`
- If a run is `QUEUED` or `RUNNING`:
  - status = `PROCESSING`
- If the latest run is `COMPLETED`:
  - status = `COMPLETED`
- If the latest run is `FAILED`:
  - status = `FAILED`
- If the latest run is `TIMED_OUT`:
  - status = `TIMED_OUT`

The document status must always be **deterministic**.

### Implementation Rule (Normative)
- Status derivation MUST be implemented in a single, shared domain service used by:
  - `GET /documents/{id}`
  - `GET /documents` (list)
---

## UI / UX Checklist

- Status is visible wherever the document is listed or viewed.
- Status is displayed using human-readable language (not enums).
- Failure states include a short explanation (category-level, not stack traces).
- No reviewer, governance, or schema evolution concepts are visible.
- `pending_review` never blocks interaction or editing.

---

## Observability Checklist (MVP)

- Emit structured log when document status is queried:
  - `document_id`
  - `event_type = DOCUMENT_METADATA_VIEWED`
   - `timestamp`
- Emit structured log when a status transition occurs (triggered elsewhere):
  - `document_id`
  - `previous_status`
  - `new_status`

Logs are best-effort and must not block requests.

---

## Tests Checklist

### Unit Tests
- Status derivation logic for all run states.
- Failure category mapping.

### Integration Tests
- `GET /documents/{id}` returns correct status after:
  - upload only,
  - processing started,
  - processing completed,
  - processing failed.
- Failure type is present only for failed states.
- `pending_review` never affects returned status.

---

## Definition of Done (DoD)

- [ ] Status derivation logic implemented and documented
- [ ] API endpoint returns correct current status
- [ ] Human-readable status messages provided
- [ ] Failure category exposed when applicable
- [ ] No reviewer/governance concepts exposed to veterinarians
- [ ] Structured logs emitted on status view
- [ ] Unit and integration tests passing
- [ ] UI can render and explain document status consistently

---

## US-03 — Download / preview original document

**User Story**  
As a user, I want to download or preview the original uploaded document so that I can view it.

**Acceptance Criteria**
- I can download the original document.
- I receive a clear error if the document is unavailable.
- The original document can be previewed in the UI as part of side-by-side review (not only downloaded).
- Preview supports page navigation via PDF.js.
- Evidence-based navigation (page + snippet) is implemented in **US-07** (review context).

**Technical Requirements**
- Retrieve files from filesystem storage.
- Handle missing files gracefully.
- Expose download endpoint.
- Frontend renders PDFs using PDF.js (pdfjs-dist) to enable side-by-side review.
- No exact PDF coordinate overlays are implemented in the MVP.


## Scope Clarification
- This story only handles **original document access**.
- This story does **not**:
  - modify documents,
  - regenerate artifacts,
  - depend on processing completion.
- Preview accuracy is **best-effort**.
- Evidence navigation is approximate and must never block review.

---

## API (Contract Checklist)

### Download Endpoint
- `GET /documents/{document_id}/original`

### Response (success)
- HTTP `200 OK`
- Response body: binary PDF stream
- Headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline` (for preview) or `attachment` (for download)

### Response (failure)
- `404 Not Found`: document metadata does not exist
- `410 Gone`: document exists but original file is missing
- `500 Internal Server Error`: unexpected filesystem or I/O failure

Error body MUST follow **API Error Response Format (Normative)**.

---

## Filesystem Access Rules

- Original PDFs are retrieved from filesystem storage using `storage_path`.
- File access must be read-only.
- Missing or unreadable files must be handled gracefully:
  - no unhandled exceptions,
  - clear error response.
- The filesystem path must never be exposed to the client.

---

## UI / UX Checklist

### Preview
- The UI renders PDFs using **PDF.js (`pdfjs-dist`)**.
- Preview is embedded in the application (no forced download).
- Preview can be shown side-by-side with structured data.

### Evidence-Based Navigation
- The UI can navigate to:
  - a specific page number,
  - and optionally highlight a text snippet.
- Navigation is **approximate**:
  - no bounding boxes,
  - no exact coordinate overlays.
- If highlighting fails, the document must still be viewable.

---

## State & Processing Independence

- Document preview and download:
  - are allowed regardless of processing state,
  - do not depend on processing completion.
- `UPLOADED`, `PROCESSING`, `FAILED`, or `COMPLETED` documents can all be previewed if the file exists.

---

## Observability Checklist (MVP)

- Emit structured log on access:
  - `document_id`
  - `event_type = DOCUMENT_ORIGINAL_ACCESSED`
  - `access_type = preview | download`
  - `timestamp`
- Emit structured log on access failure:
  - `document_id`
  - `event_type = DOCUMENT_ORIGINAL_ACCESS_FAILED`
  - `failure_reason`

Logs must be best-effort and must not block access.

---

## Tests Checklist

### Unit Tests
- Filesystem retrieval logic.
- Missing file handling.
- Error mapping (`404` vs `410`).

### Integration Tests
- Download endpoint returns PDF for valid document.
- Missing file returns correct error.
- Access works independently of processing state.
- Correct headers are set for preview vs download.

---

## Definition of Done (DoD)

- [ ] Download endpoint implemented
- [ ] Original file retrieved from filesystem
- [ ] Missing files handled gracefully
- [ ] Preview supports page navigation via PDF.js (no evidence navigation in this story).
- [ ] Evidence-based navigation supported (page + snippet)
- [ ] Preview works without processing completion
- [ ] Structured logs emitted for access and failure
- [ ] Unit and integration tests passing
- [ ] UI can render original document side-by-side with structured data

---

## US-04 — List uploaded documents and their status

### User Story
As a veterinarian, I want to see a list of uploaded documents and their current status so that I can understand what has been processed and what still requires review.

### Acceptance Criteria
- I can see a list of all uploaded documents.
- For each document, I can see its filename, upload date, and current processing status.
- The status clearly reflects the document lifecycle (e.g. uploaded, processing, ready for review, failed).
- Failed documents are clearly distinguishable from successfully processed ones.
- **Statuses are informative and non-blocking; documents marked as requiring review do not prevent veterinarians from continuing their workflow.**
- **List-level statuses communicate system progress and confidence, not approval requirements or mandatory actions.**

### Technical Requirements
- Expose an API endpoint to list documents with metadata and current status.
- Persist document status consistently across processing steps.
- Ensure the list can be refreshed to reflect ongoing processing.
- Map internal processing states to user-friendly status labels.

## Scope Clarification
- This story provides a **read-only list view** of documents and their derived status.
- This story does **not**:
  - introduce reviewer/gating workflows,
  - expose governance concepts,
  - require processing to be complete.
- This story does not add new processing behavior; it consumes status from existing state.

---

## API (Contract Checklist)

### Endpoint
- `GET /documents`

### Query Parameters (optional)
- `limit` (default: reasonable server-side default)
- `offset` (or `cursor`) for pagination
- `status` filter (optional, future-safe but not required)

### Response (success)
- HTTP `200 OK`
- Body includes:
  - `items`: array of documents
    - `document_id`
    - `original_filename`
    - `created_at` (upload date)
    - `status` (derived)
    - `status_label` (human-readable)
    - `failure_type` (nullable)
  - pagination metadata (always returned):
    - `limit`
    - `offset`
    - `total`

### Response (failure)
- `500 Internal Server Error`: unexpected system failure

Error body MUST follow **API Error Response Format (Normative)**.

---

## Status Model & Mapping

### Internal (system) status (derived)
The API uses the derived document status:
- `UPLOADED`
- `PROCESSING`
- `COMPLETED`
- `FAILED`
- `TIMED_OUT`

### User-friendly labels (UI-facing)
Map internal status to non-blocking labels:

- `UPLOADED`   → "Uploaded"
- `PROCESSING` → "Processing"
- `COMPLETED`  → "Ready for review"
- `FAILED`     → "Failed"
- `TIMED_OUT`  → "Processing timed out"

Note:
- "Ready for review" refers to **processing completion** (`COMPLETED`) and is independent from human `review_status`
  (`IN_REVIEW | REVIEWED`, introduced in US-12).
- This list view does not introduce a separate "Extracted" status in the MVP. Extraction visibility is handled in US-06.
 


### Failure display rule
If `status` is `FAILED` or `TIMED_OUT`, expose:
- `failure_type` (high-level category) and a short `status_label`

No governance concepts (e.g., "approval", "operator review") are exposed.

---

## Database (Read Model Checklist)

- The list view reads from `Document` and derived status rules.
- Status must remain consistent with:
  - latest processing run state (if any)
  - `UPLOADED` if no run exists
- The list must be stable and deterministic under refresh:
  - no randomness
  - no race-condition-driven label changes outside run transitions

No new tables are required for this story.

---

## UI / UX Checklist

- Provide a list/table view with:
  - filename
  - upload date/time
  - status badge/label
- Visually distinguish:
  - Failed / timed out documents (clear affordance)
  - Processing documents (in-progress state)
- Ensure “Ready for review” is presented as:
  - informational (not blocking)
  - a natural next step, not a requirement
- Allow manual refresh (or periodic refresh if desired) to reflect processing progress.

---

## Observability Checklist (MVP)

- Emit structured log on list retrieval:
  - `event_type = DOCUMENT_LIST_VIEWED`
  - `timestamp`
  - `count_returned`
- Emit structured log on error:
  - `event_type = DOCUMENT_LIST_VIEW_FAILED`
  - `failure_reason`

Logs must be best-effort and must not block requests.

---

## Tests Checklist

### Unit Tests
- Status mapping rules (`internal_status` → `status_label`)
- Sorting/pagination behavior (if implemented)

### Integration Tests
- `GET /documents` returns uploaded documents with correct metadata.
- Documents with no runs return status `UPLOADED`.
- Documents with active run return status `PROCESSING`.
- Failed documents return status `FAILED` and include `failure_type`.
- The list remains accessible regardless of processing state.

---

## Definition of Done (DoD)

- [ ] List endpoint implemented and documented
- [ ] Returns filename, upload date, status, and failure_type (when applicable)
- [ ] Internal status mapped to user-friendly, non-blocking labels
- [ ] Failed and timed out documents are clearly distinguishable in UI
- [ ] Refresh reflects ongoing processing states
- [ ] Structured logs emitted for list view and failures
- [ ] Unit and integration tests passing
- [ ] UI renders a stable list with correct status labels

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

## Scope Clarification
- This story introduces **automatic background processing**.
- This story does **not**:
  - introduce concurrent processing runs,
  - introduce approval or reviewer gating,
  - implement learning or automation based on confidence.
- This story establishes the **processing backbone** used by later features.

---

## Processing Model

### Automatic Trigger
- A processing run is automatically created after a document is uploaded.
- Processing executes **asynchronously** in the background.
- API requests must never block on processing.

### Activation Note (Normative)
- In Release 1, `POST /documents` does NOT create runs.
- Starting in Release 2 (US-05), `POST /documents` MUST create/enqueue a ProcessingRun non-blockingly.
 
---

### Processing Runs

- Each processing attempt creates a **new processing run**.
- Processing runs are:
  - immutable
  - append-only
  - first-class entities
- A document may have many historical runs.

#### Active Run Rule
- Only **one processing run may be active** per document.
- If reprocessing is requested while a run is active:
  - a new run is created in `QUEUED`,
  - it starts after the active run completes or times out.
- Active runs are **never cancelled**.

---

### Processing Run States
- `QUEUED`
- `RUNNING`
- `COMPLETED`
- `FAILED`
- `TIMED_OUT`

---

## Failure Classification

When a run fails, a **single high-level failure type** must be recorded:

- `EXTRACTION_FAILED`
- `INTERPRETATION_FAILED`
- `UNKNOWN_ERROR`

Failure types are:
- explanatory,
- stable,
- suitable for UI display,
- not technical diagnostics.

---

## State Transitions

- `PROCESSING` → `COMPLETED`
- `PROCESSING` → `FAILED`
- `PROCESSING` → `TIMED_OUT`

The document’s derived status must always reflect the **latest known run state**.

---

## Reprocessing Rules

- Reprocessing is **manual only**.
- Triggered via explicit user action.
- Reprocessing:
  - creates a new processing run,
  - never overwrites previous runs or artifacts.
- Retries inside a run (e.g. transient extraction retry) are allowed,
  but must not create a new run.

---

## Data Persistence Rules

### ProcessingRun Entity
Each run persists:
- `run_id`
- `document_id`
- `state` (`QUEUED | RUNNING | COMPLETED | FAILED | TIMED_OUT`)
- `failure_type` (nullable)
- `started_at` (nullable)
- `completed_at` (nullable)
- `created_at`


---

### Artifact Isolation
- All downstream artifacts are **linked to a specific run**:
  - raw extracted text
  - structured interpretations
  - confidence values
- Artifacts from previous runs are never overwritten or deleted.

---

## API (Contract Checklist)

### Trigger Processing (automatic)
- Implicitly triggered after upload (no direct API call).

---

### Reprocess Endpoint
- `POST /documents/{document_id}/reprocess`

#### Response (success)
- HTTP `202 Accepted`
- Body includes:
  - `document_id`
  - `run_id`
  - `state = QUEUED | RUNNING`

#### Response (failure)
- `404 Not Found`: document does not exist
- `409 Conflict`: reprocess request rejected due to invalid state (optional)
- `500 Internal Server Error`: unexpected failure

Error body MUST follow **API Error Response Format (Normative)**.

---

## Frontend Context Requirements

The API must expose enough context for the UI to explain processing without extra screens:

- current document status
- latest processing run:
  - `run_id`
  - `status`
  - `failure_type` (if any)

The UI must be able to answer:
> “What is happening?”  
> “Did it fail? Why?”  
> “Is this the latest attempt?”

---

## Observability Checklist (MVP)

- Emit structured logs for:
  - run creation
  - run start
  - run completion
  - run failure
- Each log entry includes:
  - `document_id`
  - `run_id`
  - `event_type`
  - `timestamp`
- Logs must be best-effort and must not block processing.

---

## Tests Checklist

### Unit Tests
- Processing run state transitions.
- Failure type classification.
- Run queuing logic (single active run rule).

### Integration Tests
- Automatic run creation after upload.
- Processing transitions reflected in document status.
- Failed runs expose correct failure type.
- Reprocessing creates a new run without overwriting previous artifacts.
- Only one run is active at any time.

---

## Definition of Done (DoD)

- [ ] Automatic processing triggered after upload
- [ ] Processing runs persisted as first-class entities
- [ ] Single active run invariant enforced
- [ ] Failure types classified and exposed
- [ ] Reprocess endpoint implemented
- [ ] Artifacts always linked to a specific run
- [ ] Document status reflects latest run state
- [ ] Processing is fully non-blocking for veterinarians
- [ ] Structured logs emitted for all run lifecycle events
- [ ] Unit and integration tests passing

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

## Scope Clarification
- This story exposes **read-only** access to extracted text artifacts.
- This story does **not**:
  - trigger reprocessing,
  - change extraction behavior,
  - implement coordinate-accurate evidence overlays.
- If extraction is not available yet, the UI must show a clear non-blocking state.

---

## Data Model (Artifacts)

### Artifact: ExtractedText
Extracted text is a first-class, versioned artifact **per processing run**.

Minimum fields (conceptual):
- `document_id`
- `run_id`
- `text_path` (filesystem path) OR `text_content` (if stored in DB)
- `language_code` (e.g., `en`, `es`)
- `language_confidence` (optional, if available)
- `created_at`

**Storage rule**
- Because extracted text can be large, prefer filesystem storage for raw text and store a reference in DB.
- Never overwrite extracted text for a run (append-only).

---

## Processing Dependencies
- Extracted text is produced by the extraction step of **US-05** processing.
- If the latest run is:
  - `RUNNING` / `QUEUED`: extracted text may not exist yet
  - `FAILED` with `EXTRACTION_FAILED`: extracted text does not exist
  - `COMPLETED`: extracted text should exist

---

## API (Contract Checklist)

### Endpoint
- `GET /documents/{document_id}/runs/{run_id}/extracted-text`

> Note: the UI should default to the **latest run** returned by `GET /documents/{document_id}`.
> This endpoint is explicitly run-scoped to preserve traceability.

### Response (success)
- HTTP `200 OK`
- Body includes:
  - `document_id`
  - `run_id`
  - `language_code`
  - `text` (raw extracted text)
  - `created_at`

### Response (not available yet)
- HTTP `404 Not Found` with `error_code`:
  - `EXTRACTION_NOT_READY` (run still processing)
  - `EXTRACTION_NOT_AVAILABLE` (extraction failed or artifact missing)

### Response (failure)
- `404 Not Found`: document or run does not exist
- `500 Internal Server Error`: unexpected filesystem/DB failure

Error body MUST follow **API Error Response Format (Normative)**.

---

## UI / UX Checklist

- Extracted text is hidden by default.
- A single action (e.g., “Show extracted text”) reveals it inline (no navigation to a separate workflow).
- Show language label near the text (e.g., “Detected language: ES”).
- Show an informational disclaimer:
  - “This is raw extracted text. It may contain noise and formatting artifacts.”
- If not available:
  - show “Not ready yet” when processing is ongoing
  - show “Unavailable (extraction failed)” when applicable
- The feature must not block review.

### Data fetching
- Use **TanStack Query** for loading/error states.
- No custom caching logic beyond TanStack defaults.

---

## Observability Checklist (MVP)

- Emit structured log when extracted text is requested:
  - `document_id`
  - `run_id`
  - `event_type = EXTRACTED_TEXT_VIEWED`
  - `timestamp`
- Emit structured log on failure/not-available:
  - `event_type = EXTRACTED_TEXT_VIEW_FAILED`
  - `failure_reason`

Logs must be best-effort and must not block the request.

---

## Tests Checklist

### Unit Tests
- Artifact retrieval logic (by `document_id` + `run_id`)
- Language persistence and retrieval
- Error mapping for “not ready” vs “not available”

### Integration Tests
- Extracted text can be retrieved after a successful run.
- While processing is ongoing, endpoint returns “not ready” response.
- If extraction failed, endpoint returns “not available”.
- Extracted text is linked to the correct `run_id`.
- No overwrite: requesting older run returns its own artifact.

---

## Definition of Done (DoD)

- [ ] Extracted text persisted as a first-class artifact per run
- [ ] Document language detected and persisted per run
- [ ] Run-scoped API endpoint implemented and documented
- [ ] Endpoint distinguishes “not ready” vs “not available”
- [ ] UI supports 1-click progressive disclosure (hidden by default)
- [ ] UI uses TanStack Query for loading/error
- [ ] Feature is non-blocking for veterinary workflow
- [ ] Structured logs emitted for access and failures
- [ ] Unit and integration tests passing

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

## Scope Clarification
- This story introduces the **core review experience**.
- This story does **not**:
  - enforce approvals or gating,
  - promote interpretations to global schemas,
  - guarantee pixel-perfect evidence alignment.
- Review is **assistive and transparent**, not authoritative.

---

## Data Model (Structured Interpretation)

### StructuredInterpretation (per processing run)
Structured data is a **versioned, first-class artifact** linked to a specific run.

Minimum fields (conceptual):
- `document_id`
- `run_id`
- `version_id`
- `fields[]`
  - `field_name`
  - `value`
  - `confidence`
  - `evidence`
    - `page_number`
    - `snippet`
- `created_at`

**Rules**
- Each edit (handled in a later story) creates a new version.
- Interpretations are **append-only**.
- No interpretation is ever treated as ground truth.

---

## Evidence Model (Approximate by Design)

- Evidence is stored per field as:
  - `page_number`
  - `text_snippet`
- No bounding boxes or exact PDF coordinates are stored.
- Evidence is:
  - explanatory,
  - approximate,
  - best-effort.

Failure to highlight evidence must **never block review**.

---

## API (Contract Checklist)

### Review Endpoint
- `GET /documents/{document_id}/runs/{run_id}/review`

> The UI should default to the **latest completed run**.

### Response (success)
- HTTP `200 OK`
- Body includes:
  - `document_id`
  - `run_id`
  - `interpretation_version_id`
  - `fields[]` with:
    - `field_name`
    - `value`
    - `confidence`
    - `evidence` (page + snippet)
  - `has_raw_text` (boolean)
  - `created_at`

### Response (not available)
- `404 Not Found`:
  - interpretation not available yet
  - run failed before interpretation

---

## UI / UX Checklist

### Layout
- Side-by-side view:
  - left: structured interpretation
  - right: original PDF (PDF.js)

### Interaction
- Selecting a field:
  - navigates the PDF to `page_number`
  - shows the snippet as explicit evidence
- Attempt best-effort snippet highlighting via PDF.js text layer.
- If highlighting fails:
  - show no highlight,
  - do not fake precision,
  - review remains fully usable.

### Confidence Presentation
- Confidence is rendered as a **visual attention signal**:
  - qualitative first (e.g., low / medium / high),
  - numeric optional.
- Confidence:
  - never disables actions,
  - never triggers confirmations,
  - never implies correctness.

### Raw Text
- Raw extracted text can be toggled (≤ 1 interaction).
- Shown as assistive context only.

### Data Fetching
- Use **TanStack Query**:
  - `useQuery` for status, interpretation, raw text
  - `useMutation` reserved for later edit/review actions
- Proper invalidation on:
  - reprocess completion,
  - interpretation updates (future stories).

---

## Processing & State Independence

- Review is allowed when:
  - the latest run is `COMPLETED`.
- Review is blocked only if:
  - no completed run exists yet.
- Failed or timed-out runs:
  - do not block access to previous completed interpretations (if any).

---

## Observability Checklist (MVP)

- Emit structured log when review view is opened:
  - `document_id`
  - `run_id`
  - `event_type = DOCUMENT_REVIEW_VIEWED`
  - `timestamp`
- Emit structured log when evidence navigation occurs:
  - `event_type = FIELD_EVIDENCE_VIEWED`
  - `field_name`
  - `page_number`

Logs must be best-effort and must not block rendering.

---

## Tests Checklist

### Unit Tests
- Confidence rendering rules (qualitative mapping).
- Evidence model mapping (page + snippet).

### Integration Tests
- Review endpoint returns structured data for completed runs.
- Selecting a field navigates to correct page number.
- Missing highlights do not break review flow.
- Raw text toggle works without reprocessing.
- `pending_review` never blocks access.

---

## Definition of Done (DoD)

- [ ] Structured interpretations generated per run
- [ ] Per-field confidence persisted and exposed
- [ ] Evidence (page + snippet) available per field
- [ ] Review endpoint aggregates all required data
- [ ] Side-by-side UI implemented with PDF.js
- [ ] Confidence rendered as non-blocking attention signal
- [ ] Evidence navigation works with best-effort highlighting
- [ ] Raw extracted text accessible from review context
- [ ] No approval or gating flows implemented
- [ ] Structured logs emitted for review and evidence navigation
- [ ] Unit and integration tests passing

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

## Scope Clarification
- This story covers **veterinarian edits only**.
- This story does **not**:
  - update global schemas,
  - train models,
  - trigger automated decisions.
- All edits are assistive and reversible via reprocessing.

---

## Data Model (Versioned Structured Records)

### StructuredInterpretationVersion
Edits create a **new version** of structured data linked to a processing run.

Minimum fields (conceptual):
- `document_id`
- `run_id`
- `version_id`
- `fields[]`
  - `field_name`
  - `value`
  - `confidence` (retained from source where applicable)
  - `source` (`machine | human`)
  - `evidence` (page + snippet, optional for human edits)
- `created_at`
- `created_by` (`system | veterinarian`)

**Rules**
- Versions are **append-only**.
- Existing versions are never mutated or deleted.
- The latest version is the **active** one for review.

---

## Field-Level Change Log

Each edit must generate a change log entry.

### FieldChangeLog
Minimum fields:
- `document_id`
- `run_id`
- `version_id`
- `field_name`
- `change_type` (`ADD | UPDATE | DELETE`)
- `previous_value` (nullable)
- `new_value`
- `changed_by` (`veterinarian`)
- `timestamp`

---

## Structural Change Detection

- Structural changes include:
  - adding a new field,
  - renaming a field,
  - deleting a field.
- When a structural change occurs:
  - the interpretation version is marked internally as `pending_review`.
- `pending_review`:
  - is **internal only**,
  - does **not** block the veterinarian,
  - does **not** change UI behavior in the MVP.

---

## API (Contract Checklist)

### Edit Structured Data
- `POST /documents/{document_id}/runs/{run_id}/interpretations`

#### Request
- Body includes:
  - `base_version_id`
  - `changes[]`
    - `field_name`
    - `operation` (`ADD | UPDATE | DELETE`)
    - `value` (nullable for delete)

#### Response (success)
- HTTP `200 OK`
- Body includes:
  - `document_id`
  - `run_id`
  - `new_version_id`
  - `fields[]` (full updated interpretation)

#### Response (failure)
- `404 Not Found`: document/run/version does not exist
- `409 Conflict`: base version is not the latest active version
- `400 Bad Request`: invalid field operation
- `500 Internal Server Error`: unexpected persistence failure

---

## Reset via Reprocess

- Reprocessing the document:
  - creates a new processing run,
  - produces a new machine-generated interpretation,
  - implicitly resets all veterinarian edits.
- No explicit “reset edits” endpoint is required.

---

## UI / UX Checklist

- Edited fields are visually distinguishable from machine-extracted fields
  (e.g., icon, color, or label).
- Changes are applied immediately after save.
- No warnings, confirmations, or reviewer language is shown.
- Confidence indicators remain visible but never disable editing.
- The UI is scan-friendly:
  - edited vs machine values are obvious at a glance.

---

## Observability Checklist (MVP)

- Emit structured log for each edit:
  - `document_id`
  - `run_id`
  - `version_id`
  - `event_type = STRUCTURED_DATA_EDITED`
  - `changed_fields[]`
  - `timestamp`
- Emit structured log for structural changes:
  - `event_type = STRUCTURAL_CHANGE_DETECTED`

Logs must be best-effort and must not block the edit flow.

---

## Tests Checklist

### Unit Tests
- Version creation logic (append-only).
- Field-level change log generation.
- Structural change detection.

### Integration Tests
- Editing creates a new interpretation version.
- Existing versions remain unchanged.
- Structural changes set internal `pending_review` flag.
- Confidence does not block edits.
- Reprocess resets all edits by creating a new run.
- Conflict when editing from a non-latest base version.

---

## Definition of Done (DoD)

- [ ] Structured data edits accepted via API
- [ ] New interpretation version created per edit
- [ ] Field-level change log persisted
- [ ] Structural changes detected and marked `pending_review`
- [ ] Existing structured records never mutated
- [ ] Edited vs machine fields clearly distinguishable in UI
- [ ] Reprocess resets edits implicitly
- [ ] No reviewer or approval UI exposed
- [ ] Structured logs emitted for edits and structural changes
- [ ] Unit and integration tests passing
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

## Scope Clarification
- This story captures **learning signals only**.
- This story does **not**:
  - retrain models,
  - change extraction or interpretation logic,
  - automate decisions based on confidence,
  - introduce approval or feedback workflows.
- All learning effects are **local, conservative, and deferred**.

---

## Learning Signal Model (Conceptual)

### LearningSignal
A learning signal represents an implicit correction derived from normal editing.

Minimum fields:
- `signal_id`
- `document_id`
- `run_id`
- `interpretation_version_id`
- `field_name`
- `original_value`
- `corrected_value`
- `change_type` (`ADD | UPDATE | DELETE`)
- `confidence_before`
- `confidence_after` (nullable; optional for MVP)
- `source = veterinarian`
- `context`
  - `document_language`
  - `document_type` (if available)
  - `field_position` (optional)
- `created_at`

**Rules**
- Learning signals are **append-only**.
- Signals are immutable once recorded.
- Signals are never exposed to veterinarians in the MVP.

---

## Signal Capture Rules

- A learning signal is recorded **automatically** whenever:
  - a veterinarian edits a machine-extracted field.
- Creating new fields also generates a signal.
- Deleting fields generates a signal.
- No signal is recorded for:
  - viewing,
  - navigation,
  - confidence inspection without edits.

---

## Confidence Adjustment Rules (MVP)

- Confidence updates are:
  - **local** (field-level, interpretation-level),
  - **conservative**,
  - **non-immediate**.
- Single corrections must **not** significantly change confidence.
- Confidence changes:
  - must not propagate globally,
  - must not affect other documents,
  - must not change extraction or interpretation behavior.

> In the MVP, confidence adjustment may be implemented as:
> - storing deltas,
> - storing counters,
> - or deferred computation without visible impact.

---

## Non-Goals (Explicit)

Do **not** implement:
- confidence-driven automation,
- confidence-based gating or blocking,
- global model updates,
- UI elements exposing learning or training,
- explicit “feedback” or “approve” actions.

---

## API (Internal Only)

- No new public API endpoints are required.
- Learning signal capture is **side-effect only** of structured data edits (US-08).
- Signals are persisted internally for future use.

---

## Observability Checklist (MVP)

- Emit structured log when a learning signal is recorded:
  - `document_id`
  - `run_id`
  - `field_name`
  - `change_type`
  - `event_type = LEARNING_SIGNAL_CAPTURED`
  - `timestamp`
- Logging must be best-effort and must not block edits.

---

## Tests Checklist

### Unit Tests
- Learning signal creation on field edit.
- No signal created on read-only operations.
- Signals correctly linked to run and interpretation version.

### Integration Tests
- Editing structured data generates learning signals transparently.
- Learning signals do not affect current confidence or behavior.
- Multiple edits generate multiple independent signals.
- No UI-visible side effects occur during learning signal capture.

---

## Definition of Done (DoD)

- [ ] Learning signals captured automatically on edits
- [ ] Signals linked to document, run, version, and field
- [ ] Signals persisted as append-only records
- [ ] No UI changes or feedback requests introduced
- [ ] No immediate behavior or confidence changes visible
- [ ] No global learning or automation implemented
- [ ] Structured logs emitted for signal capture
- [ ] Unit and integration tests passing

---

# US-10 — Change document language and reprocess

## User Story
**As a veterinarian**,  
I want to change the detected language of a document  
**so that** it can be reprocessed correctly if the automatic detection was wrong.

---

## Acceptance Criteria
- The user can see the language automatically detected for a document.
- The user can manually select a different language.
- The user can trigger reprocessing after changing the language.
- The system clearly indicates that reprocessing used the new language.
- Changing the language is an **explicit context override** and:
  - does not block review,
  - does not block editing.
- Previous interpretations remain visible for **traceability and comparison**.

---

## Scope Clarification
- This story introduces a **manual context override** (language).
- This story does **not**:
  - change language automatically after user edits,
  - propagate language changes to other documents,
  - introduce language-specific UI flows.
- Language override affects **only subsequent processing runs**.

---

## Language Model

### Detected vs Overridden Language
For each document:

- `detected_language`
  - produced automatically during extraction
- `language_override` (optional)
  - explicitly set by the veterinarian

**Effective language rule**
- If `language_override` is present → use it.
- Otherwise → use `detected_language`.

---

## Persistence Rules

### Document Metadata
Extend document metadata to include:
- `detected_language`
- `language_override` (nullable)
- `effective_language` (derived, not stored)

### ProcessingRun Context
Each processing run must persist:
- `language_used`

This ensures:
- traceability,
- comparison across runs,
- clear explanation in the UI.

---

## Reprocessing Behavior

- Changing the language **does not automatically reprocess**.
- The user must explicitly trigger reprocessing.
- Reprocessing follows the existing rules (US-05):
  - manual trigger,
  - new run created,
  - queued if another run is active,
  - previous runs and artifacts are never overwritten.

---

## API (Contract Checklist)

### Update Language Override
- `PATCH /documents/{document_id}/language`

Note:
- Endpoint path is subject to **API Naming Authority (Normative)** in `docs/TECHNICAL_DESIGN.md` Appendix B3 (+ B3.1).

#### Request
```json
{
  "language_override": "es"
}
```

### Response (success)

**HTTP 200 OK**

**Body includes:**
- `document_id`
- `detected_language`
- `language_override`
- `effective_language`

---

## Reprocess with New Language

Reuse existing endpoint:
- `POST /documents/{document_id}/reprocess`

The newly created run must record:
- `language_used = effective_language`

---

## UI / UX Checklist

**Display:**
- detected language
- overridden language (if any)
- which one is currently in effect

**Language change:**
- is explicit
- requires a deliberate user action

**After reprocess:**
- show that the latest run used the overridden language

**Traceability:**
- previous interpretations remain accessible for comparison

**Non-blocking guarantees:**
- language override never blocks:
  - review
  - editing
  - access to previous results

---

## Observability Checklist (MVP)

Emit structured log when language override is set:
- `document_id`
- `previous_language`
- `new_language`
- `event_type = DOCUMENT_LANGUAGE_OVERRIDDEN`
- `timestamp`

Emit structured log when reprocessing starts with override:
- `document_id`
- `run_id`
- `language_used`
- `event_type = DOCUMENT_REPROCESS_WITH_LANGUAGE`

Logs must be best-effort and must not block actions.

### Response (failure)
- `404 Not Found`: document does not exist
- `400 Bad Request`: invalid language code
- `500 Internal Server Error`: unexpected persistence failure

Error body MUST follow **API Error Response Format (Normative)**.

---

## Tests Checklist

### Unit Tests
- Effective language derivation logic
- Language override persistence
- Correct language selection for new runs

### Integration Tests
- Language override does not affect existing runs
- Reprocess creates a new run using overridden language
- Previous interpretations remain accessible
- Review and edit remain available after language change
- Only the new run reflects the overridden language

---

## Definition of Done (DoD)

- [ ] Detected language persisted per document
- [ ] Manual language override supported
- [ ] Effective language derived correctly
- [ ] Reprocessing uses the selected language
- [ ] Each run records `language_used`
- [ ] Previous interpretations remain traceable
- [ ] Language override does not block review or editing
- [ ] Structured logs emitted for language change and reprocess
- [ ] Unit and integration tests

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

## Scope Clarification
- This story provides **visibility only**.
- This story does **not**:
  - control processing,
  - allow retries or edits,
  - expose internal debugging or stack traces.
- The history view is informational and optional.

---

## Processing History Model (Authoritative)

Processing history is derived from:
- `ProcessingRun` records (run lifecycle)
- run-scoped step artifacts in `Artifacts` with `artifact_type = STEP_STATUS` (Appendix C)

### Dependency Note
- The `Artifacts` persistence model (including `artifact_type = STEP_STATUS`) is defined in `docs/TECHNICAL_DESIGN.md` Appendix C
  and MUST exist before implementing US-11.

### Step History (derived)
Step entries are derived by ordering `STEP_STATUS` artifacts by `created_at`.

Minimum derived fields:
- `run_id`
- `step_name` (`EXTRACTION | INTERPRETATION`)
- `step_status` (`RUNNING | SUCCEEDED | FAILED`)
- `attempt`
- `timestamp`
- `error_code` (nullable)


---

## Failure Explanation Mapping

- Technical failure types (e.g. `EXTRACTION_FAILED`) must be mapped to
  **user-friendly explanations**, such as:
  - “The document text could not be extracted.”
  - “The system could not interpret the extracted text.”
- Explanations must:
  - avoid technical jargon,
  - avoid blame,
  - avoid suggesting corrective actions.

---

## API (Contract Checklist)

### Endpoint
- `GET /documents/{document_id}/processing-history`

### Response (success)
- HTTP `200 OK`
- Body includes:
  - `document_id`
  - `runs[]`
    - `run_id`
    - `started_at`
    - `completed_at`
    - `steps[]`
      - `step_name`
      - `status`
      - `timestamp`
      - `failure_type` (nullable)
      - `explanation` (human-readable)

Runs and steps must be returned in **chronological order**.

---

### Response (failure)
- `404 Not Found`: document does not exist
- `500 Internal Server Error`: unexpected persistence failure

Error body MUST follow **API Error Response Format (Normative)**.

---

## UI / UX Checklist

- Display processing history as a **timeline or ordered list**.
- Group steps by processing run.
- Clearly distinguish:
  - completed steps,
  - failed steps,
  - steps still in progress.
- Failure explanations are:
  - short,
  - human-readable,
  - clearly separated from technical data.
- No buttons, actions, or decisions are attached to history entries.

---

## Observability Checklist (MVP)

- Emit structured log when history is viewed:
  - `document_id`
  - `event_type = PROCESSING_HISTORY_VIEWED`
  - `timestamp`
- Logs must be best-effort and must not block the request.

---

## Tests Checklist

### Unit Tests
- Correct ordering of events by timestamp.
- Failure type → explanation mapping.
- Read-only enforcement (no mutation paths).

### Integration Tests
- History includes all runs and steps for a document.
- Failed steps include explanations.
- Ongoing runs show in-progress steps correctly.
- History remains accessible regardless of document state.

---

## Definition of Done (DoD)

- [ ] Processing events persisted as append-only records
- [ ] History API endpoint implemented and documented
- [ ] Steps grouped and ordered chronologically by run
- [ ] Failures mapped to user-friendly explanations
- [ ] History is strictly read-only
- [ ] No actions or approvals exposed in history view
- [ ] Structured logs emitted for history access
- [ ] Unit and integration tests passing
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

## Scope Clarification
- This story introduces a **human review completion flag**.
- This story does **not**:
  - approve data,
  - lock documents,
  - trigger learning or automation,
  - interact with schema evolution.
- Review completion is **local, reversible, and non-blocking**.

---

## Review Status Model

### ReviewStatus (document-level, independent)
Review status is **separate from processing state**.

Allowed values:
- `IN_REVIEW` (default)
- `REVIEWED`

**Rules**
- Review status applies to the **document**, not to processing runs.
- Processing may continue independently of review status.
- Review status reflects **human workflow only**.

---

## Consistency Rules

- Default state after upload: `IN_REVIEW`.
- When the user marks the document as reviewed:
  - review status → `REVIEWED`.
- If the user edits structured data after review:
  - review status automatically reverts to `IN_REVIEW`.
- Reprocessing:
  - does **not** change review status automatically.
  - the document remains `IN_REVIEW` or `REVIEWED` as last set by the user.

---

## Persistence

### Document Review Metadata
Persist review status separately from processing data.

Minimum fields (conceptual):
- `document_id`
- `review_status` (`IN_REVIEW | REVIEWED`)
- `reviewed_at` (nullable)
- `reviewed_by` (veterinarian identifier)

---

## API (Contract Checklist)

### Mark as Reviewed
- `POST /documents/{document_id}/mark-reviewed`

#### Response (success)
- HTTP `200 OK`
- Body includes:
  - `document_id`
  - `review_status = REVIEWED`
  - `reviewed_at`

#### Response (failure)
- `404 Not Found`: document does not exist
- `409 Conflict`: invalid transition (optional, if already reviewed)
- `500 Internal Server Error`: unexpected persistence failure

---

### Fetch Review Status
- Included in existing document endpoints:
  - `GET /documents/{document_id}`
  - `GET /documents`

No separate endpoint is required for read access.

---

## UI / UX Checklist

- Provide a **single primary action**:
  - “Mark as reviewed”
- Reviewed documents:
  - are visually identifiable (badge/label).
- If the user edits a reviewed document:
  - the UI clearly shows the document is back “In review”.
- No confirmations, approvals, or warnings are introduced.
- Review completion does not block:
  - editing,
  - reprocessing,
  - viewing history or artifacts.

---

## Observability Checklist (MVP)

- Emit structured log when document is marked as reviewed:
  - `document_id`
  - `review_status = REVIEWED`
  - `event_type = DOCUMENT_MARKED_REVIEWED`
  - `timestamp`
- Emit structured log when review is reopened due to edit:
  - `document_id`
  - `event_type = DOCUMENT_REVIEW_REOPENED`
  - `timestamp`

Logs must be best-effort and must not block actions.

---

## Tests Checklist

### Unit Tests
- Review status transitions (`IN_REVIEW` → `REVIEWED`).
- Automatic reopening on edit.
- Independence from processing state.

### Integration Tests
- Marking as reviewed updates review metadata.
- Editing after review reopens review.
- Reprocessing does not change review status.
- Review actions remain available regardless of `pending_review`.

---

## Definition of Done (DoD)

- [ ] Review status persisted independently of processing
- [ ] Mark-reviewed endpoint implemented
- [ ] Reviewed documents clearly identifiable
- [ ] Editing reopens review automatically
- [ ] Review status unaffected by processing or schema evolution
- [ ] Single primary UI action for completion
- [ ] Structured logs emitted for review actions
- [ ] Unit and integration tests passing
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

## Scope Clarification
- This story introduces **schema governance tooling** for reviewers.
- This story does **not**:
  - modify existing document interpretations,
  - retroactively change document data,
  - introduce blocking approvals for veterinarians.
- All effects are **forward-looking and optional**.

---

## Structural Change Aggregation Model

### StructuralChangeCandidate
A structural change candidate represents an **aggregated pattern** derived from multiple document-level edits.

Minimum fields (conceptual):
- `candidate_id`
- `change_type` (`NEW_FIELD | FIELD_MAPPING | FIELD_RENAME | FIELD_DEPRECATION`)
- `source_field` (nullable)
- `target_field`
- `occurrence_count`
- `confidence_trend`
- `evidence_samples[]`
  - `document_id` (optional, anonymized if required)
  - `page_number`
  - `snippet`
- `status` (`PENDING | ACCEPTED | REJECTED`)
- `created_at`
- `updated_at`

**Rules**
- Candidates are **derived** from document-level `pending_review` signals.
- Candidates are **append-only**; status transitions are tracked but history is preserved.
- Candidates are independent of any single document.

---

## Aggregation Rules

- Document-level structural changes (from US-08 / US-09):
  - are collected as raw signals,
  - never block document workflows.
- Aggregation groups signals by:
  - field identity,
  - semantic similarity,
  - repeated occurrence.
- Single occurrences must **not** automatically produce candidates (threshold-based).

---

## Reviewer Actions

### Allowed Actions
- **Accept** a structural change:
  - marks the candidate as `ACCEPTED`,
  - makes it available for future schema evolution (future stories).
- **Reject** a structural change:
  - marks the candidate as `REJECTED`,
  - preserves it for audit and learning.

### Explicit Non-Effects
Reviewer actions must **not**:
- change existing document data,
- affect current or past interpretations,
- block veterinarians or processing.

---

## API (Reviewer-Facing Only)

### List Pending Structural Changes
- `GET /reviewer/structural-changes`

#### Response (success)
- HTTP `200 OK`
- Body includes:
  - `candidates[]` with:
    - `candidate_id`
    - `change_type`
    - `source_field`
    - `target_field`
    - `occurrence_count`
    - `confidence_trend`
    - `evidence_samples[]`
    - `status`

---

### Review Structural Change
- `POST /reviewer/structural-changes/{candidate_id}/decision`

#### Request
```json
{
  "decision": "ACCEPT" | "REJECT"
}
```

## Response (success)

**HTTP 200 OK**

**Body includes:**
- `candidate_id`
- `status`
- `reviewed_at`

---

## Persistence Rules

Structural change candidates are stored separately from:
- document data
- processing runs
- structured interpretations

Reviewer decisions are:
- immutable events
- auditable
- reversible only via explicit new decisions (future concern)

---

## UI / UX Checklist (Reviewer)

- Reviewer UI is separate from veterinarian UI.
- Changes are displayed:
  - grouped by pattern
  - with summarized evidence
  - without exposing individual document workflows
- No document-level actions are available from this UI.
- Clear distinction between:
  - pending
  - accepted
  - rejected candidates

---

## Observability Checklist (MVP)

Emit structured log when:
- structural change candidates are listed
- a candidate is accepted or rejected

Each log includes:
- `candidate_id`
- `decision` (if applicable)
- `event_type`
- `timestamp`

Logs must be best-effort and must not block reviewer actions.

---

## Tests Checklist

### Unit Tests
- Aggregation logic from document-level signals
- Status transition rules (`PENDING → ACCEPTED | REJECTED`)
- Isolation from document workflows

### Integration Tests
- Pending structural changes are aggregated correctly
- Reviewer decisions do not affect document-level behavior
- Veterinarian workflows remain unchanged after reviewer actions
- Accepted and rejected candidates remain traceable

---

## Definition of Done (DoD)

- [ ] Structural changes aggregated by pattern (not per document)
- [ ] Pending structural change candidates persisted separately
- [ ] Reviewer-facing API endpoints implemented
- [ ] Reviewer decisions affect schema evolution only
- [ ] No impact on document-level workflows
- [ ] Reviewer UI isolated from veterinarian UI
- [ ] Structured logs emitted for reviewer actions
- [ ] Unit and integration tests passing

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

## Scope Clarification
- This story introduces **canonical schema evolution**.
- This story does **not**:
  - automatically reprocess existing documents,
  - mutate past interpretations,
  - introduce blocking approvals for veterinarians.
- Schema application is **prospective** and **versioned**.

---

## Canonical Schema Model

### CanonicalSchema (versioned)
A canonical schema is a versioned contract used by the interpretation step.

Minimum fields (conceptual):
- `schema_version_id`
- `version_number` (monotonic)
- `schema_definition` (JSON)
- `created_at`
- `created_by` (reviewer identity)
- `change_summary` (human-readable)

**Rules**
- Schemas are immutable and append-only.
- Each approval creates a **new schema version**.
- The latest schema version is the default for new runs.

---

## Promotion Rules (Prospective Only)

- Approving a structural change:
  - creates a new canonical schema version,
  - updates the “current schema pointer” for future runs.
- Newly created processing runs record:
  - `schema_version_used`
- Existing runs and artifacts:
  - remain linked to their historical schema version,
  - are never retroactively modified.

---

## Traceability & Audit

Each approval must persist:
- `candidate_id`
- `schema_version_id` created
- reviewer identity
- timestamp
- decision rationale (optional but recommended)

All actions are auditable and immutable.

---

## API (Reviewer-Facing Only)

### Approve Structural Change
- `POST /reviewer/structural-changes/{candidate_id}/approve`

#### Response (success)
- HTTP `200 OK`
- Body includes:
  - `candidate_id`
  - `decision = APPROVED`
  - `schema_version_id`
  - `approved_at`
  - `approved_by`

#### Response (failure)
- `404 Not Found`: candidate not found
- `409 Conflict`: candidate not in approvable state (already decided)
- `500 Internal Server Error`: persistence failure

---

### View Current Schema Version
- `GET /reviewer/schema/current`

Returns:
- `schema_version_id`
- `version_number`
- `created_at`
- `change_summary`

---

## Processing Integration

- Interpretation logic must reference the **current canonical schema version** when starting a new run.
- Each processing run persists:
  - `schema_version_used`
  - `language_used` (from US-10)
- No implicit reprocessing is triggered by schema changes.

---

## UI / UX Checklist (Reviewer)

- Reviewer UI clearly shows:
  - pending candidate details,
  - expected schema impact,
  - current schema version and what will change.
- Approval is explicit and intentional.
- After approval:
  - show new schema version created,
  - show that it applies prospectively only.
- No veterinarian UI changes or gating are introduced.

---

## Observability Checklist (MVP)

- Emit structured log on approval:
  - `candidate_id`
  - `schema_version_id`
  - `approved_by`
  - `event_type = STRUCTURAL_CHANGE_APPROVED`
  - `timestamp`
- Emit structured log when a new run starts with a schema version:
  - `run_id`
  - `schema_version_used`
  - `event_type = PROCESSING_RUN_SCHEMA_ASSIGNED`

Logs must be best-effort and must not block reviewer actions.

---

## Tests Checklist

### Unit Tests
- Canonical schema version creation (append-only).
- Candidate state transition to approved.
- Prospective application rule enforcement.

### Integration Tests
- Approval creates a new schema version.
- New processing runs use the latest schema version.
- Existing runs retain their original schema version.
- No automatic reprocessing of existing documents occurs.
- Veterinarian workflows remain unaffected.

---

## Definition of Done (DoD)

- [ ] Approved changes promoted into canonical schema
- [ ] Canonical schema versioned on each approval
- [ ] Reviewer identity and timestamp persisted
- [ ] Runs persist `schema_version_used`
- [ ] Schema updates apply prospectively only
- [ ] Approval does not trigger reprocessing unless explicitly requested
- [ ] No impact on veterinarian workflows
- [ ] Structured logs emitted for approvals and schema assignment
- [ ] Unit and integration tests passing

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

## Scope Clarification
- This story governs **reviewer decision states** for structural change candidates.
- This story does **not**:
  - modify existing document data,
  - trigger reprocessing,
  - expose reviewer decisions to veterinarians.
- Decisions are **schema-level only** and **forward-looking**.

---

## Structural Change Decision Model

### StructuralChangeCandidate (state machine)
Candidates support the following states:
- `PENDING` (default)
- `APPROVED`
- `REJECTED`
- `DEFERRED`

**Rules**
- State transitions are explicit and auditable.
- `REJECTED` is terminal for schema evolution in the MVP.
- `DEFERRED` keeps the candidate visible and reviewable.
- Only `APPROVED` candidates can be promoted to the canonical schema (US-15).

---

## Decision Semantics

### Reject
- Marks the candidate as `REJECTED`.
- Optionally records a rejection reason.
- Stops any **future confidence aggregation** for that candidate.
- Preserves historical data for audit and analysis.

### Defer
- Marks the candidate as `DEFERRED`.
- Does **not** apply the change.
- Does **not** stop future signal accumulation.
- Keeps the candidate visible for later review.

---

## Confidence Aggregation Rules

- `REJECTED` candidates:
  - are excluded from future confidence and stability aggregation,
  - remain immutable and auditable.
- `DEFERRED` candidates:
  - continue to accumulate signals,
  - update metrics over time,
  - can later transition to `APPROVED` or `REJECTED`.

---

## Persistence Rules

### Decision Record
Persist reviewer decisions as immutable records:

Minimum fields (conceptual):
- `candidate_id`
- `decision` (`REJECTED | DEFERRED`)
- `reason` (nullable)
- `decided_at`
- `decided_by` (reviewer identity)

**Rules**
- Decisions are append-only.
- Changing a decision creates a **new decision record** (future concern).
- No decision mutates document-level data.

---

## API (Reviewer-Facing Only)

### Reject Structural Change
- `POST /reviewer/structural-changes/{candidate_id}/reject`

#### Request
```json
{
  "reason": "Optional explanation"
}
```
## Response (success)

**HTTP 200 OK**

**Body includes:**
- `candidate_id`
- `status = REJECTED`
- `rejected_at`
- `rejected_by`

---

## Defer Structural Change

**POST** `/reviewer/structural-changes/{candidate_id}/defer`

### Response (success)

**HTTP 200 OK**

**Body includes:**
- `candidate_id`
- `status = DEFERRED`
- `deferred_at`
- `deferred_by`

---

## UI / UX Checklist (Reviewer)

- Reviewer UI clearly supports:
  - approve (US-15)
  - reject
  - defer
- Rejection allows an optional explanation.
- Deferred changes are clearly labeled and remain visible.
- Rejected changes are clearly marked and visually de-emphasized.
- No veterinarian-facing UI reflects these states.

---

## Observability Checklist (MVP)

Emit structured log when a candidate is rejected:
- `candidate_id`
- `decision = REJECTED`
- `reason` (if provided)
- `event_type = STRUCTURAL_CHANGE_REJECTED`
- `timestamp`

Emit structured log when a candidate is deferred:
- `candidate_id`
- `decision = DEFERRED`
- `event_type = STRUCTURAL_CHANGE_DEFERRED`
- `timestamp`

Logs must be best-effort and must not block reviewer actions.

---

## Tests Checklist

### Unit Tests
- State transition rules (`PENDING → REJECTED | DEFERRED`)
- Confidence aggregation exclusion for rejected candidates
- Continued aggregation for deferred candidates

### Integration Tests
- Rejecting a candidate excludes it from future prioritization
- Deferred candidates remain visible and sortable
- Reviewer decisions do not affect document-level workflows
- Veterinarian experiences remain unchanged

---

## Definition of Done (DoD)

- [ ] Structural change candidates support `REJECTED` and `DEFERRED` states
- [ ] Rejection reason and timestamps persisted
- [ ] Rejected candidates excluded from future confidence aggregation
- [ ] Deferred candidates remain visible and reviewable
- [ ] Reviewer-facing API endpoints implemented
- [ ] No impact on document interpretations or veterinarian workflows
- [ ] Structured logs emitted for reject and defer actions
- [ ] Unit and integration tests passing


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

## Scope Clarification
- This story introduces **risk-aware governance** for schema evolution.
- This story does **not**:
  - change document interpretations,
  - block processing or review,
  - expose criticality concepts to veterinarians.
- Criticality affects **schema evolution decisions only**.

---

## Criticality Model

### CriticalConcept (configuration)
A critical concept is a schema element whose change is **non-reversible or high-impact**.

Examples (illustrative, configurable):
- primary identifiers
- clinical diagnosis categories
- financial or legal fields
- core entity boundaries

**Configuration**
- Defined via configuration (code or data-driven).
- Versioned and auditable.
- Not inferred automatically in the MVP.

---

### StructuralChangeCriticality
Each structural change candidate may carry criticality metadata.

Minimum fields (conceptual):
- `candidate_id`
- `is_critical` (boolean)
- `critical_reason` (human-readable explanation)
- `critical_rule_id` (which rule triggered criticality)
- `flagged_at`

**Rules**
- Criticality is **explicit and explainable**.
- Criticality can be:
  - rule-based (field match),
  - reviewer-marked (manual override).
- Criticality is **independent** of confidence metrics.

---

## Governance Rules

- If `is_critical = true`:
  - the change **cannot** be auto-promoted,
  - the change **must** go through explicit reviewer approval (US-15),
  - prioritization (US-14) affects ordering only, never promotion.
- Criticality:
  - never blocks veterinarians,
  - never alters document-level behavior,
  - never triggers reprocessing automatically.

---

## Reviewer Experience

- Reviewer can see:
  - critical flag,
  - reason for criticality,
  - impacted schema elements.
- Reviewer decisions (approve / reject / defer):
  - remain explicit,
  - are fully auditable,
  - apply prospectively only (US-15 / US-16).

---

## Persistence Rules

- Criticality metadata is persisted **with the structural change candidate**.
- Manual changes to criticality (future concern) are:
  - recorded as immutable events,
  - traceable (who/when/why).

---

## API (Reviewer-Facing Only)

### List Structural Changes (with criticality)
- `GET /reviewer/structural-changes`

#### Response (excerpt)
Each candidate includes:
- `candidate_id`
- `status`
- `is_critical`
- `critical_reason`
- `confidence_score`
- `occurrence_count`

No additional endpoints are required for the MVP.

---

## Observability Checklist (MVP)

- Emit structured log when a candidate is flagged as critical:
  - `candidate_id`
  - `critical_rule_id`
  - `event_type = STRUCTURAL_CHANGE_FLAGGED_CRITICAL`
  - `timestamp`
- Emit structured log when a critical candidate is approved/rejected/deferred:
  - `candidate_id`
  - `decision`
  - `event_type = STRUCTURAL_CHANGE_CRITICAL_DECISION`
  - `timestamp`

Logs must be best-effort and must not block reviewer actions.

---

## Tests Checklist

### Unit Tests
- Criticality rule evaluation.
- Enforcement of “no auto-promotion” for critical candidates.
- Persistence of criticality metadata.

### Integration Tests
- Critical candidates are flagged correctly.
- Critical candidates require explicit reviewer decision.
- Confidence does not override criticality.
- Veterinarian workflows remain unaffected.

---

## Definition of Done (DoD)

- [ ] Criticality rules defined and configurable
- [ ] Structural change candidates carry criticality metadata
- [ ] Critical changes never auto-promoted
- [ ] Criticality reasons visible to reviewers
- [ ] Critical governance isolated from veterinarian workflows
- [ ] Reviewer decisions on critical changes fully auditable
- [ ] Structured logs emitted for critical flagging and decisions
- [ ] Unit and integration tests passing

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

## Scope Clarification
- This story provides **visibility and compliance-grade traceability**.
- This story does **not**:
  - change schema behavior,
  - expose data to veterinarians,
  - allow editing or deleting audit records.
- Governance history is stored **separately** from document-level workflows.

---

## Governance Audit Model

### GovernanceDecision (append-only)
Each governance action is persisted as an immutable record.

Minimum fields (conceptual):
- `decision_id`
- `candidate_id` (nullable, e.g. manual schema version creation)
- `decision_type`
  - `APPROVE`
  - `REJECT`
  - `DEFER`
  - `FLAG_CRITICAL`
  - `UNFLAG_CRITICAL` (future concern)
- `previous_status` (nullable)
- `new_status`
- `schema_version_id` (nullable; present when approving/promoting)
- `reviewer_id`
- `reason` (nullable)
- `created_at`

**Rules**
- Records are immutable and append-only.
- A decision never overwrites a previous decision; it adds a new entry.
- The audit trail is authoritative for governance traceability.

---

## Data Separation Rules

- Governance audit data is stored separately from:
  - document data,
  - processing runs,
  - structured interpretations.
- The audit trail must not introduce dependencies that impact veterinarian workflows.

---

## API (Reviewer-Facing, Read-Only)

### Endpoint
- `GET /reviewer/governance/audit-trail`

### Query Parameters (Normative)
- `limit` (optional, default: reasonable server-side default)
- `offset` (optional, default: 0)
- `status` filter (optional, future-safe but not required)

### Response (success)
- HTTP `200 OK`
- Body includes:
  - `items[]` ordered by `created_at` ascending (chronological)
    - `decision_id`
    - `decision_type`
    - `candidate_id` (nullable)
    - `schema_version_id` (nullable)
    - `reviewer_id`
    - `reason` (nullable)
    - `created_at`

### Response (failure)
- `500 Internal Server Error`: unexpected persistence failure

---

## UI / UX Checklist (Reviewer)

- Display as a chronological list (timeline or table).
- Provide basic filtering (optional) to find decisions by:
  - candidate,
  - schema version,
  - decision type.
- No actions are available from this view (read-only).

---

## Observability Checklist (MVP)

- Emit structured log when audit trail is viewed:
  - `event_type = GOVERNANCE_AUDIT_TRAIL_VIEWED`
  - `timestamp`
  - `count_returned`
- Logs must be best-effort and must not block the request.

---

## Tests Checklist

### Unit Tests
- Append-only enforcement (no update/delete paths).
- Chronological ordering logic.
- Filtering logic (if implemented).

### Integration Tests
- Governance decisions create audit entries (from US-15/16/17).
- Audit trail endpoint returns decisions in order.
- Audit records cannot be modified or deleted.
- Governance data remains isolated from document-level workflows.

---

## Definition of Done (DoD)

- [ ] All governance decisions persisted in append-only log
- [ ] Read-only reviewer API to retrieve governance history implemented
- [ ] Audit records cannot be modified or deleted
- [ ] Governance data stored separately from document-level data
- [ ] UI renders chronological audit trail (read-only)
- [ ] Structured logs emitted for audit trail access
- [ ] Unit and integration tests passing
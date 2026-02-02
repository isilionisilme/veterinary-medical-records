## Implementation Plan

### Workflow Overview
- Plan, approve, implement, and review work by **User Story**.
- Execute releases in sequence (Release 0 through Release 6), ensuring each release is coherent, runnable, and testable before advancing.
- Use one feature branch + PR + code review per User Story; keep commits small and story-scoped.
- Keep `main` green at all times; rely on SQLite and local disk storage wherever possible.
- Introduce React UI components only when required to satisfy a story’s observable outcome.

### Release 0 — Baseline: explicit workflow & persistence

#### User Story 1 — Upload a medical record document
User Story statement  
As a user, I want to upload a medical record document so the system can process it.
Goal  
Enable metadata ingestion, validation, and lifecycle tracking for uploads.
Scope (In / Out)  
In: `POST /documents/upload`, file type/size validation, persist metadata, set initial `UPLOADED` state, record status history entry.  
Out: File download/preview, text extraction, structured data, human edits.
Observable outcome  
Upload returns confirmation + `document_id`; document stored with `UPLOADED` and history entry.
Internal implementation steps (technical chunks)  
- Create minimal FastAPI app entrypoint + healthcheck.  
- Add SQLite tables for `documents` and `document_status_history`.  
- Implement upload endpoint, validations, and metadata persistence.  
- Append status history with `UPLOADED`.
Files / components likely to be touched  
`backend` app, domain models (`Document`, `ProcessingStatus`), repository, tests.
Dependencies  
None.  
Validation & Done criteria  
- Tests: happy upload persists metadata + history entry.  
- Documented behavior in README or plan.  
- PR + code review.

Delivery note (traceability)  
- Story 1 functionality landed on `main` as commit `914470d` ("Story 1: Add document upload baseline", 2026-01-30) before the repo adopted the "one PR per user story" workflow, so there is no historical PR for Story 1.  
- Later maintainability/layering changes were applied in PR #2 (refactor) without changing the Story 1 observable outcome.  

#### User Story 2 — Clear error when a file is not supported
User Story statement  
As a user, I want to be notified when a file is not supported.
Goal  
Fail fast with explicit errors and no persistence on invalid inputs.
Scope (In / Out)  
In: type/size validation before persistence, informative error responses.  
Out: Handling every possible format or large file chunking.
Observable outcome  
Unsupported uploads return clear validation errors; DB remains unchanged.
Internal implementation steps (technical chunks)  
- Centralize validation rules for content type/size.  
- Wrap upload logic in transactional guard to avoid persistence on failure.  
- Define consistent error payload.
Files / components likely to be touched  
Upload route, validation module, error schema, tests.
Dependencies  
User Story 1.  
Validation & Done criteria  
- Tests: unsupported type and oversized file fail with errors + no document row.  
- PR + code review.

#### User Story 3 — See document processing status
User Story statement  
As a user, I want to see the document processing status.
Goal  
Expose the current lifecycle state for debugging and observability.
Scope (In / Out)  
In: `GET /documents/{id}` returning lifecycle state (plus history if helpful).  
Out: UI dashboards, analytics.
Observable outcome  
Retrieving a document reveals its current state (`UPLOADED`, etc.) and optionally history.
Internal implementation steps (technical chunks)  
- Implement GET route and response DTO.  
- Handle 404 for missing documents.  
- Optionally add listing endpoint for easier manual exploration.
Files / components likely to be touched  
Routes, DTOs, repositories, tests.
Dependencies  
User Story 1.  
Validation & Done criteria  
- Tests: existing doc returns state; missing doc yields 404.  
- PR + code review.

### Release 1 — File storage & preview

#### User Story 4 — Preview/download the uploaded document
User Story statement  
As a user, I want to preview the uploaded document.
Goal  
Allow retrieved downloads of the stored documents.
Scope (In / Out)  
In: store files on disk, persist `file_path`, implement `GET /documents/{id}/download`, surface missing-file errors.  
Out: cloud storage, format-specific preview controls.
Observable outcome  
Uploaded document can be downloaded; missing file response is explicit.
Internal implementation steps (technical chunks)  
- Add disk storage adapter and link path to document.  
- Implement download endpoint with correct headers and status history update.  
- Surface explicit missing-file error.
Files / components likely to be touched  
Storage module, data models, download route, tests.
Dependencies  
Releases 0 (Stories 1–3).  
Validation & Done criteria  
- Tests: download returns stored bytes (happy) + missing file errors.  
- PR + code review.

### Release 2 — Text extraction (stub) & visibility

#### User Story 5 — See extracted text
User Story statement  
As a user, I want to see extracted text.
Goal  
Persist stubbed extracted text and expose it in API.
Scope (In / Out)  
In: extraction action, persist `document_text_artifacts`, set state to `TEXT_EXTRACTED`, expose text in `GET /documents/{id}` or dedicated endpoint.  
Out: real OCR/LLM, async queueing.
Observable outcome  
Document retrieval includes extracted text and state reflects extraction success.
Internal implementation steps (technical chunks)  
- Extend persistence for text artifacts.  
- Add extraction orchestration (endpoint or service).  
- Update GET response to include extracted text.
Files / components likely to be touched  
Extraction service, persistence layer, routes, tests.
Dependencies  
Release 1.  
Validation & Done criteria  
- Tests: extraction happy path persists text + state.  
- PR + code review.

#### User Story 6 — See extraction errors
User Story statement  
As a user, I want to see extraction errors.
Goal  
Persist errors and transition to `TEXT_FAILED` with visibility.
Scope (In / Out)  
In: error persistence, failure state, API exposure.  
Out: rich error classification or automated retries.
Observable outcome  
Failed extraction surfaces error message and failure state.
Internal implementation steps (technical chunks)  
- Define error artifact model.  
- Ensure extraction action records errors and sets `TEXT_FAILED`.  
- Return errors in API responses.
Files / components likely to be touched  
Extraction flow, error schema, DTOs, tests.
Dependencies  
User Story 5.  
Validation & Done criteria  
- Tests: forced failure logs error + sets `TEXT_FAILED`.  
- PR + code review.

#### User Story 7 — Retry processing if it fails
User Story statement  
As a user, I want to retry processing if it fails.
Goal  
Allow controlled retries without re-upload and with idempotent transitions.
Scope (In / Out)  
In: retry endpoint or action, deterministic state transitions, no duplication.  
Out: automated retry policies.
Observable outcome  
Retry from `TEXT_FAILED` succeeds without corrupting data; invalid states return safe errors.
Internal implementation steps (technical chunks)  
- Add retry endpoint/service orchestrating next valid state.  
- Enforce idempotency and deduplication.  
- Guard invalid-state retries.
Files / components likely to be touched  
Orchestration logic, states, tests.
Dependencies  
User Stories 5–6.  
Validation & Done criteria  
- Tests: retry works from failure + invalid state rejection.  
- PR + code review.

### Release 3 — Structured medical data (stub)

#### User Story 8 — Convert text into standardized structured data
User Story statement  
As a user, I want medical information extracted into a standardized structure.
Goal  
Transform extracted text into schema-validated structured JSON.
Scope (In / Out)  
In: `StructuredMedicalRecord` schema v1, stub transformation, validation, persistence.  
Out: high-accuracy AI extraction, evidence enrichment.
Observable outcome  
Structured data is stored, schema-valid, and retrievable.
Internal implementation steps (technical chunks)  
- Define schema and persistence for structured artifact.  
- Implement stub transformer from text to schema fields.  
- Reject invalid outputs safely.
Files / components likely to be touched  
Schemas, transformer, persistence, tests.
Dependencies  
Release 2.  
Validation & Done criteria  
- Tests: valid structured output persists; invalid results are rejected.  
- PR + code review.

#### User Story 9 — Structured data organized and easy to scan
User Story statement  
As a user, I want structured medical information clearly organized.
Goal  
Ensure API output is grouped logically and readable.
Scope (In / Out)  
In: grouped fields (dates, diagnoses, treatments), exposed by `GET /documents/{id}`.  
Out: UX/UI polish, “smart summaries”.  
Observable outcome  
Document response is coherent and scannable.
Internal implementation steps (technical chunks)  
- Adjust schema/DTOs for logical grouping.  
- Stabilize format for future edits.
Files / components likely to be touched  
Schemas/DTOs, contract tests.  
Dependencies  
User Story 8.  
Validation & Done criteria  
- Tests: fixture asserts expected JSON shape and handles missing data.  
- PR + code review.

### Release 4 — Language detection & visibility

#### User Story 10 — Detect and expose language
User Story statement  
As a user, I want to support documents in different languages.
Goal  
Detect language, persist metadata, and expose it via API.
Scope (In / Out)  
In: minimal language detector, persist `detected_language`, include in retrieval responses.  
Out: translation or lang-specific pipelines.
Observable outcome  
Document response includes detected language; pipeline tolerates multiple languages.
Internal implementation steps (technical chunks)  
- Implement detection service (heuristic/lib).  
- Store language metadata in document record.  
- Include field in DTOs.
Files / components likely to be touched  
Language detection module, persistence, routes, tests.
Dependencies  
Release 2 (text) or Release 3 (structured).  
Validation & Done criteria  
- Tests: two languages covered + fallback for undetected.  
- PR + code review.

### Release 5 — Human-in-the-loop edits & revisions

#### User Story 11 — Edit structured medical information
User Story statement  
As a user, I want to edit structured medical information.
Goal  
Allow validated edits to structured data via API.
Scope (In / Out)  
In: `PUT /documents/{id}/structured-data`, schema validation, mark human edits distinctly.  
Out: permission layers, advanced editors.
Observable outcome  
PUT request updates structured data; invalid payloads are rejected.
Internal implementation steps (technical chunks)  
- Add PUT endpoint and schema validation.  
- Tag edits as human-sourced without overriding provenance.
Files / components likely to be touched  
Routes, schemas, persistence, tests.
Dependencies  
Release 3.  
Validation & Done criteria  
- Tests: valid edit accepted; invalid edit rejected with clear error.  
- PR + code review.

#### User Story 12 — Understand what changed (revision history)
User Story statement  
As a user, I want to understand what changed.
Goal  
Persist append-only revisions with before/after values and timestamps.
Scope (In / Out)  
In: revision records (`record_revisions`), append-only writes on PUT, expose history.  
Out: semantic diff UI.
Observable outcome  
Revision history is retrievable and shows before/after/timestamps.
Internal implementation steps (technical chunks)  
- Create revisions table.  
- Update PUT flow to insert revision entries.  
- Expose history via API.
Files / components likely to be touched  
Persistence, routes, tests.
Dependencies  
User Story 11.  
Validation & Done criteria  
- Tests: edit creates revision entry; history returns ordered records.  
- PR + code review.

### Release 6 — Evaluator readiness

#### User Story 13 — Run the system locally (Docker)
User Story statement  
As an evaluator, I want to run the system locally.
Goal  
Provide Docker-based execution instructions.
Scope (In / Out)  
In: Dockerfile(s), README run steps, optional docker-compose.  
Out: production-grade deployment.
Observable outcome  
Evaluator can follow README to run Docker and see API responding.
Internal implementation steps (technical chunks)  
- Containerize backend (and frontend if added).  
- Document run steps in README.  
- Validate health endpoint inside container.
Files / components likely to be touched  
`backend/Dockerfile`, optional `frontend/Dockerfile`, `docker-compose.yml`, README.
Dependencies  
Releases 0–5 complete.  
Validation & Done criteria  
- Manual: follow docs and run containerized service.  
- PR + code review.

#### User Story 14 — Run automated tests with a single command
User Story statement  
As an evaluator, I want to run automated tests easily.
Goal  
Document and standardize a single test command.
Scope (In / Out)  
In: single command (e.g. `pytest`), README entry.  
Out: CI pipeline.
Observable outcome  
Tests run with one documented command and explain coverage.
Internal implementation steps (technical chunks)  
- Define test runner invocation.  
- Add documentation to README.
Files / components likely to be touched  
Test config, README.
Dependencies  
Automated tests exist from earlier stories.  
Validation & Done criteria  
- Manual: documented command runs successfully.  
- PR + code review.

*Do not proceed with implementation until User Story 1 is approved.*

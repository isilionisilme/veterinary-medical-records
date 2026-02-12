# Note for readers
This document is intended to provide **implementation guidance for backend work** and to provide structured context to an AI Coding Assistant during implementation.

Reading order, document responsibilities, and precedence rules are defined in [`docs/README.md`](../README.md).

If any requirement here conflicts with a higher-precedence document, **STOP** and defer to the authority defined in the README.


## Purpose
This document translates the **authoritative system design** into backend implementation responsibilities, focusing on:
- backend module boundaries and layering
- persistence + filesystem responsibilities
- in-process processing runner + scheduler semantics
- API implementation wiring and enforcement of the authoritative contract
- logging and test expectations


## Scope

### In scope
- Implementation of the authoritative endpoint surface (as defined in Technical Design Appendix B3)
- Persistence model and invariants
- Filesystem storage responsibilities
- In-process asynchronous execution model
- Step-based processing tracked via persisted artifacts
- Centralized enforcement of the authoritative error contract
- Structured logging and event taxonomy
- Unit and integration testing expectations

## Running The Backend

Run instructions live in the repository root [`README.md`](../../README.md).


## Backend architecture

### Layering (mandatory)
Use a modular-monolith layered architecture:

- `domain`
  - entities/value objects/invariants
  - no imports from FastAPI or infrastructure
- `application`
  - use cases and orchestration
- `ports`
  - interfaces for repos, storage, and runner/scheduler
- `infrastructure`
  - SQLite repositories, filesystem adapter, runner/scheduler
- `api`
  - FastAPI routers, request/response models, error mapping

Rules:
- Domain logic MUST be independent from infrastructure.
- Persistence invariants MUST be enforced at the persistence layer (transactional), not in memory.


## Persistence model (SQLite)

### Minimum entities (authoritative)
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B2 (Minimal Persistent Data Model).

Implementation responsibility: provide repositories/adapters for:
- Document
- ProcessingRun
- Artifacts
- InterpretationVersion
- FieldChangeLog

### Document status derivation (authoritative)
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix A (Contracts, States & Invariants).

Implementation guidance:
- Implement status derivation as a pure domain rule (e.g., a function that maps “latest run summary” to a status).
- Do not store or mutate `Document.status`; it is derived.

### Run invariants (authoritative)
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix A2 + Appendix B1.2.

Implementation reminder: enforce invariants transactionally at the persistence layer; never via in-memory locks.

### SQLite guard pattern (authoritative)
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B1.2.1 (Persistence-Level Guard Pattern).

Implementation guidance:
- Encapsulate `BEGIN IMMEDIATE` + “check for RUNNING” + “transition to RUNNING” into a single repository method.
- Never perform the check and the transition in separate transactions (no partial transitions).


## Filesystem storage

### Deterministic paths (authoritative)
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B5 (Filesystem Management Rules).

Store the original upload under:
- `/storage/{document_id}/original{ext}`

Where `ext` is derived from the normalized file type.

### Run-scoped artifacts (implementation)
Define deterministic run artifact paths (minimum required):
- `RAW_TEXT`: `/storage/{document_id}/runs/{run_id}/raw-text.txt`

Note:
- Step artifacts (`artifact_type = STEP_STATUS`) are DB-resident JSON; no filesystem path is required for step tracking.

### Atomicity rules
- Writes must be atomic (write temp → rename).
- Upload endpoint must avoid partial persistence:
  - no DB row without filesystem artifact on success
  - no filesystem artifact without DB row on success

Implementation guidance (paired DB + filesystem writes):
1) Pre-generate IDs needed to compute deterministic final paths (e.g., `document_id`, `run_id`).
2) Write content to a temp file adjacent to the final path (`.tmp`), flush, `fsync`, then `os.replace` temp → final.
3) Wrap DB writes in a transaction and only `COMMIT` after the final filesystem rename succeeds.
4) On any failure, best-effort cleanup:
   - delete temp file,
   - roll back DB transaction,
   - if a final file was created but DB commit failed, delete the final file best-effort.
5) Never return success unless both DB state and final filesystem paths are present.

Environment knobs (current codebase):
- Storage root override: `VET_RECORDS_STORAGE_PATH`
- DB path override: `VET_RECORDS_DB_PATH`

### Missing artifacts
If DB references an artifact but the filesystem is missing, return:
- `410 Gone` with `error_code = ARTIFACT_MISSING`

Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B3.2 + Appendix B5.


## Processing execution model (in-process)

### Asynchronous behavior
- API requests MUST NOT block on processing completion.
- Processing runs in background, in-process (task runner / executor / internal loop).

### Scheduler semantics
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B1.5 + B1.5.1.

Implementation guidance:
- Use a fixed tick with sleep (no busy-loop).
- Treat scheduler execution as best-effort and never block API request handling.

### Runner lifecycle (implementation)
- Start the scheduler as a long-lived background task from FastAPI lifespan/startup.
- Store the task handle on `app.state` so shutdown can cancel it.
- Loop behavior:
  - on each tick, attempt to start eligible queued runs (per Appendix B1.5.1),
  - apply the persistence guard pattern for `QUEUED → RUNNING` (Appendix B1.2.1),
  - log best-effort scheduler/step events per Appendix A8.1.
- Shutdown behavior:
  - cancel the task and await best-effort for a clean exit.
- Avoid event-loop blocking:
  - if a step performs blocking I/O or CPU-heavy work (e.g., PDF parsing), run it off the event loop (threadpool) so requests remain responsive.

### Crash recovery (startup)
On application startup:
- Any run found in `RUNNING` is considered orphaned.
- Transition it to `FAILED` with `failure_type = PROCESS_TERMINATED`.
- Emit log event `RUN_RECOVERED_AS_FAILED`.

Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B1.3 + Appendix C3.

### Retry + timeout policy
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B1.4 + B1.4.1.

Implementation guidance:
- Retries are local to a single run and limited to the fixed default (no new runs).
- Timeouts transition the run to `TIMED_OUT` (terminal).
- Reprocessing always creates a **new** run.


## Step model 

### Step names (closed set)
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix C1.1 (StepName).

- `EXTRACTION`
- `INTERPRETATION`

### Step tracking via artifacts
Persist step lifecycle as append-only `Artifacts`:
- `artifact_type = STEP_STATUS`
- Payload schema is authoritative: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix C1.3.

### Failure mapping 
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix C3 (Error Codes and Failure Mapping).


## Structured interpretation schema 
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix D (Structured Interpretation Schema v0).
Product semantics for confidence are defined in [`docs/project/PRODUCT_DESIGN.md`](PRODUCT_DESIGN.md); UX behavior remains in [`docs/project/UX_DESIGN.md`](UX_DESIGN.md).

Alignment note:
- Interpretation output may be partial with respect to the full Global Schema v0 key universe.
- Backend does not backfill missing keys for presentation; frontend materializes the full schema view per Product Design authority.

### Storage contract
Authority:
- [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix D3 (Relationship to Persistent Model)
- [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B2.4 (InterpretationVersion)
- [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix A3 (Interpretation & Versioning Invariants)

Implementation responsibility:
- Store the structured interpretation JSON as `InterpretationVersion.data`.
- Any edit creates a new `InterpretationVersion` (append-only).
- Exactly one active interpretation version per run.

### Critical keys
`StructuredField.is_critical` MUST be derived from `key ∈ CRITICAL_KEYS_V0`.
Source of truth: [`docs/project/PRODUCT_DESIGN.md`](PRODUCT_DESIGN.md).

Backend responsibility:
- Apply deterministic derivation at write-time (or validate on write).
- Do not allow the model to decide criticality.


## API implementation 

### Authoritative API contracts (do not duplicate)
- Endpoint map: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B3 (+ B3.1)
- Run resolution per endpoint: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B3.1
- Error response format: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B2.6
- Endpoint error semantics & error codes: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B3.2

Implementation guidance (wiring and enforcement):
- Keep routers thin adapters: parse/validate → call an `application` use case → map to response schema.
- Centralize error handling so the Technical Design error contract is enforced by default:
  - Prefer a shared `AppError` type plus FastAPI exception handlers that emit `{error_code, message, details?}`.
  - Avoid per-route ad-hoc error payloads.
- When returning `409 CONFLICT`, ensure `details.reason` uses the Technical Design closed set (e.g., `NO_COMPLETED_RUN`, `REVIEW_BLOCKED_BY_ACTIVE_RUN`).

### Editing while active run exists 
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B3.2 (Conflict reasons and error semantics).

Implementation guidance:
- When a workflow is blocked by an active run, return the authoritative conflict response using `details.reason = REVIEW_BLOCKED_BY_ACTIVE_RUN`.


## Text extraction + language detection 

### PDF extraction
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) (PyMuPDF extraction).

Implementation note: if extracted text is empty/near-empty, the run may fail as `EXTRACTION_FAILED` (per Technical Design step failure mapping; Appendix C3).

### Language detection
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) (langdetect selection and rationale).

Implementation note: if detection fails, set `language_used = "unknown"` and continue best-effort.


## Logging (structured) 

Each log entry MUST include:
- `document_id`
- `run_id` (nullable only when not yet created)
- `step_name` (nullable)
- `event_type`
- `timestamp`
- `error_code` (nullable)

Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix A8.1 (Event Type Taxonomy).


## Testing expectations 
Authority: [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix B7 (Testability Expectations).

### Unit tests (minimum)
- `document_status` derivation from latest run state
- persistence guard: cannot produce two `RUNNING` runs for the same document
- interpretation versioning: append-only + single active version per run
- error mapping: stable `error_code` and `details.reason`

### Integration tests (minimum)
- upload → background processing → review view
- reprocess creates queued run; scheduler starts oldest; no parallel running
- crash recovery transitions orphaned RUNNING to FAILED with `PROCESS_TERMINATED`
- missing artifact returns 410 with `ARTIFACT_MISSING`


## STOP rule
If an implementation decision is not explicitly covered by:
- [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) (including appendices), or
- [`docs/project/IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) (scope and sequencing), or
- this document,

**STOP and clarify before implementing.** No implicit behavior is allowed.

# Note for readers:
This document is intended to provide structured context to an AI Coding Assistant during implementation.

The version of this document written for evaluators and reviewers is available here:
https://docs.google.com/document/d/16lgxuT48fA5ZCnEpR4rokl4hLbyM0yfTszlu6vHrHtM

Reading order and cross-document precedence are defined in `docs/README.md`.

# Technical Design — Instructions for Implementation

## Purpose

This document defines the **technical design, system contracts, and invariants** that must be followed when implementing the system.

Your goal is to **implement exactly this design**, respecting all constraints and decisions.
Do **not** add features, infrastructure, or abstractions that are not explicitly described.

If any requirement in this document cannot be satisfied, STOP and explain the blocker before proceeding.

---

## 1. System Overview (Technical)

The MVP is implemented as a **modular monolith** with an **explicit, observable, step-based processing pipeline**.

---

## 1.1 Deployment Model (Intent)

The system is implemented as a **modular monolith**.

- Logical boundaries must be preserved in code (modules, explicit interfaces).
- Domain logic must remain independent from infrastructure.
- The design must remain evolvable into independent services in the future.
- Do not introduce infrastructure complexity that is not strictly required for the MVP.

---

## 1.2 Logical Pipeline (Conceptual)

The implementation follows a logical pipeline (single-process, in-process execution) without introducing distributed infrastructure.

### Upload / Ingestion
- Receive veterinary documents.
- Generate a `document_id`.
- Persist basic document metadata.
- Ensure safe retry behavior on retries (no partial persistence).

### Text Extraction
- Extract raw text from documents.
- Attach standard metadata.
- Produce a canonical representation suitable for downstream processing.

### Interpretation
- Convert free text into a structured medical record.
- Attach basic confidence or evidence metadata where applicable.

### State Management
- Model explicit document lifecycle states.
- Persist all state transitions.
- Provide clear visibility into progress and failures.

### Human Review & Feedback
- Allow veterinarians to review and edit extracted fields.
- Capture all corrections as structured, append-only feedback.

---

## 1.3 Domain Model Overview (Conceptual)

The system is built around a small set of explicit, persistent domain concepts.  
All relevant domain concepts must be persisted to support auditability, traceability, and human-in-the-loop workflows.

Core concepts (conceptual overview):
- **Document**: submitted medical document with identity, metadata, lifecycle state, and raw file reference.
- **ProcessingRun / ProcessingStatus**: explicit lifecycle states representing progress through the pipeline.
- **ExtractedText**: extracted text with provenance and diagnostics.
- **StructuredMedicalRecord / InterpretationVersion**: schema-validated structured medical data.
- **FieldEvidence**: lightweight links between structured fields and their source (page/snippet).
- **RecordRevisions / FieldChangeLog**: append-only records of human edits.

This section provides conceptual orientation only.  
Authoritative contracts and invariants are defined in **Appendix A and Appendix B**.

---

## 1.4 Persistence Strategy (Intent)

Intent:  
Persist the **minimum set of artifacts** required to make the system debuggable, auditable, and safe for human-in-the-loop workflows.

Persistence moments:
- On ingestion: persist document metadata and initial lifecycle state.
- After each pipeline stage: persist produced artifacts and state transitions.
- On human edits: persist new append-only revisions; never overwrite silently.

Storage mapping and invariants are defined normatively in **Appendix B**.

---

## 1.5 Safety & Design Guardrails

- Do not collapse logical stages into opaque code paths.
- Do not bypass explicit state transitions.
- Do not silently merge machine-generated data with human-validated data.
- Prefer clarity and traceability over performance or abstraction.
- Preserve the ability to evolve this modular monolith into independent services.

Technical guardrails:
- Machine-produced structured outputs MUST be stored as run-scoped artifacts and MUST NOT overwrite prior artifacts.
- Structured interpretation outputs MUST conform to the schema in Appendix D (schema validation required).
- Human edits MUST create new interpretation versions (append-only) and MUST NOT be silently merged into machine output.
 

---

## 2. Architectural Constraints

- Implement a **modular monolith**.
- Use a layered architecture:
  - `domain`
  - `application`
  - `ports`
  - `infrastructure`
  - `api`
- Do **not** introduce:
  - microservices
  - message queues
  - distributed systems
  - external workers
- Prefer **explicit, readable code** over abstractions.

---

## 3. Processing Model

### 3.1 Pipeline

Document processing follows a **linear pipeline**:

1. Upload
2. Text extraction
3. Interpretation into structured data
4. Review & correction
5. Review completion

The pipeline is **observable** and **step-based**.

---

### 3.2 Asynchronous Execution

- Processing is **asynchronous** and runs in the background.
- API requests must **never block** waiting for processing to complete.
- Processing is executed internally (in-process worker or equivalent).
- No external queues or infrastructure are allowed.

---

### 3.3 Processing Runs

- Each processing attempt creates a **new processing run**.
- Processing runs are:
  - immutable
  - append-only
- A document may have many historical runs.

#### Active Run Rule
- **Only one processing run may be `RUNNING` per document at any time**.

- States:
  - `QUEUED`
  - `RUNNING`
  - `COMPLETED`
  - `FAILED`
  - `TIMED_OUT`

Multiple `QUEUED` runs may exist per document (append-only history).

If a reprocess is requested while a run is `RUNNING`:

- A new run is created in `QUEUED`
- It starts only after the `RUNNING` run finishes or times out
- `RUNNING` runs are **never cancelled**

---

## 4. Reprocessing Rules

- Reprocessing is **manual only** (explicit user action).
- The system must not automatically create new runs.
- Reprocessing:
  - creates a new processing run
  - never overwrites previous data
- Retries inside a run (e.g. transient step retry) are allowed, but must not create new runs.

---

## 5. Review & Editing Rules

UI and API MUST prevent conflicting edits while processing is active.
If a client attempts to edit/review while a `RUNNING` run exists, the API MUST respond with:
- `409 Conflict` (`error_code = CONFLICT`) and `details.reason = REVIEW_BLOCKED_BY_ACTIVE_RUN`.
 
---

## 6. Data Persistence Rules

### 6.1 General Principles

- Never overwrite extracted or structured data.
- All generated artifacts are versioned.
- History must be preserved for auditability.

---

### 6.2 Storage

- Primary database: **SQLite**
- Large artifacts (original uploaded files, raw extracted text):
  - stored in the filesystem
  - referenced from the database
- Use JSON columns where flexibility is required.

---

### 6.3 Structured Data & Versioning

- Structured interpretations are stored as **versioned records**.
- Any user edit creates a **new version**.
- Previous versions are retained.
- One interpretation version may be marked as:
  - `active`
- Structural changes (add/remove/rename field) set an internal `pending_review = true` flag (Appendix A3.2).
- Field-level change history must be tracked.

---

## 7. Confidence (Technical Contract)

- Each structured field MUST carry a `confidence` number in range 0–1 (see Appendix D).
- Confidence is a stored **attention signal** only.
- The meaning/governance of confidence in veterinarian workflows is defined in `docs/project/PRODUCT_DESIGN.md`.

---

## 8. Error Handling & States

- Failures must be explicit and classified:
  - `UPLOAD_FAILED`
  - `EXTRACTION_FAILED`
  - `INTERPRETATION_FAILED`
  - `PROCESS_TERMINATED` (crash/restart recovery only; Appendix B1.3)

- Document status must always reflect the **last known state**.
- Failed runs remain visible and auditable.
- Stuck runs must be detectable via timeout and transitioned to `TIMED_OUT`.

---

## 9. Observability (MVP Level)

### 9.1 Logging

The system must emit **structured logs** only.

Each log entry must include:
- `document_id`
- `run_id`
- `step_name` (if applicable)
- `event_type`
- `timestamp`
- `error_code` (if any)

Logs must be best-effort and must **never block processing**.

---

### 9.2 Future Observability (Not Implemented)

Metrics and persistent event tracing are **explicitly out of scope** for the MVP, but must be supported by design.

---

## 10. API Constraints

- The API is **internal only** in the MVP.
- No strict backward compatibility is required across releases at this stage.
- Formal versioning and public hardening are future concerns.

---

## 11. Explicit Non-Goals (MVP)

Do **not** implement:
- automatic layout evolution
- concurrent processing runs per document
- background auto-retries creating new runs
- model training or fine-tuning
- confidence-driven automation
- public API versioning
- data deletion or retention enforcement

---

## 12. Data Lifecycle & Compliance (Future Concern)

Data deletion and compliance are **not implemented** in the MVP.

However, the design assumes future support for:
- soft delete of documents
- hard purge of all related data (DB + filesystem)
- retention policies
- data export / DSAR

These concerns must be documented but not enforced.

---

## 13. Final Instruction

Follow:
- this document for **architecture and behavior**
- `IMPLEMENTATION_PLAN.md` for **scope and sequencing**

If any conflict exists, **STOP and ask for clarification**.

Do not extend the design.
Do not optimize prematurely.
Implement exactly what is described.

---
# Appendix A — Contracts, States & Invariants (Normative)

This appendix defines **system-wide, authoritative rules** for the MVP.  
If any conflict exists between this appendix and other documents (User Stories, Implementation Plan, examples), **this appendix takes precedence**.

Its purpose is to remove ambiguity for implementation (human or AI-assisted) and to prevent divergent interpretations.

---

## A1. State Model & Source of Truth

### A1.1 Processing Run State (authoritative)

Each `ProcessingRun` has exactly one state at any time:

- `QUEUED`
- `RUNNING`
- `COMPLETED`
- `FAILED`
- `TIMED_OUT`

**Rules**
- States are **append-only transitions** (no rollback).
- Only one run may be `RUNNING` per document.
- Runs are immutable once terminal (`COMPLETED`, `FAILED`, `TIMED_OUT`).

---

### A1.2 Document Status (derived, not stored)

`Document.status` is **derived**, never manually set.

Derivation rules:

| Condition                                   | Document Status |
|---------------------------------------------|-----------------|
| No processing run exists                    | `UPLOADED`      |
| Latest run is `QUEUED` or `RUNNING`         | `PROCESSING`    |
| Latest run is `COMPLETED`                   | `COMPLETED`     |
| Latest run is `FAILED`                      | `FAILED`        |
| Latest run is `TIMED_OUT`                   | `TIMED_OUT`     |

**Rule**
- Document status always reflects the **latest run**, not the latest completed run.

---

### A1.3 Review Status (human workflow only)

Review status is **independent** from processing.

Allowed values:
- `IN_REVIEW` (default)
- `REVIEWED`

**Rules**
- Stored at document level.
- Editing structured data automatically reverts `REVIEWED → IN_REVIEW`.
- Reprocessing does **not** change review status.
- Review status never blocks processing, editing, or governance.

---

### A1.4 Source of Truth Summary

| Concept              | Source of Truth            |
|---------------------|----------------------------|
| Processing progress | `ProcessingRun.state`      |
| Document lifecycle  | Derived from runs          |
| Human workflow      | `ReviewStatus`             |
| Interpretation data | Versioned interpretations |
| Governance          | Governance candidates/logs |

---

## A2. Processing Run Invariants

- Every processing attempt creates **exactly one** `ProcessingRun`.
- Runs are **append-only** and never overwritten.
- Artifacts (raw text, interpretations, confidence) are **run-scoped**.
- Reprocessing:
  - creates a new run,
  - never mutates previous runs or artifacts,
  - may remain `QUEUED` if another run is `RUNNING`.


---

## A3. Interpretation & Versioning Invariants

### A3.1 Structured Interpretations

- Interpretations are versioned records linked to a run.
- Any edit creates a **new interpretation version**.
- Previous versions are retained and immutable.
- Exactly one interpretation version is **active** at a time per run.

#### Active version invariant (Operational, normative)
- When creating a new InterpretationVersion for a run:
  - It MUST be done in a single transaction:
    1) set all previous versions for that `run_id` to `is_active = false`
    2) insert the new version with `is_active = true` and `version_number = previous_max + 1`
- At no point may two rows be active for the same `run_id`.

---

### A3.2 Field-Level Changes

- All edits produce field-level change log entries.
- Change logs are append-only.
- Structural changes (add/remove/rename field):
  - set internal `pending_review = true`,
  - do **not** affect veterinarian workflow.

---

## A4. Confidence Rules (MVP)

- Confidence is:
  - contextual,
  - conservative,
  - explainable.
- Confidence:
  - guides attention,
  - never blocks actions,
  - never implies correctness.
- Confidence updates:
  - are local,
  - are non-immediate,
  - never trigger automation in the MVP.

---

## A5. API Contract Principles

These principles apply to **all endpoints**:

- APIs are **internal** in the MVP.
- Contracts are explicit and deterministic.
- Responses always include enough context for the UI to explain:
  - current state,
  - latest run,
  - failure category (if any).
- No endpoint:
  - triggers implicit schema changes,
  - blocks veterinarian workflows.

### A5.1 Run Resolution Rule

- UI obtains `run_id` via document endpoints.
- “Latest completed run” is used for review.
- “Latest run” is used for status and processing visibility.

---

## A6. Concurrency & Idempotency Rules

- At most one `RUNNING` run per document is allowed (multiple `QUEUED` runs may exist).
- Guards must exist at persistence level (transactional or equivalent).
- Repeated user actions (upload, reprocess, mark reviewed):
  - must be safe to retry,
  - must not create inconsistent state.

---

## A7. Governance Invariants

- Governance operates **only at schema level**.
- Governance decisions:
  - never modify existing documents,
  - never trigger reprocessing implicitly,
  - apply prospectively only.
- All governance decisions are:
  - append-only,
  - auditable,
  - reviewer-facing only.

---

## A8. Audit & Observability Rules

- All critical actions emit structured logs.
- Logs:
  - include relevant identifiers (`document_id`, `run_id`, `candidate_id`),
  - are best-effort,
  - never block user flows.
- Audit trails (governance):
  - are immutable,
  - read-only,
  - stored separately from document data.

### A8.1 Event Type Taxonomy (Authoritative)

`event_type` must be one of the following values.

Run-level:
- `RUN_CREATED`
- `RUN_STARTED`
- `RUN_COMPLETED`
- `RUN_FAILED`
- `RUN_TIMED_OUT`
- `RUN_RECOVERED_AS_FAILED` (startup recovery of orphaned RUNNING runs)

Step-level:
- `STEP_STARTED`
- `STEP_SUCCEEDED`
- `STEP_FAILED`
- `STEP_RETRIED`

User actions:
- `DOCUMENT_UPLOADED`
- `REPROCESS_REQUESTED`
- `DOCUMENT_LANGUAGE_OVERRIDDEN`
- `MARK_REVIEWED`
- `INTERPRETATION_EDITED`

Reviewer actions:
- `GOVERNANCE_DECISION_RECORDED`
- `SCHEMA_VERSION_CREATED`

Rules:
- Structured logs remain best-effort and never block processing.
- Each log entry must include:
  - `document_id`
  - `run_id` (nullable only when not yet created)
  - `step_name` (nullable)
  - `event_type`
  - `timestamp`
  - `error_code` (nullable)


---

## A9. Explicit Non-Goals (Normative)

The MVP explicitly does **not** implement:

- automatic schema evolution,
- confidence-driven automation,
- blocking approvals for veterinarians,
- retroactive schema application,
- model training or fine-tuning,
- deletion or retention enforcement,
- public API hardening.

---

## A10. Final Rule

If a future feature, story, or implementation choice conflicts with any rule in this appendix:

**STOP.  
Clarify the conflict.  
Do not guess or infer behavior.**

This appendix is the final authority.

---

---
# Appendix B — Operational Clarifications (Normative)

This appendix adds **explicit operational and implementation-level clarifications** to the Technical Design Document.  
It does **not** introduce new features, infrastructure, or behavior.  
It exists solely to remove ambiguity and prevent implicit decisions during implementation.

If any conflict exists between this appendix and other documents, **Appendix A and this appendix take precedence**.

---

## B1. Asynchronous In-Process Processing Model (Authoritative)

### B1.1 Assumed Execution Model (MVP)

- Background processing is executed **in-process**, using:
  - a controlled background task runner (e.g. internal task loop or executor),
  - **no external queues, brokers, or services**.
- The MVP assumes a **single-process deployment**.
  - Multi-worker deployments are **out of scope** for the MVP.
  - The design must not rely on shared in-memory state across processes.

This choice prioritizes simplicity and debuggability over throughput.

---

### B1.2 Single `RUNNING` Run Guarantee

Definitions:
- A **running run** is a `ProcessingRun` in state `RUNNING`.

Rules:
- At most **one `RUNNING` run per document** is allowed.
- This invariant is enforced at the **persistence layer**, not in memory.
- Any attempt to create a new run when a `RUNNING` run exists must:
  - be accepted as a new run in `QUEUED` (append-only),
  - and will only start once no other run is `RUNNING` for that document.

No background worker may start a run without verifying this invariant.

---

### B1.2.1 Persistence-Level Guard Pattern (SQLite, Authoritative)

To enforce “at most one `RUNNING` run per document” in the MVP, run creation and run start transitions must follow a persistence-level guard pattern that prevents race conditions.

Definitions:
- A running run is a run with state `RUNNING`.

Pattern (normative):
- Create or start a run only under a write-locking transaction (e.g., `BEGIN IMMEDIATE` in SQLite).
- Under the same transaction scope:
  1) Query whether a `RUNNING` run exists for the target `document_id`.
  2) Apply the rules below.

Rules:
- Creating a run:
  - Always allowed to insert a new run in `QUEUED` (append-only history).
- Starting a run (`QUEUED → RUNNING`):
  - Allowed only if **no other run is `RUNNING`** for that `document_id` (multiple `QUEUED` runs may exist).
  - The check and the state transition must happen under the same lock/transaction scope.

No worker may transition a run to `RUNNING` without verifying these invariants at persistence level.

---


### B1.3 Crash & Restart Semantics

On application startup:
- Any run found in state `RUNNING` is considered **orphaned**.
- Orphaned runs must be transitioned to `FAILED` with `failure_type = PROCESS_TERMINATED`.

Rationale:
- Avoids “stuck” runs.
- Keeps the state machine monotonic and explainable.

---

### B1.4 Retry & Timeout Policy (MVP)

- Retries:
  - Are local to a single run.
  - Are limited to a small, fixed number (e.g. 1–2 retries).
  - Do not create new runs.
- Timeouts:
  - A run exceeding a fixed execution window transitions to `TIMED_OUT`.
  - `TIMED_OUT` is a terminal state.

Reprocessing always creates a **new run**.

### B1.4.1 Fixed defaults (Normative)
- Step retry limit: 2 attempts total (1 initial + 1 retry).
- Run timeout: 120 seconds wall-clock from `RUN_STARTED`.


---

### B1.5 In-Process Scheduler Semantics (Authoritative)

The MVP includes an in-process scheduler that periodically attempts to start queued runs.

Rules:
- Selection:
  - For each document, the scheduler must prefer the **oldest** `QUEUED` run (by creation time).
- Start condition:
  - A `QUEUED` run may start only if no run is `RUNNING` for that document.
- Transition:
  - The scheduler must apply the persistence guard pattern (B1.2.1) when transitioning `QUEUED → RUNNING`.
- Best-effort:
  - Scheduler execution is best-effort and must not block API requests.
  - Crash/restart relies on B1.3 (startup recovery) and future scheduler cycles.

---

### B1.5.1 Scheduler tick & fairness (Normative)
- The scheduler runs on a fixed tick (e.g. every 1s).
- On each tick, it attempts to start runs in FIFO order by `created_at`.
- It MUST NOT busy-loop; it sleeps between ticks.
- If a start attempt fails due to transient DB lock/contention, it logs `STEP_RETRIED` (or a dedicated scheduler event) and retries on the next tick.


## B2. Minimal Persistent Data Model (Textual ERD)

This section defines the **minimum required persistent entities** and invariants.
It is **not** a SQL schema, but an authoritative structural contract.

---

### B2.1 Document

**Purpose**: Represents an uploaded document.

Key fields:
- `document_id` (PK)
- `original_filename`
- `content_type`
- `file_size`
- `storage_path`
- `created_at`

Stored workflow fields:
- `review_status` (`IN_REVIEW | REVIEWED`)
- `language_override` (nullable; see B3.1 “Language override endpoint”)

Derived / external:
- `status` (derived; see Appendix A)

Invariants:
- A document must exist before any run.
- A document is never deleted in the MVP.

---

### B2.2 ProcessingRun

**Purpose**: Represents one processing attempt.

Key fields:
- `run_id` (PK)
- `document_id` (FK)
- `state`
- `started_at`
- `completed_at`
- `failure_type` (nullable)
- `language_used`
- `schema_version_used`

Invariants:
- Append-only.
- At most one `RUNNING` run per document (multiple `QUEUED` runs may exist).
- Terminal states are immutable.

---

### B2.3 Artifacts

**Purpose**: Stores run-scoped outputs (raw text, metadata).

Key fields:
- `artifact_id`
- `run_id` (FK)
- `artifact_type`
- `payload` (JSON or FS reference)
- `created_at`

Invariants:
- Artifacts are immutable.
- Artifacts are always linked to exactly one run.

#### ArtifactType (Closed Set, normative)
- `RAW_TEXT` (filesystem reference)
- `STEP_STATUS` (JSON payload; Appendix C)

---

### B2.4 InterpretationVersion

**Purpose**: Versioned structured interpretation.

Key fields:
- `interpretation_id`
- `run_id` (FK)
- `version_number`
- `data` (JSON)
- `created_at`
- `is_active`

Invariants:
- Append-only.
- Exactly one active version per run.

---

### B2.5 FieldChangeLog

**Purpose**: Captures human edits.

Key fields:
- `change_id`
- `interpretation_id`
- `field_path`
- `old_value`
- `new_value`
- `change_type`
- `created_at`

Invariants:
- Append-only.
- Never blocks veterinarian workflow.

---

#### B2.5.1 Field path format (Authoritative)
`field_path` MUST be stable across versions and MUST NOT rely on array indices.

Format (normative):
- `field_path = "fields.{field_id}.value"`

Notes:
- `field_id` refers to `StructuredField.field_id` in Appendix D.
- This allows a reviewer to trace changes even if the `fields[]` order changes between versions.
 
 ---

### B2.6 API Error Response Format & Naming Authority (Normative)

### API Error Response Format (Normative)
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

### API Naming Authority (Normative)
The authoritative endpoint map is defined in **Appendix B3 (+ B3.1)**.

If any user story lists different endpoint paths, treat them as non-normative examples and implement the authoritative map.

---

### B2.7 SchemaVersion (MVP, Authoritative)

**Purpose**: Stores the canonical schema versions used by new processing runs.

Key fields:
- `schema_version_id` (PK)
- `version_number` (monotonic integer)
- `schema_definition` (JSON)
- `created_at`
- `created_by` (reviewer identity)
- `change_summary` (nullable)

Invariants:
- Append-only; schema versions are immutable.
- “Current schema” is resolved as the schema version with the highest `version_number`.
- New processing runs MUST persist `schema_version_used` resolved at run creation time (B2.2).

---

### B2.8 StructuralChangeCandidate (MVP, Authoritative)

**Purpose**: Represents an aggregated, reviewer-facing candidate for schema evolution derived from repeated document-level edit patterns.

Key fields:
- `candidate_id` (PK)
- `change_type` (closed set; e.g. `NEW_KEY | KEY_RENAME | KEY_DEPRECATION | KEY_MAPPING`)
- `source_key` (nullable)
- `target_key`
- `occurrence_count`
- `status` (`PENDING | APPROVED | REJECTED | DEFERRED`)
- `created_at`
- `updated_at`
- `evidence_samples` (JSON; small, representative samples: page + snippet + optional document reference)

Invariants:
- Candidates are reviewer-facing only.
- Candidate details are never exposed in veterinarian workflows.
- Status changes MUST be traceable via append-only `GovernanceDecision` (B2.9).
- Candidate decisions apply prospectively only (Appendix A7).

---

### B2.9 GovernanceDecision (MVP, Authoritative)

**Purpose**: Append-only audit log of reviewer governance actions (schema evolution decisions).

Key fields:
- `decision_id` (PK)
- `candidate_id` (nullable)
- `decision_type` (closed set; `APPROVE | REJECT | DEFER | FLAG_CRITICAL`)
- `previous_status` (nullable)
- `new_status` (nullable)
- `schema_version_id` (nullable; present when approval creates a new schema version)
- `reviewer_id`
- `reason` (nullable)
- `created_at`

Invariants:
- Append-only and immutable.
- Stored separately from document-level data (Appendix A8).
- Reviewer actions never modify existing documents or trigger implicit reprocessing (Appendix A7).

---

## B3. Minimal API Endpoint Map (Authoritative)

This section defines the **minimum endpoint surface** for the MVP.

---

### Document-Level

- `POST /documents/upload`
  - Upload a document (PDF in MVP; additional file types post-MVP).
- `GET /documents`
  - List documents with derived status.
- `GET /documents/{id}`
  - Document metadata + latest run info.
- `GET /documents/{id}/download`
  - Download (and when supported, preview) the original uploaded file.
- `POST /documents/{id}/reprocess`
  - Create new processing run.
- `POST /documents/{id}/reviewed`
  - Mark as reviewed.
- `PATCH /documents/{id}/language`
  - Set or clear a document-level language override (affects subsequent runs only).
- `GET /documents/{id}/processing-history`
  - Read-only processing history (runs + step statuses).

### Supported upload types (Normative, MVP)

The system MUST accept only PDF uploads in the MVP:
- `.pdf`
- `application/pdf`

Rules:
- Any other content type MUST return:
  - HTTP 415
  - `error_code = UNSUPPORTED_MEDIA_TYPE`
- MIME type detection MUST be based on server-side inspection, not only filename.

### Post-MVP / future stories (file types)

DOCX and image support are intentionally out of scope for the MVP and are introduced later
as separate user stories (see `docs/project/IMPLEMENTATION_PLAN.md` Release 8: US-19 / US-20).

This section does not define their acceptance lists or behavior; those are deferred to the
post-MVP stories to avoid expanding MVP scope.

---

### Run / Review

- `GET /documents/{id}/review`
  - Returns:
    - latest completed run,
    - active interpretation,
    - confidence and evidence.
- `GET /runs/{run_id}/artifacts/raw-text`
  - Retrieve extracted text.
- `POST /runs/{run_id}/interpretations`
  - Apply veterinarian edits by creating a new interpretation version (append-only).

Rules:
- Status views use **latest run**.
- Review views use **latest completed run**.

---

### Reviewer / Governance (Reviewer-facing only)

- `GET /reviewer/structural-changes`
  - List pending structural change candidates.
- `POST /reviewer/structural-changes/{candidate_id}/decision`
  - Record a governance decision (approve/reject/defer).
- `GET /reviewer/schema/current`
  - Retrieve the current canonical schema version.
- `GET /reviewer/governance/audit-trail`
  - Retrieve append-only governance decision history.

---

### B3.1 Run Resolution per Endpoint (Authoritative)

- `GET /documents`
  Returns each document with:
  - derived `document_status` (from latest run; Appendix A),
  - `latest_run_id`, `latest_run_state` (nullable if none exists),
  - `latest_run_failure_type` (nullable),
  - `latest_run_language_used` (nullable),
  - `latest_run_schema_version_used` (nullable).

- `GET /documents/{id}`
  Returns:
  - document metadata,
  - derived `document_status`,
  - `latest_run` summary (id, state, timestamps, failure_type, language_used, schema_version_used).
  - `language_override` (nullable).

- `GET /documents/{id}/review`
  Resolves **latest completed run**:
  - if none exists, return an explicit error (e.g., 409) with reason `NO_COMPLETED_RUN`.
  
Rationale (authoritative):
- `/documents/{id}/review` is a derived “review view” that requires a completed run; if none exists yet, this is a **state conflict**, not a missing resource.

  Returns:
  - `latest_completed_run_id`,
  - active interpretation for that run,
  - confidence + evidence.

Rule:
- Status views always use **latest run**.
- Review views always use **latest completed run**.

#### Response shape (minimum, normative)
`GET /documents/{id}/review` returns:
- `document_id`
- `latest_completed_run`: { `run_id`, `state`, `completed_at`, `failure_type` }
- `active_interpretation`: { `interpretation_id`, `version_number`, `data` }
- `raw_text_artifact`: { `run_id`, `available`: boolean }  (do not inline raw text here)

---

### Processing history endpoint (minimum, normative)
`GET /documents/{id}/processing-history` returns:
- `document_id`
- `runs[]` ordered by `created_at` ascending (chronological)
  - `run_id`
  - `state`
  - `failure_type` (nullable)
  - `started_at` (nullable)
  - `completed_at` (nullable)
  - `steps[]` (derived from STEP_STATUS artifacts; Appendix C)
    - `step_name`
    - `step_status`
    - `attempt`
    - `started_at` (nullable)
    - `ended_at` (nullable)
    - `error_code` (nullable)

Rules:
- Read-only; does not introduce actions.
- Uses persisted artifacts as the source of truth (Appendix C4).

---

### Language override endpoint (minimum, normative)
`PATCH /documents/{id}/language`:
- Request body:
  - `language_override` (string ISO 639-1 like `"en"`, or `null` to clear)
- Response body includes:
  - `document_id`
  - `language_override` (nullable)

Rules:
- Does not trigger processing or reprocessing.
- Affects only **new** runs created after the override is set.
- Must not block review or editing workflows.

---

### Interpretation edit endpoint (minimum, normative)
`POST /runs/{run_id}/interpretations` creates a new, active interpretation version for the run (append-only).

Request body (minimum):
- `base_version_number` (integer; must match the currently active version number)
- `changes[]`
  - `op` (`ADD | UPDATE | DELETE`)
  - `field_id` (uuid; required for `UPDATE | DELETE`)
  - `key` (string; required for `ADD`)
  - `value` (string|number|boolean|null; required for `ADD | UPDATE`)
  - `value_type` (string; required for `ADD | UPDATE`)

Response body (minimum):
- `run_id`
- `interpretation_id`
- `version_number` (new active version number)
- `data` (Structured Interpretation Schema v0; Appendix D)

Rules:
- Human edits MUST produce `origin = "human"` fields (Appendix D) and append `FieldChangeLog` entries (B2.5).
- This endpoint never mutates existing interpretation versions (Appendix A3).

---

### Reviewer governance endpoints (minimum, normative)

`GET /reviewer/structural-changes` returns:
- `items[]`
  - `candidate_id`
  - `change_type`
  - `source_key` (nullable)
  - `target_key`
  - `occurrence_count`
  - `status`
  - `evidence_samples` (JSON; page + snippet + optional document reference)
  - `created_at`
  - `updated_at`

`POST /reviewer/structural-changes/{candidate_id}/decision`:
- Request body (minimum):
  - `decision_type` (`APPROVE | REJECT | DEFER | FLAG_CRITICAL`)
  - `reason` (nullable)
- Response body (minimum):
  - `decision_id`
  - `candidate_id` (nullable)
  - `decision_type`
  - `schema_version_id` (nullable)
  - `created_at`

`GET /reviewer/schema/current` returns:
- `schema_version_id`
- `version_number`
- `created_at`
- `change_summary` (nullable)

`GET /reviewer/governance/audit-trail` returns:
- `items[]` ordered by `created_at` ascending
  - `decision_id`
  - `candidate_id` (nullable)
  - `decision_type`
  - `schema_version_id` (nullable)
  - `reviewer_id`
  - `reason` (nullable)
  - `created_at`


---

## B3.2 Endpoint error semantics & error codes (Normative)

This section defines **stable HTTP semantics** and `error_code` values for the MVP.
It prevents user stories from redefining per-endpoint behavior.

### Error response format (Authoritative)
All error responses MUST follow Appendix **B2.6**:

- `error_code` (stable enum for frontend branching)
- `message` (safe for user display)
- `details` (optional object; must not expose secrets or filesystem paths)

### Common HTTP statuses (MVP)

- `400 Bad Request`
  - Invalid request body, missing required fields, invalid parameters.
  - `error_code`: `INVALID_REQUEST`

- `404 Not Found`
  - Document or run does not exist.
  - `error_code`: `NOT_FOUND`

- `409 Conflict`
  - Request is valid, but cannot be fulfilled due to current state.
  - Examples:
    - Review requested but no completed run exists.
    - Attempt to edit when blocked by a `RUNNING` run (if applicable).
  - `error_code`: `CONFLICT`, plus a specific reason in `details.reason`.
  - Specific reasons (closed set):
    - `NO_COMPLETED_RUN`
    - `REVIEW_BLOCKED_BY_ACTIVE_RUN`
    - `RAW_TEXT_NOT_READY`
    - `RAW_TEXT_NOT_AVAILABLE`
    - `STALE_INTERPRETATION_VERSION`

- `410 Gone`
  - Persistent reference exists, but the underlying filesystem artifact is missing.
  - Applies to file downloads and raw text retrieval when stored in filesystem.
  - `error_code`: `ARTIFACT_MISSING`

- `413 Payload Too Large`
  - Upload exceeds size limit.
  - `error_code`: `FILE_TOO_LARGE`

- `415 Unsupported Media Type`
  - Unsupported upload type.
  - `error_code`: `UNSUPPORTED_MEDIA_TYPE`

- `500 Internal Server Error`
  - Unhandled exception or unexpected system failure.
  - `error_code`: `INTERNAL_ERROR`

### Notes
- Frontend MUST branch on `error_code` (and optional `details.reason`) only.
- User stories may list example error cases, but must not redefine these semantics.
- Upload type support is defined in Appendix B3 (“Supported upload types (Normative, MVP)”).


### Upload size limit (Normative)
- Maximum upload size: 20 MB (MVP default).
- Exceeding the limit returns:
  - HTTP 413
  - `error_code = FILE_TOO_LARGE`

### GET /runs/{run_id}/artifacts/raw-text (Normative)
Returns:
- `run_id`
- `artifact_type = RAW_TEXT`
- `content_type = text/plain`
- `text` (string)

Errors:
- 404 NOT_FOUND if run does not exist
- 409 CONFLICT with `details.reason = RAW_TEXT_NOT_READY` if run exists but extraction artifact is not produced yet
- 409 CONFLICT with `details.reason = RAW_TEXT_NOT_AVAILABLE` if extraction failed or no raw-text artifact exists for the run
- 410 ARTIFACT_MISSING if the artifact reference exists but filesystem content is missing

### POST /runs/{run_id}/interpretations (Normative)
Errors (minimum):
- 404 NOT_FOUND if run does not exist
- 409 CONFLICT with `details.reason = REVIEW_BLOCKED_BY_ACTIVE_RUN` if the run is currently `RUNNING`
- 409 CONFLICT with `details.reason = STALE_INTERPRETATION_VERSION` if the client’s base version is not the active version

---

## B4. Idempotency & Safe Retry Rules (Authoritative)

The following actions must be safe to retry:
- Upload
- Reprocess
- Mark reviewed

Mechanisms:
- Persistence-level guards (see B1.2.1).
- Explicit checks for invariants (single `RUNNING` run rule + run-start guard).
- No reliance on client-provided idempotency keys in the MVP.

“Safe to retry” means:
- Retrying does not corrupt state.
- Retrying may create additional append-only records (where specified), but must never produce inconsistent state.

### B4.1 Endpoint Semantics

**POST /documents/upload**
- Retrying may create a new document (no deduplication in MVP).
- The system must avoid partial persistence:
  - no DB row without filesystem artifact on success,
  - no filesystem artifact without DB row on success.

**POST /documents/{id}/reprocess**
- Always creates a new `ProcessingRun` in `QUEUED`.
- Retrying may create multiple queued runs. This is acceptable in MVP.
- The system must remain consistent:
  - runs are append-only,
  - only one run may be `RUNNING` per document at any time.

**POST /documents/{id}/reviewed**
- Idempotent:
  - if already `REVIEWED`, return success without change,
  - if `IN_REVIEW`, set to `REVIEWED`.

Non-negotiable invariant:
- The system must never end up with two runs `RUNNING` for the same document, regardless of retries.


---

## B5. Filesystem Management Rules

- Files are stored under deterministic paths:
  - `/storage/{document_id}/original.pdf` (MVP)

Post-MVP note:
- Additional extensions may be introduced when non-PDF file types are added (US-19 / US-20).

  
- Writes must be atomic.
- DB persistence must complete **before** returning success.
- Temporary files must be cleaned up on failure.

Inconsistencies:
- FS exists, DB missing → treat as invalid artifact.
- DB exists, FS missing → surface explicit error on access.

No background cleanup is required in the MVP.

---

## B6. Blocking Rules (Normative)

The following **never block veterinarians**:
- Pending review
- Low confidence
- Failed processing
- Schema governance

Only explicit user actions change review state.

---

## B7. Testability Expectations (MVP)

Expected test layers:
- Unit tests:
  - state transitions,
  - derivation rules,
  - idempotency guards.
- Integration tests:
  - upload → process → review path,
  - reprocessing behavior,
  - crash recovery behavior.

Out of scope:
- Performance testing
- Load testing
- Chaos testing

---

## Final Rule

If an implementation decision is not explicitly covered by:
- the main Technical Design,
- Appendix A,
- or this appendix,

**STOP and clarify before implementing.**

No implicit behavior is allowed.

---

# Appendix C — Step Model & Run Execution Semantics (Normative)

This appendix makes the “step-based pipeline” explicit without adding infrastructure or new required entities.
It uses run-scoped artifacts (Appendix B2.3) to track step lifecycle.

If any conflict exists, Appendix A, Appendix B, and this appendix take precedence.

---

## C1. Processing Step Model (Authoritative)

A `ProcessingRun` is executed as a sequence of steps. Step state is tracked as **run-scoped artifacts**:
- `artifact_type = STEP_STATUS`
- `payload` is JSON (schema below)

### C1.1 StepName (Closed Set)
- `EXTRACTION`
- `INTERPRETATION`

### C1.2 StepStatus (Closed Set)
- `NOT_STARTED`
- `RUNNING`
- `SUCCEEDED`
- `FAILED`

### C1.3 Step Artifact Payload (JSON)
Must include:
- `step_name` (StepName)
- `step_status` (StepStatus)
- `attempt` (integer, starts at 1)
- `started_at` (nullable)
- `ended_at` (nullable)
- `error_code` (nullable)
- `details` (nullable; small JSON)

### C1.4 Append-Only Rule
- Step changes are append-only: each update is a new artifact record.
- The “current step status” is derived from the latest `STEP_STATUS` artifact for that `step_name`.

---

## C2. Run State Derivation from Steps (Authoritative)

Rules:
- A run is `RUNNING` if any required step is `RUNNING`.
- A run is `FAILED` if any required step ends `FAILED`.
- A run is `COMPLETED` only if all required steps end `SUCCEEDED`.
- Timeouts transition the run to `TIMED_OUT` (terminal) regardless of step statuses.

---

## C3. Error Codes and Failure Mapping (Authoritative)

- `error_code` is step-level and recorded in the step artifact.
- `failure_type` is run-level and recorded on the run.

Mapping:
- Step `EXTRACTION` failure → run `failure_type = EXTRACTION_FAILED`
- Step `INTERPRETATION` failure → run `failure_type = INTERPRETATION_FAILED`
- Startup recovery orphaned `RUNNING` → run terminal failure with reason `PROCESS_TERMINATED`
  - Log `RUN_RECOVERED_AS_FAILED`

Rule:
- Step artifacts never overwrite previous artifacts.
- Terminal run states are immutable.

---

## C4. Relationship between Step Artifacts and Logs (Normative)
- Step artifacts (`artifact_type = STEP_STATUS`) are the source of truth for step state.
- Structured logs emit corresponding `STEP_*` events best-effort.
- If logs and artifacts disagree, artifacts win.

---

# Appendix D — Structured Interpretation Schema (v0) (Normative)

This appendix defines the **authoritative minimum JSON schema** for structured interpretations in the MVP.
It exists to remove ambiguity for implementation (especially AI-assisted coding) and to support:
- **Review in context** (US-07)
- **Editing with traceability** (US-08)

If any conflict exists, **Appendix A, Appendix B, Appendix C, and this appendix take precedence**.

## D1. Scope and Design Principles

This is a deliberately small MVP contract, **not a full medical ontology**.

- **Assistive, not authoritative**: outputs are explainable and editable.
- **Non-blocking**: confidence and governance never block veterinarians.
- **Run-scoped & append-only**: nothing is overwritten; every interpretation belongs to a processing run.
- **Approximate evidence**: page + snippet; no PDF coordinates in v0.
- **Flat structure (v0)**: optimize for flexibility and speed, not completeness.

## D2. Versioning

- `schema_version` is a string. Current value: `"v0"`.
- Future versions must be explicit and intentional.
- Additive changes are preferred; breaking changes require a new version.

## D3. Relationship to Persistent Model (Authoritative)

The JSON object defined in this appendix is stored as the `data` payload of `InterpretationVersion` (Appendix B2.4).

## D4. Top-Level Object: StructuredInterpretation (JSON)

```json
{
  "schema_version": "v0",
  "document_id": "uuid",
  "processing_run_id": "uuid",
  "created_at": "2026-02-05T12:34:56Z",
  "fields": []
}
```

| Field | Type | Required | Notes |
|---|---|---:|---|
| schema_version | string | ✓ | Always `"v0"` |
| document_id | uuid | ✓ | Convenience for debugging |
| processing_run_id | uuid | ✓ | Links to a specific processing attempt |
| created_at | ISO 8601 string | ✓ | Snapshot creation time |
| fields | array of `StructuredField` | ✓ | Flat list of structured fields |

## D5. StructuredField (Authoritative)

A single extracted or edited data point with confidence and optional evidence.

```json
{
  "field_id": "uuid",
  "key": "pet_name",
  "value": "Luna",
  "value_type": "string",
  "confidence": 0.82,
  "is_critical": true,
  "origin": "machine",
  "evidence": { "page": 2, "snippet": "Patient: Luna" }
}
```

**Field identity rule (Authoritative)**
- `field_id` identifies a **specific field instance**, not a conceptual slot.
- Human edits create new interpretation versions (Appendix A3.1) and are tracked via `FieldChangeLog` (Appendix B2.5).

| Field | Type | Required | Notes |
|---|---|---:|---|
| field_id | uuid | ✓ | Stable identifier for this field instance |
| key | string | ✓ | Lowercase `snake_case` |
| value | string \| number \| boolean \| null | ✓ | Dates stored as ISO strings |
| value_type | `"string"` \| `"number"` \| `"boolean"` \| `"date"` \| `"unknown"` | ✓ | Explicit typing |
| confidence | number (0–1) | ✓ | Attention signal only |
| is_critical | boolean | ✓ | Derived: `key ∈ CRITICAL_KEYS_V0` (Appendix D7.4) |
| origin | `"machine"` \| `"human"` | ✓ | Distinguishes machine output vs human edits |
| evidence | `Evidence` | ✗ | Optional; expected for machine output when available |

## D6. Evidence (Approximate by Design)

```json
{ "page": 2, "snippet": "Patient: Luna" }
```

| Field | Type | Required | Notes |
|---|---|---:|---|
| page | integer | ✓ | 1-based page index |
| snippet | string | ✓ | Short excerpt shown to the user |

## D7. Semantics & Rules (Authoritative)

### D7.1 Confidence
- Confidence never blocks: editing, marking reviewed, or accessing data.
- UI may render qualitatively (e.g., low / medium / high).

### D7.2 Multiple Values
Repeated concepts (e.g., medications) are represented by multiple fields with the same `key` and different `field_id`s.

### D7.3 Governance (Future-Facing)
Structural changes (new keys, key remapping) may later be marked as pending review for schema evolution.
This is never exposed or actionable in veterinarian-facing workflows in the MVP.

### D7.4 Critical Concepts (Authoritative)

Derivation (authoritative):
- `StructuredField.is_critical = (StructuredField.key ∈ CRITICAL_KEYS_V0)`

Rules (technical, authoritative):
- `is_critical` MUST be derived from the field key (not model-decided).
- `CRITICAL_KEYS_V0` is a closed set (no heuristics, no model output).
- This designation MUST NOT block workflows; it only drives UI signaling and internal flags.

Source of truth for `CRITICAL_KEYS_V0`:
- Defined in `docs/project/PRODUCT_DESIGN.md` (product authority).

---

## D8. Example (Multiple Fields)

```json
{
  "schema_version": "v0",
  "document_id": "doc-123",
  "processing_run_id": "run-456",
  "created_at": "2026-02-05T12:34:56Z",
  "fields": [
    {
      "field_id": "f1",
      "key": "pet_name",
      "value": "Luna",
      "value_type": "string",
      "confidence": 0.82,
      "is_critical": true,
      "origin": "machine",
      "evidence": { "page": 2, "snippet": "Patient: Luna" }
    },
    {
      "field_id": "f2",
      "key": "pet_name",
      "value": "Luna",
      "value_type": "string",
      "confidence": 1.0,
      "is_critical": true,
      "origin": "human"
    }
  ]
}
```

---

# Appendix E — Minimal Libraries for PDF Text Extraction & Language Detection (Normative)

This appendix closes the minimum dependency decisions required to implement:
- Text extraction (step `EXTRACTION`, Appendix C),
- Language detection (persisted as `ProcessingRun.language_used`, Appendix B2.2).

If any conflict exists, Appendix A and Appendix B take precedence for invariants and persistence rules.

## E1. PDF Text Extraction (MVP)

Decision (Authoritative):
- Use **PyMuPDF** (`pymupdf`, imported as `fitz`) as the sole PDF text extraction library in the MVP.

Rationale:
- Good text extraction quality for “digital text” PDFs.
- Fast and simple to integrate in an in-process worker.
- Keeps the dependency surface small (single primary extractor).

Explicit non-goals (MVP):
- OCR for scanned PDFs is out of scope.
- If a PDF is scanned and yields empty/near-empty extracted text, the run may fail as `EXTRACTION_FAILED`.

## E2. Language Detection (MVP)

Decision (Authoritative):
- Use **langdetect** as the language detection library.

Rationale:
- Lightweight dependency sufficient for MVP.
- Provides deterministic-enough output to populate `ProcessingRun.language_used`.

Rules:
- Language detection is best-effort and must never block processing.
- If detection fails, `language_used` is set to `"unknown"` (or equivalent) and processing continues.

## E3. Dependency Justification (Repository Requirement)

The repository must include a short justification (e.g., in `README.md` or an ADR) explaining:
- Why PyMuPDF was chosen for extraction,
- Why langdetect was chosen for language detection,
- What is explicitly out of scope (OCR for scanned PDFs).

## E4. Image OCR (Post-MVP candidate)

Decision (Authoritative):
- Use **Tesseract OCR** (system binary `tesseract`) for OCR of supported image uploads (`.png`, `.jpg`, `.jpeg`).

Rationale:
- Mature, widely available OCR engine.
- Keeps Python dependencies lightweight (wrapper only).

Rules:
- Image uploads are post-MVP; OCR is therefore out of MVP scope.
- This section documents a recommended approach to implement image processing when US-20 is taken.

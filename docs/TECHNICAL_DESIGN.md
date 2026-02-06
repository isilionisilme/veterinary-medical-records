# Note for readers:
This document is intended to provide structured context to an AI Coding Assistant during implementation.

The version of this document written for evaluators and reviewers is available here:
https://docs.google.com/document/d/16lgxuT48fA5ZCnEpR4rokl4hLbyM0yfTszlu6vHrHtM

# Technical Design — Instructions for Implementation

## Purpose

This document defines the **technical design and constraints** that must be followed when implementing the system.

It complements `IMPLEMENTATION_PLAN.md` and is **mandatory reading** for the AI Coding Assistant.

Your goal is to **implement exactly this design**, respecting all constraints and decisions.
Do **not** add features, infrastructure, or abstractions that are not explicitly described.

If any requirement in this document cannot be satisfied, STOP and explain the blocker before proceeding.

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
- **Only one processing run may be active per document at any time**.
- States:
  - `QUEUED`
  - `RUNNING`
  - `COMPLETED`
  - `FAILED`
  - `TIMED_OUT`

If a reprocess is requested while a run is active:
- A new run is created in `QUEUED`
- It starts only after the active run finishes or times out
- Active runs are **never cancelled**

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

- **Human review is blocked while a processing run is active**.
- Review and edits are allowed **only when no run is active**.
- This avoids conflicts between system-generated data and human edits.

---

## 6. Data Persistence Rules

### 6.1 General Principles

- Never overwrite extracted or structured data.
- All generated artifacts are versioned.
- History must be preserved for auditability.

---

### 6.2 Storage

- Primary database: **SQLite**
- Large artifacts (PDFs, raw extracted text):
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

## 7. Confidence & Learning Signals

- Each structured field carries a **confidence score**.
- Confidence is:
  - contextual
  - conservative
  - explainable
- Confidence **does not mean correctness**.
- User corrections generate **learning signals**.
- Learning signals:
  - must be stored
  - must **not** change global system behavior in the MVP

---

## 8. Error Handling & States

- Failures must be explicit and classified:
  - `UPLOAD_FAILED`
  - `EXTRACTION_FAILED`
  - `INTERPRETATION_FAILED`
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
- Contracts are best-effort and may evolve.
- No strict backward compatibility is required at this stage.
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
  - may queue if another run is active.

---

## A3. Interpretation & Versioning Invariants

### A3.1 Structured Interpretations

- Interpretations are versioned records linked to a run.
- Any edit creates a **new interpretation version**.
- Previous versions are retained and immutable.
- Exactly one interpretation version is **active** at a time per run.

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

- Only one active run per document is allowed.
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
- `MARK_REVIEWED`
- `INTERPRETATION_EDITED`

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

### B1.2 Single Active Run Guarantee

Definitions:
- An **active run** is a `ProcessingRun` in state `QUEUED` or `RUNNING`.

Rules:
- At most **one active run per document** is allowed.
- This invariant is enforced at the **persistence layer**, not in memory.
- Any attempt to create a new run when an active run exists must:
  - either fail explicitly,
  - or enqueue logically (by remaining `QUEUED`) until the active run reaches a terminal state.

No background worker may start a run without verifying this invariant.

---

### B1.2.1 Persistence-Level Guard Pattern (SQLite, Authoritative)

To enforce “at most one active run per document” in the MVP, run creation and run start transitions must follow a persistence-level guard pattern that prevents race conditions.

Definitions:
- An active run is a run with state `QUEUED` or `RUNNING`.

Pattern (normative):
- Create or start a run only under a write-locking transaction (e.g., `BEGIN IMMEDIATE` in SQLite).
- Under the same transaction scope:
  1) Query whether an active run exists for the target `document_id`.
  2) Apply the rules below.

Rules:
- Creating a run:
  - Always allowed to insert a new run in `QUEUED` (append-only history).
- Starting a run (`QUEUED → RUNNING`):
  - Allowed only if **no other run is `RUNNING`** for that `document_id`.
  - The check and the state transition must happen under the same lock/transaction scope.

No worker may transition a run to `RUNNING` without verifying these invariants at persistence level.

---


### B1.3 Crash & Restart Semantics

On application startup:
- Any run found in state `RUNNING` is considered **orphaned**.
- Orphaned runs must be transitioned to `FAILED` with reason `PROCESS_TERMINATED`.

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

Derived / external:
- `status` (derived; see Appendix A)
- `review_status` (`IN_REVIEW | REVIEWED`)

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
- Exactly one active run per document.
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

## B3. Minimal API Endpoint Map (Authoritative)

This section defines the **minimum endpoint surface** for the MVP.

---

### Document-Level

- `POST /documents`
  - Upload document.
- `GET /documents`
  - List documents with derived status.
- `GET /documents/{id}`
  - Document metadata + latest run info.
- `POST /documents/{id}/reprocess`
  - Create new processing run.
- `POST /documents/{id}/reviewed`
  - Mark as reviewed.

---

### Run / Review

- `GET /documents/{id}/review`
  - Returns:
    - latest completed run,
    - active interpretation,
    - confidence and evidence.
- `GET /runs/{run_id}/artifacts/raw-text`
  - Retrieve extracted text.

Rules:
- Status views use **latest run**.
- Review views use **latest completed run**.

---

### B3.1 Run Resolution per Endpoint (Authoritative)

- `GET /documents`
  Returns each document with:
  - derived `document_status` (from latest run; Appendix A),
  - `latest_run_id`, `latest_run_state` (nullable if none exists).

- `GET /documents/{id}`
  Returns:
  - document metadata,
  - derived `document_status`,
  - `latest_run` summary (id, state, timestamps, failure_type).

- `GET /documents/{id}/review`
  Resolves **latest completed run**:
  - if none exists, return an explicit error (e.g., 409) with reason `NO_COMPLETED_RUN`.
  Returns:
  - `latest_completed_run_id`,
  - active interpretation for that run,
  - confidence + evidence.

Rule:
- Status views always use **latest run**.
- Review views always use **latest completed run**.

---

## B4. Idempotency & Safe Retry Rules (Authoritative)

The following actions must be safe to retry:
- Upload
- Reprocess
- Mark reviewed

Mechanisms:
- Persistence-level guards (see B1.2.1).
- Explicit checks for invariants (single active/run-start rule).
- No reliance on client-provided idempotency keys in the MVP.

“Safe to retry” means:
- Retrying does not corrupt state.
- Retrying may create additional append-only records (where specified), but must never produce inconsistent state.

### B4.1 Endpoint Semantics

**POST /documents**
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
  - `/storage/{document_id}/original.pdf`
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

### D7.4 Critical Concepts (US-17, Authoritative)

Some fields are designated as critical concepts in the MVP for US-17.

Rules:
- is_critical is derived from the field key (not model-decided).
- A field is critical if and only if key belongs to the closed set CRITICAL_KEYS_V0.
- This designation never blocks workflows; it only drives UI signaling and internal flags.

Closed set (v0):
- pet_name
- species
- visit_date
- invoice_total

Derivation:
- StructuredField.is_critical = (StructuredField.key ∈ CRITICAL_KEYS_V0)

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
- What is explicitly out of scope (OCR).
# Backend Implementation (MVP) — Implementation-Only

## 1. Purpose & Scope
This document owns backend **implementation details** only:
- stack + minimal dependencies
- package/module boundaries and wiring
- SQLite + filesystem implementation rules (atomicity + failure handling)
- in-process scheduler/runner implementation (startup, polling, guard pattern, crash recovery)
- backend testing strategy (minimum suite and critical flows)

This document does **not** redefine authoritative contracts. It references:
- Architecture / invariants / states / step semantics / error contract / endpoint map:
  - `docs/project/TECHNICAL_DESIGN.md` (primary; especially Appendix A, B, C, D)
- Scope + sequencing + acceptance criteria:
  - `docs/project/IMPLEMENTATION_PLAN.md`
- Product meaning and UX contract:
  - `docs/project/PRODUCT_DESIGN.md`
  - `docs/project/UX_DESIGN.md`

The MVP is PDF-only. Run instructions live in the repository root `README.md`.


## 2. Stack & Dependencies
Runtime:
- Python (target version per repo tooling)
- FastAPI + Uvicorn (HTTP server)
- SQLite via Python stdlib `sqlite3` (no ORM in MVP)
- Local filesystem storage (original uploads + large artifacts)

HTTP / testing support:
- `python-multipart` (uploads)
- `httpx` (FastAPI test client dependency)
- `pytest` (backend test runner)

Pipeline libraries (mandated by Technical Design; do not substitute):
- PDF extraction: PyMuPDF (`pymupdf` / `fitz`) — `docs/project/TECHNICAL_DESIGN.md` Appendix E
- Language detection: `langdetect` — `docs/project/TECHNICAL_DESIGN.md` Appendix E

Non-dependencies (by design, MVP constraint):
- No external queue/broker/worker service — `docs/project/TECHNICAL_DESIGN.md` Appendix B1
- No multi-process coordinator / distributed locks


## 3. Module / Package Architecture
Implement a modular monolith with strict layering:
- `backend/app/domain/`
  - pure models + derivation rules (no FastAPI / sqlite / filesystem imports)
  - authoritative state/derivation rules live in `docs/project/TECHNICAL_DESIGN.md` Appendix A + Appendix C
- `backend/app/application/`
  - use cases (upload, reprocess, read artifacts, create interpretation versions, mark reviewed)
  - orchestration across repositories + filesystem + runner
- `backend/app/ports/`
  - interfaces/protocols for persistence + file storage + runner orchestration
- `backend/app/infra/`
  - SQLite repositories + schema bootstrap
  - filesystem adapter
  - scheduler/runner implementation
- `backend/app/api/`
  - FastAPI routers + schemas (thin adapters only)
- `backend/app/main.py`
  - composition root: instantiate adapters, attach to `app.state`, register routers and exception handlers
  - FastAPI lifespan hook starts crash recovery + scheduler task (Section 5)

Layering rules:
- Domain logic MUST remain infrastructure-independent.
- Persistence invariants MUST be enforced transactionally at the persistence layer (not in-memory locks).


## 4. Persistence Implementation
Authority (do not duplicate):
- Minimal persistent model: `docs/project/TECHNICAL_DESIGN.md` Appendix B2
- State model + derivations: `docs/project/TECHNICAL_DESIGN.md` Appendix A1 + Appendix C2
- Single `RUNNING` run invariant + guard pattern: `docs/project/TECHNICAL_DESIGN.md` Appendix B1.2 + B1.2.1
- Filesystem rules + inconsistency handling: `docs/project/TECHNICAL_DESIGN.md` Appendix B5

### 4.1 SQLite responsibilities
Repositories MUST support (minimum):
- `Document`
- `ProcessingRun`
- `Artifacts` (`RAW_TEXT` filesystem ref; `STEP_STATUS` JSON)
- `InterpretationVersion` (append-only; single active per run)
- `FieldChangeLog` (append-only)

Do not store derived fields (notably `Document.status`). Derive per Appendix A.

### 4.2 Filesystem layout (deterministic, MVP)
Storage root:
- `VET_RECORDS_STORAGE_PATH` (defaults per codebase)

Minimum paths (under the storage root):
- Original upload:
  - `{storage_root}/{document_id}/original.pdf` (MVP; Appendix B5)
- Run-scoped raw text (produced by extraction step):
  - `{storage_root}/{document_id}/runs/{run_id}/raw-text.txt`

Notes:
- The path is deterministic; immutability is achieved by only creating the final file on successful step completion
  (temp-write + atomic rename; never “edit” an artifact in place).
- Step lifecycle tracking is DB-resident via `Artifacts(artifact_type = STEP_STATUS)` (Appendix C).

### 4.3 Atomicity + write ordering (DB vs filesystem)
Non-negotiable constraint: avoid partial persistence on success — `docs/project/TECHNICAL_DESIGN.md` Appendix B4.1 + Appendix B5.

Implementation rule (paired DB + FS writes):
- Final filesystem content MUST exist before the DB transaction that references it is committed.
- The API MUST only return success after the DB commit succeeds.

Reference implementation pattern (upload + any filesystem-backed artifact):
1) Pre-generate IDs needed for deterministic final paths (`document_id`, and `run_id` if created on upload).
2) Begin a write transaction (`BEGIN IMMEDIATE` in SQLite when the operation must exclude conflicting writers).
3) Insert/prepare DB rows (document, run, artifact rows) inside the transaction.
4) Write content to an adjacent temp file (`*.tmp`), flush, `fsync`, then atomically rename (`os.replace`) temp → final.
5) Commit the DB transaction.
6) On any failure, best-effort cleanup:
   - rollback DB transaction
   - delete temp file
   - if the final file exists but the DB commit failed, delete the final file best-effort

Rationale:
- Prevents “DB exists but FS missing” on the success path.
- Leaves only the crash-window inconsistency “FS exists but DB missing”, which Technical Design treats as an orphan/invalid artifact (Appendix B5).

### 4.4 Partial failure handling (DB/FS inconsistencies)
Handle inconsistencies exactly as specified (Appendix B5):

- **FS exists, DB missing** (crash between rename and DB commit):
  - Treat the filesystem content as an orphan/invalid artifact.
  - Do not serve it (no background cleanup required in MVP).

- **DB exists, FS missing** (external deletion, disk corruption, manual cleanup):
  - API endpoints serving files/artifacts MUST return `410 Gone` with `error_code = ARTIFACT_MISSING`.
    - semantics are authoritative: `docs/project/TECHNICAL_DESIGN.md` Appendix B3.2
  - Runner behavior:
    - if a required filesystem input is missing (e.g., `original.pdf` before extraction, or `raw-text.txt` before interpretation),
      record a failed step artifact with `error_code = ARTIFACT_MISSING` and transition the run to terminal failure
    - map run `failure_type` from the failing step per `docs/project/TECHNICAL_DESIGN.md` Appendix C3

Document status on failures:
- Derived from the latest run(s) per `docs/project/TECHNICAL_DESIGN.md` Appendix A1.2 (do not store).

Database location:
- `VET_RECORDS_DB_PATH` controls the SQLite file path.


## 5. In-process Pipeline Implementation
Authority (do not duplicate):
- In-process model + scheduler semantics + retries/timeouts + recovery: `docs/project/TECHNICAL_DESIGN.md` Appendix B1
- Step model + step artifacts: `docs/project/TECHNICAL_DESIGN.md` Appendix C
- Structured log taxonomy: `docs/project/TECHNICAL_DESIGN.md` Appendix A8.1

### 5.1 Startup wiring (FastAPI lifespan)
On FastAPI startup (lifespan hook):
1) Run crash recovery: transition orphaned `RUNNING` runs → terminal failure (Section 5.6).
2) Start the scheduler loop as a long-lived background task.
3) Store the task handle on `app.state` so shutdown can cancel/await best-effort.

On shutdown:
- cancel the scheduler task and await best-effort for a clean exit.

### 5.2 Scheduler loop (polling, best-effort)
Normative semantics: `docs/project/TECHNICAL_DESIGN.md` Appendix B1.5 + B1.5.1.

Implementation requirements:
- Fixed tick (e.g., every 1s); MUST NOT busy-loop.
- On each tick:
  1) Query for eligible `QUEUED` runs (FIFO by `created_at`).
  2) For each candidate, attempt to claim/start it using the guard pattern (Section 5.3).
  3) If claimed, execute the run steps (Section 5.4) without blocking API request handling.

### 5.3 Claiming a run (single-active-run invariant, transactional guard)
Single `RUNNING` rule: `docs/project/TECHNICAL_DESIGN.md` Appendix B1.2.
Guard pattern (SQLite): `docs/project/TECHNICAL_DESIGN.md` Appendix B1.2.1.

Implementation rule:
- Encapsulate `BEGIN IMMEDIATE` + “check for RUNNING” + “transition QUEUED → RUNNING” into a single repository method.
- Never split the check and transition across transactions.

### 5.4 Step execution (append-only artifacts)
Step model authority: `docs/project/TECHNICAL_DESIGN.md` Appendix C1–C3.

Implementation rules:
- Persist step lifecycle as append-only `Artifacts(artifact_type = STEP_STATUS)` records.
- For each step attempt:
  - append `STEP_STATUS` with `step_status = RUNNING` (attempt counter starts at 1)
  - run the step
  - on success: write outputs (e.g., `RAW_TEXT` artifact for extraction; `InterpretationVersion` for interpretation),
    then append `STEP_STATUS` with `SUCCEEDED`
  - on failure: append `STEP_STATUS` with `FAILED` + `error_code` and transition the run to terminal failure per Appendix C3

Avoid event-loop blocking:
- Run blocking I/O / CPU-heavy work (e.g., PDF parsing) off the event loop (threadpool/executor).

### 5.5 Retry/backoff + timeout (minimal, fixed defaults)
Authority: `docs/project/TECHNICAL_DESIGN.md` Appendix B1.4 + B1.4.1.

Implementation rules:
- Step retry limit: 2 attempts total (1 initial + 1 retry).
- Backoff: minimal fixed backoff between attempts (e.g., 250ms then 1s).
- Run timeout: enforce the wall-clock limit from `RUN_STARTED`; on timeout, transition run → `TIMED_OUT` (terminal).

### 5.6 Crash recovery (RUNNING → FAILED on startup)
Authority: `docs/project/TECHNICAL_DESIGN.md` Appendix B1.3 + Appendix C3.

Implementation rule:
- On application startup, inside a write transaction, transition all orphaned runs in state `RUNNING` to:
  - terminal failure with `failure_type = PROCESS_TERMINATED`
  - terminal timestamps set consistently (per the persistent model)
- Emit a structured log event using the Appendix A8.1 taxonomy (do not invent a new event type here).


## 6. API Wiring & Error Enforcement
Authoritative API surface and semantics MUST be referenced (not duplicated):
- Endpoint map + run resolution: `docs/project/TECHNICAL_DESIGN.md` Appendix B3 + B3.1
- Error response format: `docs/project/TECHNICAL_DESIGN.md` Appendix B2.6
- Endpoint error semantics + codes: `docs/project/TECHNICAL_DESIGN.md` Appendix B3.2

Implementation rules:
- Routers are thin adapters: parse/validate → call an `application` use case → map to response schema.
- Centralize error handling:
  - prefer a shared application error type and FastAPI exception handlers that always emit the Appendix B2.6 structure
  - avoid per-route ad-hoc error payloads
- Enforce `409 CONFLICT` reasons using the closed set from Appendix B3.2.


## 7. Backend Testing Strategy
Minimum expectations are authoritative: `docs/project/TECHNICAL_DESIGN.md` Appendix B7.

### 7.1 Unit tests (domain + persistence rules)
Domain (pure):
- Document status derivation from run history (Appendix A1.2).
- Run state derivation from step artifacts (Appendix C2).
- Interpretation versioning rules (append-only; single active version per run) (Appendix A3 + Appendix B2.4).

Persistence/invariants (SQLite):
- Guard pattern: cannot produce two `RUNNING` runs for the same document (Appendix B1.2.1).
- Atomicity contract: DB commits only after final filesystem artifact exists (Appendix B4.1 + Appendix B5).

### 7.2 Integration tests (API + DB + filesystem)
Use a temporary SQLite DB path + temporary storage root per test run.
Minimum critical cases:
- Upload persists both DB row(s) and original file; response returns success only when both exist.
- Raw text retrieval:
  - `409 CONFLICT` reasons per Appendix B3.2 when not ready / not available
  - `410 ARTIFACT_MISSING` when DB references an artifact but filesystem content is missing
- Reprocess creates a new queued run (append-only), scheduler starts oldest queued, single-active-run invariant holds.
- Crash recovery: a run left as `RUNNING` is transitioned to terminal failure on startup (`PROCESS_TERMINATED`) per Appendix B1.3.

### 7.3 Storage-error flows (must be exercised)
At minimum, simulate:
- DB exists, FS missing → 410 ARTIFACT_MISSING (API) and terminal failure when runner input is missing.
- Transient SQLite lock/contention during scheduler tick → next-tick retry (best-effort; no busy-loop).


## 8. Appendix (Local dev)
Run instructions are owned by the repository root `README.md`.

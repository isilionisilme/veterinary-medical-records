# B1. Asynchronous In-Process Processing Model (Authoritative)

## B1.1 Assumed Execution Model

Background processing is executed **in-process**, using a controlled background task runner (e.g. internal task loop or executor).

If future user stories introduce multi-instance execution or external workers/queues, they must define the additional coordination contracts explicitly.

This choice prioritizes simplicity and debuggability over throughput.

---

## B1.2 Single `RUNNING` Run Guarantee

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

## B1.2.1 Persistence-Level Guard Pattern (SQLite, Authoritative)

To enforce “at most one `RUNNING` run per document”, run creation and run start transitions must follow a persistence-level guard pattern that prevents race conditions.

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


## B1.3 Crash & Restart Semantics

On application startup:
- Any run found in state `RUNNING` is considered **orphaned**.
- Orphaned runs must be transitioned to `FAILED` with `failure_type = PROCESS_TERMINATED`.

Rationale:
- Avoids “stuck” runs.
- Keeps the state machine monotonic and explainable.

---

## B1.4 Retry & Timeout Policy

- Retries:
  - Are local to a single run.
  - Are limited to a small, fixed number (e.g. 1–2 retries).
  - Do not create new runs.
- Timeouts:
  - A run exceeding a fixed execution window transitions to `TIMED_OUT`.
  - `TIMED_OUT` is a terminal state.

Reprocessing always creates a **new run**.

## B1.4.1 Fixed defaults (Normative)
- Step retry limit: 2 attempts total (1 initial + 1 retry).
- Run timeout: 120 seconds wall-clock from `RUN_STARTED`.


---

## B1.5 In-Process Scheduler Semantics (Authoritative)

The system includes an in-process scheduler that periodically attempts to start queued runs.

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

## B1.5.1 Scheduler tick & fairness (Normative)
- The scheduler runs on a fixed tick (e.g. every 1s).
- On each tick, it attempts to start runs in FIFO order by `created_at`.
- It MUST NOT busy-loop; it sleeps between ticks.
- If a start attempt fails due to transient DB lock/contention, it logs `STEP_RETRIED` (or a dedicated scheduler event) and retries on the next tick.

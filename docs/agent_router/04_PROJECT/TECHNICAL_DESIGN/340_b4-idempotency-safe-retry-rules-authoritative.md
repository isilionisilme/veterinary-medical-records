# B4. Idempotency & Safe Retry Rules (Authoritative)

The following actions must be safe to retry:
- Upload
- Reprocess
- Mark reviewed

Mechanisms:
- Persistence-level guards (see B1.2.1).
- Explicit checks for invariants (single `RUNNING` run rule + run-start guard).
- No reliance on client-provided idempotency keys.

“Safe to retry” means:
- Retrying does not corrupt state.
- Retrying may create additional append-only records (where specified), but must never produce inconsistent state.

## B4.1 Endpoint Semantics

**POST /documents/upload**
- Retrying may create a new document (no deduplication).
- The system must avoid partial persistence:
  - no DB row without filesystem artifact on success,
  - no filesystem artifact without DB row on success.

**POST /documents/{id}/reprocess**
- Always creates a new `ProcessingRun` in `QUEUED`.
- Retrying may create multiple queued runs. This is acceptable.
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

# A1. State Model & Source of Truth

## A1.1 Processing Run State (authoritative)

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

## A1.2 Document Status (derived, not stored)

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

## A1.3 Review Status (human workflow only)

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

## A1.4 Source of Truth Summary

| Concept              | Source of Truth            |
|---------------------|----------------------------|
| Processing progress | `ProcessingRun.state`      |
| Document lifecycle  | Derived from runs          |
| Human workflow      | `ReviewStatus`             |
| Interpretation data | Versioned interpretations |
| Governance          | Governance candidates/logs |

---

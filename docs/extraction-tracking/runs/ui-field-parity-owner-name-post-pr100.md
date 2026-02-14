# UI field parity: owner_name (post-PR100 ownership update)

## Scope
- Record canonical ownership policy after PR #100 (`frontend: stop posting extraction snapshots from UI`).
- Ensure parity write-path is single-source (backend-only) to avoid split-write drift.

## Evidence anchor
- PR: [#100](https://github.com/isilionisilme/veterinary-medical-records/pull/100)
- Frontend change: UI no longer issues `POST /debug/extraction-runs`.
- Existing parity endpoints remain:
  - `GET /documents/{document_id}/review`
  - `GET /debug/extraction-runs/{document_id}/summary?limit=...&run_id={run_id}`

## Findings
- Snapshot persistence ownership is now explicit and non-duplicated:
  - Backend persists snapshots for completed runs (PR #99).
  - Frontend does not write snapshots (PR #100).
- This removes retry/ordering ambiguity from client-driven posting and keeps run-pinned parity data source deterministic.

## Conclusion
- Canonical policy is now stable: backend writes; frontend reads.
- Next validation pass should sample latest completed runs and verify run-pinned summary coverage using backend-only ownership.

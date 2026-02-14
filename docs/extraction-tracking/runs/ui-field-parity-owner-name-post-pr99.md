# UI field parity: owner_name (post-PR99)

## Scope
- Record parity impact after PR #99 (`backend: persist extraction snapshots for completed runs`).
- Confirm canonical snapshot write-path moved to backend completed-run boundary.

## Evidence anchor
- PR: [#99](https://github.com/isilionisilme/veterinary-medical-records/pull/99)
- Backend contract change: completed runs now auto-persist debug extraction snapshots server-side.
- Related endpoint for run-pinned parity:
  - `GET /debug/extraction-runs/{document_id}/summary?limit=...&run_id={run_id}`

## Findings
- Prior `snapshot-not-persisted-for-run` 404s in post-PR97 checks were caused by missing persisted snapshots for those specific historical runs.
- With PR #99, snapshot persistence is no longer dependent on frontend behavior for newly completed runs.
- Run-pinned parity checks now have a canonical backend source for new runs.

## Conclusion
- PR #99 closes the primary persistence gap for future run-pinned parity checks.
- Historical runs without persisted snapshots may still return 404 and should be treated as expected legacy gaps.

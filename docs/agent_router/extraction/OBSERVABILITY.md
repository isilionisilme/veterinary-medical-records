# Extraction Observability

## What we capture
- Per-run extraction snapshot with per-field status:
  - `missing` / `rejected` / `accepted`
- Per-field candidate evidence:
  - `topCandidates` (max 3)
  - confidence
  - reason (for rejected)
  - suspicious accepted flags (triage)

## Storage
- Path: `.local/extraction_runs/<documentId>.json`
- Behavior: ring buffer of latest 20 runs per document.

## Backend endpoints
- `POST /debug/extraction-runs`
  - Persist one run snapshot.
- `GET /debug/extraction-runs/{documentId}`
  - Return persisted runs for one document.
- `GET /debug/extraction-runs/{documentId}/summary?limit=...`
  - Aggregate recent runs (default operational window: 20).

## Summary outputs
- Most missing fields.
- Most rejected fields.
- For missing/rejected: top1 sample + average confidence.
- Suspicious accepted counts.
- Missing split:
  - with candidates
  - without candidates

## Logs emitted by backend
- Triage summary header.
- `MISSING` section.
- `REJECTED` section.
- `SUSPICIOUS_ACCEPTED` section.
- Diff vs previous persisted snapshot.
- Aggregate summary logs (`MOST_MISSING`, `MOST_REJECTED`).

## Practical interpretation rule
- `limit=20` includes historical behavior and is useful for trend.
- `limit=1` isolates the latest run and is the right check to confirm a new fix.

## Relevant code paths
- Snapshot persistence + triage + summary:
  - [backend/app/application/extraction_observability.py](../../backend/app/application/extraction_observability.py)
- Debug endpoints:
  - [backend/app/api/routes.py](../../backend/app/api/routes.py)
  - [backend/app/api/schemas.py](../../backend/app/api/schemas.py)

## Verification quick-start
1. Process/review a document with extraction debug enabled.
2. Persist snapshot (`POST /debug/extraction-runs`).
3. Query summary with `limit=20` and `limit=1`.
4. Confirm field transitions and candidate evidence in both endpoint output and logs.
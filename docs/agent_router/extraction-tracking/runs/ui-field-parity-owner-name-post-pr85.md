# UI field parity: owner_name (post-PR85 recheck)

## Scope
- Re-check UI/backend parity for `owner_name` after PR #85 (`Datos del Cliente` context fix).
- Classify result as detection, promotion, or UI mapping mismatch.

## Anchors
- document_id: `e05bef44-79d9-4c36-a8f4-490cf6d87473`
- ui_run_id: `a7229396-e639-4937-bf0d-8d31036c77bd`
- endpoints:
  - `POST /documents/{document_id}/reprocess`
  - `GET /documents/{document_id}/review`
  - `GET /debug/extraction-runs/{document_id}/summary?limit=1`

## Findings
- From review payload under `active_interpretation.data.global_schema`:
  - `owner_name`: `null`
- From debug summary (`limit=1`, latest run):
  - `owner_name.missing_count=1`
  - `owner_name.has_candidates=false`
  - `owner_name.top1_sample=null`
  - `considered_runs=1`

## Conclusion
- Classification: detection-missing for this post-fix run.
- Parity status: UI and backend are aligned for `owner_name` in this run (no UI mapping mismatch).

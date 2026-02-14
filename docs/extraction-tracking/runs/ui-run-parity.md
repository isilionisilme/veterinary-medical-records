# UI run parity (canonical report)

**PR anchor:** [#78](https://github.com/your-org/veterinary-medical-records/pull/78)

## Scope
- Verify UI uses the same run_id and values as backend review/debug surfaces.

## Anchors
- document_id: `fb322034-e8eb-4c5b-b235-056bbdc6b7f4`
- ui_run_id: `21d15982-c2da-4d34-a1fe-fda83ab4306d`
- endpoints:
  - `GET /documents/{document_id}/review`
  - `GET /debug/extraction-runs/{document_id}/summary?limit=1&run_id={run_id}`

## Findings
- UI extracted fields are loaded via `GET /documents/{document_id}/review`.
- UI uses `latest_completed_run.run_id` from the review payload.
- Structured values come from `active_interpretation.data.global_schema_v0`.
- In at least one check, `GET /runs/{run_id}/artifacts/global-schema-v0` returned 404.

## Conclusion
- Run parity confirmed for `/review` path in this check.

# UI field parity: microchip_id + owner_name (canonical report)

## Scope
- Verify whether empty `microchip_id` and `owner_name` in UI are detection, promotion, or UI-mapping issues.

## Anchors
- document_id: `e05bef44-79d9-4c36-a8f4-490cf6d87473`
- ui_run_id: `d838c09a-9589-4dec-811e-dedeb7c75380`
- endpoints:
	- `GET /documents/{document_id}/review`
	- `GET /debug/extraction-runs/{document_id}/summary?limit=1&run_id={run_id}`

## Findings
- From review payload under `active_interpretation.data.global_schema_v0`:
- `microchip_id`: `null`
- `owner_name`: `null`
- key `microchip`: not present

- From debug summary for same run:
- `microchip_id`: `missing_count=1`, `has_candidates=false`, `top1_sample=null`
- `owner_name`: `missing_count=1`, `has_candidates=false`, `top1_sample=null`

## Conclusion
- Classification: detection-missing for this run (not UI mapping mismatch and not promotion mismatch for these two fields at that point).
- Follow-up diagnostics later found microchip raw_text signal and enabled a minimal microchip heuristic fix.

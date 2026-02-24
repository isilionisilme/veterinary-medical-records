# Baseline canonical snapshot (post-PR #83)

## Scope
- Freeze a reviewer-friendly baseline after PR #83 before opening the next extraction iteration.
- Capture one stable reference run and expected-vs-observed values for the two most sensitive fields (`microchip_id`, `owner_name`).

## Baseline anchors
- baseline_date: `2026-02-14`
- baseline_commit_on_main: `c73242f291dd246500a92deca9477bd893874e73`
- canonical_reference_pr: [#83](https://github.com/isilionisilme/veterinary-medical-records/pull/83)

## Reference run
- document_id: `e05bef44-79d9-4c36-a8f4-490cf6d87473`
- run_id: `d838c09a-9589-4dec-811e-dedeb7c75380`
- endpoints used:
  - `GET /documents/{document_id}/review`
  - `GET /debug/extraction-runs/{document_id}/summary?limit=1&run_id={run_id}`

## Expected vs observed (baseline)

| Field | Expected baseline state | Observed in reference run |
|---|---|---|
| `microchip_id` | Empty is acceptable when no valid candidate signal exists in this run | `null` in review, `has_candidates=false`, `top1_sample=null` |
| `owner_name` | Empty is acceptable when deterministic owner signal is absent | `null` in review, `has_candidates=false`, `top1_sample=null` |

## Notes
- This baseline intentionally reflects a conservative state for the selected run (detection-missing classification).
- Use this snapshot as the comparison point for PR #85+ changes.

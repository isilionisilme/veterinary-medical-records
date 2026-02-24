# UI field parity: microchip_id (post-PR87 recheck)

## Scope
- Re-check `microchip_id` parity on recent completed runs after PR #87 OCR hardening.
- Verify whether UI review values align with debug summary signals and identify remaining risk patterns.

## Sample set
- Source: `GET /documents?limit=5&offset=0` (latest 5 completed docs)
- Endpoints used per document:
  - `GET /documents/{document_id}/review`
  - `GET /debug/extraction-runs/{document_id}/summary?limit=1`

## Findings

| document_id | run_id | review `microchip_id` | summary `has_candidates` | summary `top1_sample` | summary `missing_count` | Classification |
|---|---|---|---|---|---|---|
| `d60a5a71-d6da-41ea-997c-d5cc05b6aaf1` | `62ecc2ec-6318-436f-8b89-caa584641231` | `null` | `false` | `null` | `1` | detection-missing |
| `fb322034-e8eb-4c5b-b235-056bbdc6b7f4` | `21d15982-c2da-4d34-a1fe-fda83ab4306d` | `00023035139 NHC` | `false` | `null` | `0` | canonical-format drift (non-digits suffix in review) |
| `e05bef44-79d9-4c36-a8f4-490cf6d87473` | `a7229396-e639-4937-bf0d-8d31036c77bd` | `null` | `false` | `null` | `1` | detection-missing |
| `daeaa6fd-c367-48e5-863b-846c5451dda1` | `11ca5506-bf3f-4231-ba88-4f8b15d78e7c` | `BEATRIZ ABARCA C/ ORTEGA` | `false` | `BEATRIZ ABARCA C/ ORTEGA` | `0` | false-positive drift (non-chip value) |
| `043fa0d1-8d39-48fa-89c0-09a300e838cc` | `7ca39765-430a-430b-8c88-35e125b38d30` | `00023035139 NHC` | `false` | `null` | `0` | canonical-format drift (non-digits suffix in review) |

## Conclusion
- Parity is stable for missing cases (`null` + `has_candidates=false`).
- Remaining risk is not UI mapping mismatch; it is canonical-value quality drift in some completed runs.
- Next minimal iteration should enforce strict canonical microchip normalization (`digits-only`) in review-facing payloads.

# UI field parity: owner_name (post-PR93 recheck)

## Scope
- Re-check `owner_name` parity on recent completed runs after the latest microchip review-facing hardening cycle.
- Verify whether `/documents/{document_id}/review` and debug summary remain aligned for owner detection state.

## Sample set
- Source: `GET /documents?limit=5&offset=0` (latest 5 completed docs)
- Endpoints used per document:
  - `GET /documents/{document_id}/review`
  - `GET /debug/extraction-runs/{document_id}/summary?limit=1&run_id={run_id}`

## Findings

| document_id | run_id | review `owner_name` | summary `has_candidates` | summary `top1_sample` | summary `missing_count` | Classification |
|---|---|---|---|---|---|---|
| `d60a5a71-d6da-41ea-997c-d5cc05b6aaf1` | `62ecc2ec-6318-436f-8b89-caa584641231` | `null` | `false` | `null` | `1` | detection-missing |
| `fb322034-e8eb-4c5b-b235-056bbdc6b7f4` | `21d15982-c2da-4d34-a1fe-fda83ab4306d` | `null` | `false` | `null` | `1` | detection-missing |
| `e05bef44-79d9-4c36-a8f4-490cf6d87473` | `a7229396-e639-4937-bf0d-8d31036c77bd` | `null` | `false` | `null` | `1` | detection-missing |
| `daeaa6fd-c367-48e5-863b-846c5451dda1` | `11ca5506-bf3f-4231-ba88-4f8b15d78e7c` | `null` | `false` | `null` | `1` | detection-missing |
| `043fa0d1-8d39-48fa-89c0-09a300e838cc` | `7ca39765-430a-430b-8c88-35e125b38d30` | `null` | `false` | `null` | `1` | detection-missing |

## Conclusion
- No UI/backend mismatch observed for `owner_name` in this sample.
- State remains consistent with previous rechecks: `owner_name` is currently a detection-missing case in these recent runs (`null` + `has_candidates=false`).
- If prioritizing this field next, the minimal loop remains signal-focused (new deterministic owner-context fixtures) rather than UI mapping changes.

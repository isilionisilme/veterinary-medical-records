# UI field parity: owner_name (post-PR95 recheck)

## Scope
- Re-check `owner_name` parity after PR #95 (`tabular Nombre` owner extraction).
- Validate latest runs through review payload and debug summary pinned by `run_id`.

## Sample set
- Source: `GET /documents?limit=5&offset=0` (latest 5 docs)
- Action: `POST /documents/{document_id}/reprocess` (where available in sample)
- Endpoints used per document:
  - `GET /documents/{document_id}/review`
  - `GET /debug/extraction-runs/{document_id}/summary?limit=1&run_id={run_id}`

## Findings

| document_id | run_id | review `owner_name` | summary `has_candidates` | summary `top1_sample` | summary `missing_count` | Classification |
|---|---|---|---|---|---|---|
| `d60a5a71-d6da-41ea-997c-d5cc05b6aaf1` | `1bc3ea90-bd37-4ae8-8bbe-bd01a37d850f` | `BEATRIZ ABARCA` | `false` | `null` | `1` | review-accepted, debug-summary lag |
| `fb322034-e8eb-4c5b-b235-056bbdc6b7f4` | `21d15982-c2da-4d34-a1fe-fda83ab4306d` | `null` | `false` | `null` | `1` | detection-missing |
| `e05bef44-79d9-4c36-a8f4-490cf6d87473` | `f57ec96e-07d5-41f6-8dd9-afd8b9fd3a2b` | `BEATRIZ ABARCA` | `false` | `null` | `1` | review-accepted, debug-summary lag |
| `daeaa6fd-c367-48e5-863b-846c5451dda1` | `11ca5506-bf3f-4231-ba88-4f8b15d78e7c` | `null` | `false` | `null` | `1` | detection-missing |
| `043fa0d1-8d39-48fa-89c0-09a300e838cc` | `7ca39765-430a-430b-8c88-35e125b38d30` | `null` | `false` | `null` | `1` | detection-missing |

## Conclusion
- PR #95 improves review-facing extraction for tabular owner layout (`owner_name=BEATRIZ ABARCA` observed in fresh runs).
- A residual observability mismatch remains: debug summary still reports `owner_name` as missing for runs where review payload is populated.
- Next minimal iteration should align debug-summary owner metrics with review-facing canonical output for the same `run_id`.

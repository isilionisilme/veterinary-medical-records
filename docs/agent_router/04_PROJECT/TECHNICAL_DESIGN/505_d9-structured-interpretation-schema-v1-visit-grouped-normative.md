# D9. Structured Interpretation Schema (v1 — Visit-grouped) (Normative)

Version `v1` defines deterministic visit grouping for multi-visit documents.

- Multi-visit PDFs exist; UI must not heuristic-group.
- v1 enables deterministic grouping by introducing `visits[]`.
- v0 remains valid; this is an explicit schema version evolution.

## D9.1 Top-Level Object: StructuredInterpretation v1 (JSON)

```json
{
  "schema_version": "v1",
  "document_id": "uuid",
  "processing_run_id": "uuid",
  "created_at": "2026-02-05T12:34:56Z",
  "fields": [],
  "visits": []
}
```

| Field | Type | Required | Notes |
|---|---|---:|---|
| schema_version | string | ✓ | Always `"v1"` |
| document_id | uuid | ✓ | Convenience for debugging |
| processing_run_id | uuid | ✓ | Links to a specific processing attempt |
| created_at | ISO 8601 string | ✓ | Snapshot creation time |
| fields | array of `StructuredField` | ✓ | Non-visit-scoped fields only |
| visits | array of `VisitGroup` | ✓ | Deterministic grouping container for visit-scoped data |

## D9.2 VisitGroup (Normative)

```json
{
  "visit_id": "uuid",
  "visit_date": "2026-02-05",
  "admission_date": "2026-02-05",
  "discharge_date": "2026-02-07",
  "reason_for_visit": "Vomiting",
  "fields": []
}
```

| Field | Type | Required | Notes |
|---|---|---:|---|
| visit_id | uuid | ✓ | Stable identifier for the visit group within this interpretation version |
| visit_date | ISO 8601 date string | ✓ (nullable) | Critical concept; may be `null` if unknown |
| admission_date | ISO 8601 date string | ✗ | Optional |
| discharge_date | ISO 8601 date string | ✗ | Optional |
| reason_for_visit | string | ✗ | Optional |
| fields | array of `StructuredField` | ✓ | Visit-scoped structured fields (clinical + costs); `StructuredField` is unchanged from D5 |

## D9.3 Scoping Rules (Normative)

For `schema_version = "v1"`:
1. Top-level `fields[]` MUST contain only non-visit-scoped keys (clinic/patient/owner/review metadata and any future non-visit keys).
2. Visit-scoped concepts MUST appear inside exactly one `visits[].fields[]` entry set, not in top-level `fields[]`.

Visit-scoped keys (MUST be inside `visits[].fields[]`):
- `symptoms`
- `diagnosis`
- `procedure`
- `medication`
- `treatment_plan`
- `allergies`
- `vaccinations`
- `lab_result`
- `imaging`
- `invoice_total`
- `covered_amount`
- `non_covered_amount`
- `line_item`

Visit metadata keys are represented as `VisitGroup` properties:
- `visit_date`
- `admission_date`
- `discharge_date`
- `reason_for_visit`

## D9.4 Determinism and Unassigned Rule (Normative)

If an extracted clinical/cost field cannot be deterministically linked to a specific visit, it MUST be placed under a synthetic `VisitGroup` with:
- `visit_id = "unassigned"`
- `visit_date = null`
- `admission_date = null`
- `discharge_date = null`
- `reason_for_visit = null`

This rule prevents UI-side heuristic grouping and keeps all visit-scoped items contained in `visits[]`.

## D9.5 Compatibility Note (Normative)

- v0 continues to use the flat `fields[]` list.
- Frontend may branch rendering by `schema_version`, but this document defines contract shape only (UX owns layout).

---

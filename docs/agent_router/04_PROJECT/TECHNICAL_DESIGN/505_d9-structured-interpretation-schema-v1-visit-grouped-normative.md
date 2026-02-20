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
  "visits": [],
  "other_fields": []
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
| other_fields | array of `StructuredField` | ✗ (v1 preferred) | Explicit unmapped/other bucket for deterministic rendering; when present, FE MUST render only these entries in “Otros campos detectados”. |

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
3. “Otros campos detectados” MUST be contract-driven: backend emits explicit items in `other_fields[]` (preferred) and/or marks fields with `classification = "other"`; FE MUST NOT reclassify.
4. Medical Record panel membership is contract metadata (`scope`, `section`, `domain`, `classification`) and not UI inference.

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

Document-level Medical Record keys (MUST be emitted in top-level `fields[]`, with `scope = "document"`, `classification = "medical_record"`):
- Clinic section (`section = "clinic"`): `clinic_name`, `clinic_address`, `vet_name`, `nhc`.
- Patient section (`section = "patient"`): `pet_name`, `species`, `breed`, `sex`, `age`, `dob`, `microchip_id`, `weight`, `repro_status`.
- Owner section (`section = "owner"`): `owner_name`, `owner_address`.
- Review notes section (`section = "review_notes"`): `notes`.
- Report info section (`section = "report_info"`): `language`.

Owner address concept (normative):
- `owner_address` is the explicit owner address concept for Medical Record taxonomy.
- Legacy `owner_id` is an identifier concept and MUST NOT be interpreted as address in Medical Record taxonomy.

NHC (normative):
- Preferred key is `nhc` (Número de historial clínico), document-level, clinic section.
- Transitional compatibility: `medical_record_number` may be emitted by legacy producers; producers should converge to `nhc`.

Age and DOB (normative compatibility):
- `age` and `dob` are both valid patient fields.
- Backend may emit either or both; the contract does not require deriving one from the other in frontend consumers.

Medical Record vs billing/claim boundary (contract taxonomy):
- Medical Record panel rendering MUST rely on contract classification (`classification = "medical_record"` and domain/section metadata), not frontend denylists.
- Billing/claim concepts are excluded from Medical Record taxonomy by classification/domain; examples include `invoice_total`, `covered_amount`, `non_covered_amount`, `line_item`, `claim_id`, `document_date`.

Date normalization (v1 contract target):
- Canonical date representation for `visit_date`, `admission_date`, and `discharge_date` is ISO 8601 date string (`YYYY-MM-DD`).
- Transitional note: non-ISO inputs (for example `dd/mm/yyyy`) may exist upstream; producers should normalize to canonical ISO in payload output.

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

## D9.6 Authoritative Contract Boundary for Medical Record Rendering

- This appendix is the technical source of truth for payload taxonomy and deterministic buckets (`fields[]`, `visits[]`, `other_fields[]`, and classification metadata).
- Frontend consumers MUST render Medical Record structure from contract metadata only; they MUST NOT infer grouping/classification heuristically.
- UX labels/copy are defined in [`docs/project/UX_DESIGN.md`](../UX_DESIGN/00_entry.md); this appendix defines contract semantics only.

---

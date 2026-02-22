# D4. Top-Level Object: StructuredInterpretation (JSON)

```json
{
  "schema_contract": "visit-grouped-canonical",
  "document_id": "uuid",
  "processing_run_id": "uuid",
  "created_at": "2026-02-05T12:34:56Z",
  "medical_record_view": {
    "version": "mvp-1",
    "sections": [
      "clinic",
      "patient",
      "owner",
      "visits",
      "notes",
      "other",
      "report_info"
    ],
    "field_slots": []
  },
  "fields": [],
  "visits": [],
  "other_fields": []
}
```

| Field | Type | Required | Notes |
|---|---|---:|---|
| schema_contract | string | ✓ | Always `"visit-grouped-canonical"` |
| document_id | uuid | ✓ | Convenience for debugging |
| processing_run_id | uuid | ✓ | Links to a specific processing attempt |
| created_at | ISO 8601 string | ✓ | Snapshot creation time |
| medical_record_view | `MedicalRecordViewTemplate` | ✓ | Deterministic panel template |
| fields | array of `StructuredField` | ✓ | Non-visit-scoped fields |
| visits | array of `VisitGroup` | ✓ | Visit-scoped deterministic grouping |
| other_fields | array of `StructuredField` | ✓ | Explicit unmapped/other bucket |

# D8. Example (Multiple Fields)

```json
{
  "schema_contract": "visit-grouped-canonical",
  "document_id": "doc-123",
  "processing_run_id": "run-456",
  "created_at": "2026-02-05T12:34:56Z",
  "medical_record_view": {
    "version": "mvp-1",
    "sections": ["clinic", "patient", "owner", "visits", "notes", "other", "report_info"],
    "field_slots": []
  },
  "fields": [
    {
      "field_id": "f1",
      "key": "pet_name",
      "value": "Luna",
      "value_type": "string",
      "confidence": 0.82,
      "is_critical": true,
      "origin": "machine",
      "evidence": { "page": 2, "snippet": "Patient: Luna" }
    }
  ],
  "visits": [
    {
      "visit_id": "visit-1",
      "visit_date": "2026-02-05",
      "admission_date": null,
      "discharge_date": null,
      "reason_for_visit": "Vomiting",
      "fields": [
        {
          "field_id": "vf1",
          "key": "diagnosis",
          "value": "Gastroenteritis",
          "value_type": "string",
          "confidence": 0.78,
          "is_critical": false,
          "origin": "machine"
        }
      ]
    }
  ],
  "other_fields": []
}
```

---

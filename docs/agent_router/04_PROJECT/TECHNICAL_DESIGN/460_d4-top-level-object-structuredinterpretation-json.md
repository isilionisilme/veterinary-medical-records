# D4. Top-Level Object: StructuredInterpretation (JSON)

```json
{
  "schema_contract": "legacy-flat",
  "document_id": "uuid",
  "processing_run_id": "uuid",
  "created_at": "2026-02-05T12:34:56Z",
  "fields": []
}
```

| Field | Type | Required | Notes |
|---|---|---:|---|
| schema_contract | string | ✓ | Always `"legacy-flat"` |
| document_id | uuid | ✓ | Convenience for debugging |
| processing_run_id | uuid | ✓ | Links to a specific processing attempt |
| created_at | ISO 8601 string | ✓ | Snapshot creation time |
| fields | array of `StructuredField` | ✓ | Flat list of structured fields |

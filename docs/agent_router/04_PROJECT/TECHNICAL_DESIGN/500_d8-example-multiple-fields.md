# D8. Example (Multiple Fields)

```json
{
  "schema_version": "v0",
  "document_id": "doc-123",
  "processing_run_id": "run-456",
  "created_at": "2026-02-05T12:34:56Z",
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
    },
    {
      "field_id": "f2",
      "key": "pet_name",
      "value": "Luna",
      "value_type": "string",
      "confidence": 1.0,
      "is_critical": true,
      "origin": "human"
    }
  ]
}
```

---

# Appendix E — Minimal Libraries for PDF Text Extraction & Language Detection (Normative)

This appendix closes the minimum dependency decisions required to implement:
- Text extraction (step `EXTRACTION`, Appendix C),
- Language detection (persisted as `ProcessingRun.language_used`, Appendix B2.2).

If any conflict exists, Appendix A and Appendix B take precedence for invariants and persistence rules.

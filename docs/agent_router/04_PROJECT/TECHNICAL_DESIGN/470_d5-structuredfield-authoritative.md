# D5. StructuredField (Authoritative)

A single extracted or edited data point with confidence and optional evidence.

```json
{
  "field_id": "uuid",
  "key": "pet_name",
  "value": "Luna",
  "value_type": "string",
  "confidence": 0.82,
  "is_critical": true,
  "origin": "machine",
  "evidence": { "page": 2, "snippet": "Patient: Luna" }
}
```

**Field identity rule (Authoritative)**
- `field_id` identifies a **specific field instance**, not a conceptual slot.
- Human edits create new interpretation versions (Appendix A3.1) and are tracked via `FieldChangeLog` (Appendix B2.5).

| Field | Type | Required | Notes |
|---|---|---:|---|
| field_id | uuid | ✓ | Stable identifier for this field instance |
| key | string | ✓ | Lowercase `snake_case` |
| value | string \| number \| boolean \| null | ✓ | Dates stored as ISO strings |
| value_type | `"string"` \| `"number"` \| `"boolean"` \| `"date"` \| `"unknown"` | ✓ | Explicit typing |
| scope | `"document"` \| `"visit"` | ✗ | Contract taxonomy hint (canonical preferred). Backward-compatible optional metadata. |
| section | `"clinic"` \| `"patient"` \| `"owner"` \| `"visits"` \| `"notes"` \| `"other"` \| `"report_info"` | ✗ | Contract section membership hint (canonical preferred). |
| domain | `"clinical"` \| `"administrative"` \| `"meta"` \| `"other"` | ✗ | Concept domain classification (contract metadata; not UI behavior). |
| classification | `"medical_record"` \| `"other"` | ✗ | Explicit render taxonomy marker for deterministic consumers. |
| confidence | number (0–1) | ✓ | Attention signal only |
| is_critical | boolean | ✓ | Derived: `key ∈ CRITICAL_KEYS` (Appendix D7.4) |
| origin | `"machine"` \| `"human"` | ✓ | Distinguishes machine output vs human edits |
| evidence | `Evidence` | ✗ | Optional; expected for machine output when available |

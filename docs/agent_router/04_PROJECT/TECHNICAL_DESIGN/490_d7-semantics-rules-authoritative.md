# D7. Semantics & Rules (Authoritative)

## D7.1 Confidence
- Confidence never blocks: editing, marking reviewed, or accessing data.
- UI may render qualitatively (e.g., low / medium / high).

## D7.2 Multiple Values
Repeated concepts (e.g., medications) are represented by multiple fields with the same `key` and different `field_id`s.

## D7.3 Governance (Future-Facing)
Structural changes (new keys, key remapping) may later be marked as pending review for schema evolution.
This is never exposed or actionable in veterinarian-facing workflows.

## D7.4 Critical Concepts (Authoritative)

Derivation (authoritative):
- `StructuredField.is_critical = (StructuredField.key ∈ CRITICAL_KEYS_V0)`

Rules (technical, authoritative):
- `is_critical` MUST be derived from the field key (not model-decided).
- `CRITICAL_KEYS_V0` is a closed set (no heuristics, no model output).
- This designation MUST NOT block workflows; it only drives UI signaling and internal flags.

Source of truth for `CRITICAL_KEYS_V0`:
- Defined in [`docs/project/PRODUCT_DESIGN.md`](../PRODUCT_DESIGN/00_entry.md) (product authority).

---

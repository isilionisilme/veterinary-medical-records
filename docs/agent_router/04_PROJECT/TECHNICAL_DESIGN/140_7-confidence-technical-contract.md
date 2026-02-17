# 7. Confidence (Technical Contract)

- Each structured field MUST carry a `confidence` number in range 0–1 (see Appendix D).
- Confidence is a stored **attention signal** only.
- The meaning/governance of confidence in veterinarian workflows is defined in [`docs/project/PRODUCT_DESIGN.md`](../PRODUCT_DESIGN/00_entry.md).

## Tooltip breakdown visibility contract (MVP)

- `mapping_confidence` remains the primary veterinarian-facing confidence signal.
- Optional tooltip diagnostics:
  - `extraction_reliability` (0–1, nullable) for per-run/per-document extraction quality.
  - `review_history_adjustment` (signed percentage points) for cross-document/system-level explanatory adjustment.
- `extraction_reliability` is not `candidate_confidence`.
- Tooltip breakdown is explanatory only; no document-level policy UI is exposed.

---

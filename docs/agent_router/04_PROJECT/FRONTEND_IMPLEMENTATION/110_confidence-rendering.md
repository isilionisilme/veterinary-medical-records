# Confidence Rendering

Confidence values are rendered as **visual attention signals**, not as control mechanisms.

Frontend representation:
- qualitative signal first (e.g. color or emphasis),
- numeric confidence value visible inline or via tooltip.

The frontend must treat confidence as:
- non-blocking,
- non-authoritative,
- and purely assistive.

No frontend logic may interpret confidence as correctness or validation.

## Confidence tooltip breakdown rendering (MVP)

- `mapping_confidence` remains the primary visible signal; tooltip values are secondary explanatory details.
- Frontend renders backend-provided breakdown values only.
- Frontend must not infer `extraction_reliability` from `candidate_confidence` and must not implement calibration math.
- Edge cases:
  - no history -> `Ajuste por historico de revisiones: 0%`
  - missing extraction reliability -> `Fiabilidad de la extraccion de texto: No disponible`
- Use existing semantic tokens/classes for positive/negative/neutral adjustment styling.
- Keep veterinarian-facing copy free of governance terminology.

---

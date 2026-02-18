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

- `field_mapping_confidence` remains the primary visible signal; tooltip values are secondary explanatory details.
- Frontend renders backend-provided breakdown values only.
- Frontend must not infer `text_extraction_reliability` from `candidate_confidence` and must not implement calibration math.
- Edge cases:
  - no history -> `Ajuste por histórico de revisiones: 0%`
  - missing extraction reliability -> `Fiabilidad de la extracción de texto: No disponible`
- Use existing semantic tokens/classes for positive/negative/neutral adjustment styling.
- Keep veterinarian-facing copy free of governance terminology.

---

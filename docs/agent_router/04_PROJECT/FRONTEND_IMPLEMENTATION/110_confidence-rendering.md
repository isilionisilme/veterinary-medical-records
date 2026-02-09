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

---

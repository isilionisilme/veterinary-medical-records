# 4. Veterinarian Review Flow

## Step 1 — Document & Interpretation Together

The veterinarian reviews, in a single unified context:
- the original document,
- the structured interpretation,
- confidence indicators per field.

These elements must never be split into separate screens.

---

## Step 2 — Confidence-Guided Attention

- Low-confidence fields stand out visually.
- High-confidence fields recede into the background.

The UI guides *where to look first*, not *what to decide*.

### Confidence tooltip breakdown (veterinarian UI)

- `field_mapping_confidence` remains the primary visible confidence signal.
- Numeric values are secondary and shown in tooltip details only.
- Tooltip may include:
  - `Fiabilidad de la extracción de texto` (per-document diagnostic for current run)
  - `Ajuste por histórico de revisiones` (cross-document/system-level explanatory adjustment)
- Keep veterinarian-facing copy free of governance terminology.

---

## Step 3 — Immediate Local Correction

The veterinarian can:
- edit existing values,
- reassign information,
- create new fields when needed.

UX rules:
- Changes apply immediately to the current document.
- No explicit actions exist to submit feedback or “teach” the system.
- A single explicit action may exist to mark the document as reviewed.

From the veterinarian’s perspective:
> “I am done with this document.”

---

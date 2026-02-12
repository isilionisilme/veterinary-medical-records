# Conceptual Model: Local Schema, Global Schema, and Mapping

This conceptual model defines how interpretation data is understood at product level.
It does not prescribe storage tables or transport contracts.

- **Local Schema (per document/run):**
  the structured interpretation for one case/run, with evidence + confidence, editable without friction.
- **Global Schema (canonical):**
  the standardized field set the system recognizes and presents consistently across documents;
  it evolves safely and prospectively.
- **Field:**
  semantic unit that can exist locally and/or globally.
- **Mapping:**
  "this local field/value maps to this global key in this context";
  context can include document type, language, clinic, and similar operational conditions.

## Confidence Semantics (Stability, not Truth)

- Confidence is assigned to a mapping in context; it is a proxy for operational stability, not medical truth.
- Confidence guides attention and defaults over time, but must never block veterinary workflow.
- Safety asymmetry applies: confidence decreases fast on contradiction, increases slowly on repeated consistency, and remains reversible.

## Governance and Safeguards (pending_review, critical, non-reversible)

- `pending_review` means "captured as a structural signal", not blocked workflow.
- Global schema changes are prospective only and never silently rewrite history.
- Any change that can affect money, coverage, or medical/legal interpretation must not auto-promote.
- `CRITICAL_KEYS_V0` remains authoritative and closed.

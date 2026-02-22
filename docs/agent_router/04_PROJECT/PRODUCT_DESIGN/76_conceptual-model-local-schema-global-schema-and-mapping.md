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

- `candidate_confidence` is an extractor diagnostic for a local candidate in one run; it indicates extraction certainty, not cross-document stability.
- `field_mapping_confidence` is assigned to a mapping in context; it is a proxy for operational stability, not medical truth.
- Confidence guides attention and defaults over time, but must never block veterinary workflow.
- Safety asymmetry applies: `field_mapping_confidence` decreases fast on contradiction, increases slowly on repeated consistency, and remains reversible.

## Context (Deterministic)

- Purpose: deterministic aggregation key for correction/review signals and `field_mapping_confidence` propagation.
- Context fields: `doc_family`/`document_type`, `language`, `country`, `layout_fingerprint`, `extractor_version`, `schema_contract`.
- Context is computed per document/run and persisted alongside review/correction signals; it is deterministic system metadata, not LLM-defined.
- `veterinarian_id` is explicitly excluded from Context.
- `clinic_id` is not a first-class context key; use `layout_fingerprint` for layout-level grouping.
- Context semantics are deterministic and stable for the current MVP contract.

## Learnable Unit (`mapping_id`)

- The learnable unit is the pair (`field_key`, `mapping_id`).
- `mapping_id` is a stable identifier for the extraction/mapping strategy that produced a value.
- Representative stable forms include: `label_regex::<label>`, `anchor::<anchor_id>`, `fallback::<heuristic_name>`.

## Signals & Weighting (qualitative)

- Weak positive: veterinarian marks document reviewed and field remains unchanged.
- Negative: field value is edited/corrected.
- Negative (when applicable): value is reassigned/moved away from this field.
- Future strong positive: explicit per-field confirm.
- Confidence increases slowly, decreases quickly; requires minimum volume; and remains reversible.

## Policy State (soft behavior)

- `neutral`: no bias adjustment.
- `boosted`: preferred default suggestion/ranking in context.
- `demoted`/`suppressed`: reduced or hidden default suggestion priority.
- Policy state (not the metric itself) is what may enter `pending_review` where applicable.

## Confidence Propagation & Calibration

- `field_mapping_confidence` propagates continuously as new reviewed documents arrive, using smoothing to avoid abrupt oscillations from isolated events.
- Product policy actions (for example default suggestion promotion/demotion or review prioritization) are triggered only when thresholds are met with hysteresis and minimum volume.
- Policy actions adjust default ranking/selection behavior and do not add/remove Global Schema keys.
- `candidate_confidence` can influence extraction diagnostics, but governance and policy actions use `field_mapping_confidence` in context.
- By default, we do not require explicit per-field confirmation: implicit review is used as a weak positive signal when a veterinarian marks the document as reviewed and a field remains unchanged.
- Global Schema keys/order do not change automatically during this propagation; only `field_mapping_confidence` and policy state may change.

### Future Improvements

- Random audit sampling to periodically validate high-confidence mappings and detect drift.
- Explicit per-field confirmation as a strong positive signal (stronger than implicit unchanged-on-complete signals).
- Veterinarian-proposed fields from **Other extracted fields** as high-priority reviewer proposals; naming reconciliation across synonyms/aliases is tracked as future complexity.

## Governance and Safeguards (pending_review, critical, non-reversible)

- `pending_review` means "captured as a structural signal", not blocked workflow.
- Global schema changes are prospective only and never silently rewrite history.
- Any change that can affect money, coverage, or medical/legal interpretation must not auto-promote.
- `CRITICAL_KEYS` remains authoritative and closed.

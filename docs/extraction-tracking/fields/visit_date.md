# visit_date

## Current heuristic summary
- Extract from visit/consult labels and `DÍA dd/mm/yyyy` patterns.
- Normalize date values to ISO in canonical layer.
- Reject birthdate (`nacimiento`) contexts for visit date.

## Guardrails / must-not rules
- Must not map birthdate contexts to visit_date.
- Must not infer visit_date from unlabeled ambiguous dates when anchors are weak.
- Must not overwrite existing canonical value during promotion.

## Known failure modes / blocked-by-signal notes
- Multiple dates in one record can require anchor disambiguation.
- Non-standard date formats may remain missing by design.

## How to test (exact commands)
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py -s -q`
- `python -m pytest backend/tests/unit/test_interpretation_schema.py -q`

## History (commit + PR link)
- Branch `fix/golden-visit-date-iteration` | Commit `6749aa38` | PR: [#77](https://github.com/your-org/veterinary-medical-records/pull/77) | docA missing→accepted (`2024-07-17`).
- Commit `c27b2e14` | PR: [#80](https://github.com/your-org/veterinary-medical-records/pull/80) | promotion includes visit_date when canonical is missing.

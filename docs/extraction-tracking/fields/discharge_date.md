# discharge_date

## Current heuristic summary
- Extract from discharge labels (`alta`, `salida`, `discharge`).
- Normalize to ISO in canonical layer.
- Keep conservative label-based behavior (no free date guessing).

## Guardrails / must-not rules
- Must not infer discharge_date without explicit discharge-like label context.
- Must not map unrelated timeline dates to discharge_date.
- Must not overwrite existing canonical value during promotion.

## Known failure modes / blocked-by-signal notes
- Records without explicit discharge label remain missing intentionally.
- Date collisions with other timeline events can be rejected by context.

## How to test (exact commands)
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q`

## History (commit + PR link)
- Branch `fix/golden-discharge-date-iteration` | Commit `cb95be5e` | PR: [#77](https://github.com/your-org/veterinary-medical-records/pull/77) | docA missing→accepted (`2024-07-20`).
- Commit `c27b2e14` | PR: [#80](https://github.com/your-org/veterinary-medical-records/pull/80) | promotion includes discharge_date when canonical is missing.

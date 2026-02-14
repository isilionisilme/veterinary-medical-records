# vaccinations

## Current heuristic summary
- Strict label-only extraction (`vacunas`, equivalent explicit labels).
- Keep concise list values only; reject noisy clinical narrative.
- Apply conservative guardrails (length/context checks).

## Guardrails / must-not rules
- Must not extract vaccinations from unlabeled narrative text.
- Must not accept administrative/date-heavy lines as vaccination values.
- Must not overwrite existing canonical value during promotion.

## Known failure modes / blocked-by-signal notes
- Without explicit vaccine label, this field should remain missing.
- Date-heavy administrative lines are intentionally excluded.

## How to test (exact commands)
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q`

## History (commit + PR link)
- Branch `fix/golden-vaccinations-iteration` | Commit `c5d3ffbe` | PR: TODO(PR: pending) | docA missing→accepted (`Rabia, Moquillo, Parvo`).
- Commit `c27b2e14` | PR: TODO(PR: pending) | promotion includes vaccinations when canonical is missing.

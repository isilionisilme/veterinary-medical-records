# weight

## Current heuristic summary
- Prefer label-based extraction (`peso`, `weight`) with numeric normalization.
- Normalize comma decimals to dot; keep canonical format with `kg` when applicable.
- Guardrails: accepted range `[0.5, 120]`; ignore non-positive values (`0`).

## Guardrails / must-not rules
- Must not accept `0` or negative values.
- Must not accept out-of-range values (`<0.5` or `>120`).
- Must not parse treatment dosage lines as weight.

## Known failure modes / blocked-by-signal notes
- Ambiguous quantity strings in treatment lines can be rejected.
- Missing explicit unit can reduce reliability depending on surrounding context.

## How to test (exact commands)
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py -s -q`
- `python -m pytest backend/tests/unit/test_interpretation_schema.py -q`

## History (commit + PR link)
- Branch `fix/golden-weight-iteration` | Commit `ad366cd0` | PR: [#77](https://github.com/your-org/veterinary-medical-records/pull/77) | docB missing→accepted (`7.2 kg`).
- Commit `c27b2e14` | PR: [#80](https://github.com/your-org/veterinary-medical-records/pull/80) | promotion includes weight when canonical value is missing.
- Weight-noise guard tracked (`0` ignored) | PR: [#80](https://github.com/your-org/veterinary-medical-records/pull/80).

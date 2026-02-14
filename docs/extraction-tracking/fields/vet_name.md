# vet_name

## Current heuristic summary
- Prefer explicit veterinarian labels (`veterinario/a`, `vet`, `Dr./Dra.`).
- Normalize honorific forms and keep person-like name fragments only.
- Exclude clinic/address-like strings.

## Guardrails / must-not rules
- Must not promote clinic-only values as vet_name.
- Must not accept address-like lines.
- Must not overwrite existing canonical value during promotion.

## Known failure modes / blocked-by-signal notes
- Clinic-only headers without a personal name should not be promoted as vet name.
- Address-heavy lines near labels can produce false positives if not guarded.

## How to test (exact commands)
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q`

## History (commit + PR link)
- Branch `fix/golden-vet-name-iteration` | Commit `40762a48` | PR: TODO(PR: pending) | docA missing→accepted (`NOMBRE DEMO`).
- Commit `c27b2e14` | PR: TODO(PR: pending) | promotion includes vet_name when canonical value is missing.

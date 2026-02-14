# symptoms

## Current heuristic summary
- Strict label-only extraction (`síntomas`, equivalent explicit labels).
- Reject dosage/date/administration language with strict guardrails.
- Keep concise symptom phrase values.

## Guardrails / must-not rules
- Must not extract symptoms from treatment administration text.
- Must not accept dosage/date payload as symptom value.
- Must not overwrite existing canonical value during promotion.

## Known failure modes / blocked-by-signal notes
- Free narrative without symptom label remains missing by design.
- Very long treatment paragraphs are excluded to avoid contamination.

## How to test (exact commands)
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q`

## History (commit + PR link)
- Branch `fix/golden-symptoms-iteration` | Commit `3401c318` | PR: TODO(PR: pending) | docA missing→accepted (`vómitos y diarrea`).
- Commit `c27b2e14` | PR: TODO(PR: pending) | promotion includes symptoms when canonical is missing.

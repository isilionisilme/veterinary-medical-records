# Field Guardrails Catalog

## microchip_id
- Business meaning: unique pet microchip identifier.
- Current status:
  - Candidate sources:
    - label-based extraction in candidate mining
    - heuristic keyword-window digit extraction near `microchip/chip/nº chip`
  - Validator/normalizer behavior: digits-only, length 9–15; supports stripping trailing non-digits after valid digit prefix.
- Accept rules:
  - 9–15 digits.
  - Candidate starts with 9–15 digits and trailing text can be trimmed.
- Reject rules:
  - owner/address-like text and alphanumeric non-digit IDs.
  - anything outside 9–15 digit range.
- Common failure modes:
  - owner/address text selected as top1 candidate.
  - legacy runs still showing historical rejects in `limit=20`.
- Examples:
  - Good: `Microchip: 00023035139 NHC` -> `00023035139`
  - Bad: `BEATRIZ ABARCA C/ ORTEGA` -> rejected/no candidate
- Implemented at:
  - [backend/app/application/processing_runner.py](../../backend/app/application/processing_runner.py) (`_mine_interpretation_candidates`, `_candidate_sort_key`)
  - [frontend/src/extraction/fieldValidators.ts](../../frontend/src/extraction/fieldValidators.ts) (`validateMicrochip`)
- Tests:
  - [backend/tests/unit/test_interpretation_schema_v0.py](../../backend/tests/unit/test_interpretation_schema_v0.py)
  - [backend/tests/unit/test_interpretation_canonical_fixtures.py](../../backend/tests/unit/test_interpretation_canonical_fixtures.py)
  - [frontend/src/extraction/fieldValidators.test.ts](../../frontend/src/extraction/fieldValidators.test.ts)
- Notes:
  - Verify with `summary?limit=1` to isolate new behavior from historical runs.

## weight
- Business meaning: patient weight.
- Current status:
  - Candidate sources: label-based extraction (`peso/weight`).
  - Validator behavior: accepts numeric + optional unit, plausible range, normalizes to `X kg`.
- Accept rules:
  - Numeric, range `0.5–120`, unit optional (`kg/kgs`), comma decimals supported.
- Reject rules:
  - `0` treated as missing.
  - out-of-range or non-numeric values.
- Common failure modes:
  - top1 `0` rejected (expected behavior).
- Examples:
  - Good: `7,2kg` -> `7.2 kg`
  - Good: `7.2` -> `7.2 kg`
  - Bad: `0` -> missing/rejected path
- Implemented at:
  - [frontend/src/extraction/fieldValidators.ts](../../frontend/src/extraction/fieldValidators.ts)
- Tests:
  - [frontend/src/extraction/fieldValidators.test.ts](../../frontend/src/extraction/fieldValidators.test.ts)

## visit_date
- Business meaning: clinical visit date.
- Current status:
  - Candidate sources: date mining + anchor-based classification.
  - Validator/normalizer behavior: multiple accepted formats -> ISO.
- Accept rules:
  - `DD/MM/YYYY`, `D/M/YY`, `YYYY-MM-DD`, `YYYY/MM/DD`, `YYYY.MM.DD`.
  - 2-digit year policy: `00–69 => 2000–2069`, `70–99 => 1970–1999`.
- Reject rules:
  - invalid calendar dates or non-date strings.
- Common failure modes:
  - historical rejects for short-year strings in old runs.
- Examples:
  - Good: `08/12/19` -> `2019-12-08`
- Implemented at:
  - [frontend/src/extraction/fieldValidators.ts](../../frontend/src/extraction/fieldValidators.ts)
  - [backend/app/application/processing_runner.py](../../backend/app/application/processing_runner.py) (date candidate classification)
- Tests:
  - [frontend/src/extraction/fieldValidators.test.ts](../../frontend/src/extraction/fieldValidators.test.ts)
  - [backend/tests/unit/test_interpretation_canonical_fixtures.py](../../backend/tests/unit/test_interpretation_canonical_fixtures.py)

## discharge_date
- Business meaning: discharge date.
- Current status:
  - Uses same date validator/normalizer policy as `visit_date`.
- Accept rules:
  - Same accepted formats and year policy.
- Reject rules:
  - invalid/unparseable dates.
- Common failure modes:
  - old runs rejecting short-year format.
- Examples:
  - Good: `05/06/20` -> `2020-06-05`
  - Good: `2020/06/05` -> `2020-06-05`
- Implemented at:
  - [frontend/src/extraction/fieldValidators.ts](../../frontend/src/extraction/fieldValidators.ts)
- Tests:
  - [frontend/src/extraction/fieldValidators.test.ts](../../frontend/src/extraction/fieldValidators.test.ts)

## document_date
- Business meaning: document/report date.
- Current status:
  - Date extraction + same normalization guardrails.
- Accept rules:
  - Same accepted formats and year policy.
- Reject rules:
  - invalid/unparseable dates.
- Common failure modes:
  - timeline/unanchored date ambiguity in older runs.
- Examples:
  - Good: `04/10/19` -> `2019-10-04`
- Implemented at:
  - [frontend/src/extraction/fieldValidators.ts](../../frontend/src/extraction/fieldValidators.ts)
  - [backend/app/application/processing_runner.py](../../backend/app/application/processing_runner.py)
- Tests:
  - [frontend/src/extraction/fieldValidators.test.ts](../../frontend/src/extraction/fieldValidators.test.ts)

---

## vet_name (placeholder)
- Business meaning: veterinarian name.
- Current status: frequent missing in summary; candidate generation quality pending.
- Next tuning focus: header-block capture (`Veterinario/a`, `Dr./Dra.`), disambiguation from clinic labels.

## owner_name (placeholder)
- Business meaning: owner/tutor name.
- Current status: frequent missing in summary.
- Next tuning focus: person-like token extraction, address-token rejection.

## owner_id (placeholder)
- Business meaning: owner identifier (DNI/NIE-like).
- Current status: frequent missing in summary.
- Next tuning focus: explicit DNI/NIE candidate extraction and schema mapping checks.

## symptoms (placeholder)
- Business meaning: clinical symptoms.
- Current status: frequent missing in summary.
- Next tuning focus: section/header-driven candidate mining.

## vaccinations (placeholder)
- Business meaning: vaccination records.
- Current status: frequent missing in summary.
- Next tuning focus: timeline/list pattern candidate extraction.

## reason_for_visit (placeholder)
- Business meaning: reason for consultation.
- Current status: frequent missing in summary.
- Next tuning focus: robust anchor coverage (`motivo`, `consulta`, `reason for visit`).
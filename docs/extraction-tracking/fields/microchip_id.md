# microchip_id

## Current heuristic summary
- Prefer explicit chip labels (`microchip`, `chip`, `nº chip`) with digit extraction (9–15 digits).
- Accept adjacent-line chip evidence when a valid digit block appears near a chip-label line.
- Accept OCR-prefixed windows (`N�`, `Nro`) when followed by a valid 9–15 digit block.
- Keep value digits-only in canonical promotion path.

## Guardrails / must-not rules
- Must not produce a candidate when there is no 9–15 digit sequence.
- Must not promote non-digit chip strings.
- Must not overwrite existing canonical value during promotion.
- Must not accept generic `No:`/`Nro:` reference numbers without chip/microchip context.

## Known failure modes / blocked-by-signal notes
- If raw text has no chip label and no 9–15 digit sequence, extraction remains empty by design.
- Free-text mentions like "poner el chip" without an ID should not produce a candidate.
- Generic invoice/reference lines such as `No: 941000024967769` should remain excluded.

## How to test (exact commands)
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py -s -q`
- `python -m pytest backend/tests/unit/test_interpretation_schema_v0.py -q`
- Optional parity check: `GET /documents/{document_id}/review` + debug summary with same `run_id`.

## History (commit + PR link)
- Commit `7d4b2d7a` | PR: [#77](https://github.com/isilionisilme/veterinary-medical-records/pull/77) | improved microchip capture; docA/docB missing→accepted.
- Commit `c27b2e14` | PR: [#80](https://github.com/isilionisilme/veterinary-medical-records/pull/80) | promotion from top1 candidate when canonical is missing.
- Commit `9b1a691c` | PR: [#77](https://github.com/isilionisilme/veterinary-medical-records/pull/77) | nearby-label fix for real-run pattern (`N� Chip` + digits).
- Branch `fix/golden-microchip-ocr-hardening` | Commits `97a014a1`, `1a732ba2` | PR: [#87](https://github.com/isilionisilme/veterinary-medical-records/pull/87) | adds OCR fallback for malformed `N�`/`Nro` prefixes and guards generic `No:` references.

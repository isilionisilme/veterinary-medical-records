# Extraction Tracking Index

## Latest state
- Last updated: 2026-02-14
- Last field iterated: `microchip_id`
- Golden fields completed: `microchip_id`, `owner_name`, `weight`, `vet_name`, `visit_date`, `discharge_date`, `vaccinations`, `symptoms`
- Current confidence policy: fixed `0.66` for golden-loop promotion and conservative field heuristics.
- Current UI/backend facts:
  - UI renders extracted values from `GET /documents/{document_id}/review`.
  - UI-facing structured values are in `active_interpretation.data.global_schema_v0`.
  - `GET /runs/{run_id}/artifacts/global-schema-v0` has been observed as 404 in parity checks.
  - Debug parity should pin run with `GET /debug/extraction-runs/{document_id}/summary?limit=...&run_id=...`.
- Next recommended minimal iteration: `owner_name` only, because real-run evidence shows owner context (`Datos del Cliente`) but no deterministic label→value extraction accepted yet.

### Anchor legend
- `Commit`: required
- `PR`: link if available, else `TODO(PR: pending)`
- `Run/document`: required in run-parity reports

## Golden iterations (one-field loop)

| Field | Fixture(s) (docA/docB) | Signal source (existing vs added line) | Outcome (missing→accepted) | Conf policy | Branch | Commit | PR link | Tests (commands) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| [microchip_id](fields/microchip_id.md) | docA + docB | Existing signal + later real-run nearby-label signal (`N� Chip` + digits) | docA/docB missing→accepted (`00023035139`, `941000024967769`) | `0.66` | N/A | `7d4b2d7a`, `9b1a691c` | TODO(PR: pending) | `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q` | Digits-only 9–15; no overwrite. |
| [owner_name](fields/owner_name.md) | docB | Existing signal + conservative fallback | docB missing→accepted (`NOMBRE DEMO`) | `0.66` | `fix/golden-owner-name-iteration` | `b012628e` | TODO(PR: pending) | `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q` | Do not guess without deterministic owner signal. |
| [weight](fields/weight.md) | docB | Added fixture line: `Peso: 7,2 kg` | docB missing→accepted (`7.2 kg`) | `0.66` | `fix/golden-weight-iteration` | `ad366cd0` | TODO(PR: pending) | `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q` | Range `[0.5,120]`; ignore `0`. |
| [vet_name](fields/vet_name.md) | docA | Existing signal | docA missing→accepted (`NOMBRE DEMO`) | `0.66` | `fix/golden-vet-name-iteration` | `40762a48` | TODO(PR: pending) | `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q` | Exclude clinic/address values. |
| [visit_date](fields/visit_date.md) | docA | Existing signal | docA missing→accepted (`2024-07-17`) | `0.66` | `fix/golden-visit-date-iteration` | `6749aa38` | TODO(PR: pending) | `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q` | Ignore birthdate context. |
| [discharge_date](fields/discharge_date.md) | docA | Added fixture line: `Alta: 20/07/2024` | docA missing→accepted (`2024-07-20`) | `0.66` | `fix/golden-discharge-date-iteration` | `cb95be5e` | TODO(PR: pending) | `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q` | Label-based only. |
| [vaccinations](fields/vaccinations.md) | docA | Added fixture line: `Vacunas: Rabia, Moquillo, Parvo` | docA missing→accepted (`Rabia, Moquillo, Parvo`) | `0.66` | `fix/golden-vaccinations-iteration` | `c5d3ffbe` | TODO(PR: pending) | `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q` | Strict label-only. |
| [symptoms](fields/symptoms.md) | docA | Added fixture line: `Síntomas: vómitos y diarrea` | docA missing→accepted (`vómitos y diarrea`) | `0.66` | `fix/golden-symptoms-iteration` | `3401c318` | TODO(PR: pending) | `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q` | Strict label-only; reject treatment noise. |

### Promotion iteration (candidates → structured interpretation)
- Commit: `c27b2e14`
- Message: `Golden: promote missing goal fields from candidates`
- Scope: promote only goal fields (`microchip_id`, `owner_name`, `weight`, `vet_name`, `visit_date`, `discharge_date`, `vaccinations`, `symptoms`) when canonical value is missing and candidate top1 exists.
- Guardrails: deterministic, never overwrite existing canonical value, confidence policy fixed at `0.66`, microchip requires digits-only 9–15.

### Run mismatch risk / summary filtering
- Optional run pinning introduced for debug summary:
  - `GET /debug/extraction-runs/{document_id}/summary?limit=...&run_id=...`
- Aggregation uses selected run when `run_id` is provided, reducing cross-run confusion in diagnostics.

### Weight noise fix
- Rule tracked: `weight` must ignore zero candidates (`0`).

## UI ↔ Backend parity / debugging reports
- [UI run parity](runs/ui-run-parity.md): UI fields come from `/documents/{document_id}/review`, using `active_interpretation.data.global_schema_v0`; explicit `/runs/{run_id}/artifacts/global-schema-v0` observed as 404 in checks.
- [UI field parity (microchip/owner)](runs/ui-field-parity-microchip-owner.md): in one real run, both empty with `has_candidates=false`, classified as detection-missing at that point.
- [Raw-text signal diagnostic (microchip/owner)](../debug/raw-text-signal-microchip-owner.md): later evidence found clear raw_text signal for microchip and prompted a minimal microchip-only heuristic fix.

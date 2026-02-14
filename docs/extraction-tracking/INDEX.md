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
- Next recommended minimal iteration: microchip parity re-check on recent real runs to confirm OCR `N�`/`Nro` variants increase candidate presence without false positives.

## Baseline snapshots
- [Baseline v1 (post-PR #83)](runs/baseline-v1.md): freeze point before PR #85+ iterations.

## Guardrails & risk
- [Consolidated risk matrix](risk-matrix.md): high-risk false-positive patterns and active guardrails across golden fields.

### Anchor legend
- `Commit`: required
- `PR`: link if available, else `TODO(PR: pending)`
- `Run/document`: required in run-parity reports

## PR Storyline

The following PRs represent the evolution of the extraction tracking system. Each chapter corresponds to a major milestone or refactor, with direct links to the relevant PRs for reviewer traceability.

| Chapter | PR | Title & Summary |
|---------|----|-----------------|
| 1. Golden Loop Foundation | [#77](https://github.com/isilionisilme/veterinary-medical-records/pull/77) | Initial golden loop extraction tracking docs. Establishes evidence-first, one-field-per-iteration, test-driven process. |
| 2. UI/Backend Parity | [#78](https://github.com/isilionisilme/veterinary-medical-records/pull/78) | Adds UI parity tracking and run reports. Ensures backend and UI extraction are synchronized. |
| 3. Field Catalogs | [#79](https://github.com/isilionisilme/veterinary-medical-records/pull/79) | Introduces per-field documentation and catalogs for all golden fields. |
| 4. Run Reports | [#80](https://github.com/isilionisilme/veterinary-medical-records/pull/80) | Adds detailed run/debug reports for extraction and UI parity. |
| 5. Reviewer Hardening | [#81](https://github.com/isilionisilme/veterinary-medical-records/pull/81) | Refactors docs for reviewer-friendliness, PR/commit anchoring, and minimal duplication. |
| 6. Docs-Only PR | [#82](https://github.com/isilionisilme/veterinary-medical-records/pull/82) | Creates a single, clean docs-only PR for all extraction tracking documentation. |
| 7. PR Storyline & Anchors | [#83](https://github.com/isilionisilme/veterinary-medical-records/pull/83) | Adds PR Storyline, explicit PR anchors, and final reviewer-facing improvements. |
| 8. Baseline Snapshot v1 | [#84](https://github.com/isilionisilme/veterinary-medical-records/pull/84) | Freezes post-#83 baseline and expected-vs-observed anchors before next loop. |
| 9. owner_name Parity Recheck | [#85](https://github.com/isilionisilme/veterinary-medical-records/pull/85) | Applies conservative `Datos del Cliente` fallback and hardens ambiguity guardrails. |
| 10. owner_name Post-fix Parity Evidence | [#86](https://github.com/isilionisilme/veterinary-medical-records/pull/86) | Confirms owner_name remains detection-missing (no UI mismatch) on a fresh post-fix run. |
| 11. microchip OCR Hardening | [#87](https://github.com/isilionisilme/veterinary-medical-records/pull/87) | Hardens malformed `N�`/`Nro` microchip capture and adds false-positive guardrails. |

## Golden iterations (one-field loop)

| Field | Fixture(s) (docA/docB) | Signal source (existing vs added line) | Outcome (missing→accepted) | Conf policy | Branch | Commit | PR link | Tests (commands) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| [microchip_id](fields/microchip_id.md) | docA + docB + OCR synthetic | Existing signal + nearby-label signal (`N� Chip` + digits) + OCR `N�`/`Nro` prefix window fallback | docA/docB missing→accepted (`00023035139`, `941000024967769`); OCR synthetic now accepted (`941000024967769`) | `0.66` | `fix/golden-microchip-ocr-hardening` | `7d4b2d7a`, `9b1a691c`, `97a014a1`, `1a732ba2` | [#87](https://github.com/isilionisilme/veterinary-medical-records/pull/87) | `python -m pytest backend/tests/unit/test_interpretation_schema_v0.py backend/tests/unit/test_golden_extraction_regression.py -q` | Digits-only 9–15; no overwrite. |
| [owner_name](fields/owner_name.md) | docB + owner-context synthetic | Existing signal + conservative fallback + `Datos del Cliente` context support for `Nombre:` lines | docB missing→accepted (`NOMBRE DEMO`); synthetic owner block now accepted (`BEATRIZ ABARCA`) | `0.66` | `fix/golden-owner-name-minimal-loop` | `b012628e`, `efcab057` | TODO(PR: pending) | `python -m pytest backend/tests/unit/test_interpretation_schema_v0.py backend/tests/unit/test_golden_extraction_regression.py -q` | Keep deterministic context; no free-name guessing. |
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
- [UI field parity (owner_name post-PR85)](runs/ui-field-parity-owner-name-post-pr85.md): reprocess run remains `owner_name=null` with `has_candidates=false`, confirming detection-missing and no UI mismatch.
- [Baseline v1 snapshot](runs/baseline-v1.md): freeze point (post-PR #83) for expected-vs-observed comparison before next loop.
- [Raw-text signal diagnostic (microchip/owner)](../debug/raw-text-signal-microchip-owner.md): later evidence found clear raw_text signal for microchip and prompted a minimal microchip-only heuristic fix.

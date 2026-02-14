# owner_name

## Current heuristic summary
- Prefer explicit owner labels (`propietario/a`, `titular`, `owner`) with person-like value extraction.
- Apply conservative normalization (remove address suffix, reject vet/clinic context).
- Keep confidence policy fixed at `0.66` for golden-loop promotion.

## Guardrails / must-not rules
- Must not infer owner from a standalone person-like name without deterministic owner context.
- Must not accept values that include address/contact payload.
- Must not use vet/clinic-context lines for owner candidate extraction.
- For `Nombre:` fallback, accept only with explicit owner cue in local context or when previous non-empty line is exactly `Datos del Cliente`.

## Known failure modes / blocked-by-signal notes
- `Datos del Cliente` + `Nombre:` is now accepted as owner context; other unlabeled headers can still be ambiguous.
- Not accepted example: `Datos del Cliente` + `Paciente: LUNA BELLA` + `Nombre: LUNA BELLA` (patient-labeled block).
- When debug shows `has_candidates=false`, do not guess owner from arbitrary nearby names.
- Post-PR97, `run_id`-pinned debug summary is available, but returns `404` when no snapshot exists for that run; this indicates snapshot availability gap, not extraction absence.

## How to test (exact commands)
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q`
- For parity: `GET /debug/extraction-runs/{document_id}/summary?limit=1&run_id={run_id}` and inspect `owner_name`.

## History (commit + PR link)
- Branch `fix/golden-owner-name-iteration` | Commit `b012628e` | PR: [#77](https://github.com/isilionisilme/veterinary-medical-records/pull/77) | docB missing→accepted (`NOMBRE DEMO`).
- Commit `c27b2e14` | PR: [#80](https://github.com/isilionisilme/veterinary-medical-records/pull/80) | promotion includes owner_name when top1 exists and canonical value is missing.
- Branch `fix/golden-owner-name-minimal-loop` | Commits `efcab057`, `9bce25cf` | PR: [#85](https://github.com/isilionisilme/veterinary-medical-records/pull/85) | accepts `Nombre:` with strict context and guards patient-labeled ambiguity.
- Branch `fix/owner-name-signal-minimal-loop` | Commits `cc220af6`, `8a4f94fd` | PR: [#95](https://github.com/isilionisilme/veterinary-medical-records/pull/95) | supports tabular `Nombre` layout under `Datos del Cliente` with bounded lookback/forward scan windows.
- Diagnostic run anchor (no code change): `document_id=e05bef44-79d9-4c36-a8f4-490cf6d87473`, `run_id=d838c09a-9589-4dec-811e-dedeb7c75380` (owner missing with no candidate).
- Post-fix parity anchor (no code change): `document_id=e05bef44-79d9-4c36-a8f4-490cf6d87473`, `run_id=a7229396-e639-4937-bf0d-8d31036c77bd` (owner still missing with `has_candidates=false`, classified as detection-missing).
- Post-PR93 parity anchor set (no code change): latest-5 documents show `owner_name=null` and `has_candidates=false` in all sampled runs (see `runs/ui-field-parity-owner-name-post-pr93.md`).
- Post-PR95 parity anchor set (no code change): fresh runs include accepted review values (`owner_name=BEATRIZ ABARCA`) for tabular documents; see `runs/ui-field-parity-owner-name-post-pr95.md` for run-level details and debug-summary lag note.
- Post-PR97 parity anchor set (no code change): run-pinned summary requests (`run_id`) return `404` on sampled runs without persisted snapshots; see `runs/ui-field-parity-owner-name-post-pr97.md`.

# owner_name

## Current heuristic summary
- Prefer explicit owner labels (`propietario/a`, `titular`, `owner`) with person-like value extraction.
- Apply conservative normalization (remove address suffix, reject vet/clinic context).
- Keep confidence policy fixed at `0.66` for golden-loop promotion.

## Guardrails / must-not rules
- Must not infer owner from a standalone person-like name without deterministic owner context.
- Must not accept values that include address/contact payload.
- Must not use vet/clinic-context lines for owner candidate extraction.

## Known failure modes / blocked-by-signal notes
- `Datos del Cliente` header blocks without explicit owner label can be ambiguous.
- When debug shows `has_candidates=false`, do not guess owner from arbitrary nearby names.

## How to test (exact commands)
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q`
- For parity: `GET /debug/extraction-runs/{document_id}/summary?limit=1&run_id={run_id}` and inspect `owner_name`.

## History (commit + PR link)
- Branch `fix/golden-owner-name-iteration` | Commit `b012628e` | PR: TODO(PR: pending) | docB missing→accepted (`NOMBRE DEMO`).
- Commit `c27b2e14` | PR: TODO(PR: pending) | promotion includes owner_name when top1 exists and canonical value is missing.
- Diagnostic run anchor (no code change): `document_id=e05bef44-79d9-4c36-a8f4-490cf6d87473`, `run_id=d838c09a-9589-4dec-811e-dedeb7c75380` (owner missing with no candidate).

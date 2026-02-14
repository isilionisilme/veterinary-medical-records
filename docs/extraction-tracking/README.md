# Extraction Tracking

## Purpose
This folder tracks the extraction program using an evidence-first, one-field-per-iteration loop. It documents what changed, why it changed, and how to reproduce results from fixtures and real-document diagnostics.

## Strategy (practical)
- Evidence first: no rule change without observable signal from fixture or real raw text.
- One field per iteration: keep blast radius small and reviews fast.
- Surgical changes: avoid broad refactors and avoid accidental behavior drift.
- Test-driven loop: add/adjust focused tests in the same iteration.
- Run alignment: always compare UI, review payload, and debug summary using the same run_id.

## Reviewer quick status
- Open `INDEX.md` first for latest state, field-level completion, and next minimal step.
- Open `fields/<field>.md` for guardrails and exact test commands before reviewing any diff.
- Open `risk-matrix.md` for a consolidated view of false-positive risks and active guardrails.
- Open `INDEX.md` section `Chapter closeout` for chapter status and remaining anchor gaps.
- Open `runs/*.md` only when validating UI/backend parity or run-specific diagnostics.
- For frozen comparison before new iterations, open `runs/baseline-v1.md`.

## Anchor policy (required per entry)
- Golden iteration entries must include: field, commit hash, branch, test command.
- Add PR link when available; if a verified direct commit has no PR, use `N/A (direct commit, no PR)`.
- Run diagnostics must include `document_id`, `run_id`, and endpoint(s) queried.
- Keep detailed history in `fields/*.md`; keep `INDEX.md` concise and pointer-oriented.

## Why this is useful
- Traceability: each field has a timeline with branch/commit/tests/evidence.
- Reproducibility: commands and fixture sources are explicit.
- Review readiness: reviewers can inspect one field in isolation.
- Lower confusion: parity reports prevent mixing values from different runs.
- Safer iteration speed: fixes remain minimal and reversible.

## Quick commands
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py -s -q`
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py backend/tests/unit/test_interpretation_schema_v0.py -q`
- `python -m pytest backend/tests/unit/test_interpretation_schema_v0.py backend/tests/integration/test_extraction_observability_api.py -q`

## Debug endpoints for UI/backend parity
- `GET /documents/{document_id}/review`
- `GET /debug/extraction-runs/{document_id}/summary?limit=1&run_id={run_id}`
- `GET /debug/extraction-runs/{document_id}`
- `GET /runs/{run_id}/artifacts/raw-text`

Notes:
- In current checks, `GET /runs/{run_id}/artifacts/global-schema-v0` returned 404; UI-facing structured values are in `active_interpretation.data.global_schema_v0` from `/documents/{document_id}/review`.

## How to add a new iteration entry
1. Confirm evidence (fixture or real run) and isolate one target field.
2. Add/update focused tests first or together with the fix.
3. Record branch, commit, PR/TODO, commands, and concise evidence in `INDEX.md`.
4. Add/update the specific field page under `fields/`.
5. If UI/debug parity was checked, add/update a report in `runs/`.
6. Keep entries concise and consistent; avoid narrative-only notes.

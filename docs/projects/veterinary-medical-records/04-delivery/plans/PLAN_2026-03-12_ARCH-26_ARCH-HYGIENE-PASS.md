# Plan A (ARCH-26): Hygiene Pass — Architecture Signal Cleanup

> **Operational rules:** See [plan-execution-protocol.md](../../../03-ops/plan-execution-protocol.md) for agent execution protocol, scope boundary, and validation gates.

**Branch:** docs/arch-26-plan-linkage
**Worktree:** D:/Git/veterinary-medical-records
**Execution Mode:** Autonomous
**Model Assignment:** Uniform
**PR:** Pending (PR created on explicit user request)
**Backlog item:** [arch-26-architecture-hygiene-pass.md](../Backlog/arch-26-architecture-hygiene-pass.md)
**Related item ID:** `ARCH-26`

## TL;DR
Plan de ejecucion de `ARCH-26` para eliminar anti-patrones que un evaluador AI de arquitectura flagearia inmediatamente: dynamic re-export (ARCH-24), function-local imports, y `__init__.py` exportando nombres con `_` como API publica.

## Prerequisitos
- Branch: crear `improvement/arch-hygiene-pass` desde `main` actualizado
- Verificar que ARCH-01 merge está en main

## Steps

### Phase 1: ARCH-24 — Explicit re-exports in document_service.py
1. **Rewrite `backend/app/application/document_service.py`** (currently 8 LOC)
   - Replace `globals().update({name: getattr(_documents, name) for name in __all__})` with explicit named imports from `backend.app.application.documents`
   - Use the 44 symbols in `documents/__init__.py` `__all__` as the import list
   - Keep `__all__` explicit too — list every name
   - *Reference*: Current `__init__.py` has `__all__ = [44 symbols]`

2. **Verify callers still resolve** — 5 files import from `document_service`:
   - `backend/app/api/routes_review.py:21`
   - `backend/app/api/routes_processing.py:14`
   - `backend/app/api/routes_documents.py:21`
   - `backend/tests/unit/test_confidence_config_and_fallback.py:3`
   - `backend/tests/unit/test_document_service.py:6`

### Phase 2: Move function-local imports to module level
3. **`backend/app/application/documents/review_payload_projector.py` line 112** — move `from backend.app.application.documents.visit_scoping import normalize_canonical_review_scoping` to top of file (after existing imports)
   - Check for circular import: `review_payload_projector` → `visit_scoping`. Trace: `visit_scoping` does NOT import from `review_payload_projector`, so no cycle. Safe to move.

4. **`backend/app/application/documents/review_payload_projector.py` line 27** — move `from backend.app.application.documents.edit_service import _sanitize_confidence_breakdown` to top of file
   - Check for circular import: `review_payload_projector` → `edit_service`. Trace: `edit_service` does NOT import from `review_payload_projector`. Safe to move.

### Phase 3: Clean public API naming
5. **`backend/app/application/documents/__init__.py`** — rename the 3 underscore-prefixed public exports:
   - `_locate_visit_date_occurrences_from_raw_text` → `locate_visit_date_occurrences_from_raw_text`
   - `_normalize_visit_date_candidate` → `normalize_visit_date_candidate`
   - `_project_review_payload_to_canonical` → `project_review_payload_to_canonical`
   - Update `__all__` entries accordingly
   - ⚠️ This requires updating all callers of these names. Grep each one.
   - Alternative (lower risk): keep `_` names as aliases + add non-`_` versions. Add deprecation comment.
   - **Decision needed**: full rename or alias approach?

6. **Update `document_service.py`** to match renamed exports from step 5

### Phase 4: Lint & validate
7. Run `ruff check --fix` + `ruff format` on all changed files
8. Run `python -m pytest backend/tests/ -x --tb=short -q` — all 706+ tests must pass
9. Run `scripts/ci/test-L3.ps1 -SkipDocker -SkipE2E` — must pass

## Relevant files
- `backend/app/application/document_service.py` — ARCH-24 dynamic re-export (REWRITE)
- `backend/app/application/documents/__init__.py` — public API exports (MODIFY)
- `backend/app/application/documents/review_payload_projector.py` — function-local imports (MODIFY)
- `backend/app/api/routes_review.py`, `routes_processing.py`, `routes_documents.py` — callers to verify
- `backend/tests/unit/test_document_service.py`, `test_confidence_config_and_fallback.py` — test callers

## Verification
1. `python -c "from backend.app.application.document_service import get_document_review"` — explicit import works
2. `ruff check backend/app/application/document_service.py` — no lint errors
3. `python -m pytest backend/tests/ -x --tb=short -q` — all pass
4. `scripts/ci/test-L3.ps1 -SkipDocker -SkipE2E` — green

## Decisions
- Step 5 (public API rename) has risk if external callers use `_` names. Recommend alias approach for safety.
- Scope deliberately excludes `_shared.py` internal functions — those are package-private module convention, not an anti-pattern.
- Scope deliberately excludes orchestrator state object (ARCH-02 territory).
- This plan is the implementation path for `ARCH-26`.

## Parallel notes
- No conflict with Plan B (regression tests) — Plan B tests through public entry points only.

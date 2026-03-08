# Plan: Autocalculo de edad desde fecha de nacimiento

> **Operational rules:** See [plan-execution-protocol.md](../../../03-ops/plan-execution-protocol.md) for execution protocol and hard-gates.

**Branch:** `codex/veterinary-medical-records/feature/age-autocalc-implementation`
**PR:** Pending (PR created on explicit user request)
**User Story:** N/A — standalone derivation improvement (no parent user story)
**Prerequisite:** None
**Worktree:** `D:/Git/veterinary-medical-records`
**CI Mode:** `2) Pipeline depth-1 gate` (default)
**Agents:** Planning agent + Execution agent
**Automation Mode:** `Supervisado`
**Iteration:** 1
**Mode:** feature with backend normalization + frontend UX hint.

---

## Context

Hoy el esquema mantiene `age` y `dob` como campos separados. La edad se puede editar manualmente y no se deriva de forma automatica, lo que permite inconsistencias cuando existe fecha de nacimiento valida.

Decisiones cerradas para este plan:

1. Fecha de referencia para el calculo: **ultima `visit_date` valida**.
2. Prioridad: **la edad manual prevalece** sobre la autocalculada.
3. UX: `age` permanece **autorrelleno y editable**.

---

## Objective

1. Derivar `age` desde `dob` cuando corresponda, usando la ultima visita como fecha de referencia.
2. Mantener trazabilidad del origen (`human` vs `derived`) y evitar sobrescribir correcciones humanas.
3. Conservar compatibilidad de API y contrato actual de review/interpretation.
4. Exponer en UI una indicacion clara cuando `age` sea derivada.

## Scope Boundary (strict)

- **In scope:** normalizacion backend en lectura/proyeccion de interpretacion, preservacion de prioridad manual, ajuste de UI para hint de campo derivado, tests unitarios/integracion asociados.
- **Out of scope:** nuevos endpoints, cambios de contrato global schema, recalculo historico masivo de artefactos existentes, cambios de logica clinica fuera de `age`/`dob`.

---

## Steps

### F1 - Backend derivation rules

| Step | Task | Agent | Gate |
|------|------|-------|------|
| F1-A | Implementar helper para calcular edad en anos completos desde `dob` y fecha de referencia | 🔄 auto | - |
| F1-B | Resolver fecha de referencia con prioridad: ultima `visit_date` valida -> `document_date` valida -> fecha actual del sistema | 🔄 auto | - |
| F1-C | Aplicar derivacion de `age` durante normalizacion de review payload solo cuando no exista `age` manual no vacia | 🔄 auto | - |
| F1-D | Marcar origen `derived` para `age` autocalculada y reflejar valor en `fields` + `global_schema` | 🔄 auto | - |

### F2 - Frontend UX behavior

| Step | Task | Agent | Gate |
|------|------|-------|------|
| F2-A | Mantener `age` editable en dialogo de campo sin bloquear guardado manual | 🔄 auto | - |
| F2-B | Mostrar hint contextual cuando `age` venga con origen `derived` | 🔄 auto | - |
| F2-C | Verificar que edicion manual de `age` sigue teniendo prioridad tras refrescos/recarga del review | 🔄 auto | - |

### F3 - Validation and hard-gates

| Step | Task | Agent | Gate |
|------|------|-------|------|
| F3-A | Tests unitarios backend: calculo, fallbacks, DOB invalida/futura, no-overwrite de valor manual | 🔄 auto | - |
| F3-B | Test de integracion backend: `get_document_review` proyecta `age` derivada y respeta `age` manual | 🔄 auto | - |
| F3-C | Tests frontend: render de hint derivado y persistencia de edicion manual | 🔄 auto | - |
| F3-D | Documentation task: no-doc-needed (internal derivation logic, no new API surface or user-facing docs) | 🔄 auto | - |
| F3-E | 🚧 Validacion funcional de usuario en documento con multiples visitas y DOB presente | 🚧 hard-gate | User approval |

---

## Execution Status

**Legend**

- 🔄 auto-chain — executable by agent
- 🚧 hard-gate — requires user review/decision

- [x] F1-A — Helper de calculo de edad ✅ validated (`backend/tests/unit/test_age_derivation.py`)
- [x] F1-B — Resolucion de fecha de referencia ✅ validated (`backend/tests/unit/test_age_derivation.py`)
- [x] F1-C — Derivacion condicionada por prioridad manual
- [x] F1-D — Persistencia de origen `derived` en proyeccion
- [x] F2-A — Edad editable sin bloqueo
- [x] F2-B — Hint visual de campo derivado
- [x] F2-C — Prioridad manual tras refresco
- [x] F3-A — Unit tests backend
- [x] F3-B — Integration test backend
- [x] F3-C — Tests frontend
- [x] F3-D — ✅ no-commit (no-doc-needed: internal derivation logic, no new API surface or user-facing documentation required)
- [x] F3-E — ✅ validado por usuario en entorno dev

---

## Prompt Queue

### Prompt 1 — F1-A / F1-B (consumed → see Active Prompt)

### Prompt 2 — F1-C / F1-D — Conditional derivation + origin tracking

**Objective:** Wire the helpers from F1-A/B into the review normalization pipeline so that `age` is auto-derived when appropriate, and tag `origin: "derived"` for traceability.

**Target files:**
- `backend/app/application/field_normalizers.py` — `normalize_canonical_fields()`
- `backend/app/application/documents/review_service.py` — `_normalize_review_interpretation_data()` or `_project_review_payload_to_canonical()`
- `backend/app/application/documents/_shared.py` — if constants needed

**F1-C — Conditional derivation (in `normalize_canonical_fields`)**
- After existing normalization of `dob`, `visit_date`, and `document_date`:
  1. Check if `age` is empty/None AND `dob` is present and valid.
  2. Call `resolve_reference_date(visits, document_date)` to get the reference date.
  3. Call `calculate_age_in_years(dob, reference_date)` to compute age.
  4. If result is not None, set `age` to `str(result)`.
  5. If `age` was already non-empty (manual value), do NOT overwrite — skip derivation entirely.
- `visits` list: extract from the review payload's visit groups — each visit group has metadata keys including `visit_date`. Pass the flat list of visit dicts to the resolver.
- Import `calculate_age_in_years` and `resolve_reference_date` from `backend.app.application.age_derivation`.

**F1-D — Origin tracking**
- When age IS derived (step above triggered), set a companion key `age_origin: "derived"` on the normalized dict.
- When age is NOT derived (manual value kept), set `age_origin: "human"`.
- When age is absent and derivation fails, do not set `age_origin`.
- The `origin` field on `ReviewField` already exists with values `"machine" | "human"`. Extend to support `"derived"` — this is a string value, no schema change needed.
- In `_project_review_payload_to_canonical` (or wherever the final field dict is built), ensure the `origin` property on the age field reflects the derivation source:
  - If age was derived → `origin: "derived"`
  - If age was manual → `origin: "human"`
  - If age came from OCR and was not modified → `origin: "machine"` (default, no change)

**Guardrails:**
- Do NOT change `edit_service.py` — manual edit priority is already handled by F1-C's "skip if non-empty" logic.
- Do NOT change the global schema contract — `origin` is a field-level runtime property, not a schema key.
- Do NOT change frontend files — that is F2 scope.

**Inline commit recommendation:**
- **When:** after F1-C + F1-D integration and existing tests still pass.
- **Scope:** `field_normalizers.py`, `review_service.py`, possibly `_shared.py`.
- **Suggested message:** `feat(plan-f1cd): integrate conditional age derivation with origin tracking`
- **Expected validation:** `python -m pytest backend/tests/ -v --no-cov -x` green (full backend suite, no regressions).

---

### Prompt 3 — F2-A / F2-B / F2-C — Frontend UX: editable age + derived hint

**Objective:** Keep `age` fully editable in the field edit dialog, show a visual hint when the value is derived, and verify manual edits take priority after page refresh.

**Target files:**
- `frontend/src/components/structured/FieldEditDialog.tsx`
- `frontend/src/components/review/WorkspaceDialogs.tsx`
- `frontend/src/components/review/ReviewFieldRenderers.tsx`
- `frontend/src/hooks/useFieldEditing.ts` (read-only check — no changes expected)
- `frontend/src/types/appWorkspace.ts` (extend `origin` type if needed)

**Context:**
- `ReviewField.origin` already exists as `"machine" | "human"` (see `appWorkspace.ts` L119-140).
- The field edit dialog receives data via `editingField?.rawField?.origin`.
- Existing patterns: `CriticalBadge` for critical fields, amber background for `origin === "human"`.
- `isFieldModified` check in `ReviewFieldRenderers.tsx` L218: `item.rawField?.origin === "human"`.

**F2-A — Age remains editable**
- Verify (no code change expected): `FieldEditDialog` already renders `age` as a regular `<Input>` with no disable logic. Confirm no blocking condition exists. If any conditional disabling exists, remove it.

**F2-B — Derived hint in dialog and field list**
1. Extend the `origin` type in `appWorkspace.ts` to include `"derived"`: `origin: "machine" | "human" | "derived"`.
2. In `FieldEditDialog.tsx`: when `fieldOrigin === "derived"`, render a small hint below the input: `"Edad calculada desde fecha de nacimiento"` (use a subtle text style, e.g., `text-xs text-blue-500`).
3. Pass `fieldOrigin` prop from `WorkspaceDialogs.tsx` to `FieldEditDialog`: `fieldOrigin={editingField?.rawField?.origin}`.
4. In `ReviewFieldRenderers.tsx`: add a derived visual style similar to the existing human-edit amber pattern. Use a distinct color (e.g., `!bg-blue-50 ring-1 ring-blue-300/70`) when `origin === "derived"`.

**F2-C — Manual priority after refresh**
- This is a behavioral verification, not a code change. After a user edits the `age` field manually (which sets `origin: "human"` via the edit API), refreshing the page should show the manual value, NOT the derived value. This is guaranteed by F1-C's "skip if non-empty" logic. Confirm by reading the data flow.
- If any code prevents this, fix it.

**Guardrails:**
- Do NOT change backend files — backend is done by this point.
- Do NOT add new API calls or endpoints.
- Keep styling minimal and consistent with existing CriticalBadge / amber-override patterns.

**Inline commit recommendation:**
- **When:** after F2-A/B/C and frontend tests pass.
- **Scope:** `FieldEditDialog.tsx`, `WorkspaceDialogs.tsx`, `ReviewFieldRenderers.tsx`, `appWorkspace.ts`.
- **Suggested message:** `feat(plan-f2abc): add derived-age hint in field dialog and review list`
- **Expected validation:** `npm --prefix frontend run test -- --run` green.

---

### Prompt 4 — F3-A / F3-B / F3-C — Test suite

**Objective:** Add targeted tests covering the age derivation feature end-to-end.

**Target files:**
- `backend/tests/unit/test_age_derivation.py` (extend if needed beyond F1-A/B tests)
- `backend/tests/unit/test_field_normalizers.py` or new `backend/tests/unit/test_age_normalization_integration.py`
- `backend/tests/integration/` — add or extend test for `get_document_review` with age derivation
- `frontend/src/components/structured/FieldEditDialog.test.tsx` (new or extend)

**F3-A — Backend unit tests** (extend existing + add new)
- `calculate_age_in_years`: already tested in F1-A/B. Verify coverage of: exact birthday edge case, leap year DOB, `None`/empty inputs, future DOB.
- `resolve_reference_date`: already tested in F1-A/B. Verify: multiple visits with different dates, all invalid dates fallback to today, empty visits list.
- `normalize_canonical_fields` with age derivation: new tests —
  - dob present + age empty → age derived correctly
  - dob present + age non-empty → age NOT overwritten
  - dob invalid + age empty → age stays empty
  - dob future + age empty → age stays empty
  - origin set to `"derived"` when age is auto-calculated
  - origin stays `"human"` when age is manually set

**F3-B — Backend integration test**
- In the integration test for `get_document_review`, add a case with:
  - A document that has `dob` but no `age` in the interpretation.
  - At least one visit with `visit_date`.
  - Assert the response includes `age` with the correct derived value and `origin: "derived"`.
- Add a complementary case where `age` is manually set and assert it is NOT overwritten.

**F3-C — Frontend tests**
- `FieldEditDialog`: render with `fieldOrigin="derived"` → assert hint text `"Edad calculada desde fecha de nacimiento"` is visible.
- `FieldEditDialog`: render with `fieldOrigin="human"` → assert hint is NOT visible.
- `ReviewFieldRenderers`: render a field with `origin: "derived"` → assert blue styling class is applied.

**Guardrails:**
- Do NOT modify production code — tests only.
- Follow existing test patterns and fixtures.
- Use `--no-cov` for speed during development; CI will add coverage.

**Inline commit recommendation:**
- **When:** after all new tests pass.
- **Scope:** test files only.
- **Suggested message:** `test(plan-f3abc): add unit/integration/frontend tests for age derivation`
- **Expected validation:** full test suite green — `python -m pytest backend/tests/ -v --no-cov` AND `npm --prefix frontend run test -- --run`.

---

### Prompt 5 — F3-D — Documentation task (no-doc-needed)

**Objective:** Close the mandatory documentation task.

**Action:** Mark F3-D as `[x]` with `✅ \`no-commit (no-doc-needed: internal derivation logic, no new API surface or user-facing documentation required)\``.

No code or documentation changes needed.

---

### Prompt 6 — F3-E — 🚧 User functional validation (hard-gate)

**Objective:** User validates the feature on a running dev environment.

**Pre-conditions (agent must verify before asking user):**
1. Start dev environment: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`
2. Backend reachable: `http://localhost:8000/health` → HTTP 200
3. Frontend reachable: `http://localhost:5173` → HTTP 200

**Test scenario for user:**
1. Open a document that has `dob` and multiple visits but no manually-set `age`.
2. Verify the `age` field shows a derived value matching the expected calculation.
3. Verify the blue "calculated from DOB" hint is visible in the field list and edit dialog.
4. Edit `age` manually, save, refresh the page → verify the manual value persists and the hint disappears (origin changes to `"human"`).
5. Confirm no regressions in other fields.

**This is a 🚧 hard-gate.** The agent MUST STOP here and wait for explicit user approval before proceeding.

## Active Prompt

### F1-A / F1-B — Age derivation helper + reference-date resolution

**Objective:** Create a pure helper function that calculates age in complete years from `dob` and a reference date, plus a resolver that picks the best reference date from the review payload.

**Target files:**
- New helper: `backend/app/application/age_derivation.py` (new module)
- Tests: `backend/tests/unit/test_age_derivation.py` (new)

**Context (read before coding):**
- `age` is `value_type: "string"` (schema key in `shared/global_schema_contract.json`), critical, required.
- `dob` is `value_type: "date"`, optional, non-critical.
- Date normalization already exists in `backend/app/application/field_normalizers.py`: `_normalize_date_value()` outputs `DD/MM/YYYY`.
- Visit-scoped keys include `visit_date` (see `backend/app/application/documents/_shared.py` L167, `_VISIT_GROUP_METADATA_KEYS`).
- `document_date` is document-scoped metadata.

**F1-A — `calculate_age_in_years(dob: str, reference_date: str) -> int | None`**
- Inputs: `dob` and `reference_date` as strings in `DD/MM/YYYY` format (post-normalization).
- Returns complete years (floor) or `None` if:
  - Either input is `None`, empty, or unparseable.
  - `dob` is in the future relative to `reference_date`.
- Pure function, no side effects. Tested in isolation.

**F1-B — `resolve_reference_date(visits: list[dict], document_date: str | None) -> str | None`**
- Priority chain:
  1. Latest valid `visit_date` across all visits in the payload.
  2. `document_date` if valid.
  3. Today's date (`datetime.date.today()` formatted as `DD/MM/YYYY`).
- A date is "valid" if it parses and is not in the future.
- Returns `DD/MM/YYYY` string.

**Guardrails:**
- Do NOT touch `review_service.py`, `edit_service.py`, or `field_normalizers.py` — integration is F1-C scope.
- Do NOT add `origin` tracking yet — that is F1-D scope.
- Reuse `_normalize_date_value` from `field_normalizers.py` if needed for parsing, but import cleanly.

**Inline commit recommendation:**
- **When:** after F1-A + F1-B are implemented and unit tests pass.
- **Scope:** `backend/app/application/age_derivation.py`, `backend/tests/unit/test_age_derivation.py`.
- **Suggested message:** `feat(plan-f1ab): add age derivation helper and reference-date resolver`
- **Expected validation:** `python -m pytest backend/tests/unit/test_age_derivation.py -v --no-cov` green.

---

## Acceptance Criteria

1. Con `dob` valida y sin `age` manual, el sistema muestra `age` derivada correctamente.
2. Con `age` manual no vacia, el sistema no la sobrescribe por derivacion automatica.
3. La fecha de referencia para el calculo sigue la prioridad definida (ultima visita -> fecha documento -> hoy).
4. Si `dob` es invalida o futura, no se deriva `age`.
5. La UI muestra indicacion de campo derivado y permite edicion manual.
6. Suite de pruebas objetivo en verde sin regresiones.

---

## PR Roadmap

### PR partition gate assessment

- **Projected scope:** ~8 changed files, ~150–250 changed lines.
- **Semantic risk axes:** backend + frontend in same PR (mixed axis flagged).
- **Size guardrails:** within 400 lines / 15 files thresholds.
- **Decision:** `Option A` — single PR. Rationale: changes are cohesive (one derivation feature), backend changes are small normalization logic, frontend changes are limited to a hint label. Risk is low and reviewable in isolation.

| PR | Scope | Steps | Status |
|----|-------|-------|--------|
| PR-1 | Age auto-calc: backend derivation + frontend hint + tests | F1-A → F3-E | Pending |

---

## Key Files

| File | Role |
|------|------|
| `backend/app/application/documents/review_service.py` | Proyeccion/normalizacion de payload para derivar `age` |
| `backend/app/application/documents/edit_service.py` | Preservacion de prioridad en ediciones manuales |
| `frontend/src/components/structured/FieldEditDialog.tsx` | UX de edicion y hint de campo derivado |
| `frontend/src/hooks/useFieldEditing.ts` | Flujo de guardado y prioridad de cambios manuales |

---

## How to test

- `python -m pytest backend/tests/unit -v --no-cov`
- `python -m pytest backend/tests/integration -v --no-cov`
- `npm --prefix frontend run test -- --run`

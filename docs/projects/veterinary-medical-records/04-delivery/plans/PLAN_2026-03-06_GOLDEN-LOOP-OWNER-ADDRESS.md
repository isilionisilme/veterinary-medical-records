# Plan: Golden Loop - `owner_address` (Direccion del propietario)

> **Operational rules:** See [plan-execution-protocol.md](../../03-ops/plan-execution-protocol.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Branch:** `golden-2/feat/golden-loop-propietario-direccion`
**PR:** (draft - TBD)
**Prerequisite:** `main` estable con tests verdes.
**Iteracion:** 20 (propuesta)
**Worktree:** `D:/Git/golden-2`
**CI Mode:** `2) Pipeline depth-1 gate` (default aplicado por protocolo; confirmar con usuario antes de Step 1)
**Agents:** `Pendiente de seleccion explicita del usuario antes de Step 1 (Mandatory Plan-Start Choice)`

## Context

`owner_address` (Direccion del propietario) no existe en el contrato global (`shared/global_schema_contract.json`), aunque si se extrae como candidato en el pipeline (`_LABELED_PATTERNS`, `MVP_COVERAGE_DEBUG_KEYS`). Faltan las piezas clave del patron golden loop:

- No en el schema global: no existe en `global_schema_contract.json` ni en `GLOBAL_SCHEMA_KEYS`.
- No normalization: no existe `_normalize_owner_address_value()` en `field_normalizers.py`.
- No fixtures dedicados: no existe `backend/tests/fixtures/synthetic/owner_address/`.
- No benchmark: no existe `backend/tests/benchmarks/test_owner_address_extraction_accuracy.py`.
- No triage especifico: no hay flags de sospecha dedicados.
- No frontend validator: no hay validacion en `fieldValidators.ts`.
- No guardrails documentados: `owner_address` figura como pending en `extraction-quality.md`.
- Ambiguedad con `clinic_address`: bare labels como `Direccion:` pueden capturar ambos campos sin desambiguacion.

### Desafios especificos

- Desambiguacion con `clinic_address`: ambos patrones pueden capturar `Direccion:` o `Domicilio:` sin calificador.
- Abreviaturas de direccion en espanol: `C/`, `Avda.`, `Pza.`, `N.`, `CP`, etc.
- Direcciones multilinea: algunos documentos traen la direccion en 2 lineas.
- Mezcla nombre + direccion: `Juan Garcia C/ Ortega 5`.
- Null cases frecuentes: muchos documentos no incluyen direccion del propietario.
- False-positive traps: direccion de la clinica promovida como `owner_address`.
- Variaciones de etiqueta: `Direccion del propietario`, `Domicilio del propietario`, `Direccion del titular`, `Dir.`.

## Objective

- Canonizar `owner_address` en contrato global y pipeline de extraccion.
- Alcanzar >= 85% exact match en benchmark sintetico.
- Implementar desambiguacion contextual entre `clinic_address` y `owner_address`.
- Evitar regresiones en golden loops existentes.
- Dejar evidencia reproducible (fixtures + benchmark + tests + observabilidad).

## Scope Boundary

- **In scope:** schema, extraccion, normalizacion, ranking y observabilidad de `owner_address`; desambiguacion owner/clinic para direccion; fixtures y benchmark del campo; tests y guardrails.
- **Out of scope:** mejoras de `owner_name` o `owner_id`; cambios de UX mas alla de validacion minima; refactors no relacionados.

---

## Commit plan

| ID | After Steps | Scope | Commit Message | Push |
|---|---|---|---|---|
| CT-1 | P0-A, P0-B, P0-C | Steps `P0-A + P0-B + P0-C`; files: `shared/global_schema_contract.json`, `backend/app/application/global_schema.py`, `backend/tests/fixtures/synthetic/owner_address/owner_address_cases.json`, `backend/tests/fixtures/synthetic/owner_address/README.md`, `backend/tests/benchmarks/test_owner_address_extraction_accuracy.py` | `test(plan-p0): owner_address schema promotion and golden-loop baseline` | Inmediato |
| CT-2 | P1-A, P1-B, P1-C, P1-D | Steps `P1-A + P1-B + P1-C + P1-D`; files: `backend/app/application/field_normalizers.py`, `backend/app/application/processing/candidate_mining.py`, `backend/app/application/processing/constants.py`, `backend/tests/unit/test_owner_address_normalization.py`, `backend/tests/benchmarks/test_owner_address_extraction_accuracy.py` | `feat(plan-p1): owner_address extraction hardening - normalizer, disambiguation, labels, unit tests` | Inmediato |
| CT-3 | P2-A | Step `P2-A`; files: `backend/app/application/extraction_observability/triage.py`, tests de observabilidad asociados | `feat(plan-p2): owner_address observability flags` | Inmediato |
| CT-4 | P3-A, P3-B | Steps `P3-A + P3-B`; files: `backend/tests/unit/test_golden_extraction_regression.py`, artefactos de evidencia de validacion para PR | `test(plan-p3): owner_address golden regression and validation evidence` | Inmediato |
| CT-5 | P3-D | Step `P3-D`; files: `backend/tests/benchmarks/test_owner_address_extraction_accuracy.py`, `docs/projects/veterinary-medical-records/02-tech/extraction-quality.md` | `docs(plan-p3): owner_address threshold lock and extraction-quality update` | Inmediato |
| CT-6 | P4-A, P4-B, P4-C, P4-D | Steps `P4-A + P4-B + P4-C + P4-D`; files: `backend/app/application/processing/candidate_mining.py`, `backend/tests/unit/test_golden_extraction_regression.py`, `backend/tests/benchmarks/test_owner_address_extraction_accuracy.py`, fixtures de regresion relevantes | `feat(plan-p4): docB owner_address extraction from unlabeled owner block` | Inmediato |

---

## Operational override steps

### CT-1 - Commit baseline bundle

- **type:** `commit-task`
- **trigger:** After `P0-A`, `P0-B`, `P0-C`
- **preconditions:** Branch verificada; cambios de P0 listos; `scripts/ci/test-L1.ps1 -BaseRef HEAD` verde
- **commands:**
  - `git add -A -- . ':!docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_2026-03-06_GOLDEN-LOOP-OWNER-ADDRESS.md'`
  - `git commit -m "test(plan-p0): owner_address schema promotion and golden-loop baseline"`
  - `git push origin golden-2/feat/golden-loop-propietario-direccion`
  - Si no existe PR: `gh pr create --draft`
- **approval:** `auto`
- **fallback:** Revertir staged parcial de P0, documentar error de preflight/commit y STOP

### CT-2 - Commit extraction hardening bundle

- **type:** `commit-task`
- **trigger:** After `P1-A`, `P1-B`, `P1-C`, `P1-D`
- **preconditions:** Delta benchmark reportado; sin regresiones blocking; `scripts/ci/test-L1.ps1 -BaseRef HEAD` verde
- **commands:**
  - `git add -A -- . ':!docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_2026-03-06_GOLDEN-LOOP-OWNER-ADDRESS.md'`
  - `git commit -m "feat(plan-p1): owner_address extraction hardening - normalizer, disambiguation, labels, unit tests"`
  - `git push origin golden-2/feat/golden-loop-propietario-direccion`
- **approval:** `auto`
- **fallback:** Revertir cambios no deterministas de P1, conservar evidencia de fallos y STOP

### CT-3 - Commit observability bundle

- **type:** `commit-task`
- **trigger:** After `P2-A`
- **preconditions:** Flags + tests unitarios de observabilidad verdes; `scripts/ci/test-L1.ps1 -BaseRef HEAD` verde
- **commands:**
  - `git add -A -- . ':!docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_2026-03-06_GOLDEN-LOOP-OWNER-ADDRESS.md'`
  - `git commit -m "feat(plan-p2): owner_address observability flags"`
  - `git push origin golden-2/feat/golden-loop-propietario-direccion`
- **approval:** `auto`
- **fallback:** Rollback de cambios de observabilidad de P2, dejar reporte de fallos y STOP

### CT-4 - Commit validation evidence bundle

- **type:** `commit-task`
- **trigger:** After `P3-A`, `P3-B`
- **preconditions:** Suite focalizada y evidencia reproducible disponibles; `scripts/ci/test-L1.ps1 -BaseRef HEAD` verde
- **commands:**
  - `git add -A -- . ':!docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_2026-03-06_GOLDEN-LOOP-OWNER-ADDRESS.md'`
  - `git commit -m "test(plan-p3): owner_address golden regression and validation evidence"`
  - `git push origin golden-2/feat/golden-loop-propietario-direccion`
- **approval:** `auto`
- **fallback:** Mantener artefactos de evidencia, revertir assertions inestables y STOP

### CT-5 - Commit post-gate docs bundle

- **type:** `commit-task`
- **trigger:** After `P3-D` and explicit GO on `P3-C`
- **preconditions:** Hard-gate `P3-C` = GO; threshold lock aplicado; docs actualizados; `scripts/ci/test-L1.ps1 -BaseRef HEAD` verde
- **commands:**
  - `git add -A -- . ':!docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_2026-03-06_GOLDEN-LOOP-OWNER-ADDRESS.md'`
  - `git commit -m "docs(plan-p3): owner_address threshold lock and extraction-quality update"`
  - `git push origin golden-2/feat/golden-loop-propietario-direccion`
- **approval:** `auto`
- **fallback:** Revertir solo cambios doc/threshold de P3-D, preservar decision del hard-gate y STOP

### CT-6 - Commit docB remediation bundle

- **type:** `commit-task`
- **trigger:** After `P4-A`, `P4-B`, `P4-C`, `P4-D`
- **preconditions:** `docB` extrae `owner_address`; no regresiones blocking en `clinic_address`; `scripts/ci/test-L1.ps1 -BaseRef HEAD` verde
- **commands:**
  - `git add -A -- . ':!docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_2026-03-06_GOLDEN-LOOP-OWNER-ADDRESS.md'`
  - `git commit -m "feat(plan-p4): docB owner_address extraction from unlabeled owner block"`
  - `git push origin golden-2/feat/golden-loop-propietario-direccion`
- **approval:** `auto`
- **fallback:** Revertir cambios de heuristica de `P4`, preservar evidencia de fallos y STOP

---

## Execution Status

**Leyenda**
- 🔄 auto-chain - ejecutable por agente de ejecucion
- 🚧 hard-gate - revision/decision de usuario

### Phase 0 - Schema promotion, baseline and fixtures

- [x] P0-A 🔄 - Anadir `owner_address` al contrato global (`global_schema_contract.json`, seccion Propietario, `value_type: string`, `repeatable: false`, `critical: false`, `optional: true`) y a `GLOBAL_SCHEMA_KEYS` en `global_schema.py`. — ✅ `5884966b`
- [x] P0-B 🔄 - Crear fixtures sinteticos bajo `backend/tests/fixtures/synthetic/owner_address/owner_address_cases.json` (>= 18 casos). — ✅ `5884966b`
- [x] P0-C 🔄 - Crear benchmark `backend/tests/benchmarks/test_owner_address_extraction_accuracy.py` y medir baseline inicial. — ✅ `5884966b`
- [x] CT-1 🔄 - Commit task: scope P0-A + P0-B + P0-C -> `test(plan-p0): owner_address schema promotion and golden-loop baseline` -> push. — ✅ `5884966b`

### Phase 1 - Extraction improvements (`owner_address` only)

- [x] P1-A 🔄 - Crear `_normalize_owner_address_value()` en `field_normalizers.py` y conectarlo en `normalize_canonical_fields()`. — ✅ `521ef468`
- [x] P1-B 🔄 - Implementar desambiguacion contextual owner/clinic en `candidate_mining.py` y ampliar variantes de label en `_LABELED_PATTERNS`. — ✅ `521ef468`
- [x] P1-C 🔄 - Anadir tests unitarios dedicados de normalizacion: `backend/tests/unit/test_owner_address_normalization.py`. — ✅ `521ef468`
- [x] P1-D 🔄 - Medir delta de benchmark vs baseline y ajustar confidence/ranking si es necesario para llegar a >= 85%. — ✅ `521ef468`
- [x] CT-2 🔄 - Commit task: scope P1-A + P1-B + P1-C + P1-D -> `feat(plan-p1): owner_address extraction hardening - normalizer, disambiguation, labels, unit tests` -> push. — ✅ `521ef468`

### Phase 2 - Observability and quality gates

- [x] P2-A 🔄 - Anadir flags de observabilidad para `owner_address` sospechoso (`owner_address_matches_clinic_address`, `owner_address_too_short`, `owner_address_no_address_tokens`, `owner_address_too_long`) + tests. — ✅ `9f2b70d5`
- [x] CT-3 🔄 - Commit task: scope P2-A -> `feat(plan-p2): owner_address observability flags` -> push. — ✅ `9f2b70d5`

### Phase 3 - Tests, validation, and closure

- [x] P3-A 🔄 - Anadir/ajustar assertions golden para `owner_address` en `test_golden_extraction_regression.py` y ejecutar suite focalizada. — ✅ `94593a6a`
- [x] P3-B 🔄 - Ejecutar suite completa y preparar evidencia reproducible para PR body. — ✅ `94593a6a`
- [x] CT-4 🔄 - Commit task: scope P3-A + P3-B -> `test(plan-p3): owner_address golden regression and validation evidence` -> push. — ✅ `94593a6a`
- [x] P3-C 🚧 - Hard-gate: decision explicita = **NO-GO**. Motivo: `docB` contiene direccion de propietario real (`C/ CALLE DEMO 1 PORTAL 3 1F`) pero golden regression actual exige `owner_address` vacio. — ✅ `no-commit (gate decision + remediation required)`
- [ ] P3-D 🔄 - Post-gate (deferred): ajustar `MIN_EXACT_MATCH_RATE`, actualizar guardrails en `extraction-quality.md`, marcar campo como completado. ⏸️ PAUSADO hasta cierre de `Phase 4`.
- [ ] CT-5 🔄 - Commit task: scope P3-D -> `docs(plan-p3): owner_address threshold lock and extraction-quality update` -> push. ⏸️ PAUSADO hasta cierre de `Phase 4`.

### Phase 4 - docB remediation (real extraction parity)

- [x] P4-A 🔄 - Implementar heuristica de extraccion para bloque owner no etiquetado en `candidate_mining.py` (patron linea nombre + linea direccion adyacente bajo contexto owner). — ✅ `c78bd5bb`
- [x] P4-B 🔄 - Actualizar `test_doc_b_golden_goal_fields_regression` para exigir `owner_address` poblado y mantener invariantes de no-regresion en `clinic_address`. — ✅ `c78bd5bb`
- [x] P4-C 🔄 - Ejecutar benchmark de `owner_address` + suite focalizada de regresion (`owner_address`, `clinic_address`, `docB`) y reportar delta EM/null misses/false positives. — ✅ `c78bd5bb`
- [x] P4-D 🚧 - Hard-gate: validacion de usuario del comportamiento en `docB` (GO/NO-GO para retomar `P3-D`). — ✅ `GO (user confirmation in chat)`
- [x] CT-6 🔄 - Commit task: scope P4-A + P4-B + P4-C + P4-D -> `feat(plan-p4): docB owner_address extraction from unlabeled owner block` -> push. — ✅ `c78bd5bb`

---

## Acceptance criteria

1. `owner_address` existe en `global_schema_contract.json` con `optional: true`.
2. `owner_address` existe en `GLOBAL_SCHEMA_KEYS`.
3. Benchmark sintetico de `owner_address` alcanza >= 85% EM.
4. No hay regresiones en benchmarks/golden tests existentes, en especial `clinic_address`.
5. Existe normalizador dedicado `_normalize_owner_address_value()` con expansion de abreviaturas.
6. La desambiguacion contextual owner/clinic esta implementada y testeada.
7. Flags de observabilidad para `owner_address` implementados con tests.
8. Guardrails de `owner_address` documentados en `extraction-quality.md`.
9. `owner_address` deja de estar en pendientes y pasa a estado completado tras cierre.
10. Cambios limitados al alcance definido del campo.
11. `docB` (`backend/tests/fixtures/raw_text/docB.txt`) expone `owner_address` en `global_schema` cuando la direccion existe en bloque owner no etiquetado.

---

## Prompt Queue

### P0-A - Schema promotion

```text
Contexto: estamos ejecutando el golden loop para `owner_address` en la rama `feat/golden-loop-propietario-direccion` dentro de `D:/Git/golden-2`.

1. En `shared/global_schema_contract.json`, anade `owner_address` en seccion Propietario:
   - key: owner_address
   - label: Direccion del propietario
   - section: Propietario
   - value_type: string
   - repeatable: false
   - critical: false
   - optional: true

2. En `backend/app/application/global_schema.py`, anade `"owner_address"` en `GLOBAL_SCHEMA_KEYS` despues de `owner_id`.

3. Ejecuta tests relevantes de contrato/schema.

No tocar PLAN ni hacer commit.
```

### P0-B - Synthetic fixtures

```text
Crea `backend/tests/fixtures/synthetic/owner_address/owner_address_cases.json` con al menos 18 casos:
- Positivos con label explicito: Direccion del propietario / Domicilio del propietario.
- Positivos por contexto (Datos del cliente + Direccion).
- Casos con abreviaturas (C/, Avda., Pza., CP).
- Null cases sin direccion del propietario.
- Trampas donde solo existe direccion de clinica.
- Caso dual clinic+owner donde debe ganar owner.

Formato:
{
  "cases": [
    {"id": "...", "text": "...", "expected_owner_address": "..." | null}
  ]
}

Agregar README.md en la carpeta describiendo estructura y criterios.

No tocar PLAN ni hacer commit.
```

### P0-C - Baseline benchmark

```text
Crear `backend/tests/benchmarks/test_owner_address_extraction_accuracy.py` siguiendo patron de benchmark existente:
1. Cargar fixtures owner_address_cases.json.
2. Extraer owner_address con _build_interpretation_artifact().
3. Normalizar comparacion con normalize_canonical_fields().
4. Test parametrizado por caso.
5. Test resumen accuracy.
6. MIN_EXACT_MATCH_RATE = 0.0 para baseline.

Ejecutar benchmark y reportar exact matches, null misses, false positives.

No tocar PLAN ni hacer commit.
```

### CT-1 - Commit task Phase 0

```text
Ejecutar SCOPE BOUNDARY:
- Branch verification: feat/golden-loop-propietario-direccion
- STEP A: commit code (sin PLAN)
  mensaje: test(plan-p0): owner_address schema promotion and golden-loop baseline
- STEP B: actualizar plan (P0-A, P0-B, P0-C, CT-1 en [x] con SHA)
- STEP C: push y crear draft PR si aplica
- STEP D/E/F: actualizar PR, gate CI, chain decision
```

### P1-A - Normalizer

```text
Implementar `_normalize_owner_address_value()` en `backend/app/application/field_normalizers.py`:
- Expandir abreviaturas (C/ -> Calle, Avda./Av. -> Avenida, Pza. -> Plaza, CP -> C.P.).
- Normalizar whitespace y puntuacion.
- Permitir maximo 2 lineas equivalentes.
- Rechazar strings sin tokens de direccion.
- Conectar en normalize_canonical_fields(): normalized["owner_address"] = _normalize_owner_address_value(...)

Ejecutar unit tests relevantes.

No tocar PLAN ni hacer commit.
```

### P1-B - Disambiguation owner vs clinic

```text
Implementar desambiguacion contextual en `candidate_mining.py`:
- Para labels ambiguos (`Direccion:`, `Domicilio:` sin calificador), analizar ventana +/-5 lineas.
- Contexto owner -> promover owner_address.
- Contexto clinic -> promover clinic_address.
- Contexto ambiguo -> mantener candidato conservador con menor confianza.

Actualizar `_LABELED_PATTERNS` en `constants.py` para incluir variantes owner:
- Direccion del titular
- Domicilio del titular
- Dir. propietario

Agregar guard cruzado para evitar que clinic_address se cuele como owner_address y viceversa.

Ejecutar benchmark owner_address y clinic_address para verificar no regresion.

No tocar PLAN ni hacer commit.
```

### P1-C - Unit tests

```text
Crear `backend/tests/unit/test_owner_address_normalization.py`:
- Abreviaturas: C/, Avda., Pza.
- Whitespace y puntuacion.
- Casos invalidos -> None.
- Label residual ("Dir.: C/ Sol 3").
- Casos multilinea y CP.

Ejecutar tests y reportar resultados.

No tocar PLAN ni hacer commit.
```

### P1-D - Benchmark delta

```text
Ejecutar benchmark owner_address y reportar:
- EM rate actual vs baseline.
- Null misses.
- False positives.

Si EM < 85%, hacer ajustes minimos en labels/contexto/normalizador y re-ejecutar.

Correr benchmarks/golden de campos clave para confirmar 0 regresiones.

No tocar PLAN ni hacer commit.
```

### CT-2 - Commit task Phase 1

```text
SCOPE BOUNDARY:
- STEP A commit code (sin PLAN)
  mensaje: feat(plan-p1): owner_address extraction hardening - normalizer, disambiguation, labels, unit tests
- STEP B actualizar PLAN (P1-A..P1-D + CT-2)
- STEP C/D/E/F push, PR update, CI gate, chain decision
```

### P2-A - Observability flags

```text
Agregar flags en triage para owner_address:
- owner_address_matches_clinic_address
- owner_address_too_short
- owner_address_no_address_tokens
- owner_address_too_long

Agregar tests unitarios para cada flag.

No tocar PLAN ni hacer commit.
```

### CT-3 - Commit task Phase 2

```text
SCOPE BOUNDARY:
- STEP A commit code mensaje: feat(plan-p2): owner_address observability flags
- STEP B actualizar PLAN (P2-A + CT-3)
- STEP C/D/E/F push, PR update, CI gate, chain decision
```

### P3-A - Golden regression

```text
Actualizar `backend/tests/unit/test_golden_extraction_regression.py` con assertions owner_address.
Ejecutar suite focalizada:
- benchmark owner_address
- unit normalizacion owner_address
- golden regression filtrando owner_address
- observability tests

No tocar PLAN ni hacer commit.
```

### P3-B - Validation run

```text
Ejecutar suite completa focalizada + resumen para PR body:
- total tests pass/fail
- EM vs baseline
- null misses y false positives
- delta vs threshold
- verificacion de no regresiones en otros campos

No tocar PLAN ni hacer commit.
```

### CT-4 - Commit task Phase 3 evidence

```text
SCOPE BOUNDARY:
- STEP A commit code (sin PLAN)
  mensaje: test(plan-p3): owner_address golden regression and validation evidence
- STEP B actualizar PLAN (P3-A, P3-B, CT-4)
- STEP C/D/E/F push, PR update, CI gate, chain decision
```

### P3-C - Hard-gate

```text
Hard-gate de usuario: decision GO/NO-GO tras revisar evidencia de benchmark, regresiones, fixtures y flags.
```

### P3-D - Post-gate closure

```text
Tras GO:
1. Ajustar MIN_EXACT_MATCH_RATE en benchmark owner_address al valor logrado - 5pp.
2. Actualizar `docs/projects/veterinary-medical-records/02-tech/extraction-quality.md`:
   - Seccion guardrails owner_address
   - Risk matrix row
   - Estado golden fields
3. Actualizar PR body final.

No tocar PLAN hasta STEP B del commit task.
```

### CT-5 - Commit task Phase 3 closure

```text
SCOPE BOUNDARY:
- STEP A commit code mensaje: docs(plan-p3): owner_address threshold lock and extraction-quality update
- STEP B actualizar PLAN (P3-D + CT-5)
- STEP C/D/E/F push, PR update, CI gate, close iteration
```

### P4-A - Heuristica docB owner block

```text
Implementar heuristica en `candidate_mining.py` para `owner_address` sin label explicito en bloques tipo docB:
- Detectar secuencia de 2 lineas adyacentes: (1) nombre owner-like, (2) direccion address-like con digitos.
- Requisito de contexto owner: presencia de marcador owner/titular/cliente en ventana cercana o estructura compatible de bloque de identificacion.
- Excluir contexto clinic/hospital/veterinario para evitar contamination con `clinic_address`.
- Emitir candidato `owner_address` con confianza conservadora y evidencia multilinea.

No tocar PLAN ni hacer commit.
```

### P4-B - Golden assertions docB

```text
Actualizar `backend/tests/unit/test_golden_extraction_regression.py`:
- En `test_doc_b_golden_goal_fields_regression`, reemplazar assert de vacio por expect de owner_address normalizado.
- Mantener asserts de no regresion en `clinic_address`.
- Agregar test negativo para evitar promotion de direccion de clinica como owner en bloques no etiquetados.

No tocar PLAN ni hacer commit.
```

### P4-C - Benchmark and focused validation

```text
Ejecutar validacion focalizada y reportar:
- `pytest backend/tests/benchmarks/test_owner_address_extraction_accuracy.py -v`
- `pytest backend/tests/unit/test_golden_extraction_regression.py -k "doc_b or owner_address or clinic_address" -v`
- `pytest backend/tests/unit/test_owner_address_normalization.py -v`

Reportar: exact match rate, null misses, false positives, y estado de no-regresion clinic.

No tocar PLAN ni hacer commit.
```

### P4-D - Hard-gate remediation

```text
Hard-gate de usuario: decision GO/NO-GO tras validar que docB ahora muestra `owner_address` en extraccion real sin regresion de `clinic_address`.
```

### CT-6 - Commit task Phase 4 remediation

```text
SCOPE BOUNDARY:
- STEP A commit code (sin PLAN)
  mensaje: feat(plan-p4): docB owner_address extraction from unlabeled owner block
- STEP B actualizar PLAN (P4-A, P4-B, P4-C, P4-D, CT-6)
- STEP C/D/E/F push, PR update, CI gate, chain decision
```

---

## Active Prompt

_(vacio - se completara dinamicamente)_

---

## How to test

1. `pytest backend/tests/benchmarks/test_owner_address_extraction_accuracy.py -v`
2. `pytest backend/tests/unit/test_owner_address_normalization.py -v`
3. `pytest backend/tests/unit/test_golden_extraction_regression.py -k owner_address -v`
4. Verificar no regresion clinic: `pytest backend/tests/unit/test_golden_extraction_regression.py -k clinic -v`
5. `pytest backend/tests/ -q`

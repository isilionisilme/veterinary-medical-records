# Plan: Visit-Scoped Weight — Separación de visitas y peso por visita

> **Operational rules:** See [execution-rules.md](../../03-ops/execution-rules.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Rama:** `feat/visit-scoped-weight`
**PR:** pendiente (draft)
**Prerequisito:** `main` estable con tests verdes. Golden loop de weight (PR #204, branch `feat/golden-loop-paciente-weight`) con P0–P3-B completados.
**Iteración:** 22
**Modo CI:** `3) End-of-plan gate`

---

## Context

### Problema funcional

El peso (`weight`) se extrae actualmente a nivel de documento (document-scoped). Cuando un PDF contiene múltiples visitas con pesos diferentes, el sistema puede mostrar un peso incorrecto para la visita que el usuario está viendo.

**Bugs reportados:**
- **docA:** el peso existe en el PDF (cabecera del paciente) pero no se muestra — posible fallo en candidate mining (label no reconocido o candidato filtrado).
- **docB:** se muestra un peso erróneo porque hay varias visitas con pesos diferentes y se toma uno arbitrario (el primero encontrado, sin ranking temporal).

### Sistema actual de visitas

La función `_normalize_canonical_review_scoping()` en `review_service.py` ya separa campos en tres categorías:
1. **Metadata de visita** (`_VISIT_GROUP_METADATA_KEYS`): `visit_date`, `admission_date`, `discharge_date`, `reason_for_visit`.
2. **Campos visit-scoped** (`_VISIT_SCOPED_KEYS`): `symptoms`, `diagnosis`, `procedure`, `medication`, `treatment_plan`, `allergies`, `vaccinations`, `lab_result`, `imaging`.
3. **Campos document-scoped**: todo lo demás, incluyendo `weight`.

`weight` **NO está** en `_VISIT_SCOPED_KEYS` ni en `_VISIT_GROUP_METADATA_KEYS` — se trata como campo de paciente (document-scoped) y se muestra sin contexto de visita.

### Regla funcional adoptada: híbrida

- Cuando solo exista evidencia global de cabecera (sin fecha de visita en snippet/contexto), `weight` permanece document-scoped (caso docA).
- Cuando haya múltiples visitas con pesos asociados (fecha detectada en snippet), los pesos se asignan a sus visitas respectivas y el peso "actual" mostrado a nivel paciente se deriva como **último cronológico** (caso docB).

### Desafíos técnicos

- **Asignación ambigua:** snippets de peso sin fecha de visita explícita que caen al bucket `unassigned`.
- **Candidate mining insuficiente:** el regex actual solo cubre `(?:peso|weight)\s*[:\-]?\s*...` — variantes de cabecera sin label ("Signos Vitales: ... 25.5 kg") no se capturan.
- **Ranking equi-weighted:** todos los candidatos de peso tienen `confidence=0.66` sin diferenciación por posición, contexto o proximidad temporal.
- **Sin normalización post-asignación a visita:** la lógica de review scoping no aplica la regla de "último cronológico" porque `weight` nunca entra en el flujo de visitas.

---

## Objective

1. `weight` se asigna correctamente por visita cuando existe evidencia temporal (snippet con fecha).
2. `weight` permanece como campo global de paciente cuando solo existe en cabecera sin contexto de visita.
3. En documentos multi-visita, el peso mostrado a nivel paciente = último peso cronológico.
4. No hay regresiones en el benchmark de weight (18/18 EM, 100%) ni en golden loops existentes.
5. Cobertura de tests para los escenarios: single-visit, multi-visit, global-only, ambiguo/unassigned.

## Scope Boundary (strict)

- **In scope:** lógica de scoping de `weight` en `review_service.py`; mejora de candidate mining y ranking de `weight`; regla de derivación de peso actual; tests de integración de scoping multi-visita; actualización de fixtures/benchmark si cambian expectativas.
- **Out of scope:** cambios de UX/frontend, rediseño amplio del contrato global, refactors no relacionados, cambios de reglas en otros campos, re-entrenamiento de modelos.

---

## Commit Task Definitions

| ID | After Steps | Scope | Commit Message | Push |
|---|---|---|---|---|
| CT-1 | P0-A, P0-B | Tests de baseline + snapshot multi-Visit | `test(plan-p0): visit-scoped weight baseline tests` | Inmediato |
| CT-2 | P1-A, P1-B, P1-C | Scoping + mining + ranking | `feat(plan-p1): weight visit-scoped assignment and mining improvements` | Inmediato |
| CT-3 | P2-A, P2-B | Derivación de peso actual + normalización | `feat(plan-p2): weight current-value derivation rule` | Inmediato |
| CT-4 | P3-A, P3-B | Benchmark delta + golden regression | `test(plan-p3): visit-scoped weight benchmark and golden regression` | Inmediato |
| CT-5 | P3-D | Docs + threshold | `docs(plan-p3): visit-scoped weight threshold lock and docs update` | Inmediato |

---

## Estado de ejecución

**Leyenda**
- 🔄 auto-chain — ejecutable por Codex
- 🚧 hard-gate — revisión/decisión de usuario

### Phase 0 — Baseline y snapshot multi-visita

- [x] P0-A 🔄 — Crear tests de integración de review scoping que capturen el comportamiento actual de `weight` en escenarios: (1) single-visit con peso, (2) multi-visit con pesos diferentes, (3) global-only sin fecha en snippet, (4) campo de peso en `unassigned`. Verificar que reflejan el status quo (peso global arbitrario). (GPT-5.3-Codex) (SHA: d36d8679)
- [x] P0-B 🔄 — Ampliar fixtures de weight con casos multi-visita y global-only bajo `backend/tests/fixtures/synthetic/weight/`. Registrar expectativas _pre-cambio_ como snapshot de regresión. (GPT-5.3-Codex) (SHA: d36d8679)
- [x] CT-1 🔄 — Commit task: scope P0-A + P0-B → `test(plan-p0): visit-scoped weight baseline tests` → push (GPT-5.3-Codex) (SHA: d36d8679)

### Phase 1 — Scoping, mining y ranking

- [ ] P1-A 🔄 — En `_shared.py`, añadir `"weight"` a `_VISIT_SCOPED_KEYS` para que `_normalize_canonical_review_scoping` lo asigne a visitas cuando tenga fecha en snippet. Conservar fallback: si no hay fecha y solo hay una visita, asignar a esa visita; si no hay fecha y hay múltiples visitas, dejar en `fields_to_keep` (document-scoped) en lugar de mandarlo a `unassigned`. (Claude Opus 4.6)
- [ ] P1-B 🔄 — En `constants.py`, ampliar regex de `weight` en `_LABELED_PATTERNS` para cubrir variantes faltantes en docA: "Signos Vitales" seguido de peso, peso sin label explícito en bloque de datos de paciente, etc. Añadir guards contra falsos positivos (`ml/kg`, `mg/dL`, precios). (GPT-5.3-Codex)
- [ ] P1-C 🔄 — En `candidate_mining.py`, añadir lógica de ranking específica para `weight` en `_candidate_sort_key`: priorizar candidatos con contexto de visita (snippet con fecha), penalizar candidatos en líneas de medicación/lab, preferir última ocurrencia en texto cuando haya empate de confidence. (GPT-5.3-Codex)
- [ ] CT-2 🔄 — Commit task: scope P1-A + P1-B + P1-C → `feat(plan-p1): weight visit-scoped assignment and mining improvements` → push (GPT-5.3-Codex)

### Phase 2 — Derivación de peso actual y normalización

- [ ] P2-A 🔄 — En `review_service.py`, tras asignar campos a visitas, implementar regla de derivación: si `weight` aparece en al menos una visita asignada, calcular `current_weight` = peso de la visita con `visit_date` más reciente. Exponer como campo document-scoped en `fields_to_keep` con `origin: "derived"` y evidencia del visit_id fuente. Si `weight` no aparece en ninguna visita (caso global-only), preservar el valor document-scoped original sin cambios. (Claude Opus 4.6)
- [ ] P2-B 🔄 — Verificar que `_normalize_weight()` (ya implementada en golden loop) se aplica correctamente al peso derivado y al peso global. Confirmar formato canónico `X.Y kg` y rango `[0.5, 120]`. (GPT-5.3-Codex)
- [ ] CT-3 🔄 — Commit task: scope P2-A + P2-B → `feat(plan-p2): weight current-value derivation rule` → push (GPT-5.3-Codex)

### Phase 3 — Tests, validación y cierre

- [ ] P3-A 🔄 — Ejecutar benchmark de weight y comparar delta: EM, null misses, false positives. Actualizar expected values en fixtures si la nueva semántica (visit-scoped) cambia las expectativas de forma justificada. (GPT-5.3-Codex)
- [ ] P3-B 🔄 — Ejecutar suite completa (golden regression + benchmark + scoping integration + normalization unit) y preparar evidencia para PR: totales pass/fail, EM, null misses, false positives, delta vs baseline, escenarios docA/docB. (GPT-5.3-Codex)
- [ ] CT-4 🔄 — Commit task: scope P3-A + P3-B → `test(plan-p3): visit-scoped weight benchmark and golden regression` → push (GPT-5.3-Codex)
- [ ] P3-C 🚧 — Hard-gate: validación manual en entorno dev levantado. Verificar: (1) docA muestra peso global de cabecera, (2) docB muestra peso correcto por visita y peso actual = último cronológico. Decisión go/no-go. (Claude Opus 4.6)
- [ ] P3-D 🔄 — Post-gate: actualizar `MIN_EXACT_MATCH_RATE` con margen -5pp, actualizar guardrails de `weight` en `extraction-quality.md` para referenciar scoping por visita, actualizar Golden Fields status. (GPT-5.3-Codex)
- [ ] CT-5 🔄 — Commit task: scope P3-D → `docs(plan-p3): visit-scoped weight threshold lock and docs update` → push (GPT-5.3-Codex)

---

## Relación con PR #204 (Golden Loop Weight)

Este plan es **complementario** al golden loop de weight (PR #204, branch `feat/golden-loop-paciente-weight`). La secuencia de cierre es:

1. **Este plan** resuelve el problema funcional de peso por visita y mejora candidate mining.
2. **PR #204** cierra P3-C/P3-D/CT-5 una vez que las fixtures/benchmark reflejen la nueva semántica.
3. Si los cambios de este plan alteran expectativas del benchmark de weight, se actualizan en la rama del golden loop (stash pop + merge/rebase).

### Stash pendiente en golden loop

En `feat/golden-loop-paciente-weight` hay un `git stash@{0}` con:
- Fix de `docker-compose.dev.yml` (Vite dev en puerto 8080 interno).
- WIP de P3-C.

**Secuencia para cerrar PR #204 tras este plan:**
1. En worktree `veterinary-medical-records-golden-loop`: `git stash pop`.
2. Borrar `backend/data/documents.db`.
3. `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`.
4. Validar docA/docB con nueva semántica.
5. Completar P3-C → P3-D → CT-5 en `PLAN_2026-03-05_GOLDEN-LOOP-WEIGHT.md`.
6. Marcar PR #204 ready.

---

## Acceptance criteria

1. `weight` se asigna a la visita correcta cuando el snippet contiene fecha de visita identificable.
2. `weight` permanece document-scoped cuando no hay fecha de visita en el contexto.
3. En documentos multi-visita, el peso a nivel paciente = último peso cronológico.
4. Benchmark de weight ≥ 95% EM (sin regresión del 100% alcanzado, salvo justificación por cambio de criterio).
5. No hay regresiones en golden loops existentes (pet_name, clinic_name, clinic_address, microchip_id, dob).
6. Tests de integración cubren: single-visit, multi-visit, global-only, ambiguo/unassigned.
7. Payload de review es idempotente y determinista (misma entrada → misma salida, orden estable).
8. Cambios limitados al path de `weight` y lógica de scoping en `review_service.py` / `_shared.py`.

---

## Archivos clave

| Archivo | Rol |
|---|---|
| `backend/app/application/documents/review_service.py` | `_normalize_canonical_review_scoping` — lógica de agrupación por visita |
| `backend/app/application/documents/_shared.py` | `_VISIT_SCOPED_KEYS`, `_VISIT_GROUP_METADATA_KEYS`, parseo de fechas |
| `backend/app/application/processing/constants.py` | Regex de `weight` en `_LABELED_PATTERNS` |
| `backend/app/application/processing/candidate_mining.py` | Ranking/selección de candidatos (`_candidate_sort_key`) |
| `backend/app/application/field_normalizers.py` | `_normalize_weight()` y conexión canónica |
| `backend/tests/integration/test_document_review.py` | Contratos de scoping y estabilidad de payload |
| `backend/tests/benchmarks/test_weight_extraction_accuracy.py` | Benchmark de weight (en golden loop branch) |
| `backend/tests/fixtures/synthetic/weight/` | Fixtures de peso (en golden loop branch) |

---

## Políticas de sesión

- Antes de pedir testing manual, levantar entorno dev con hot reload: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`.
- Borrar DB al levantar entorno: eliminar `backend/data/documents.db`.
- El fix de `docker-compose.dev.yml` (Vite en puerto 8080 interno) está en el stash del golden loop; hacer pop antes de levantar dev.

---

## Cola de prompts

### P0-A — Baseline scoping tests

```text
Contexto: estamos ejecutando el plan VISIT-SCOPED-WEIGHT. La rama es `feat/visit-scoped-weight`.

Crea tests de integración en `backend/tests/integration/test_document_review.py` que capturen el
comportamiento ACTUAL de `weight` en review scoping para estos escenarios:

1. **Single-visit con peso:** un documento con una visita (visit_date + diagnosis) y un campo
   weight con evidencia que menciona la misma fecha. Verificar que weight permanece en
   `fields` (document-scoped) y NO aparece en la visita.

2. **Multi-visit con pesos diferentes:** un documento con dos visitas (fechas distintas) y dos
   campos weight con snippets que mencionan fechas diferentes. Verificar que ambos weights
   permanecen en `fields` (document-scoped) — comportamiento actual pre-cambio.

3. **Global-only sin fecha en snippet:** un campo weight cuyo snippet es "Peso: 7.2 kg"
   (sin fecha). Verificar que permanece en `fields`.

4. **Weight con snippet ambiguo:** snippet con fecha que NO corresponde a ninguna visita
   detectada. Verificar que weight permanece en `fields`.

Estos tests documentan el status quo y servirán como snapshot de regresión. Se espera que
algunos fallen DESPUÉS de P1-A (cuando weight pase a ser visit-scoped) — lo cual es correcto.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → P0-B

### P0-B — Fixtures multi-visita

```text
Amplía los fixtures de weight en `backend/tests/fixtures/synthetic/weight/` con casos
adicionales orientados a multi-visita:

Añade al menos 6 casos nuevos a `weight_cases.json` (o crea un archivo separado
`weight_visit_cases.json` si es más limpio):

1. "Visita 15/01/2026: Peso: 8.2 kg ... Visita 22/01/2026: Peso: 8.5 kg" →
   expected: último cronológico = "8.5 kg"
2. "Peso: 12 kg" (solo cabecera, sin contexto de visita) → expected: "12 kg" (global)
3. "Consulta 10/02/2026 ... Signos vitales: 25.5 kg ... Consulta 03/03/2026 ... Peso: 26 kg" →
   expected: "26 kg" (último cronológico)
4. "Dosis: 0.5 ml/kg ... Visita 01/01/2026: Peso: 4.2 kg" → expected: "4.2 kg" (no la dosis)
5. Documento sin peso, dos visitas con datos clínicos → expected: null
6. Una visita con peso, otra sin → expected: peso de la visita que lo tiene

Formato: `{"id": "...", "text": "...", "expected_weight": "..." | null, "scenario": "..."}`

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → CT-1

### P1-A — Weight visit-scoped assignment

```text
Implementa la regla híbrida de scoping para `weight`:

1. En `_shared.py` (línea ~151), añadir `"weight"` a `_VISIT_SCOPED_KEYS`.

2. En `review_service.py`, dentro de `_normalize_canonical_review_scoping`, ajustar el
   tratamiento de `weight` después de la asignación a visitas:

   a. Si `weight` fue asignado a al menos una visita (por fecha en snippet): OK, dejar
      en la visita. Además, derivar un campo `weight` document-scoped con valor =
      peso de la visita con visit_date más reciente, origin = "derived".

   b. Si `weight` NO fue asignado a ninguna visita (sin fecha en snippet, o no hay
      visit_by_date matches): sacarlo del flujo visit-scoped y devolverlo a
      `fields_to_keep` como document-scoped (fallback global).

   c. Si `weight` fue a `unassigned` y hay exactamente una visita con fecha: mover a
      esa visita (misma regla que otros campos visit-scoped con single-visit fallback).

3. Preservar determinismo: el payload debe ser idempotente (misma entrada → misma salida).

Ejecutar tests de review scoping existentes para verificar que no hay regresiones en otros
campos visit-scoped.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → P1-B

### P1-B — Mining improvements para docA

```text
Mejorar candidate mining de `weight` para cubrir el caso docA (peso presente pero no extraído):

1. En `constants.py`, ampliar regex de weight para cubrir:
   - "Signos vitales" / "Signos Vitales" como header seguido de peso en línea siguiente
   - Peso sin label explícito en bloque tabular de paciente (ej: "Nombre: Luna | Peso: 7.2 kg")
   - "P.:" como abreviación (con guard para no capturar "P. ej.")
   - "Peso corporal", "peso (kg)"

2. Añadir guards contextuales en candidate mining para evitar falsos positivos:
   - Rechazar líneas con "ml/kg", "mg/kg" (dosis)
   - Rechazar líneas con "mg/dL", "mmol/L", "U/L" (lab values)
   - Rechazar líneas con "€", "$", "EUR" (precios)

3. Ejecutar benchmark de weight para verificar que recall mejora sin false positives nuevos.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → P1-C

### P1-C — Weight candidate ranking

```text
Añadir lógica de ranking específica para `weight` en `_candidate_sort_key` (candidate_mining.py):

1. Priorizar candidatos cuyo snippet contenga una fecha de visita reconocible (boost +1.0).
2. Penalizar candidatos en líneas que contengan tokens de medicación/lab (-0.5).
3. En caso de empate de confidence, preferir la última ocurrencia en el texto (mayor offset).
4. Si hay múltiples candidatos con fechas de visita, no descartar — dejar que el scoping
   los distribuya a las visitas correspondientes.

Ejecutar tests de benchmark y verificar que el candidato seleccionado para global_schema
es ahora el más reciente cronológicamente cuando hay multi-visita.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → CT-2

### P2-A — Derivación de peso actual

```text
Si P1-A ya implementa la derivación de peso actual como campo document-scoped, verificar
que funciona correctamente en los tests de integración:

1. Multi-visit: el peso a nivel paciente = último cronológico.
2. Single-visit: el peso a nivel paciente = peso de la única visita.
3. Global-only: el peso a nivel paciente = peso global original.
4. Sin peso: campo `weight` ausente o null.

Si P1-A no la implementa directamente, hacerlo ahora en `review_service.py` al final de
`_normalize_canonical_review_scoping`, justo antes de retornar `projected`.

Ejecutar suite focalizada para confirmar.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → P2-B

### P2-B — Normalización post-derivación

```text
Verificar que `_normalize_weight()` se aplica al peso derivado y al peso global:

1. El campo `weight` derivado (origin="derived") pasa por normalización canónica.
2. El campo `weight` global (fallback) pasa por normalización canónica.
3. Formato final: `X.Y kg` con rango [0.5, 120].

Correr tests unitarios de normalización de weight para confirmar.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → CT-3

### P3-A — Benchmark delta

```text
Ejecutar benchmark de `weight` y reportar delta vs baseline:

- Exact match rate antes vs después.
- Null misses.
- False positives.
- Casos que cambiaron de expectativa por nueva semántica (justificar cada uno).

Si hay cambios de expected values por la regla híbrida, actualizarlos en fixtures con
comentario de justificación.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → P3-B

### P3-B — Suite completa y evidencia

```text
Ejecutar suite completa:
- `python -m pytest backend/tests/benchmarks/test_weight_extraction_accuracy.py -v`
- `python -m pytest backend/tests/unit/test_weight_normalization.py -v`
- `python -m pytest backend/tests/unit/test_extraction_observability.py -v`
- `python -m pytest backend/tests/integration/test_document_review.py -v`
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py -v`

Preparar evidencia para PR body: totales, pass/fail, EM, delta, escenarios docA/docB.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → CT-4

### P3-C — Hard-gate manual

```text
⚠️ HARD-GATE — Validación manual en entorno dev.

Secuencia:
1. Borrar `backend/data/documents.db`.
2. Levantar: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`.
3. Subir documento tipo docA (peso en cabecera sin fecha de visita).
   → Verificar que peso se muestra a nivel paciente.
4. Subir documento tipo docB (múltiples visitas con pesos diferentes).
   → Verificar que cada visita muestra su peso.
   → Verificar que peso a nivel paciente = último cronológico.
5. Decisión go/no-go.

Si GO → auto-chain a P3-D.
Si NO-GO → STOP, documentar hallazgo y ajustar.
```

⚠️ HARD-GATE → P3-D (Claude)

### P3-D — Post-gate closure

```text
Post-gate: ajustar threshold y docs.

1. Ajustar `MIN_EXACT_MATCH_RATE` al valor alcanzado menos 5 pp.
2. Actualizar `extraction-quality.md` § weight para referenciar scoping por visita.
3. Actualizar Golden Fields status.
4. Actualizar body de PR con evidencia final.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → CT-5

### CT-5 — Commit task Phase 3 closure

```text
Ejecuta el commit task CT-5 según SCOPE BOUNDARY:

**STEP 0 — Branch Verification:** `feat/visit-scoped-weight`

**STEP A — Commit Code:**
- Format pre-flight: formatters + L1.
- Stage todo excepto PLAN.
- Commit: `docs(plan-p3): visit-scoped weight threshold lock and docs update`

**STEP B — Commit Plan Update:**
- Marca P3-D, CT-5 como `[x]` con SHA.
- Stage y commit solo el PLAN.

**STEP C — Push.**
**STEP D — Update PR description.**
**STEP E — CI Gate.**
**STEP F — Chain or Handoff.**
```

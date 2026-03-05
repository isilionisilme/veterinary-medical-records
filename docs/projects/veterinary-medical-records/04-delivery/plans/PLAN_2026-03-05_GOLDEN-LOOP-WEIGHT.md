# Plan: Golden Loop — `weight` (Peso del paciente)

> **Operational rules:** See [execution-rules.md](../../03-ops/execution-rules.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Rama:** `feat/golden-loop-paciente-weight`
**PR:** #204 (draft)
**Prerequisito:** `main` estable con tests verdes.
**Iteración:** 21
**Modo CI:** `3) End-of-plan gate`

## Context

`weight` (Peso del paciente) ya existe en el contrato global (`shared/global_schema_contract.json`, sección `Paciente`, `value_type: string`, `critical: true`, `optional: false`) y tiene una regex etiquetada en `_LABELED_PATTERNS`. Sin embargo, faltan las piezas clave del patrón golden loop:

- **No conectado al normalizador backend** — `normalize_canonical_fields()` normaliza `pet_name`, `clinic_name`, `clinic_address`, `species`, `breed`, `sex`, `microchip_id`, `dob`, y campos de fecha, pero **NO `weight`**. No existe `_normalize_weight()`.
- **No candidate mining específico** — depende exclusivamente del regex genérico en `_LABELED_PATTERNS`; no hay `WEIGHT_TARGET_KEYS` ni heurísticas contextuales.
- **No dedicated fixtures** — no existe `backend/tests/fixtures/synthetic/weight/`.
- **No benchmark test** — no existe `backend/tests/benchmarks/test_weight_extraction_accuracy.py`.
- **No dedicated normalization unit tests** — falta suite de normalización backend.
- **Observabilidad existe pero incompleta** — `triage.py` tiene 3 flags (`weight_contains_non_kg_letters`, `weight_missing_numeric_value`, `weight_out_of_range`) con rango `[0.2, 120]`, pero la doc dice `[0.5, 120]`; inconsistencia menor.
- **Guardrails parcialmente documentados** — `extraction-quality.md` tiene sección `### weight` pero apunta solo a implementación frontend.
- **Ya listado como Golden Field** — `extraction-quality.md` § 6 reporta `weight | Active (range [0.5, 120], reject 0) | ✅`, pero sin evidencia backend.
- **Golden regression solo negativa** — `test_golden_extraction_regression.py` solo verifica que weight es vacío/None en ambos docs golden (no hay test positivo).

### Desafíos específicos de `weight`

- **Formatos numéricos:** coma vs punto decimal (`3,5 kg` vs `3.5 kg`), con o sin unidad.
- **Variaciones de unidad:** `kg`, `kgs`, `g`, `gr`, sin unidad (implícito kg).
- **Variaciones de etiqueta en español:** "Peso", "Peso corporal", "P.", "Peso:", "peso (kg)", "Weight".
- **Formato de salida normalizado:** `X.Y kg` (punto decimal, espacio, `kg` minúscula) — alineado con frontend `validateWeight`.
- **Rango válido:** `[0.5, 120]` kg (alineado con doc y frontend).
- **Rechazo de cero:** `0` o `0.0` son inválidos (alineado con frontend).
- **False-positive traps:** dosis de medicamento (`0.5 ml/kg`), valores de laboratorio, concentraciones, precios.
- **Conversión de gramos:** valores en gramos (ej. `500 g`) deben convertirse a kg (`0.5 kg`).
- **Null cases:** documentos sin peso registrado (campo `optional: false` pero reality ≠ schema).
- **OCR noise:** espacios extra, confusión `kg`/`kq`/`Kg`.

## Objective

- Alcanzar ≥ 85 % exact match en benchmark sintético de `weight`.
- Evitar regresiones en los golden loops existentes y en el resto del schema canónico.
- Añadir evidencia reproducible (fixtures + benchmark + tests unit/golden + normalización backend).

## Scope Boundary (strict)

- **In scope:** normalización backend, mejora de extracción, ranking y observabilidad de `weight`; fixtures sintéticos; benchmark y tests focalizados del campo; actualización de guardrails en documentación.
- **Out of scope:** cambios de UX/frontend, rediseño del contrato global, refactors no relacionados, cambios de reglas en otros campos.

---

## Commit Task Definitions

| ID | After Steps | Scope | Commit Message | Push |
|---|---|---|---|---|
| CT-1 | P0-A, P0-B | Fixtures + benchmark (baseline) | `test(plan-p0): weight golden-loop baseline fixtures and benchmark` | Inmediato |
| CT-2 | P1-A, P1-B, P1-C, P1-D | Normalizador + labels + unit tests + delta | `feat(plan-p1): weight extraction hardening — normalizer, labels, unit tests` | Inmediato |
| CT-3 | P2-A | Observability alignment + tests | `feat(plan-p2): weight observability alignment` | Inmediato |
| CT-4 | P3-A, P3-B | Golden regression + validation evidence | `test(plan-p3): weight golden regression and validation evidence` | Inmediato |
| CT-5 | P3-D | Threshold lock + extraction-quality doc | `docs(plan-p3): weight threshold lock and extraction-quality update` | Inmediato |

---

## Estado de ejecución

**Leyenda**
- 🔄 auto-chain — ejecutable por Codex
- 🚧 hard-gate — revisión/decisión de usuario

### Phase 0 — Baseline and fixtures

- [x] P0-A 🔄 — Crear fixtures sintéticos de `weight` con casos positivos/negativos/ruido OCR bajo `backend/tests/fixtures/synthetic/weight/` (GPT-5.3-Codex) — ✅ `e1c5ab81`
- [x] P0-B 🔄 — Crear benchmark `backend/tests/benchmarks/test_weight_extraction_accuracy.py` y medir baseline inicial (GPT-5.3-Codex) — ✅ `e1c5ab81` — baseline: 8/18 (44.4%), null_misses=4, false_positives=1
- [x] CT-1 🔄 — Commit task: scope P0-A + P0-B → `test(plan-p0): weight golden-loop baseline fixtures and benchmark` → push (GPT-5.3-Codex) — ✅ `e1c5ab81`

### Phase 1 — Extraction improvements (`weight` only)

- [x] P1-A 🔄 — Implementar `_normalize_weight()` en `field_normalizers.py` y conectar en `normalize_canonical_fields()`: coma→punto, unidad a `kg`, gramos→kg, rango [0.5, 120], rechazo de 0, formato normalizado `X.Y kg` (GPT-5.3-Codex) — ✅ `1f7f9896`
- [x] P1-B 🔄 — Ampliar regex de `weight` en `_LABELED_PATTERNS` con variantes de label: "Peso corporal", "P.", "peso (kg)", etc.; añadir guards contra falsos positivos (dosis, lab values) (GPT-5.3-Codex) — ✅ `1f7f9896`
- [x] P1-C 🔄 — Añadir tests unitarios dedicados de normalización de `weight`: formatos válidos (coma, punto, con/sin unidad, gramos), inválidos (0, fuera de rango, None/vacío, dosis) (GPT-5.3-Codex) — ✅ `1f7f9896` (15 passed)
- [x] P1-D 🔄 — Medir delta de benchmark vs baseline; ajustar confidence/ranking de candidates de `weight` si es necesario (GPT-5.3-Codex) — ✅ `1f7f9896` — 8/18 (44.4%) → 18/18 (100.0%), null_misses: 4→0, false_positives: 1→0
- [x] CT-2 🔄 — Commit task: scope P1-A + P1-B + P1-C + P1-D → `feat(plan-p1): weight extraction hardening — normalizer, labels, unit tests` → push (GPT-5.3-Codex) — ✅ `1f7f9896`

### Phase 2 — Observability and quality gates

- [x] P2-A 🔄 — Alinear rango de observabilidad en `triage.py` a `[0.5, 120]` (actualmente `0.2`); añadir flag `weight_zero_value` para rechazo explícito de 0; verificar tests existentes y añadir faltantes (GPT-5.3-Codex) — ✅ `d2dff8ed` (3 passed)
- [x] CT-3 🔄 — Commit task: scope P2-A → `feat(plan-p2): weight observability alignment` → push (GPT-5.3-Codex) — ✅ `d2dff8ed`

### Phase 3 — Tests, validation, and closure

- [ ] P3-A 🔄 — Añadir/ajustar assertions golden para `weight` en `test_golden_extraction_regression.py` y ejecutar suite focalizada (benchmark weight + unit normalización + observability + regresión golden) (GPT-5.3-Codex) ⏳ EN PROGRESO (GPT-5.3-Codex, 2026-03-05)
- [ ] P3-B 🔄 — Ejecutar suite completa y preparar evidencia reproducible para body de PR (totales, pass/fail, EM, null misses, false positives, delta vs baseline) (GPT-5.3-Codex)
- [ ] CT-4 🔄 — Commit task: scope P3-A + P3-B → `test(plan-p3): weight golden regression and validation evidence` → push (GPT-5.3-Codex)
- [ ] P3-C 🚧 — Hard-gate: validación de usuario con evidencia y decisión go/no-go (Claude Opus 4.6)
- [ ] P3-D 🔄 — Post-gate: ajustar `MIN_EXACT_MATCH_RATE` al valor alcanzado menos 5 pp, actualizar guardrails de `weight` en `extraction-quality.md` para referenciar implementación backend, actualizar Golden Fields status (GPT-5.3-Codex)
- [ ] CT-5 🔄 — Commit task: scope P3-D → `docs(plan-p3): weight threshold lock and extraction-quality update` → push (GPT-5.3-Codex)

---

## Acceptance criteria

1. `weight` alcanza ≥ 85 % exact match en benchmark sintético.
2. No hay regresiones en tests golden existentes (`pet_name`, `clinic_name`, `clinic_address`, `microchip_id`, `dob`, otros campos).
3. `_normalize_weight()` implementado en `field_normalizers.py`: coma→punto, unidad estandarizada a `kg`, gramos→kg, rango [0.5, 120], rechazo de 0, formato `X.Y kg`.
4. `weight` conectado en `normalize_canonical_fields()`.
5. Regex de `weight` ampliado con variantes de label y guards contra falsos positivos.
6. Rango de observabilidad alineado a `[0.5, 120]` en `triage.py`.
7. Guardrails de `weight` en `extraction-quality.md` actualizados para referenciar implementación backend.
8. Cambios limitados al path de `weight`.

---

## Cola de prompts

### P0-A — Synthetic fixtures

```text
Contexto: estamos ejecutando el golden loop para el campo `weight` (peso del paciente). La rama es `feat/golden-loop-paciente-weight` en el worktree `d:\Git\veterinary-medical-records-golden-loop`. Crea la rama desde `origin/main` si no existe.

Crea fixtures sintéticos para `weight`.

Bajo `backend/tests/fixtures/synthetic/weight/weight_cases.json` incluye al menos 18 casos:

**Positivos (con label explícito):**
- "Peso: 3,5 kg" (coma decimal)
- "Peso: 12.8 kg" (punto decimal)
- "Weight: 25 kgs"
- "Peso corporal: 7 kg"
- "P.: 4.2 kg"
- "Peso (kg): 18"
- "Peso: 0.8 kg" (peso pequeño válido, gato/ave)
- "Peso: 500 g" (gramos → 0.5 kg)

**Positivos con ruido OCR:**
- Label con espacios extra o errores tipográficos ("Pesso", "Peso  :", "peso:  3,5  kg")
- Peso embebido en bloque de datos del paciente con múltiples campos
- Unidad con casing variado ("Kg", "KG", "kq" OCR noise)

**Null cases (expected_weight = null):**
- Documento sin ningún peso registrado
- Documento solo con datos clínicos sin peso del paciente

**False-positive traps (expected_weight = valor correcto o null, NO la trampa):**
- Documento con "Dosis: 0.5 ml/kg" sin peso real → expected_weight = null
- Documento con "Glucosa: 120 mg/dL" y "Peso: 8 kg" → expected_weight = "8 kg"
- Documento con "Precio: 45.00 €" sin peso → expected_weight = null
- Documento con "Peso: 0 kg" → expected_weight = null (rechazo de cero)

Formato: `{"cases": [{"id": "...", "text": "...", "expected_weight": "..." | null}]}`
Valores `expected_weight` normalizados al formato canónico: `"X.Y kg"` (punto decimal, espacio, kg minúscula) o `null`.

Añade también un `README.md` describiendo la estructura del fixture.

NO toques el archivo PLAN. NO hagas commit. Solo crea los fixtures.
```

⚠️ AUTO-CHAIN → P0-B

### P0-B — Baseline benchmark

```text
Crea `backend/tests/benchmarks/test_weight_extraction_accuracy.py` siguiendo el patrón exacto de `test_microchip_extraction_accuracy.py`, adaptado a `weight`:

1. Carga fixtures de `weight_cases.json`.
2. Extrae `weight` vía `_build_interpretation_artifact()`.
3. Normaliza para comparación usando `normalize_canonical_fields()`.
4. Test parametrizado por caso (`test_weight_extraction_case[<id>]`).
5. Test summary de accuracy (`test_weight_accuracy_summary`).
6. `MIN_EXACT_MATCH_RATE = 0.0` (baseline — se ajustará post hard-gate).

Ejecuta el benchmark y reporta accuracy inicial — exact matches, null misses, false positives.

NO toques el archivo PLAN. NO hagas commit todavía.
```

⚠️ AUTO-CHAIN → CT-1

### CT-1 — Commit task Phase 0

```text
Ejecuta el commit task CT-1 según SCOPE BOUNDARY:

**STEP 0 — Branch Verification:**
- Rama esperada: `feat/golden-loop-paciente-weight`
- Si no existe, créala desde `origin/main`.

**STEP A — Commit Code:**
- Format pre-flight: formatters + L1.
- Stage todo excepto PLAN: `git add -A -- . ':!docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_2026-03-05_GOLDEN-LOOP-WEIGHT.md'`
- Commit: `test(plan-p0): weight golden-loop baseline fixtures and benchmark`

**STEP B — Commit Plan Update:**
- Marca P0-A, P0-B, CT-1 como `[x]` en Estado de ejecución (con SHA del code commit).
- Limpia Prompt activo.
- Stage y commit solo el PLAN.

**STEP C — Push:**
- `git push origin feat/golden-loop-paciente-weight`
- Primera vez: crear draft PR con `gh pr create --draft`.

**STEP D — Update PR description.**

**STEP E — CI Gate** (según modo CI seleccionado).

**STEP F — Chain or Handoff.**
```

⚠️ AUTO-CHAIN → P1-A

### P1-A — Backend normalizer

```text
Implementa `_normalize_weight()` en `backend/app/application/field_normalizers.py` y conéctala en `normalize_canonical_fields()`.

Lógica de `_normalize_weight(raw: str) -> str`:
1. Strip whitespace.
2. Si vacío o None → return "".
3. Detectar unidad: buscar `kg`, `kgs`, `g`, `gr`, `grs` (case-insensitive).
4. Extraer valor numérico: regex `(\d+[\.,]?\d*)`.
5. Convertir coma→punto decimal.
6. Si unidad es gramos: dividir entre 1000.
7. Si no hay unidad: asumir kg.
8. Parsear a float; si 0 → return "" (rechazo de cero).
9. Si fuera de rango [0.5, 120] → return "" (inválido).
10. Formatear: `f"{value} kg"` (un decimal si no es entero, ej. "3.5 kg", "12 kg").

Conectar en `normalize_canonical_fields()` con:
```python
if key == "weight":
    result[key] = _normalize_weight(value)
    continue
```

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → P1-B

### P1-B — Label variants and guards

```text
Amplía el regex de `weight` en `_LABELED_PATTERNS` (en `constants.py`) para cubrir:

- "Peso corporal" → `peso\s*corporal`
- "P." (abreviación) → `p\.` con guard para no capturar "P. ej." u otros
- "peso (kg)" → `peso\s*\(kg\)`
- Variantes OCR: "Pesso", mayúsculas "PESO"

El regex ya es case-insensitive, pero ajustar el label pattern a:
```
(?:peso(?:\s*corporal)?|p\.\s*(?=\d)|peso\s*\(kg\)|weight)\s*[:\-]?\s*([0-9]+(?:[\.,][0-9]+)?\s*(?:kg|kgs|g|gr|grs)?)
```

Añade guards en candidate mining si es necesario para evitar capturar:
- Dosis de medicamento: contexto "ml/kg", "mg/kg" en la misma línea
- Valores de laboratorio: contexto "mg/dL", "mmol/L"
- Precios: contexto "€", "$", "EUR"

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → P1-C

### P1-C — Normalization unit tests

```text
Crea `backend/tests/unit/test_weight_normalization.py` con tests dedicados para `_normalize_weight()`:

**Válidos:**
- "3,5 kg" → "3.5 kg"
- "12.8 kg" → "12.8 kg"
- "25 kgs" → "25 kg"
- "7" (sin unidad) → "7 kg"
- "500 g" → "0.5 kg"
- "0.8 kg" → "0.8 kg"
- "  4.2  kg  " (whitespace) → "4.2 kg"
- "3500 g" → "3.5 kg"

**Inválidos (→ ""):**
- "" → ""
- None → ""
- "0 kg" → "" (rechazo de cero)
- "0.0" → "" (rechazo de cero)
- "150 kg" → "" (fuera de rango > 120)
- "0.1 kg" → "" (fuera de rango < 0.5)
- "abc" → "" (sin valor numérico)

Ejecuta tests y reporta resultados.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → P1-D

### P1-D — Benchmark delta

```text
Ejecuta el benchmark de `weight` y compara con el baseline de P0-B.

Reporta:
- Exact match rate antes vs después
- Null misses (expected != null, got null/empty)
- False positives (expected == null, got value)
- Casos individuales que fallaron

Si la accuracy no alcanza ≥ 85%, ajusta confidence/ranking de candidates o regex. Si ya es ≥ 85%, reporta y continúa.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → CT-2

### CT-2 — Commit task Phase 1

```text
Ejecuta el commit task CT-2 según SCOPE BOUNDARY:

**STEP 0 — Branch Verification:** `feat/golden-loop-paciente-weight`

**STEP A — Commit Code:**
- Format pre-flight: formatters + L1.
- Stage todo excepto PLAN.
- Commit: `feat(plan-p1): weight extraction hardening — normalizer, labels, unit tests`

**STEP B — Commit Plan Update:**
- Marca P1-A, P1-B, P1-C, P1-D, CT-2 como `[x]` en Estado de ejecución (con SHA).
- Stage y commit solo el PLAN.

**STEP C — Push.**
**STEP D — Update PR description.**
**STEP E — CI Gate.**
**STEP F — Chain or Handoff.**
```

⚠️ AUTO-CHAIN → P2-A

### P2-A — Observability alignment

```text
Alinea la observabilidad de `weight` en `triage.py`:

1. Cambiar el rango de `weight_out_of_range` de `< 0.2` a `< 0.5` para alinear con doc y frontend.
2. Añadir flag `weight_zero_value` cuando el valor numérico extraído es exactamente 0.
3. Verificar que los tests existentes de triage para weight cubren todos los flags.
4. Añadir tests faltantes si es necesario.

Ejecuta suite de observability y reporta resultados.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → CT-3

### CT-3 — Commit task Phase 2

```text
Ejecuta el commit task CT-3 según SCOPE BOUNDARY:

**STEP 0 — Branch Verification:** `feat/golden-loop-paciente-weight`

**STEP A — Commit Code:**
- Format pre-flight: formatters + L1.
- Stage todo excepto PLAN.
- Commit: `feat(plan-p2): weight observability alignment`

**STEP B — Commit Plan Update:**
- Marca P2-A, CT-3 como `[x]` en Estado de ejecución (con SHA).
- Stage y commit solo el PLAN.

**STEP C — Push.**
**STEP D — Update PR description.**
**STEP E — CI Gate.**
**STEP F — Chain or Handoff.**
```

⚠️ AUTO-CHAIN → P3-A

### P3-A — Golden regression

```text
Añade/ajusta assertions golden para `weight` en `test_golden_extraction_regression.py`:

- Si los docs golden (docA/docB) no contienen peso, mantén assertion negativa pero documenta.
- Si es posible, añade un fixture golden con peso positivo o ajusta un doc existente.
- Ejecuta suite focalizada:
  - benchmark weight
  - tests unitarios de normalización weight
  - tests de observability
  - regresión golden

Reporta resultados reproducibles.

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ AUTO-CHAIN → P3-B

### P3-B — Validation evidence

```text
Ejecuta suite completa y resume para body de PR:
- Total tests, pass/fail
- Exact match rate vs baseline
- Null misses y false positives
- Delta vs threshold (≥ 85 %)
- Regresiones en otros golden fields: sí/no

NO toques el archivo PLAN. NO hagas commit.
```

⚠️ HARD-GATE → P3-C (Claude)

### P3-C — Hard-gate

```text
(Claude Opus 4.6) Revisa la evidencia de P3-B:
- ¿EM ≥ 85 %?
- ¿0 regresiones en campos existentes?
- ¿False positives controlados?
- Decisión go/no-go.
```

### P3-D — Post-gate closure

```text
Tras aprobación explícita en P3-C:

1. Ajustar `MIN_EXACT_MATCH_RATE` en benchmark al valor alcanzado menos 5 pp.
2. Actualizar guardrails de `weight` en `extraction-quality.md`:
   - Referenciar implementación backend (`field_normalizers.py::_normalize_weight`).
   - Actualizar § 6 Golden Fields status con benchmark evidence.
3. Commit + push.

NO toques el archivo PLAN aparte de marcar P3-D y CT-5 como completados.
```

⚠️ AUTO-CHAIN → CT-5

### CT-5 — Commit task Phase 3 closure

```text
Ejecuta el commit task CT-5 según SCOPE BOUNDARY:

**STEP 0 — Branch Verification:** `feat/golden-loop-paciente-weight`

**STEP A — Commit Code:**
- Format pre-flight: formatters + L1.
- Stage todo excepto PLAN.
- Commit: `docs(plan-p3): weight threshold lock and extraction-quality update`

**STEP B — Commit Plan Update:**
- Marca P3-D, CT-5 como `[x]` en Estado de ejecución (con SHA).
- Stage y commit solo el PLAN.

**STEP C — Push.**
**STEP D — Update PR description with final evidence.**
**STEP E — CI Gate.**
**STEP F — Mark PR as ready for review.**
```

## Prompt activo

_(Ninguno — plan recién creado, pendiente de inicio.)_

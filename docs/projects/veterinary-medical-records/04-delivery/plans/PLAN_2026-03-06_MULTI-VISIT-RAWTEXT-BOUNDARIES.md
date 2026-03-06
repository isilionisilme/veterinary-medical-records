# Plan: Multi-Visit Detection via Raw Text Boundaries

> **Operational rules:** See [plan-execution-protocol.md](../../03-ops/plan-execution-protocol.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Branch:** `veterinary-medical-records-golden-loop/fix/multi-visit-rawtext-detection`
**PR:** pendiente (draft)
**Prerequisite:** `main` estable con tests verdes y baseline reproducible en `test_document_review.py`.
**Worktree:** pendiente de seleccion (obligatorio antes de Step 1)
**CI Mode:** `2) Pipeline depth-1 gate` (default)
**Agents:** `Codex 5.3` (single-agent execution)
**Iteration:** 23 (propuesta)

---

## Context

### Problema funcional

La deteccion de visitas en review scoping depende hoy de:

1. Campos explicitos `visit_date`.
2. Fechas detectadas en snippets de evidencia que contienen keywords de visita.

Esto provoca fallos en documentos con multiples visitas cuando la fecha existe en el texto crudo pero no esta presente en snippets de campos visit-scoped. Caso objetivo: `docB` mostrando una sola visita cuando el documento contiene varias.

### Estado actual relevante

- `_extract_visit_date_candidates_from_text()` en `_shared.py` solo opera sobre snippets.
- `_normalize_canonical_review_scoping()` en `review_service.py` no consume `raw_text`.
- Existe guard de contexto no-visita (`_NON_VISIT_DATE_CONTEXT_PATTERN`), pero solo aplicado al snippet.

### Decision de implementacion

Se incorpora una fuente adicional de deteccion de visitas basada en `raw_text` completo, en modo incremental:

- Fase inicial: deteccion por fechas + contexto de visita desde `raw_text` (sin asignacion por offsets).
- Fase posterior condicional: offsets posicionales solo si la fase inicial no resuelve `docB`.

---

## Objective

1. Detectar multiples visitas cuando las fechas aparecen en `raw_text` aunque no esten en snippets.
2. Mantener comportamiento determinista/idempotente del payload canonical.
3. Evitar falsos positivos de fechas no clinicas (factura, emision, nacimiento, etc.).
4. Resolver `docB` sin regresiones en golden loops existentes.

## Scope Boundary

- **In scope:** deteccion de visitas desde `raw_text`, merge/deduplicacion con fuentes existentes, guards de contexto no-visita, tests de integracion y benchmark focalizado de visit count.
- **Out of scope:** cambios UX/frontend, cambios de prompt/LLM, soporte de otros idiomas, refactors no relacionados.

---

## Commit plan

| ID | After Steps | Scope | Commit Message | Push |
|---|---|---|---|---|
| CT-1 | P0-A, P0-B | Baseline y fixtures multi-visita | `test(plan-p0): multi-visit raw-text baseline and fixtures` | Inmediato |
| CT-2 | P1-A0, P1-A, P1-B | Plumbing raw_text + deteccion fuente 3 + dedupe | `feat(plan-p1): detect multi-visit boundaries from raw text` | Inmediato |
| CT-3 | P2-A, P2-B | Guards anti-false-positive + determinismo | `fix(plan-p2): harden raw-text visit detection guards` | Inmediato |
| CT-4 | P3-A, P3-B | Benchmark + suite focalizada + evidencia | `test(plan-p3): validate multi-visit raw-text detection` | Inmediato |
| CT-5 | P3-D | Post-gate docs update | `docs(plan-p3): document raw-text multi-visit detection` | Inmediato |
| CT-6 | P4-A, P4-B | Offset assignment (solo si aplica) | `feat(plan-p4): positional visit assignment by raw-text offsets` | Inmediato |

---

## Operational override steps

### CT-1

- `type`: `commit-task`
- `trigger`: after `P0-A` and `P0-B`
- `preconditions`: cambios de `P0-A` y `P0-B` completos; preflight L1/L2 verde; sin archivos fuera de scope
- `commands`: `git add <scope-files> && git commit -m "test(plan-p0): multi-visit raw-text baseline and fixtures" && git push origin veterinary-medical-records-golden-loop/fix/multi-visit-rawtext-detection`
- `approval`: `auto`
- `fallback`: si falla commit/push, corregir causa, reintentar una vez; si persiste, marcar paso `🚫 BLOCKED` y escalar

### CT-2

- `type`: `commit-task`
- `trigger`: after `P1-A0`, `P1-A`, and `P1-B`
- `preconditions`: plumbing `raw_text` y deteccion fuente 3 listos; preflight L1/L2 verde
- `commands`: `git add <scope-files> && git commit -m "feat(plan-p1): detect multi-visit boundaries from raw text" && git push origin veterinary-medical-records-golden-loop/fix/multi-visit-rawtext-detection`
- `approval`: `auto`
- `fallback`: si falla commit/push, corregir causa, reintentar una vez; si persiste, marcar paso `🚫 BLOCKED` y escalar

### CT-3

- `type`: `commit-task`
- `trigger`: after `P2-A` and `P2-B`
- `preconditions`: guards anti-false-positive y pruebas de determinismo completas; preflight L1/L2 verde
- `commands`: `git add <scope-files> && git commit -m "fix(plan-p2): harden raw-text visit detection guards" && git push origin veterinary-medical-records-golden-loop/fix/multi-visit-rawtext-detection`
- `approval`: `auto`
- `fallback`: si falla commit/push, corregir causa, reintentar una vez; si persiste, marcar paso `🚫 BLOCKED` y escalar

### CT-4

- `type`: `commit-task`
- `trigger`: after `P3-A` and `P3-B`
- `preconditions`: benchmark y suite focalizada en verde
- `commands`: `git add <scope-files> && git commit -m "test(plan-p3): validate multi-visit raw-text detection" && git push origin veterinary-medical-records-golden-loop/fix/multi-visit-rawtext-detection`
- `approval`: `auto`
- `fallback`: si falla commit/push, corregir causa, reintentar una vez; si persiste, marcar paso `🚫 BLOCKED` y escalar

### CT-5

- `type`: `commit-task`
- `trigger`: after `P3-D`
- `preconditions`: hard-gate `P3-C` aprobado por usuario y docs post-gate actualizadas
- `commands`: `git add <scope-files> && git commit -m "docs(plan-p3): document raw-text multi-visit detection" && git push origin veterinary-medical-records-golden-loop/fix/multi-visit-rawtext-detection`
- `approval`: `auto`
- `fallback`: si falla commit/push, corregir causa, reintentar una vez; si persiste, marcar paso `🚫 BLOCKED` y escalar

### CT-6

- `type`: `commit-task`
- `trigger`: after `P4-A` and `P4-B`
- `preconditions`: `P4-A` habilitado (decision gate GO) y offsets implementados
- `commands`: `git add <scope-files> && git commit -m "feat(plan-p4): positional visit assignment by raw-text offsets" && git push origin veterinary-medical-records-golden-loop/fix/multi-visit-rawtext-detection`
- `approval`: `auto`
- `fallback`: si falla commit/push, corregir causa, reintentar una vez; si persiste, marcar paso `🚫 BLOCKED` y escalar

---

## Execution Status

**Leyenda**
- 🔄 auto-chain - ejecutable por Codex
- 🚧 hard-gate - revision/decision de usuario

### Phase 0 - Baseline y diagnostico

- [ ] P0-A 🔄 - Crear test de integracion que reproduzca bug de `docB`: raw text con multiples visitas -> sistema actual detecta una sola visita (snapshot del status quo).
- [ ] P0-B 🔄 - Crear fixtures sinteticos con al menos 7 variantes: (a) keywords explicitos, (b) variantes implicitas, (c) separadores de seccion, (d) fechas sin keyword, (e) mezcla de formatos, (f) control single-visit, (g) fechas duplicadas en formatos distintos para la misma visita.
- [ ] CT-1 🔄 - Commit task P0.

### Phase 1 - Deteccion desde raw text (sin offsets)

- [ ] P1-A0 🔄 - Propagar `raw_text` al flujo de normalizacion canonical: `get_document_review()` -> `_normalize_review_interpretation_data()` -> `_project_review_payload_to_canonical()` -> `_normalize_canonical_review_scoping()`.
- [ ] P1-A 🔄 - Implementar `_detect_visit_dates_from_raw_text(raw_text) -> list[str]` en `_shared.py` usando contexto de visita + parseo de fecha. Evitar `Fecha` generico; usar patron compuesto (`fecha de visita|consulta|cita|atencion|exploracion`) y keywords clinicas de visita.
- [ ] P1-B 🔄 - Integrar como tercera fuente en `review_service.py` (merge + deduplicacion por fecha normalizada) manteniendo orden estable.
- [ ] CT-2 🔄 - Commit task P1.

### Phase 2 - Guards y robustez

- [ ] P2-A 🔄 - Endurecer `_NON_VISIT_DATE_CONTEXT_PATTERN` para excluir contextos no-clinicos: facturacion, emision, nacimiento, identificadores y disclaimers comunes.
- [ ] P2-B 🔄 - Verificar determinismo e idempotencia del payload canonical con tests (misma entrada, misma salida/orden).
- [ ] CT-3 🔄 - Commit task P2.

### Phase 3 - Validacion y cierre

- [ ] P3-A 🔄 - Ejecutar benchmark completo + delta, sin regresiones en golden loops.
- [ ] P3-B 🔄 - Ejecutar suite focalizada de visit detection incluyendo assert duro `detected_visits == expected_visits` para cada fixture.
- [ ] CT-4 🔄 - Commit task P3-A + P3-B.
- [ ] P3-C 🚧 - Hard-gate: validacion manual de `docB` en entorno dev. Criterio GO: multiples visitas detectadas correctamente.
- [ ] P3-D 🔄 - Post-gate: actualizacion de documentacion tecnica y umbrales aplicables.
- [ ] CT-5 🔄 - Commit task P3-D.

### Phase 4 - Extension condicional (solo si Phase 1 no alcanza)

- [ ] P4-A 🚧 - Decision gate: si `docB` NO queda resuelto solo con fechas desde raw text, habilitar asignacion posicional por offsets.
- [ ] P4-B 🔄 - Implementar `_detect_visit_boundaries_from_raw_text(raw_text) -> list[DetectedVisit]` con `start_offset/end_offset` y asignacion por proximidad solo para campos sin fecha en snippet.
- [ ] CT-6 🔄 - Commit task P4.

---

## Prompt Queue

1. `P0-A`: reproducir baseline del bug `docB` en integracion sin cambiar logica productiva.
2. `P0-B`: crear fixtures sinteticos para coverage de multi-visita y controles anti-regresion.
3. `P1-A0`: propagar `raw_text` por pipeline canonical hasta scoping.
4. `P1-A`: implementar deteccion de fechas de visita desde `raw_text` con contexto clinico.
5. `P1-B`: integrar tercera fuente de visitas con merge + dedupe estable.
6. `P2-A`: endurecer guard de contexto no-visita.
7. `P2-B`: asegurar determinismo/idempotencia con tests dedicados.
8. `P3-A`: ejecutar benchmark y validar no regresiones.
9. `P3-B`: ejecutar suite focalizada con asserts duros de visit count.
10. `P3-C`: hard-gate de validacion manual de `docB`.
11. `P3-D`: documentar cambios y umbrales post-gate.
12. `P4-A`: decision gate para habilitar offsets.
13. `P4-B`: implementar asignacion posicional solo si gate GO.

## Active Prompt

Pendiente de carga por planning agent antes del siguiente step ejecutable.

---

## Acceptance criteria

1. `docB` pasa de una visita detectada a multiples visitas detectadas correctamente.
2. No se introducen visitas fantasma en casos single-visit.
3. Fechas no clinicas no generan visitas (factura/emision/nacimiento/disclaimer).
4. Dedupe correcto de fechas equivalentes (`dd/mm/yyyy` y `yyyy-mm-dd`).
5. Payload canonical determinista e idempotente.
6. Suites de regresion y benchmark relevantes en verde.

---

## Archivos clave

| Archivo | Rol |
|---|---|
| `backend/app/application/documents/_shared.py` | Deteccion de fechas de visita desde snippet/raw text y patrones de contexto |
| `backend/app/application/documents/review_service.py` | Integracion de fuentes de visita y scoping canonical |
| `backend/tests/integration/test_document_review.py` | Casos de integracion multi-visita |
| `backend/tests/fixtures/synthetic/` | Fixtures sinteticos de visit detection |
| `backend/tests/benchmarks/` | Benchmark/regresion de extraccion |

---

## How to test

- `python -m pytest backend/tests/integration/test_document_review.py -v --no-cov`
- `python -m pytest backend/tests/benchmarks/ -v --no-cov`
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py -v --no-cov`
- Validacion manual: cargar `docB` y confirmar multiples visitas detectadas.

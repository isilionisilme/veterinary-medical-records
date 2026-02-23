# Plan de ejecución AI (handoff entre chats)

## Objetivo
Mejorar el proyecto para obtener la mejor evaluación posible en la prueba técnica. Focos:
- Arquitectura y diseño
- Mantenibilidad y calidad de código
- Calidad de tests
- Prácticas de desarrollo
- Documentación de entrega
- Entrega incremental con evidencia verificable

---

## Estado de ejecución — actualizar al completar cada paso

> **Protocolo "Continúa":** abre un chat nuevo, selecciona el agente correcto, adjunta este archivo y escribe `Continúa`. El agente leerá el estado, ejecutará el siguiente paso sin completar y se detendrá al terminar.

**Leyenda de automatización:**
- 🔄 **auto-chain** — Codex ejecuta solo; tú revisas el resultado *después*.
- 🚧 **hard-gate** — Requiere tu decisión antes de continuar. No saltar.

### Fase 1 — Auditoría de arquitectura
- [x] F1-A 🔄 — Auditoría 12-Factor → backlog (Codex)
- [x] F1-B 🚧 — Validación de backlog — **TÚ decides qué items se implementan** (Claude)
- [ ] F1-C 🔄 — Implementación de items del backlog (Codex, una iteración por item)

### Fase 2 — Mantenibilidad y refactor estructural
- [ ] F2-A 🔄 — Auditoría ln-620 + codebase_audit.md (Codex)
- [ ] F2-B 🚧 — Validación de backlog — **TÚ decides estrategia de descomposición** (Claude)
- [ ] F2-C 🔄 — Refactor App.tsx (Codex)
- [ ] F2-D 🔄 — Refactor processing_runner.py (Codex)
- [ ] F2-E 🔄 — Refactor document_service.py (Codex)
- [ ] F2-F 🔄 — Redistribución App.test.tsx (Codex)
- [ ] F2-G 🚧 — **TÚ pruebas la app post-refactor** (~10 min: docker compose up, subir PDF, editar, confirmar)

### Fase 3 — Quick wins de tooling
- [ ] F3-A 🔄 — Definir config ESLint + Prettier + pre-commit (Claude)
- [ ] F3-B 🔄 — Implementar tooling + coverage (Codex)

### Fase 4 — Calidad de tests
- [ ] F4-A 🔄 — Auditoría frontend-testing (Codex)
- [ ] F4-B 🔄 — Auditoría python-testing-patterns (Codex)
- [ ] F4-C 🔄 — Implementar mejoras de tests (Codex)

### Fase 5 — Documentación
- [ ] F5-A 🔄 — Revisión docs con project-guidelines-example (Codex)
- [ ] F5-B 🚧 — ADRs de arquitectura: **TÚ defines los argumentos** (Claude)
- [ ] F5-C 🔄 — ADRs de arquitectura: crear ficheros (Codex)
- [ ] F5-D 🔄 — FUTURE_IMPROVEMENTS.md (Codex)

### Fase 6 — Smoke test del evaluador
- [ ] F6-A 🚧 — **TÚ pruebas el flujo end-to-end como evaluador** (Claude + Codex)

### Fase 7 — Cierre global
- [ ] F7-A 🚧 — Veredicto final + PR a main (Claude/Codex)

---

## Resultados de auditorías — rellenar automáticamente al completar cada auditoría

> Esta sección es el source of truth para los backlogs. Codex escribe aquí el top-5 del backlog de cada auditoría antes de commitear. Así el plan es autocontenido y cualquier sesión siguiente tiene el contexto sin depender del historial del chat.

### F1-A — Backlog 12-Factor (top 5)
1. ✅ **Centralizar configuración/validación de entorno en un único settings module tipado**
  - **Problema:** Lectura de env distribuida entre `config.py` e infraestructura (`database.py`, `file_storage.py`), con riesgo de drift.
  - **Impacto:** Alto en mantenibilidad y percepción de arquitectura.
  - **Esfuerzo:** S
  - **Riesgo:** Bajo
  - **Criterio de aceptación:** Todos los env vars runtime se validan en un único punto y los adapters consumen settings resueltos.
  - **Evidencia de validación:** `pytest` backend y arranque `docker compose up --build` sin regressions.

2. ✅ **Exponer metadata de release (commit/version/build-date) como frontera explícita build-release-run**
  - **Problema:** Build/run reproducibles, pero sin superficie explícita de release metadata.
  - **Impacto:** Medio-alto en evaluación de prácticas de ingeniería.
  - **Esfuerzo:** S
  - **Riesgo:** Bajo
  - **Criterio de aceptación:** API/contenerización exponen versión/revisión inmutable verificable en CI.
  - **Evidencia de validación:** Job CI verificando metadata y smoke local.

3. ✅ **Desacoplar bootstrap del scheduler del composition root HTTP**
  - **Problema:** API process y processing scheduler comparten ciclo de vida directo en `main.py`.
  - **Impacto:** Alto en mantenibilidad evolutiva y claridad de responsabilidades.
  - **Esfuerzo:** M
  - **Riesgo:** Medio
  - **Criterio de aceptación:** Arranque/parada del scheduler encapsulados detrás de una frontera explícita sin cambiar contratos HTTP.
  - **Evidencia de validación:** `pytest` backend completo + pruebas de ciclo de vida sin cambios funcionales.

4. ✅ **Añadir profile opcional de worker en Compose (sin alterar flujo evaluador por defecto)**
  - **Problema:** No existe process type dedicado para presión de cola; todo corre en el proceso web.
  - **Impacto:** Medio en madurez arquitectónica percibida.
  - **Esfuerzo:** M
  - **Riesgo:** Medio
  - **Criterio de aceptación:** `docker compose` mantiene comportamiento actual; profile opcional habilita worker separado reutilizando código existente.
  - **Evidencia de validación:** Compose config válida + smoke con y sin profile.

5. ✅ **Definir comandos administrativos one-off explícitos (schema/maintenance/diagnostics)**
  - **Problema:** Existen scripts y tests, pero falta interfaz administrativa formal para tareas operativas.
  - **Impacto:** Medio en 12-factor factor XII y operabilidad.
  - **Esfuerzo:** S
  - **Riesgo:** Bajo
  - **Criterio de aceptación:** README/docs documentan comandos idempotentes para tareas administrativas recurrentes.
  - **Evidencia de validación:** Ejecución local de comandos y referencia cruzada en documentación.

### F1-B — Decisiones de validación
- ✅ **Item 1** — Centralizar configuración/validación en único settings module tipado → Aprobado
- ✅ **Item 2** — Exponer metadata de release (commit/version/build-date) → Aprobado
- ✅ **Item 3** — Desacoplar bootstrap del scheduler del composition root HTTP → Aprobado (riesgo medio aceptado: el código actual ya usa stop_event limpio; refactor es mayormente mover código)
- ❌ **Item 4** — Worker profile opcional en Compose → **Descartado.** SQLite no soporta escrituras concurrentes fiables desde dos procesos. Si el evaluador activa el profile y falla con `database is locked`, la impresión es peor que no tenerlo.
- ✅ **Item 5** — Comandos administrativos one-off explícitos → Aprobado

### F2-A — Backlog ln-620 codebase audit (top 5)
_Pendiente. Codex rellenará esta sección al completar F2-A._

### F2-B — Decisiones de validación y estrategia de descomposición
_Pendiente. Claude escribirá aquí los items aprobados, la estrategia de descomposición de cada archivo monolítico (módulos destino, responsabilidades), y las decisiones del usuario._

---

## Prompt activo (just-in-time) — write-then-execute

> **Uso:** Claude escribe aquí el próximo prompt de Codex ANTES de que el usuario cambie de agente. Así Codex lo lee directamente del archivo adjunto — cero copy-paste, cero error humano.
>
> **Flujo:** Claude escribe → commit + push → usuario abre Codex → adjunta archivo → "Continúa" → Codex lee esta sección → ejecuta → borra el contenido al terminar.

### Paso objetivo
_F1-C: Implementar los 4 items aprobados del backlog 12-Factor (items 1, 2, 3, 5)._

### Prompt
```
--- AGENT IDENTITY CHECK ---
This prompt is designed for GPT-5.3-Codex in VS Code Copilot Chat.
If you are not GPT-5.3-Codex: STOP. Tell the user to switch agents.
--- END IDENTITY CHECK ---

--- BRANCH CHECK ---
Run: git branch --show-current
If NOT `improvement/refactor`: STOP. Tell the user: "⚠️ Cambia a la rama improvement/refactor antes de continuar: git checkout improvement/refactor"
--- END BRANCH CHECK ---

--- SYNC CHECK ---
Run: git pull origin improvement/refactor
--- END SYNC CHECK ---

--- PRE-FLIGHT CHECK ---
1. Verify F1-B has `[x]` in Estado de ejecución. If not: STOP.
2. Verify `### F1-B — Decisiones de validación` is NOT `_Pendiente_`. If it is: STOP.
3. Verify these files exist:
   - backend/app/config.py
   - backend/app/infra/database.py
   - backend/app/infra/file_storage.py
   - backend/app/main.py
   - docker-compose.yml
   - Dockerfile.backend
--- END PRE-FLIGHT CHECK ---

TASK — Implement 4 approved items from the F1-B backlog. Work through them ONE AT A TIME in the order below. After each sub-item, run tests before moving to the next.

**Approved items (from F1-B decisions):**
- ✅ Item 1 — Centralize config
- ✅ Item 2 — Release metadata
- ✅ Item 3 — Decouple scheduler bootstrap
- ✅ Item 5 — Admin one-off commands
- ❌ Item 4 — Worker profile (DISCARDED — skip entirely)

---

### Item 1: Centralize env config into a typed Settings class

**Current state:** `os.environ.get()` calls scattered across:
- `backend/app/config.py` — VET_RECORDS_DISABLE_PROCESSING, VET_RECORDS_EXTRACTION_OBS, confidence policy vars
- `backend/app/infra/database.py` — VET_RECORDS_DB_PATH
- `backend/app/infra/file_storage.py` — VET_RECORDS_STORAGE_PATH
- `backend/app/main.py` — ENV/APP_ENV/VET_RECORDS_ENV, UVICORN_RELOAD, VET_RECORDS_CORS_ORIGINS

**What to do:**
1. Create `backend/app/settings.py` with a frozen dataclass `Settings` that reads ALL env vars at construction time with typed defaults. Use `__post_init__` for validation (not pydantic — keep deps minimal).
2. Expose a module-level `get_settings() -> Settings` function using `@lru_cache(maxsize=1)`.
3. Update `config.py`, `database.py`, `file_storage.py`, and `main.py` to consume `get_settings()` instead of reading `os.environ` directly.
4. Preserve ALL existing defaults and behavior — this is a refactor, not a behavior change.
5. Keep `config.py` functions that have business logic (confidence policy parsing) — they should take settings values as parameters instead of reading env directly.

**Acceptance:** `pytest` backend passes. `os.environ.get` no longer appears in config.py, database.py, file_storage.py (except in settings.py itself).

---

### Item 2: Expose release metadata (build-release-run boundary)

**What to do:**
1. Add `GIT_COMMIT`, `BUILD_DATE`, `APP_VERSION` to `Settings` (default: "dev"/"unknown").
2. Add a `/version` endpoint in the API that returns `{"version": ..., "commit": ..., "build_date": ...}`.
3. In `Dockerfile.backend`, add `ARG GIT_COMMIT` and `ARG BUILD_DATE`, pass them as `ENV` to the container.
4. In `docker-compose.yml`, add `build.args` that populate from shell env (with sensible defaults for local dev).

**Acceptance:** `curl localhost:8000/version` returns JSON with version info. Tests pass.

---

### Item 3: Decouple scheduler bootstrap from HTTP composition root

**Current state:** `main.py` `lifespan()` directly creates an `asyncio.Task` for `processing_scheduler` at lines 128-135. Shutdown is via `stop_event.set()` + `await task`.

**What to do:**
1. Create `backend/app/infra/scheduler_lifecycle.py` with a class `SchedulerLifecycle` that encapsulates:
   - `async start(repository, storage) -> None` (creates the task + stop_event)
   - `async stop() -> None` (sets stop_event, awaits task)
   - Property `is_running -> bool`
2. Update `main.py` `lifespan()` to use `SchedulerLifecycle` instead of managing the task directly.
3. The existing `processing_scheduler` async generator function stays as-is — this is just lifecycle wiring.
4. Store the lifecycle instance on `app.state.scheduler` instead of separate `processing_stop_event` and `processing_task`.

**Critical:** Do NOT change the behavior of `processing_enabled()`. Do NOT change the scheduler's internal logic. Only move the lifecycle management behind an explicit boundary.

**Acceptance:** `pytest` backend passes. `processing_stop_event` and `processing_task` no longer appear directly in main.py lifespan.

---

### Item 5: Define explicit one-off admin commands

**What to do:**
1. Create `backend/app/cli.py` with a minimal CLI (using `argparse`, not click — keep deps minimal):
   - `db-schema` — runs `database.ensure_schema()` and reports success
   - `db-check` — verifies DB exists and is readable, reports table count
   - `config-check` — instantiates `Settings`, reports all config values (masking sensitive ones)
2. Make it runnable as `python -m backend.app.cli <command>`.
3. Document the commands in the project README under a new "Administrative Commands" section (brief, 5-6 lines).

**Acceptance:** Each command runs successfully locally. Tests pass (no need to add CLI tests — these are operational, not business logic).

---

COMMIT STRATEGY: Make ONE commit for all 4 items together (they're all small and tightly related under "12-factor improvements").

--- TEST GATE ---
Backend: cd d:/Git/veterinary-medical-records && python -m pytest --tb=short -q
Frontend: cd d:/Git/veterinary-medical-records/frontend && npm test
If any test fails: STOP. Report failures. Do NOT commit.
--- END TEST GATE ---

--- SCOPE BOUNDARY ---
When done and all tests pass:
1. Edit AI_ITERATIVE_EXECUTION_PLAN.md: change `- [ ] F1-C` to `- [x] F1-C`.
2. Clean `## Prompt activo`: replace `### Paso objetivo` content with `_Completado: F1-C_` and `### Prompt` with `_Vacío._`
3. git add -A && git commit -m "refactor(plan-f1c): centralize config, release metadata, scheduler lifecycle, admin CLI" && git push origin improvement/refactor
4. Tell the user: "✓ F1-C completado, tests OK, pusheado. Siguiente: abre un chat nuevo en Copilot → selecciona GPT-5.3-Codex → adjunta AI_ITERATIVE_EXECUTION_PLAN.md → escribe Continúa (para F2-A 🔄 auditoría ln-620)."
5. Stop.
--- END SCOPE BOUNDARY ---
```

---

## Skills instaladas y uso recomendado

### Arquitectura / calidad
- `12-factor-apps` — Auditoría cloud-native, configuración por entorno, acoplamiento y escalabilidad.
- `ln-620-codebase-auditor` — Auditoría integral con 9 workers especializados (seguridad, build, arquitectura, calidad, dependencias, dead code, observabilidad, concurrencia, lifecycle). Genera `docs/project/codebase_audit.md`.

### Testing
- `frontend-testing` — Cobertura y calidad en frontend React/Vitest/RTL, detección de gaps críticos.
- `python-testing-patterns` — Estrategia backend FastAPI/pytest, fixtures/mocks, robustez.

### Documentación
- `project-guidelines-example` — Optimización de estructura documental (arquitectura, ejecución, checklist de entrega).
- `architecture-decision-records` — Documentación de decisiones técnicas (ADRs), trade-offs, trazabilidad.

### Soporte
- `skill-lookup` — Buscar skills adicionales si aparece un hueco funcional durante la ejecución.

## Compatibilidad por modelo
- **Codex**: `~/.codex/skills` ✓
- **Claude (Copilot chat)**: `~/.github/skills` ✓
- Si una skill no carga: reiniciar el chat para refrescar.

---

## Fortalezas existentes — NO MODIFICAR SIN JUSTIFICACIÓN EXPLÍCITA

Estas áreas puntúan alto con los evaluadores. Todo cambio debe preservarlas:

| Área | Qué proteger |
|---|---|
| **Arquitectura hexagonal backend** | `domain/` puro (frozen dataclasses), ports con `Protocol`, composición en `main.py` |
| **Docker setup** | `docker compose up --build` funcional, healthchecks, perfiles de test, dev overlay |
| **CI pipeline** | 6 jobs: brand, design system, doc/test parity, docker packaging, quality, frontend |
| **Documentación** | `docs/README.md` con reading order, TECHNICAL_DESIGN.md (1950 líneas), extraction-tracking |
| **Evidencia incremental** | PR storyline (143 PRs trazados), golden field iterations, run parity reports |

---

## Reglas operativas

### Iteraciones atómicas
Nunca mezclar alcance entre pasos. Cada paso del Estado de ejecución es una unidad atómica: se ejecuta, se commitea, se pushea, se marca `[x]`. Si falla, se reporta — no se continúa al siguiente.

### Regla "Continúa-only"
**Cuando el usuario escribe `Continúa`, el agente ejecuta SOLO lo que dicta el plan (Estado + prompt correspondiente).** Si el mensaje del usuario incluye instrucciones adicionales junto a "Continúa" (ej: "Continúa, pero no toques X" o "Continúa y de paso haz Y"), el agente debe:
1. **Ignorar las instrucciones extra.**
2. Responder: "⚠️ El protocolo Continúa ejecuta exactamente el siguiente paso del plan. Si necesitas modificar el alcance, díselo primero a Claude para que actualice el plan y el prompt."
3. No ejecutar nada hasta que el usuario confirme con un `Continúa` limpio.

Esto evita que instrucciones ad-hoc del usuario se mezclen con las del plan y causen desviaciones no controladas.

### Rollback
Si un paso completado causa un problema no detectado por los tests:
1. `git revert HEAD` (revierte el commit sin perder historial)
2. Editar Estado de ejecución: cambiar `[x]` de vuelta a `[ ]` en el paso afectado
3. Reportar a Claude para diagnóstico antes de reintentar

### Plan = solo agentes
**El usuario NO edita este archivo manualmente.** Solo los agentes (Claude y Codex) modifican `AI_ITERATIVE_EXECUTION_PLAN.md`. Si el usuario necesita cambiar algo (ej: añadir un paso, corregir un typo), se lo pide a Claude y Claude hace la edición + commit.

Razón: una edición humana accidental (borrar un `[x]`, reformatear una tabla, truncar un prompt) puede corromper el routing y causar que Codex repita o salte pasos.

### Hard-gates: protocolo de decisión estructurada
En los pasos 🚧 (F1-B, F2-B, F5-B, F6-A), Claude presenta las opciones como lista numerada:
```
Items del backlog:
1. ✅ Centralizar config en Settings class — Impact: Alto, Effort: S
2. ✅ Añadir health check endpoint — Impact: Medio, Effort: S
3. ❌ Migrar a PostgreSQL — Impact: Alto, Effort: L (FUERA DE SCOPE)
4. ✅ Separar logging config — Impact: Medio, Effort: S
5. ❌ Añadir service mesh — Impact: Bajo, Effort: L (FUERA DE SCOPE)
```
El usuario responde SOLO con números: `1, 2, 4` o `todos` o `ninguno`.
Claude entonces:
1. Escribe la decisión en la sección `## Resultados de auditorías` correspondiente (items aprobados ✅, descartados ❌ con razón).
2. Commitea + pushea la decisión.
3. Prepara el prompt de implementación en `## Prompt activo` (solo con los items aprobados).
4. Commitea + pushea el prompt.
5. Le dice al usuario: "Decisiones guardadas. Abre Codex, adjunta el plan, escribe Continúa."

Así las decisiones quedan en el archivo y sobreviven a la pérdida del chat.

## Estrategia de prompts

- **Prompts de auditoría** (Fases 1 y 2): pre-escritos en las secciones de cada fase. Codex los lee directamente del archivo.
- **Prompts de implementación** (Fases 3+): generados just-in-time por Claude. **Claude los escribe en la sección `## Prompt activo`** de este archivo, commitea y pushea. Luego el usuario abre Codex, adjunta el archivo y escribe `Continúa`. Codex lee el prompt de la sección `Prompt activo`. **El usuario nunca copia ni pega prompts manualmente.**

### Protocolo "Continúa"
Cada prompt incluye al final una instrucción para que el agente:
1. Marque su paso como completado en la sección **Estado de ejecución** (cambiando `[ ]` por `[x]`).
2. Haga commit automáticamente con el mensaje estandarizado (sin pedir permiso, informando al usuario del commit realizado).
3. Se detenga.

Flujo para Codex — pasos con prompt pre-escrito (F1-A, F2-A):
> _Referencia para agentes. El usuario no necesita leer esto — cada agente le indica el siguiente paso al terminar._

Codex lee el prompt de la sección de la fase correspondiente ("Fase 1 — Prompt para Codex" o "Fase 2 — Prompt para Codex").

Flujo para Codex — pasos just-in-time (F1-C, F2-C…F2-F, F3-B, F4-A…F4-C, F5-A/C/D):
> _Referencia para agentes._

Claude prepara el prompt en `## Prompt activo`, commitea y le dice al usuario: "Listo. Abre un chat nuevo con Codex, adjunta el plan y escribe Continúa." Codex lee el prompt de `## Prompt activo`.

Flujo para Claude (pasos marcados con "Claude" en el Estado):
> _Referencia para agentes._

Claude lee el Estado, ejecuta el paso y al terminar le dice al usuario el siguiente movimiento.

### Instrucciones de siguiente paso (regla para todos los agentes)
Al terminar un paso, el agente SIEMPRE indica al usuario el siguiente movimiento con instrucciones concretas:

- **Si el siguiente paso es de Codex (prompt pre-escrito):**
  → "Abre un chat nuevo en Copilot → selecciona GPT-5.3-Codex → adjunta `AI_ITERATIVE_EXECUTION_PLAN.md` → escribe `Continúa`."
- **Si el siguiente paso es de Codex (just-in-time):**
  → "Vuelve a Claude (este chat) con el plan adjunto y escribe `Continúa`. Claude preparará el prompt."
- **Si el siguiente paso es de Claude (🚧 hard-gate):**
  → "Vuelve a Claude (este chat) con el plan adjunto y escribe `Continúa`."
- **Si el siguiente paso es de Claude (🔄 auto-chain):**
  → "Vuelve a Claude (este chat) con el plan adjunto y escribe `Continúa`."

Así el usuario nunca necesita consultar el plan para saber qué hacer — simplemente sigue las indicaciones del agente.

### Routing de "Continúa" para Codex
Cuando Codex recibe `Continúa` con este archivo adjunto, sigue esta lógica de decisión:

```
1. Lee Estado de ejecución → encuentra el primer `[ ]`.
2. Si el paso es de Claude (no de Codex):
   → STOP. Dile al usuario: "Este paso es de Claude. Vuelve al chat de Claude."
3. Si el paso es F1-A:
   → Lee el prompt de la sección "Fase 1 — Prompt para Codex".
4. Si el paso es F2-A:
   → Lee el prompt de la sección "Fase 2 — Prompt para Codex".
5. Para cualquier otro paso de Codex:
   → Lee el prompt de la sección "## Prompt activo".
   → Si `### Prompt` contiene `_Vacío._`: STOP.
     Dile al usuario: "⚠️ No hay prompt activo. Vuelve a Claude para que lo genere."
```
### Auto-chain vs Hard-gate

Los pasos marcados con 🔄 (**auto-chain**) se pueden ejecutar consecutivamente sin intervención humana. Cuando hay varios 🔄 seguidos del mismo agente, basta con abrir un chat y escribir `Continúa` repetidamente — o incluso esperar a que termine y volver a escribir `Continúa` para el siguiente.

Los pasos marcados con 🚧 (**hard-gate**) cortan la cadena. **No ejecutes el siguiente paso hasta completar el hard-gate.** Estos son los momentos donde tú tomas decisiones que afectan todo el trabajo posterior:

| Hard-gate | Qué decides | Tiempo estimado |
|---|---|---|
| **F1-B** | Qué items del backlog 12-factor valen la pena implementar (descartar falsos positivos / fuera de scope) | ~10 min |
| **F2-B** | Estrategia de descomposición de los archivos monolíticos (nombres de módulos, responsabilidades) | ~15 min |
| **F2-G** | Verificación manual post-refactor — ¿la app se ve y funciona correctamente? | ~10 min |
| **F5-B** | Argumentos reales de los ADRs (deben reflejar *tu* razonamiento, no el de la IA) | ~15 min |
| **F6-A** | Experiencia del evaluador — solo tú puedes juzgar la primera impresión del repo | ~15 min |
| **F7-A** | Veredicto final: LISTO / NO LISTO + crear PR | ~15 min |

**Tu tiempo activo total: ~75 minutos repartidos en 6 pausas.** El resto fluye automáticamente con test gates como red de seguridad.
### Template para prompts de implementación (just-in-time)
Todos los prompts de implementación generados just-in-time siguen esta estructura. Claude la rellena antes de cada paso de Codex:

```
--- AGENT IDENTITY CHECK ---
This prompt is designed for GPT-5.3-Codex in VS Code Copilot Chat.
If you are not GPT-5.3-Codex: STOP. Tell the user to switch agents.
--- END IDENTITY CHECK ---

--- BRANCH CHECK ---
Run: git branch --show-current
If NOT `improvement/refactor`: STOP. Tell the user: "⚠️ Cambia a la rama improvement/refactor antes de continuar: git checkout improvement/refactor"
--- END BRANCH CHECK ---

--- SYNC CHECK ---
Run: git pull origin improvement/refactor
This ensures the local copy has the latest Estado, Resultados, and Prompt activo from previous sessions.
--- END SYNC CHECK ---

--- PRE-FLIGHT CHECK (ejecutar antes de empezar) ---
1. Paso anterior completado: verify the previous step in Estado de ejecución has `[x]`. If not: STOP. Tell the user: "⚠️ El paso anterior no está marcado como completado. Complétalo primero."
2. Backlog disponible (si aplica): if this step depends on an audit backlog (F1-C depends on F1-A, F2-C…F depends on F2-A), verify the corresponding `### Resultados de auditorías` section is NOT `_Pendiente_`. If it is: STOP. Tell the user: "⚠️ El backlog de [fase] no está relleno. Ejecuta la auditoría primero."
3. Target files exist: for any file path mentioned in the TASK section below, run `Test-Path <path>`. If any file does NOT exist: STOP. Tell the user which file is missing — it may have been renamed in a prior refactor step.
--- END PRE-FLIGHT CHECK ---

[TASK — rellenado por Claude con instrucciones específicas del paso]

--- TEST GATE (ejecutar antes de commitear) ---
Backend: cd d:/Git/veterinary-medical-records && python -m pytest --tb=short -q
Frontend: cd d:/Git/veterinary-medical-records/frontend && npm test
Si algún test falla: STOP. Reporta los fallos al usuario. NO commitees.
--- END TEST GATE ---

--- SCOPE BOUNDARY ---
Cuando termines y todos los tests pasen:
1. Edita AI_ITERATIVE_EXECUTION_PLAN.md: cambia `- [ ] F?-?` a `- [x] F?-?`.
2. Limpia la sección `## Prompt activo`: reemplaza el contenido de `### Paso objetivo` con `_Completado: F?-?_` y `### Prompt` con `_Vacío._`
3. git add -A && git commit -m "<tipo>(plan-f?-?): <descripción>" && git push origin improvement/refactor
4. Dile al usuario: "✓ F?-? completado, tests OK, pusheado. Vuelve a Claude para [siguiente paso]."
5. Stop.
--- END SCOPE BOUNDARY ---
```

### Convención de commits
Todos los commits de este flujo siguen el formato:
```
<tipo>(plan-<id>): <descripción corta>
```
Ejemplos:
- `audit(plan-f1a): 12-factor compliance report + backlog`
- `refactor(plan-f2c): split App.tsx into page and API modules`
- `test(plan-f4c): add frontend coverage gaps for upload flow`
- `docs(plan-f5c): add ADR-ARCH-001 through ADR-ARCH-004`

El agente construye el mensaje según el id del paso completado (F1-A → `plan-f1a`, F2-C → `plan-f2c`, etc.).

---

## Formato obligatorio de salida (en cada iteración)

Para cada recomendación/hallazgo:
- **Problema**
- **Impacto** en la evaluación
- **Esfuerzo** (S/M/L)
- **Riesgo** de regresión
- **Criterio de aceptación** verificable
- **Evidencia de validación** (tests/lint/build/documentación)

---

## Fase 1 — Auditoría de arquitectura `[PROMPT LISTO]`

> **Modelo para el prompt:** `Codex`
> **Modelo para validar el backlog:** `Claude (este chat)`

**Skill:** `12-factor-apps`
**Objetivo:** Identificar brechas de arquitectura cloud-native. La arquitectura ya es sólida; esta fase debe confirmar eso o señalar brechas puntuales.
**Criterio de cierre:** ≤3 brechas de severidad Media o Alta. Todas con criterio de aceptación verificable.

### Prompt para Codex

```
--- AGENT IDENTITY CHECK (execute this first, before anything else) ---
This prompt is designed for GPT-5.3-Codex acting as an agentic coding assistant in VS Code Copilot Chat.
If you are Claude, Gemini, or any model other than GPT-5.3-Codex:
  STOP. Do not read or execute any instruction below.
  Tell the user: "Este prompt está diseñado para GPT-5.3-Codex. Por favor, cambia el agente en el desplegable del chat de Copilot a GPT-5.3-Codex y pega el prompt de nuevo."
--- END IDENTITY CHECK ---

--- BRANCH CHECK ---
Run: git branch --show-current
If the current branch is NOT `improvement/refactor`:
  STOP. Tell the user: "⚠️ Estás en la rama '<branch>'. Este prompt debe ejecutarse en 'improvement/refactor'. Cámbiala con: git checkout improvement/refactor"
--- END BRANCH CHECK ---

--- SYNC CHECK ---
Run: git pull origin improvement/refactor
This ensures the local copy has the latest Estado and Resultados from previous sessions.
--- END SYNC CHECK ---

Use the skill `12-factor-apps` to perform a full 12-Factor compliance audit on this codebase.

codebase_path: d:/Git/veterinary-medical-records

Context for the audit:
- This is a veterinary medical records processing system (technical exercise for job evaluation).
- Stack: FastAPI (Python 3.11) backend + React 18/TypeScript frontend.
- Deployment: Docker Compose (single-machine, not cloud-native production).
- Persistence: SQLite + local filesystem storage.
- Config: environment variables via `.env` files and `backend/app/config.py`.
- The architecture is intentionally a modular monolith (not microservices).

Audit instructions:
1. Run the full 12-factor analysis against all 12 factors.
2. For each factor: assign Strong / Partial / Weak compliance, with specific file references.
3. Skip factors that are explicitly out of scope for a single-machine Docker Compose setup (note which and why).
4. For each Partial or Weak finding: produce one row in this format:
   | Factor | Finding | File/Location | Impact | Effort (S/M/L) | Acceptance Criterion |
5. Prioritize findings by impact on code maintainability and evaluator perception.
6. Do NOT suggest microservices, cloud infrastructure, or distributed systems — out of scope.
7. End with a prioritized backlog of ≤5 actionable items for Codex to implement.

--- SCOPE BOUNDARY — STOP HERE ---
Do NOT implement any changes. Your output for this prompt is the audit report + backlog ONLY.
When done:
1. Write the top-5 backlog items into the `### F1-A — Backlog 12-Factor (top 5)` section of docs/project/AI_ITERATIVE_EXECUTION_PLAN.md (replace the _Pendiente_ placeholder).
2. Change `- [ ] F1-A` to `- [x] F1-A` in the Estado de ejecución section.
3. git add -A && git commit -m "audit(plan-f1a): 12-factor compliance report + backlog" && git push origin improvement/refactor
4. Tell the user: "✓ F1-A completado, pusheado. Siguiente: vuelve a Claude (este chat) con el plan adjunto y escribe `Continúa` para validar el backlog (F1-B 🚧)."
5. Stop.
--- END SCOPE BOUNDARY ---
```

### Flujo de ejecución
1. `Codex` — ejecuta el prompt de auditoría con `12-factor-apps`.
2. `Claude (este chat)` — revisa el backlog producido y elimina items fuera de alcance.
3. `Codex` — implementa cada item por separado (una iteración por item).
4. `Claude (este chat)` — valida cada iteración contra su criterio de aceptación.
5. Repetir 3-4 hasta cerrar todos los items del backlog.

---

## Fase 2 — Auditoría de mantenibilidad y refactor estructural `[PROMPT LISTO]`

> **Modelo para el prompt de auditoría:** `Codex`
> **Modelo para revisar el informe y validar iteraciones:** `Claude (este chat)`
> **Modelo para implementar el refactor:** `Codex`

**Skill:** `ln-620-codebase-auditor`
**Objetivo:** Identificar deuda técnica, y en especial los archivos monolíticos que un evaluador verá inmediatamente.
**Criterio de cierre:** Los 3 archivos monolíticos críticos descompuestos. Todos los workers del auditor sin findings de severidad Alta sin resolver.

### Targets críticos identificados (pre-auditoría)

| Archivo | Líneas actuales | Problema | Prioridad |
|---|---|---|---|
| `frontend/src/App.tsx` | ~6.000 | Toda la app en un archivo: rutas, estado, API calls, UI | **#1 — Crítico** |
| `backend/app/application/processing_runner.py` | ~2.900 | Extracción + interpretación + orquestación mezcladas | **#2 — Alto** |
| `backend/app/application/document_service.py` | ~1.800 | Demasiadas responsabilidades en un módulo | **#3 — Medio** |
| `frontend/src/App.test.tsx` | ~3.600 | Tests monolíticos (espejo de App.tsx) | **#4 — Se resuelve con #1** |

### Prompt para Codex

```
--- AGENT IDENTITY CHECK (execute this first, before anything else) ---
This prompt is designed for GPT-5.3-Codex acting as an agentic coding assistant in VS Code Copilot Chat.
If you are Claude, Gemini, or any model other than GPT-5.3-Codex:
  STOP. Do not read or execute any instruction below.
  Tell the user: "Este prompt está diseñado para GPT-5.3-Codex. Por favor, cambia el agente en el desplegable del chat de Copilot a GPT-5.3-Codex y pega el prompt de nuevo."
--- END IDENTITY CHECK ---

--- BRANCH CHECK ---
Run: git branch --show-current
If the current branch is NOT `improvement/refactor`:
  STOP. Tell the user: "⚠️ Estás en la rama '<branch>'. Este prompt debe ejecutarse en 'improvement/refactor'. Cámbiala con: git checkout improvement/refactor"
--- END BRANCH CHECK ---

--- SYNC CHECK ---
Run: git pull origin improvement/refactor
This ensures the local copy has the latest Estado and Resultados from previous sessions.
--- END SYNC CHECK ---

Use the skill `ln-620-codebase-auditor` to perform a full codebase quality audit on this project.

Project root: d:/Git/veterinary-medical-records

Context:
- Veterinary medical records processing system (technical exercise for job evaluation).
- Stack: FastAPI (Python 3.11) + React 18/TypeScript + SQLite + Docker Compose.
- Architecture: intentional modular monolith with hexagonal/ports-and-adapters pattern.
- Evaluators specifically assess: architecture, maintainability, best practices, incremental delivery.

After the audit, produce a prioritized remediation backlog with this structure for each finding:
| # | Worker | File | Finding | Impact on Evaluation | Effort (S/M/L) | Acceptance Criterion |

Pre-identified critical targets to include in the analysis regardless of automated detection:
1. `frontend/src/App.tsx` (~6000 lines) — entire application in one file
2. `backend/app/application/processing_runner.py` (~2900 lines) — mixed responsibilities
3. `backend/app/application/document_service.py` (~1800 lines) — too many responsibilities

Do NOT recommend:
- Changing the hexagonal architecture (already correct)
- Replacing SQLite with PostgreSQL (out of scope)
- Introducing microservices or distributed systems
- Removing or simplifying the existing documentation system

Output the audit report to docs/project/codebase_audit.md as the skill specifies.
Then return a prioritized backlog of the top 10 actionable items for Codex to implement.

--- SCOPE BOUNDARY — STOP HERE ---
Do NOT implement any changes. Your output for this prompt is the audit report + backlog ONLY.
When done:
1. Write the top-5 backlog items into the `### F2-A — Backlog ln-620 codebase audit (top 5)` section of docs/project/AI_ITERATIVE_EXECUTION_PLAN.md (replace the _Pendiente_ placeholder).
2. Change `- [ ] F2-A` to `- [x] F2-A` in the Estado de ejecución section.
3. git add -A && git commit -m "audit(plan-f2a): ln-620 codebase audit report + remediation backlog" && git push origin improvement/refactor
4. Tell the user: "✓ F2-A completado, pusheado. Siguiente: vuelve a Claude (este chat) con el plan adjunto y escribe `Continúa` para validar el backlog (F2-B 🚧)."
5. Stop.
--- END SCOPE BOUNDARY ---
```

### Flujo de ejecución
1. `Codex` — ejecuta el prompt con `ln-620-codebase-auditor` → genera `docs/project/codebase_audit.md`.
2. `Claude (este chat)` — revisa el informe y valida/ajusta el backlog resultante.
3. `Codex` — **Iteración 2a — App.tsx**: extraer rutas/páginas, capa API, state management en módulos separados. Criterio: ningún archivo nuevo >500 líneas. Tests siguen pasando (`npm test`).
4. `Codex` — **Iteración 2b — processing_runner.py**: separar extracción, interpretación, orquestación. Criterio: interfaz pública intacta, tests backend pasan (`pytest`).
5. `Codex` — **Iteración 2c — document_service.py**: dividir responsabilidades. Criterio: tests pasan, imports en `routes.py` no cambian.
6. `Codex` — **Iteración 2d — App.test.tsx**: redistribuir tests alineados con nuevos componentes. Criterio: cobertura mantenida o mejorada.
7. `Claude (este chat)` — valida cierre de cada iteración antes de pasar a la siguiente.

---

## Fase 3 — Quick wins de tooling `[PROMPT: just-in-time]`

> **Modelo para definir la config:** `Claude (este chat)`
> **Modelo para implementar:** `Codex`
> **Modelo para verificar:** `Claude (este chat)`

**Objetivo:** Añadir herramientas estándar que los evaluadores esperan ver y que no están configuradas.
**Esfuerzo total:** S. **Impacto en evaluación:** Alto.

| Quick win | Estado actual | Qué añadir |
|---|---|---|
| **ESLint + Prettier (frontend)** | Solo `tsc --noEmit` | `eslint.config.mjs`, `.prettierrc`, script `lint` en `package.json`, job en CI |
| **Coverage reporting** | Sin coverage | `vitest --coverage` + `pytest --cov=backend` en CI, badge en README |
| **`.pre-commit-config.yaml`** | `pre-commit` en deps pero sin config | Hooks: ruff + eslint + prettier |

### Flujo de ejecución
1. `Claude (este chat)` — define la configuración exacta para los tres tools (just-in-time, tras ver output de Fase 2).
2. `Codex` — implementa los tres en una sola iteración.
3. `Claude (este chat)` — verifica: `npm run lint` pasa, `pytest --cov` genera reporte, pre-commit hooks funcionan localmente.
4. `Codex` — cierra brechas.

---

## Fase 4 — Calidad de tests `[PROMPT: just-in-time]`

> **Modelo para auditoría de tests:** `Codex` (usa skills `frontend-testing` y `python-testing-patterns`)
> **Modelo para validar y decidir cierre:** `Claude (este chat)`
> **Modelo para implementar mejoras:** `Codex`

**Skills:** `frontend-testing`, `python-testing-patterns`
**Objetivo:** Evaluar cobertura post-refactor, eliminar tests frágiles y cerrar gaps críticos.
**Nota:** Esta fase ocurre DESPUÉS de Fase 2. Los tests de frontend ya estarán redistribuidos; el foco es calidad, no estructura.

### Flujo de ejecución
1. `Codex` — auditoría de cobertura frontend con skill `frontend-testing`: gaps críticos, tests frágiles, patrones incorrectos.
2. `Codex` — auditoría backend con skill `python-testing-patterns`: fixtures redundantes, casos sin probar, robustez de integración.
3. `Claude (este chat)` — revisar los informes de auditoría y priorizar mejoras.
4. `Codex` — implementar mejoras priorizadas de tests por separado (frontend / backend).
5. `Claude (este chat)` — revisar resultados y decidir cierre.
6. Repetir 4-5 hasta cierre.

---

## Fase 5 — Documentación de entrega `[PROMPT: just-in-time]`

> **Modelo para revisar docs existentes:** `Codex` (skill `project-guidelines-example`)
> **Modelo para definir ADRs y validar formato:** `Claude (este chat)` (skill `architecture-decision-records`)
> **Modelo para crear los archivos ADR:** `Codex`

**Skills:** `project-guidelines-example`, `architecture-decision-records`
**Objetivo:** Los evaluadores piden explícitamente "decisiones técnicas documentadas". Ya existen ADRs de extracción; faltan ADRs de arquitectura general.

### 5a — ADRs de arquitectura general (nuevos)
ADRs que faltan y que el evaluador espera:
- **ADR-ARCH-001**: Why modular monolith (vs microservices)
- **ADR-ARCH-002**: Why SQLite (trade-offs, path to PostgreSQL)
- **ADR-ARCH-003**: Why no ORM (repository pattern with raw SQL)
- **ADR-ARCH-004**: Why in-process async (vs task queue como Celery/RQ)

### 5b — Estructura documental
1. `Codex` — usar skill `project-guidelines-example` para revisar y optimizar docs existentes (sin reinventar lo correcto).
2. `Codex` — aplicar mejoras puntuales.
3. `Claude (este chat)` — usando skill `architecture-decision-records`: validar formato ADR y definir contenido de los 4 ADRs de arquitectura.
4. `Codex` — crear los ficheros ADR y conectar con `docs/README.md`.
5. `Claude (este chat)` — verificación final de claridad, trazabilidad y mantenibilidad.

### 5c — Plan de mejoras futuras
Crear `docs/project/FUTURE_IMPROVEMENTS.md` con roadmap 2/4/8 semanas (entregable explícito requerido por la prueba).

---

## Fase 6 — Smoke test del evaluador `[PROMPT: just-in-time]`

> **Modelo para verificar README y revisar la experiencia:** `Claude (este chat)`
> **Modelo para ejecutar el flujo y corregir fricciones:** `Codex`

**Objetivo:** Garantizar que la experiencia del evaluador sea impecable de principio a fin. Simula exactamente lo que hará el evaluador cuando reciba el repo.

### Checklist de verificación
1. `Claude (este chat)` — verificar que `README.md` lleva del clone al sistema funcionando en ≤5 comandos / ≤5 minutos.
2. `Codex` — ejecutar flujo completo: `docker compose up --build` → todos los servicios healthy → subir un PDF → ver extracción → editar campo → confirmar revisión.
3. `Claude (este chat)` — revisar experiencia de primer uso (mensajes de error claros, estados de carga, feedback visual, edge cases visibles).
4. `Codex` — corregir cualquier fricción encontrada.

---

## Fase 7 — Cierre global

> **Modelo:** `Claude (este chat)` para el repaso y el veredicto — `Codex` para las correcciones y la PR.

1. `Claude (este chat)` — repaso final del delta completo (sin rediseños grandes).
2. `Codex` — aplicar correcciones imprescindibles de cierre menores.
3. `Claude (este chat)` — veredicto final **"LISTO PARA ENTREGAR / NO LISTO"** con lista de lo implementado vs pendiente.
4. Si LISTO: `Codex` — crear la PR final con `gh pr create` usando el template de abajo. Claude revisa el body antes de merge.

### PR final — template de body

```
gh pr create \
  --base main \
  --head improvement/refactor \
  --title "improvement: architecture audit, structural refactor, tooling & documentation" \
  --body "## Summary
Structured improvement across 7 phases, driven by AI-assisted audits and iterative implementation.

### Phase 1 — Architecture audit (12-Factor)
- [commits del backlog F1-A y F1-C]

### Phase 2 — Structural refactor
- App.tsx (~6000 → modular components, none >500 LOC)
- processing_runner.py (~2900 → extraction/interpretation/orchestration modules)
- document_service.py (~1800 → split responsibilities)
- App.test.tsx redistributed to match new component structure

### Phase 3 — Tooling quick wins
- ESLint + Prettier configured
- Coverage reporting (vitest + pytest-cov)
- .pre-commit-config.yaml (ruff + eslint + prettier)

### Phase 4 — Test quality
- Frontend: [gaps cerrados]
- Backend: [gaps cerrados]

### Phase 5 — Documentation
- ADR-ARCH-001 through ADR-ARCH-004
- FUTURE_IMPROVEMENTS.md (2/4/8 week roadmap)
- Documentation structure optimized

### Phase 6 — Evaluator smoke test
- README → running system in ≤5 commands verified
- Full E2E flow verified (upload → extract → edit → confirm)

### How to test
\`\`\`bash
git clone <repo> && cd veterinary-medical-records
docker compose up --build
# Wait for healthy → open http://localhost:5173
# Upload a PDF → verify extraction → edit a field → confirm
\`\`\`

All tests pass: \`pytest\` (backend) + \`npm test\` (frontend)."
```

> **Nota:** Claude rellenará los `[placeholders]` con datos reales del Estado y Resultados antes de que Codex ejecute la creación. El template es una guía, no texto final.

### Estrategia de rama y PR
- **Una sola rama:** `improvement/refactor` (ya creada).
- **Una sola PR:** al finalizar F7-A, merge a `main`. Con 143 PRs existentes, la evidencia incremental está más que cubierta. Los commits individuales de cada fase (`audit(plan-f1a)`, `refactor(plan-f2c)`, etc.) dan la trazabilidad paso a paso dentro de la PR.

---

## Entregables finales esperados

| Entregable | Estado objetivo |
|---|---|
| Código con estructura clara y mantenible | Sin archivos >500 líneas (salvo excepciones justificadas) |
| Documentación de arquitectura y decisiones técnicas | ADRs de extracción (existentes) + 4 ADRs de arquitectura general (nuevos) |
| Instrucciones de instalación/ejecución Docker-first | Verificadas end-to-end en Fase 6 |
| Evidencia de enfoque incremental | PR storyline existente + iteraciones de esta rama |
| Plan de mejoras futuras | `docs/project/FUTURE_IMPROVEMENTS.md` (2/4/8 semanas) |
| Toolchain completo | Ruff + ESLint + Prettier + pre-commit + coverage reporting |

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

### Fase 1 — Auditoría de arquitectura
- [ ] F1-A — Auditoría 12-Factor → backlog (Codex)
- [ ] F1-B — Validación de backlog (Claude)
- [ ] F1-C — Implementación de items del backlog (Codex, una iteración por item)

### Fase 2 — Mantenibilidad y refactor estructural
- [ ] F2-A — Auditoría ln-620 + codebase_audit.md (Codex)
- [ ] F2-B — Validación de backlog (Claude)
- [ ] F2-C — Refactor App.tsx (Codex)
- [ ] F2-D — Refactor processing_runner.py (Codex)
- [ ] F2-E — Refactor document_service.py (Codex)
- [ ] F2-F — Redistribución App.test.tsx (Codex)

### Fase 3 — Quick wins de tooling
- [ ] F3-A — Definir config ESLint + Prettier + pre-commit (Claude)
- [ ] F3-B — Implementar tooling + coverage (Codex)

### Fase 4 — Calidad de tests
- [ ] F4-A — Auditoría frontend-testing (Codex)
- [ ] F4-B — Auditoría python-testing-patterns (Codex)
- [ ] F4-C — Implementar mejoras de tests (Codex)

### Fase 5 — Documentación
- [ ] F5-A — Revisión docs con project-guidelines-example (Codex)
- [ ] F5-B — ADRs de arquitectura: definir contenido (Claude)
- [ ] F5-C — ADRs de arquitectura: crear ficheros (Codex)
- [ ] F5-D — FUTURE_IMPROVEMENTS.md (Codex)

### Fase 6 — Smoke test del evaluador
- [ ] F6-A — Verificar README y flujo end-to-end (Claude + Codex)

### Fase 7 — Cierre global
- [ ] F7-A — Veredicto final (Claude)

---

## Resultados de auditorías — rellenar automáticamente al completar cada auditoría

> Esta sección es el source of truth para los backlogs. Codex escribe aquí el top-5 del backlog de cada auditoría antes de commitear. Así el plan es autocontenido y cualquier sesión siguiente tiene el contexto sin depender del historial del chat.

### F1-A — Backlog 12-Factor (top 5)
_Pendiente. Codex rellenará esta sección al completar F1-A._

### F2-A — Backlog ln-620 codebase audit (top 5)
_Pendiente. Codex rellenará esta sección al completar F2-A._

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
| **Evidencia incremental** | PR storyline (19 PRs trazados), golden field iterations, run parity reports |

---

## Regla operativa clave

Trabajar por **iteraciones** y no mezclar alcance:
1. **Claude (este chat)** propone/valida (usando skill correspondiente).
2. **Codex** implementa.
3. **Claude (este chat)** evalúa contra criterios de aceptación.
4. Si hay brechas, **Codex** corrige y se repite.
5. Solo cuando **Claude (este chat)** confirme **"iteración cerrada"**, pasar a la siguiente.

## Estrategia de prompts

- **Prompts de auditoría** (Fases 1 y 2): generados en este documento, listos para copiar.
- **Prompts de implementación** (Fases 3+): generados just-in-time, usando el output de las auditorías como input. Evita obsolescencia por cambios en el código.

### Protocolo "Continúa"
Cada prompt incluye al final una instrucción para que el agente:
1. Marque su paso como completado en la sección **Estado de ejecución** (cambiando `[ ]` por `[x]`).
2. Haga commit automáticamente con el mensaje estandarizado (sin pedir permiso, informando al usuario del commit realizado).
3. Se detenga.

Flujo para Codex (pasos marcados con “Codex” en el Estado):
1. Abre un chat **nuevo** en Copilot, selecciona **GPT-5.3-Codex**.
2. Adjunta este archivo.
3. Escribe: `Continúa`.

Flujo para Claude (pasos marcados con “Claude” en el Estado):
1. Vuelve a **este chat** (Claude en Copilot).
2. Adjunta este archivo.
3. Escribe: `Continúa`.

El agente leerá el Estado, identificará el primer ítem `[ ]` sin completar, ejecutará ese único paso y se detendrá.

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

[TASK — rellenado por Claude con instrucciones específicas del paso]

--- TEST GATE (ejecutar antes de commitear) ---
Backend: cd d:/Git/veterinary-medical-records && python -m pytest --tb=short -q
Frontend: cd d:/Git/veterinary-medical-records/frontend && npm test
Si algún test falla: STOP. Reporta los fallos al usuario. NO commitees.
--- END TEST GATE ---

--- SCOPE BOUNDARY ---
Cuando termines y todos los tests pasen:
1. Edita AI_ITERATIVE_EXECUTION_PLAN.md: cambia `- [ ] F?-?` a `- [x] F?-?`.
2. git add -A && git commit -m "<tipo>(plan-f?-?): <descripción>" && git push origin improvement/refactor
3. Dile al usuario: "✓ F?-? completado, tests OK, pusheado. Vuelve a Claude para [siguiente paso]."
4. Stop.
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
4. Tell the user: "✓ F1-A completado, pusheado. Vuelve a Claude (este chat) con el archivo adjunto para validar el backlog (F1-B)."
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
4. Tell the user: "✓ F2-A completado, pusheado. Vuelve a Claude (este chat) con el archivo adjunto para validar el backlog (F2-B)."
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

> **Modelo:** `Claude (este chat)` para el repaso y el veredicto — `Codex` para las correcciones.

1. `Claude (este chat)` — repaso final del delta completo (sin rediseños grandes).
2. `Codex` — aplicar correcciones imprescindibles de cierre menores.
3. `Claude (este chat)` — veredicto final **"LISTO PARA ENTREGAR / NO LISTO"** con lista de lo implementado vs pendiente.

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

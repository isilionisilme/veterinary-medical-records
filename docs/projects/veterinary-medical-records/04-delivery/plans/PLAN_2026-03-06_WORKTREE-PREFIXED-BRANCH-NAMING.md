# Plan: Worktree-Prefixed Branch Naming Convention

> **Operational rules:** See [execution-rules.md](../../03-ops/execution-rules.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Rama:** `improvements/improvement/branch-naming-rules-update`
**PR:** pendiente (draft)
**Prerequisito:** `main` estable con tests verdes y router generator operativo (`python scripts/docs/generate-router-files.py`).
**Iteracion:** 1
**Modo CI:** `3) End-of-plan gate`

---

## Context

### Problema operativo

Los nombres de rama actuales no identifican explicitamente el worktree de origen. Con multiples worktrees activos, esto complica:

- identificar de un vistazo de que worktree viene cada rama,
- evitar colisiones de nombres entre agentes/worktrees,
- filtrar ramas por contexto operativo.

### Estado actual

- Convencion vigente documentada: `<category>/<slug>`.
- No hay validacion automatica de branch naming en hooks o CI.
- Los worktrees activos comparten el mismo repositorio: `veterinary-medical-records`, `veterinary-medical-records-golden-loop`, `golden-2`, `docs`.

### Regla funcional adoptada

- Nuevo formato canonico: `<worktree>/<category>/<slug>`.
- `worktree` usa el nombre de carpeta tal cual.
- Categorias permitidas: `feature`, `fix`, `docs`, `chore`, `refactor`, `ci`, `improvement`.
- Exenciones: `main` y detached HEAD.
- Transicion: formato antiguo (`<category>/<slug>`) permitido temporalmente con warning.

---

## Objective

1. Establecer la convencion canonica `<worktree>/<category>/<slug>` en la documentacion operativa.
2. Regenerar router docs para mantener sincronia canonical -> router.
3. Implementar validacion automatica en pre-push (via L2/preflight) con mensajes claros.
4. Mantener compatibilidad temporal con ramas antiguas (warning, no bloqueo).
5. Garantizar verificabilidad con pruebas manuales del hook + check de drift del router.

## Scope Boundary (strict)

- **In scope:** `way-of-working.md` (branching), regeneracion de router files, nuevo validador de nombre de rama, integracion en `preflight-ci-local.ps1`, pruebas manuales de enforcement.
- **Out of scope:** migracion/rename de ramas historicas, enforcement en CI remoto, cambios de categorias de rama, refactors no relacionados.

---

## Commit Task Definitions

| ID | After Steps | Scope | Commit Message | Push |
|---|---|---|---|---|
| CT-1 | P1-A, P1-B | Convencion canonica + router regenerado | `docs(plan-p1): adopt worktree-prefixed branch naming convention` | Inmediato |
| CT-2 | P2-A, P2-B | Validador + integracion preflight L2 | `ci(plan-p2): enforce worktree-prefixed branch naming on pre-push` | Inmediato |
| CT-3 | P3-A, P3-B | Evidencia de validacion + cierre del plan | `docs(plan-p3): document branch naming validation evidence` | Inmediato |

---

## Estado de ejecucion

**Leyenda**
- 🔄 auto-chain — ejecutable por Codex
- 🚧 hard-gate — revision/decision de usuario

### Phase 1 — Convencion y router

- [ ] P1-A 🔄 — Actualizar `docs/shared/03-ops/way-of-working.md` seccion 2 para formalizar `<worktree>/<category>/<slug>`, exenciones y politica de transicion. (GPT-5.3-Codex)
- [ ] P1-B 🔄 — Regenerar router docs y verificar que `docs/agent_router/03_SHARED/WAY_OF_WORKING/30_branching-strategy.md` y `docs/agent_router/01_WORKFLOW/BRANCHING/00_entry.md` reflejan la nueva convencion. (GPT-5.3-Codex)
- [ ] CT-1 🔄 — Commit task: scope P1-A + P1-B -> `docs(plan-p1): adopt worktree-prefixed branch naming convention` -> push. (GPT-5.3-Codex)

### Phase 2 — Enforcement pre-push

- [ ] P2-A 🔄 — Crear `scripts/ci/validate-branch-name.ps1` con validacion de formato nuevo, exenciones, fallback legacy con warning y error blocking para formatos invalidos. (GPT-5.3-Codex)
- [ ] P2-B 🔄 — Integrar validacion en `scripts/ci/preflight-ci-local.ps1` para que aplique en L2 (`Mode Push`) y bloquee push cuando corresponda. (GPT-5.3-Codex)
- [ ] CT-2 🔄 — Commit task: scope P2-A + P2-B -> `ci(plan-p2): enforce worktree-prefixed branch naming on pre-push` -> push. (GPT-5.3-Codex)

### Phase 3 — Validacion y cierre

- [ ] P3-A 🔄 — Ejecutar validacion manual de escenarios (nuevo formato, legacy permitido, invalido bloqueado, worktree-prefijo incorrecto bloqueado). (GPT-5.3-Codex)
- [ ] P3-B 🔄 — Ejecutar `python scripts/docs/generate-router-files.py --check` y consolidar evidencia final para PR. (GPT-5.3-Codex)
- [ ] CT-3 🔄 — Commit task: scope P3-A + P3-B -> `docs(plan-p3): document branch naming validation evidence` -> push. (GPT-5.3-Codex)

---

## Acceptance criteria

1. La convencion oficial queda documentada como `<worktree>/<category>/<slug>` en `way-of-working.md`.
2. Los router files derivados de branching reflejan la nueva convencion sin drift.
3. El push falla para ramas fuera de formato y pasa para formato nuevo valido.
4. Ramas legacy `<category>/<slug>` no bloquean push durante transicion y muestran warning.
5. Ramas con prefijo de worktree incorrecto se bloquean en pre-push.
6. `main` y detached HEAD permanecen exentos.

---

## Archivos clave

| Archivo | Rol |
|---|---|
| `docs/shared/03-ops/way-of-working.md` | Fuente canonica de convencion de ramas |
| `docs/agent_router/03_SHARED/WAY_OF_WORKING/30_branching-strategy.md` | Router derivado para branching strategy |
| `docs/agent_router/01_WORKFLOW/BRANCHING/00_entry.md` | Entrada routing para intent de branch naming |
| `scripts/ci/validate-branch-name.ps1` | Validador de branch naming (nuevo) |
| `scripts/ci/preflight-ci-local.ps1` | Punto de integracion enforcement en L2 |
| `.githooks/pre-push` | Hook que dispara L2 antes del push |

---

## Politicas de sesion

- No editar router files manualmente (son auto-generated).
- Cualquier cambio en docs canonicos de branching debe regenerar router antes de cerrar.
- No cambiar categorias de rama fuera del alcance de este plan.

---

## Cola de prompts

### P1-A — Canonical branching update

```text
Contexto: estamos ejecutando el plan WORKTREE-PREFIXED-BRANCH-NAMING en la rama `improvements/improvement/branch-naming-rules-update`.

Actualiza `docs/shared/03-ops/way-of-working.md` en la seccion de Branching Strategy para adoptar como formato canonico:

<worktree>/<category>/<slug>

Requisitos:
1) Mantener categorias vigentes: feature, fix, docs, chore, refactor, ci, improvement.
2) Explicitar exenciones: main y detached HEAD.
3) Definir transicion: permitir temporalmente el formato legacy <category>/<slug> con warning.
4) Incluir ejemplos concretos para worktrees: veterinary-medical-records, veterinary-medical-records-golden-loop, golden-2, docs.
5) No modificar secciones no relacionadas.

NO toques el archivo PLAN. NO hagas commit.
```

### P1-B — Router regeneration and verification

```text
Regenera los router files tras el cambio canonico de branching:

1) Ejecutar: python scripts/docs/generate-router-files.py
2) Verificar que cambiaron:
	- docs/agent_router/03_SHARED/WAY_OF_WORKING/30_branching-strategy.md
	- docs/agent_router/01_WORKFLOW/BRANCHING/00_entry.md
3) Validar drift limpio con:
	- python scripts/docs/generate-router-files.py --check

NO toques el archivo PLAN. NO hagas commit.
```

### P2-A — Branch name validator script

```text
Crea `scripts/ci/validate-branch-name.ps1` con esta logica:

1) Detectar rama actual con `git branch --show-current`.
2) Si rama vacia (detached) o `main`: exit 0.
3) Detectar worktree esperado con `git rev-parse --show-toplevel` + `Split-Path -Leaf`.
4) Validar formato nuevo:
	^<worktree>/(feature|fix|docs|chore|refactor|ci|improvement)/[a-z0-9][a-z0-9-]*[a-z0-9]$
5) Si no matchea formato nuevo pero si legacy (`^(feature|fix|docs|chore|refactor|ci|improvement)/`): warning + exit 0.
6) Si no matchea ninguno: error + exit 1.
7) Mensajes claros con formato esperado y worktree detectado.

NO toques el archivo PLAN. NO hagas commit.
```

### P2-B — Integrate validation into L2 preflight

```text
Integra el validador en `scripts/ci/preflight-ci-local.ps1` para que corra en modo Push (L2):

1) Invocar `scripts/ci/validate-branch-name.ps1` temprano en el flujo de Mode Push.
2) Si la validacion falla, abortar con exit code no-cero.
3) No ejecutar la validacion en mode Quick (L1), salvo que ya exista patron central reutilizable.
4) Mantener sin cambios el resto de checks L1/L2/L3.

NO toques el archivo PLAN. NO hagas commit.
```

### P3-A — Manual validation matrix

```text
Ejecuta y documenta esta matriz manual:

1) Rama valida nueva: <worktree>/chore/test-branch-naming -> push permitido.
2) Rama legacy: chore/test-old-format -> warning y push permitido.
3) Rama invalida: random-branch -> push bloqueado.
4) Prefijo worktree incorrecto: golden-2/chore/test desde worktree veterinary-medical-records -> push bloqueado.

Registrar comandos y resultado de cada caso.

NO toques el archivo PLAN. NO hagas commit.
```

### P3-B — Final quality checks and PR evidence

```text
Preparar evidencia final:

1) Ejecutar: python scripts/docs/generate-router-files.py --check
2) Consolidar resultados de la matriz de validacion del hook.
3) Preparar resumen para PR body:
	- formato nuevo,
	- compatibilidad legacy temporal,
	- casos bloqueados,
	- archivos modificados.

NO toques el archivo PLAN. NO hagas commit.
```

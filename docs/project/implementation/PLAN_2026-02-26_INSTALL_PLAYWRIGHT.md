# Plan de ejecución AI — Playwright E2E (Producción)

## Objetivo
Integrar y estabilizar Playwright E2E en este repositorio para uso local (VS Code) y CI, dejando una PR lista para merge a `main`.

Focos:
- Setup técnico Playwright en `frontend/`
- Smoke tests E2E confiables
- Señal CI reproducible
- Entrega incremental con evidencia verificable

---

## Estado de ejecución — actualizar al completar cada paso

> **Protocolo `Continúa`:** abre un chat nuevo, selecciona el agente correcto, adjunta este archivo y escribe `Continúa`. El agente leerá el estado, ejecutará el siguiente paso sin completar y se detendrá al terminar.

**Leyenda de automatización:**
- 🔄 **auto-chain** — Codex ejecuta solo; revisión posterior.
- 🚧 **hard-gate** — requiere decisión/validación humana antes de continuar.

### Fase P1 — Integración Playwright E2E
- [ ] P1-A 🔄 — Verificación de estado actual y gap analysis (Codex)
- [ ] P1-B 🔄 — Setup Playwright en `frontend/` (dependencia, config, scripts, fixture) (Codex)
- [ ] P1-C 🔄 — Selectores `data-testid` E2E estables (Codex)
- [ ] P1-D 🔄 — Smoke `app-loads` verde y estable (Codex)
- [ ] P1-E 🔄 — Smoke `upload` robusto por `document_id` (Codex)
- [ ] P1-F 🔄 — Job `CI / e2e` con artifacts en fallo (Codex)
- [ ] P1-G 🔄 — Validación técnica: `test:e2e`, `tsc --noEmit`, `eslint .` (Codex)
- [ ] P1-H 🚧 — Validación manual en headed + checklist funcional mínimo (Usuario/Claude)
- [ ] P1-I 🔄 — Commit, push y PR hacia `main` (Codex)
- [ ] P1-J 🚧 — Veredicto final y decisión de merge (Claude/Usuario)

---

## Reglas operativas (obligatorias)

Estas reglas son de cumplimiento estricto para este plan y replican la política operativa del plan maestro.

1. **Identity check (hard rule):**
   - Este flujo está diseñado para `GPT-5.3-Codex` cuando el paso es de Codex.
   - Si el agente activo no corresponde al paso siguiente, detenerse y hacer handoff explícito al agente correcto.

2. **Branch check (hard rule):**
   - Ejecutar `git branch --show-current` antes de empezar cada paso.
   - Rama objetivo de este plan: `improvement/playwright`.
   - Si no coincide, STOP con instrucción concreta para cambiar de rama.

3. **Sync check (hard rule):**
   - Antes de ejecutar un paso, sincronizar rama (`git fetch` + `git pull` cuando aplique).
   - Si no hay upstream configurado, registrarlo como limitación operativa y continuar con evidencia local.

4. **Scope boundary (hard rule):**
   - Cada paso implementa solo su alcance.
   - No encadenar cambios fuera del paso activo.

5. **Paso por paso (hard rule):**
   - Completar y cerrar un paso antes de iniciar el siguiente.
   - Actualizar checkbox del estado al terminar.

6. **Evidencia obligatoria por paso:**
   - Comandos ejecutados.
   - Resultado relevante.
   - Archivos tocados.
   - Criterio de aceptación validado.

7. **Formato de hallazgos/recomendaciones (obligatorio):**
   - Problema
   - Impacto
   - Esfuerzo (S/M/L)
   - Riesgo
   - Criterio de aceptación
   - Evidencia de validación

8. **Commits (convención obligatoria):**
   - Formato: `<tipo>(plan-<id>): <descripción corta>`
   - Ejemplos: `test(plan-p1e): stabilize upload smoke by upload response id`

9. **Handoff obligatorio al cerrar paso (hard rule):**
   - Si el siguiente paso es del **mismo agente** y no es 🚧: anunciar cierre y continuar en el mismo chat.
   - Si el siguiente paso es de **otro agente** o es 🚧: STOP. Abrir chat nuevo + agente exacto + adjuntar este archivo + escribir `Continúa`.

10. **Mensajes de handoff (obligatorios):**
   - Caso A (siguiente paso otro agente y prompt listo):
     - "✅ P?-? completado. Siguiente: abre un chat nuevo en Copilot → selecciona **[agente]** → adjunta `PLAN_2026-02-26_INSTALL_PLAYWRIGHT.md` → escribe `Continúa`."
   - Caso B (siguiente paso Codex sin prompt listo):
     - "✅ P?-? completado. No hay prompt pre-escrito para P?-?. Vuelve al chat de **Claude Opus 4.6** y pídele el prompt de P?-?. Luego abre un chat nuevo con **GPT-5.3-Codex**, adjunta el plan y escribe `Continúa`."
   - Caso C (siguiente paso Claude/hard-gate):
     - "✅ P?-? completado. Siguiente: abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta `PLAN_2026-02-26_INSTALL_PLAYWRIGHT.md` → escribe `Continúa`."

11. **No-review implícito:**
   - No iniciar code review automáticamente salvo instrucción explícita del usuario.

12. **No implementación fuera de pedido:**
   - Si el objetivo es plan/documentación, no ejecutar implementación técnica en ese turno.

13. **Control de regresión:**
   - No marcar un paso como completo sin validaciones mínimas definidas para ese paso.

14. **Context safety valve:**
   - Si el contexto del chat se agota, cerrar paso actual limpiamente y emitir handoff.

15. **Regla de finalización de iteración:**
   - Ningún cierre sin "siguiente acción" concreta.

16. **Prohibición de saltos:**
   - No saltar hard-gates.

---

## Prompt activo

### P1-E — Stabilizar `upload-smoke` (Codex)
Objetivo: hacer el smoke de upload determinístico.

Instrucciones operativas:
1. Esperar respuesta `POST /documents/upload` (201).
2. Extraer `document_id` de la respuesta.
3. Asertar presencia de `data-testid="doc-row-${document_id}"` en sidebar.
4. Evitar assertions basadas solo en texto filename.
5. Mantener timeout razonable por test, sin aumentar globalmente toda la suite.

Criterio de aceptación:
- `cd frontend && npm run test:e2e` en verde local con Docker en `localhost:80`.

---

## Cola de prompts

- P1-F (Codex): endurecer CI `CI / e2e` y artifacts.
- P1-G (Codex): ejecutar quality gates y consolidar evidencia.
- P1-H (Claude/Usuario): validación manual headed.
- P1-I (Codex): commit + push + PR.
- P1-J (Claude/Usuario): veredicto final de merge.

---

## Criterios de aceptación global

1. Playwright instalado/configurado en `frontend/`.
2. `app-loads.spec.ts` y `upload-smoke.spec.ts` pasan de forma estable.
3. Job `CI / e2e` funcional y con artifacts en fallo.
4. `npx tsc --noEmit` limpio.
5. `npx eslint .` limpio.
6. PR abierta a `main` con sección `How to test`.

---

## How to test (cuando se ejecute implementación)

```bash
# 1) Levantar stack en puerto 80 para frontend
$env:FRONTEND_PORT='80'; docker compose up -d --build --wait

# 2) Ejecutar E2E
cd frontend
npm run test:e2e

# 3) Ejecutar checks
npx tsc --noEmit
npx eslint .
```

Resultado esperado:
- Todos los tests E2E pasan.
- TypeScript y ESLint sin errores.

---

## Notas de gobierno documental
- Este plan se rige por las políticas de handoff iterativo del plan maestro.
- Cualquier cambio operativo adicional debe registrarse aquí antes de ejecución.

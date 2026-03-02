# Plan: Reprocess Toolbar Spacing Alignment

> **Operational rules:** See [execution-rules.md](../../03-ops/execution-rules.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Rama:** `docs/plan-execution-rules-prep`
**PR:** _Por crear_
**Prerequisito:** Ninguno.

## Context

En la vista de reprocesado/extraído del panel PDF, la barra de herramientas y su bloque superior se perciben demasiado cerca del borde superior. El objetivo es alinear el ritmo vertical con el Design System usando tokens existentes (sin hardcodes) y sin cambiar lógica funcional.

## Scope Boundary (strict)

- **In scope:** layout/spacing vertical del panel de tabs del visor (`Documento`, `Texto extraído`, `Técnico/Reprocesar`) en frontend.
- **In scope:** consistencia con tokens de spacing del Design System (objetivo: 16px).
- **Out of scope:** lógica de extracción/reprocesado, API backend, nuevos componentes, cambios de diseño no solicitados.
- **Out of scope:** cambios en color, tipografía o comportamiento funcional.

---

## Estado de ejecución — update on completion of each step

**Leyenda:**
- 🔄 **auto-chain** — Codex ejecuta; usuario revisa después.
- 🚧 **hard-gate** — Claude; requiere validación/decisión del usuario.

### Phase 0 — Plan readiness (execution-rules)

- [ ] R0-A 🚧 — Validar alcance final del ajuste (tabs incluidos + objetivo p-4 = 16px) y aprobar inicio de implementación (Claude)

### Phase 1 — Implementation

- [ ] R1-A 🔄 — Harmonize top spacing en los contenedores de tabs del panel para mantener `p-4` consistente y tokenizado (Codex)
- [ ] R1-B 🔄 — Ejecutar validaciones frontend para el cambio (`lint`, `check:design-system`, `test`) y corregir regresiones del área tocada (Codex)
- [ ] R1-C 🚧 — Validación visual del usuario en UI (estado con/sin texto extraído) (Claude)

### Closure

- [ ] R2-A 🚧 — Aprobación final de merge readiness para este ajuste de layout (Claude)

---

## Cola de prompts

### R1-A — Implement spacing harmonization (ready)

```
1. Localiza el panel del visor PDF y los contenedores de tabs (`Documento`, `Texto extraído`, `Técnico/Reprocesar`).
2. Ajusta únicamente spacing vertical superior para que el ritmo sea consistente con token de 16px (`p-4`), sin introducir valores hardcoded.
3. No cambies lógica de extracción/reprocesado ni estructura funcional del flujo.
4. Mantén cambios mínimos en archivos frontend estrictamente necesarios.
5. Reporta archivos modificados y rationale de DS (token-first).
```
⚠️ AUTO-CHAIN → R1-B

### R1-B — Validate frontend checks (ready)

```
1. Ejecuta `npm --prefix frontend run lint`.
2. Ejecuta `npm --prefix frontend run check:design-system`.
3. Ejecuta `npm --prefix frontend run test`.
4. Si falla algo relacionado al cambio, corrige y re-ejecuta; no abordar fallos no relacionados.
5. Reporta resultado por comando.
```
⚠️ AUTO-CHAIN → R1-C

---

## Prompt activo

### Paso objetivo: R0-A — Validar alcance final del ajuste

### Prompt

```
Valida este alcance antes de implementar:
- Vista objetivo: panel PDF en tabs `Documento`, `Texto extraído`, `Técnico/Reprocesar`.
- Ajuste: armonizar spacing top a token de 16px (`p-4`) para mejorar breathing de toolbar/bloques superiores.
- Restricción: no tocar lógica funcional ni introducir hardcodes de diseño.
Si apruebas, responde: "Continúa" para ejecutar R1-A.
```

---

## Risks

| Risk | Mitigation |
|---|---|
| Diferencia visual entre tabs por wrappers distintos | Ajuste mínimo y homogéneo en contenedores de cada tab |
| Cambios de altura/scroll en panel | Validar estado con y sin texto extraído |
| Falsos positivos en checks DS | Mantener tokens existentes y evitar inline styles |

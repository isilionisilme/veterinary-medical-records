# Plan de ejecución AI (handoff entre chats)

## Objetivo
Mejorar el proyecto para obtener la mejor evaluación posible en la prueba técnica. Focos:
- Arquitectura y diseño
- Mantenibilidad y calidad de código
- Calidad de tests
- Prácticas de desarrollo
- Documentación de entrega
- Entrega incre S. mental con evidencia verificable

---

## Estado de ejecución — actualizar al completar cada paso

> **Protocolo "Continúa":** abre un chat nuevo, selecciona el agente correcto, adjunta este archivo y escribe `Continúa`. El agente leerá el estado, ejecutará el siguiente paso sin completar y se detendrá al terminar.

**Leyenda de automatización:**
- 🔄 **auto-chain** — Codex ejecuta solo; tú revisas el resultado *después*.
- 🚧 **hard-gate** — Requiere tu decisión antes de continuar. No saltar.

### Fase 1 — Auditoría de arquitectura
- [x] F1-A 🔄 — Auditoría 12-Factor → backlog (Codex)
- [x] F1-B 🚧 — Validación de backlog — **TÚ decides qué items se implementan** (Claude)
- [x] F1-C 🔄 — Implementación de items del backlog (Codex, una iteración por item)

### Fase 2 — Mantenibilidad y refactor estructural
- [x] F2-A 🔄 — Auditoría ln-620 + codebase_audit.md (Codex)
- [x] F2-B 🚧 — Validación de backlog — **TÚ decides estrategia de descomposición** (Claude)
- [x] F2-C 🔄 — Refactor App.tsx (Codex)
- [x] F2-D 🔄 — Refactor processing_runner.py (Codex)
- [x] F2-E 🔄 — Refactor document_service.py (Codex)
- [x] F2-F 🔄 — Redistribución App.test.tsx (Codex)
- [x] F2-G 🚧 — **TÚ pruebas la app post-refactor** (~10 min: docker compose up, subir PDF, editar, confirmar)

### Fase 3 — Quick wins de tooling
- [x] F3-A 🔄 — Definir config ESLint + Prettier + pre-commit (Claude)
- [x] F3-B 🔄 — Implementar tooling + coverage (Codex)

### Fase 4 — Calidad de tests
- [x] F4-A 🔄 — Auditoría frontend-testing (Codex)
- [x] F4-B 🔄 — Auditoría python-testing-patterns (Codex)
- [x] F4-C 🔄 — Implementar mejoras de tests (Codex)

### Fase 5 — Documentación
- [x] F5-A 🔄 — Revisión docs con project-guidelines-example (Codex)
- [x] F5-B 🚧 — ADRs de arquitectura: **TÚ defines los argumentos** (Claude)
- [x] F5-C 🔄 — ADRs de arquitectura: crear ficheros (Codex)
- [x] F5-D 🔄 — FUTURE_IMPROVEMENTS.md (Codex)

### Fase 6 — Smoke test del evaluador
- [x] F6-A 🚧 — **TÚ pruebas el flujo end-to-end como evaluador** (Claude + Codex)

### Fase 7 — Cierre global
- [x] F7-A 🚧 — Veredicto final + PR a main (Claude/Codex)

### Fase 8 — Iteración 2 (CTO verdict)
- [x] F8-A 🚧 — Setup branch + guardrails + prompt activo (Codex)
- [x] F8-B 🔄 — SQLite WAL + busy_timeout + test de concurrencia (Codex)
- [x] F8-C 🔄 — Subir cobertura de `frontend/src/lib/utils.ts` (Codex)
- [x] F8-D 🚧 — Security boundary docs + nota AppWorkspace + roadmap update (Claude)
- [x] F8-E 🚧 — Validación final + PR nueva + cierre iteración (Claude)

### Fase 9 — Iteración 3 (Hardening & Maintainability)
- [x] F9-A 🚧 — Definir backlog ejecutable de Iteración 3 + prompt activo (Claude)
- [x] F9-B 🔄 — Upload streaming guard + límite temprano + tests (Codex)
- [x] F9-C 🔄 — Auth boundary mínima opcional por configuración + tests/docs (Codex)
- [x] F9-D 🔄 — Decomposición inicial de `AppWorkspace.tsx` + tests de regresión (Codex)
- [x] F9-E 🚧 — Validación final Iteración 3 + PR + cierre (Claude)

### Fase 10 — Iteración 4 (Polish de calidad: docs + lint)
- [x] F10-A 🔄 — Corregir Known Limitations desactualizadas en TECHNICAL_DESIGN.md §14 (Claude)
- [x] F10-B 🔄 — Eliminar ESLint warnings → 0 problemas en lint (Claude)
- [x] F10-C 🔄 — Alinear naming docs↔código: `infrastructure` → `infra` (Claude)
- [x] F10-D 🔄 — Eliminar warning de chunk vacío en Vite build (Claude)
- [x] F10-E 🔄 — Corregir instrucciones de quality gates en README (Claude)
- [x] F10-F 🚧 — Smoke test final + commit + PR (Claude)

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
1. ✅ **Descomponer `frontend/src/App.tsx` por verticales funcionales**
  - **Problema:** `App.tsx` concentra demasiadas responsabilidades (shell UI, estado, wiring de datos/API, validaciones y diagnósticos), generando acoplamiento y fricción de cambio.
  - **Impacto:** Crítico en mantenibilidad percibida y en primera impresión del evaluador.
  - **Esfuerzo:** L
  - **Riesgo:** Medio
  - **Criterio de aceptación:** El flujo actual se mantiene, pero el archivo se divide en módulos cohesivos por feature (sin archivos nuevos >500 líneas).
  - **Evidencia de validación:** `npm test` verde + smoke manual de navegación/subida/revisión sin regresiones.

2. ✅ **Separar responsabilidades de `backend/app/application/processing_runner.py`**
  - **Problema:** Mezcla orquestación de runs, extracción/parsing y ensamblado de interpretación en un único módulo de alto blast radius.
  - **Impacto:** Alto en calidad de arquitectura y mantenibilidad backend.
  - **Esfuerzo:** L
  - **Riesgo:** Medio-Alto
  - **Criterio de aceptación:** Orquestación, extracción y ensamblado pasan a módulos separados manteniendo contratos públicos actuales.
  - **Evidencia de validación:** `pytest --tb=short -q` en verde + mismas transiciones de run en pruebas existentes.

3. ✅ **Dividir `backend/app/application/document_service.py` por casos de uso**
  - **Problema:** Acumula upload/review/edit/calibración/listado en una sola unidad, dificultando legibilidad y evolución segura.
  - **Impacto:** Alto en evaluación de diseño de capa de aplicación.
  - **Esfuerzo:** L
  - **Riesgo:** Medio
  - **Criterio de aceptación:** Servicios internos separados por caso de uso sin cambiar contratos HTTP ni comportamiento observable.
  - **Evidencia de validación:** `pytest --tb=short -q` en verde + rutas consumiendo interfaces equivalentes.

4. ✅ **Redistribuir `frontend/src/App.test.tsx` alineado al refactor**
  - **Problema:** Suite monolítica y acoplada al archivo gigante, bloqueando refactors seguros.
  - **Impacto:** Medio-Alto en percepción de estrategia de testing.
  - **Esfuerzo:** M
  - **Riesgo:** Medio
  - **Criterio de aceptación:** Tests por componente/feature con cobertura equivalente o superior y menor acoplamiento estructural.
  - **Evidencia de validación:** `npm test` estable + cobertura mantenida o mejorada en áreas críticas.

5. ✅ **Completar guardas de calidad frontend (lint/formato/coverage) y limpiar duplicidades de tests**
  - **Problema:** Faltan gates frontend consistentes y hay duplicación puntual en pruebas, reduciendo señal de disciplina de ingeniería.
  - **Impacto:** Medio en madurez de prácticas durante refactor incremental.
  - **Esfuerzo:** S-M
  - **Riesgo:** Bajo
  - **Criterio de aceptación:** CI con lint frontend real + coverage gate definido + tests duplicados consolidados.
  - **Evidencia de validación:** Pipeline falla ante violaciones y pasa en rama limpia, sin suites redundantes en los módulos afectados.

### F2-B — Decisiones de validación y estrategia de descomposición

**Decisión del usuario:** Items 1-4 aprobados. Item 5 (quality guards) absorbido en F3.

#### App.tsx (5,998 → ~8 módulos, shell ≤400 LOC)
| Módulo destino | Responsabilidad |
|---|---|
| `src/types/` | Types e interfaces (~25 tipos locales) |
| `src/lib/api.ts` | API client, queries, mutations (useQuery/useMutation wrappers) |
| `src/lib/utils.ts` | Funciones utilitarias (formatters, validators, label resolvers) |
| `src/components/UploadPanel.tsx` | Upload, drag-and-drop, toast management |
| `src/components/DocumentSidebar.tsx` | Lista de documentos, búsqueda, selección |
| `src/components/ReviewWorkspace.tsx` | Interpretación, edición, field selection, confidence |
| `src/components/StructuredDataView.tsx` | Canonical sections, visit grouping, field rows, long-text |
| `src/App.tsx` (shell) | Layout, split-panel, sidebar state, wiring de componentes |

#### processing_runner.py (2,901 → ~5 módulos)
| Módulo destino | Responsabilidad |
|---|---|
| `application/processing/scheduler.py` | Queue, tick loop, dequeue |
| `application/processing/orchestrator.py` | `_execute_run`, `_process_document`, step tracking |
| `application/processing/interpretation.py` | Build artifact, candidate mining, schema mapping, field assembly |
| `application/processing/pdf_extraction.py` | 3 estrategias PDF (fitz, extractor, no-deps fallback) |
| `application/processing/__init__.py` | Re-exports públicos: `enqueue_processing_run`, `processing_scheduler` |

#### document_service.py (1,874 → ~5 módulos)
| Módulo destino | Responsabilidad |
|---|---|
| `application/documents/upload_service.py` | `register_document_upload` |
| `application/documents/query_service.py` | `get_document`, `list_documents`, `get_processing_history`, DTOs |
| `application/documents/review_service.py` | `get_document_review`, projection, normalization, toggle |
| `application/documents/edit_service.py` | `apply_interpretation_edits`, helpers, confidence, audit |
| `application/documents/calibration.py` | Build/apply/revert calibration deltas |

#### App.test.tsx (3,693 → redistribución por componente)
- Tests de upload → `UploadPanel.test.tsx`
- Tests de sidebar → `DocumentSidebar.test.tsx`
- Tests de review/edit → `ReviewWorkspace.test.tsx`
- Tests de structured data → `StructuredDataView.test.tsx`
- Tests de layout/shell → `App.test.tsx` (reducido)

**Regla global:** ningún archivo nuevo > 500 LOC.

### F3-A — Configuración de tooling definida por Claude

#### 1. ESLint (`frontend/eslint.config.mjs`) — flat config ESLint 9

Dependencias nuevas (devDependencies):
```
eslint@^9
@eslint/js@^9
typescript-eslint@^8
eslint-plugin-react-hooks@^5
eslint-plugin-react-refresh@^0.4
eslint-config-prettier@^10
```

Contenido:
```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  prettierConfig,
);
```

#### 2. Prettier (`frontend/.prettierrc`)

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```
Coherente con `line-length = 100` de ruff en backend.

Dependencias nuevas:
```
prettier@^3
```

#### 3. Scripts de package.json

Actualizar/añadir:
```json
"lint": "eslint src/ && tsc --noEmit",
"lint:fix": "eslint src/ --fix",
"format": "prettier --write 'src/**/*.{ts,tsx,css}'",
"format:check": "prettier --check 'src/**/*.{ts,tsx,css}'",
"test:coverage": "vitest run --coverage"
```

#### 4. Coverage frontend (`@vitest/coverage-v8`)

Dependencia nueva:
```
@vitest/coverage-v8@^4
```

Añadir a `vite.config.ts` dentro de `test`:
```ts
coverage: {
  provider: "v8",
  reporter: ["text", "lcov"],
  reportsDirectory: "./coverage",
},
```

Añadir `frontend/coverage/` a `.gitignore` (raíz).

#### 5. Coverage backend (`pytest-cov`)

Añadir a `requirements-dev.txt`:
```
pytest-cov==6.1.1
```

Añadir a `pytest.ini`:
```ini
addopts = --cov=backend/app --cov-report=term-missing
```

Añadir `htmlcov/` a `.gitignore` (raíz).

#### 6. Pre-commit (`.pre-commit-config.yaml`)

Actualizar ruff a repo actual + añadir hooks frontend:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.9.9
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: local
    hooks:
      - id: frontend-lint
        name: frontend lint (eslint + tsc)
        entry: bash -c 'cd frontend && npx eslint src/ && npx tsc --noEmit'
        language: system
        pass_filenames: false
        files: ^frontend/src/.*\.(ts|tsx)$
      - id: frontend-format
        name: frontend format check (prettier)
        entry: bash -c 'cd frontend && npx prettier --check "src/**/*.{ts,tsx,css}"'
        language: system
        pass_filenames: false
        files: ^frontend/src/.*\.(ts|tsx|css)$
```

Actualizar ruff en `requirements-dev.txt`:
```
ruff==0.9.9
```

Actualizar `pyproject.toml` al formato ruff moderno:
```toml
[tool.ruff]
line-length = 100
target-version = "py311"
exclude = ["**/__pycache__", ".git", ".venv"]

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP"]
extend-ignore = ["B008"]
```

#### 7. CI (`.github/workflows/ci.yml`)

Añadir al job `frontend_test_build` (después de "Install frontend dependencies"):
```yaml
      - name: Run ESLint
        run: npm --prefix frontend run lint
      - name: Check Prettier formatting
        run: npm --prefix frontend run format:check
```
Y cambiar "Run frontend tests" para incluir coverage:
```yaml
      - name: Run frontend tests with coverage
        run: npm --prefix frontend run test:coverage
```

Añadir al job `quality` (después de "Run Ruff"):
```yaml
      - name: Check Ruff formatting
        run: ruff format --check .
      - name: Run Pytest with coverage
        run: pytest --cov=backend/app --cov-report=term-missing
```

#### 8. Autofix inicial

Después de instalar todo, ejecutar:
```bash
cd frontend && npx eslint src/ --fix && npx prettier --write 'src/**/*.{ts,tsx,css}'
cd .. && ruff check --fix . && ruff format .
```
Commitear autofix como commit separado antes del commit de plan.

### F4-A — Frontend testing audit

**Coverage summary:**

```text
% Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   77.67 |    68.66 |   84.59 |   77.74 |
 src               |   78.37 |    68.45 |   85.23 |   78.33 |
  App.tsx          |     100 |      100 |     100 |     100 |
  AppWorkspace.tsx |   78.36 |    68.45 |    85.2 |   78.32 | ...6108,6111-6113
 src/components    |   66.58 |    58.88 |   80.55 |      67 |
  ...tsSidebar.tsx |     100 |     94.5 |     100 |     100 | 253,283,299,303
  PdfViewer.tsx    |   64.82 |    46.06 |      80 |    65.4 | ...68,677,737,740
  ...Workspace.tsx |     100 |      100 |     100 |     100 |
  SourcePanel.tsx  |       0 |        0 |       0 |       0 | 27
  ...dDropzone.tsx |      50 |    82.14 |      50 |      50 | 51-53
 ...components/app |      95 |    89.74 |   91.66 |      95 |
  ...icalBadge.tsx |     100 |      100 |     100 |     100 |
  ...usCluster.tsx |     100 |    94.11 |     100 |     100 | 50
  Field.tsx        |     100 |       80 |     100 |     100 | 61-74
  IconButton.tsx   |     100 |      100 |     100 |     100 |
  Section.tsx      |   66.66 |       50 |   66.66 |   66.66 | 22
 ...nts/structured |   64.06 |    66.86 |   62.85 |      64 |
  ...eldDialog.tsx |   28.57 |       10 |   22.22 |      30 | 42-46,50-53,60-92
  ...ditDialog.tsx |   71.02 |    70.51 |   76.92 |   70.47 | ...93,213-236,282
 ...mponents/toast |     100 |    97.77 |     100 |     100 |
  ToastHost.tsx    |     100 |    97.77 |     100 |     100 | 111
 src/components/ui |   97.36 |    80.64 |   95.83 |   97.36 |
  badge.tsx        |     100 |      100 |     100 |     100 |
  button.tsx       |     100 |    66.66 |     100 |     100 | 38
  card.tsx         |     100 |      100 |     100 |     100 |
  dialog.tsx       |     100 |      100 |     100 |     100 |
  input.tsx        |     100 |      100 |     100 |     100 |
  scroll-area.tsx  |     100 |       80 |     100 |     100 | 34
  separator.tsx    |     100 |       75 |     100 |     100 | 16
  toggle-group.tsx |     100 |      100 |     100 |     100 |
  tooltip.tsx      |   91.66 |    84.21 |   85.71 |   91.66 | 26,107
 src/extraction    |   81.41 |    69.76 |   97.14 |   81.13 |
  ...uggestions.ts |    80.9 |       67 |   94.44 |   80.55 | ...86,300-306,322
  ...ctionDebug.ts |   72.72 |     37.5 |     100 |   72.72 | 19,31-32
  ...Validators.ts |   82.43 |    74.76 |     100 |   82.19 | ...01,215,229,239
 src/hooks         |   43.13 |    22.72 |   33.33 |   45.83 |
  ...PanelState.ts |   43.13 |    22.72 |   33.33 |   45.83 | ...51-54,69,78-85
 src/lib           |   86.93 |    74.82 |   89.18 |   86.54 |
  ...mentStatus.ts |     100 |      100 |     100 |     100 |
  globalSchema.ts  |     100 |      100 |     100 |     100 |
  ...ingHistory.ts |      96 |    68.08 |     100 |   95.83 | 33,117
  ...istoryView.ts |     100 |      100 |     100 |     100 |
  ...ataFilters.ts |   94.44 |    91.17 |     100 |   94.11 | 68,84
  utils.ts         |      24 |        0 |      20 |      24 | ...41,49-53,60-64
  ...ervability.ts |     100 |    83.33 |     100 |     100 | 19,37
 src/test          |    93.8 |    85.08 |     100 |   93.63 |
  helpers.tsx      |    93.8 |    85.08 |     100 |   93.63 | ...03,566,827-834
-------------------|---------|----------|---------|---------|-------------------
```

**Critical gaps (files <60% coverage):**
| File | Coverage % | What's missing |
|---|---|---|
| `src/components/SourcePanel.tsx` | 0% lines | No direct tests for source drawer behavior (pin toggle, close behavior, evidence fallback rendering). |
| `src/components/UploadDropzone.tsx` | 50% lines | Keyboard activation and overlay branches are only indirectly exercised; several drag state branches remain unverified. |
| `src/components/structured/AddFieldDialog.tsx` | 30% lines | Missing coverage for save-lock behavior (escape/outside click blocked), open/close transitions, and input focus timing. |
| `src/hooks/useSourcePanelState.ts` | 45.83% lines | Hook transitions are not unit-tested (non-desktop pin fallback, Escape listener lifecycle, reset semantics). |
| `src/lib/utils.ts` | 24% lines | Error parsing paths in `apiFetchJson`/`apiFetchBlob` are mostly untested (non-JSON errors, malformed JSON, default fallback). |

**Fragile/anti-pattern tests:**
| File | Line(s) | Issue | Suggested fix |
|---|---|---|---|
| `src/App.test.tsx` | 146-183 | Asserts many Tailwind/token classes (`toHaveClass`) and layout internals, which makes tests brittle to harmless UI refactors. | Prefer user-visible assertions (roles/text/ARIA semantics) and keep only 1-2 structural assertions for contract-critical layout. |
| `src/components/StructuredDataView.test.tsx` | 116-132 | Heavy style-class assertions on row/value rendering increase maintenance cost and couple tests to CSS utility choices. | Assert semantic behavior (labels, grouped values, fallback text) and reserve visual token checks for a focused styling smoke test. |
| `src/components/UploadPanel.test.tsx` | 144-177 | Uses real-time `setTimeout` waits (3.6s/5.2s) with long test-level timeouts, causing slower and potentially flaky runs. | Use fake timers (`vi.useFakeTimers`) and advance time deterministically. |
| `src/lib/processingHistory.test.ts` + `src/lib/__tests__/processingHistory.test.ts` | 1-120 | Duplicated coverage of `groupProcessingSteps` logic across two files creates maintenance drift risk. | Consolidate into one canonical suite and keep complementary cases only. |
| 8 test files mocking `PdfViewer` | see `vi.mock` at line 11-23 in each file | Repeated mock implementation copy/paste increases drift risk and obscures intent. | Centralize in a shared factory/helper (or `setupTests`) to keep one stub definition. |

**Missing test scenarios:**
| Component/Flow | What should be tested | Priority (P1/P2/P3) |
|---|---|---|
| `SourcePanel` | Pin/unpin button disabled behavior on non-desktop, close action callback, evidence fallback text when snippet is null. | P1 |
| `UploadDropzone` | Keyboard activation (`Enter`/`Space`), drag overlay visibility toggling, compact vs non-compact aria-label behavior. | P1 |
| `AddFieldDialog` | Prevent close while `isSaving=true` (Escape/outside click), focus-on-open timing, cancel/save disabled semantics. | P1 |
| `useSourcePanelState` | `openFromEvidence` notice behavior without page, Escape key close lifecycle, reset and pin rules by viewport. | P1 |
| API helpers (`lib/utils.ts`) | `parseError` fallback on invalid JSON/content-type mismatch and thrown API errors from `apiFetchJson`/`apiFetchBlob`. | P1 |
| `PdfViewer` failure/edge states | Missing source/highlight edge behavior and low-branch paths currently near threshold. | P2 |

**Cleanup candidates:**
- No `.bak` test file found in `frontend/src` (candidate mentioned in prompt appears already cleaned).
- Consolidate duplicated processing history suites (`src/lib/processingHistory.test.ts` vs `src/lib/__tests__/processingHistory.test.ts`).
- Extract a shared `PdfViewer` mock to avoid 8 copy/pasted `vi.mock` blocks.
- Reduce noisy diagnostic stdout assertions side effects in StructuredData tests when not under explicit observability checks.

**Top 5 actionable improvements (prioritized):**
1. Add focused tests for `SourcePanel`, `UploadDropzone`, and `AddFieldDialog` to eliminate all P1 coverage holes below 60%.
2. Add unit tests for `useSourcePanelState` and `lib/utils.ts` to harden core interaction/error-path logic.
3. Replace real-time waits in `UploadPanel.test.tsx` with fake timers to cut flakiness and runtime cost.
4. Collapse duplicated `processingHistory` suites into one source of truth and keep non-overlapping cases only.
5. Refactor style-coupled assertions (especially in `App.test.tsx` and `StructuredDataView.test.tsx`) toward behavior-first checks.

### F4-B — Python testing patterns audit

**Execution evidence:**

```text
pytest --cov=backend/app --cov-report=term-missing
246 passed in 11.72s
TOTAL coverage: 86% (4530 statements, 653 misses)
```

**Coverage summary (backend):**

| Area | Coverage % | Notes |
|---|---|---|
| `backend/app/application/*` | Mostly 82-100% | Strong service-level coverage in document flows and interpretation logic. |
| `backend/app/api/routes.py` | 92% | HTTP contracts largely protected with integration tests. |
| `backend/app/application/processing/orchestrator.py` | 76% | Failure/timeout and branchy orchestration paths still under-tested. |
| `backend/app/application/processing/pdf_extraction.py` | 78% | Multiple extractor fallbacks/edge branches remain uncovered. |
| `backend/app/infra/database.py` | 73% | DB initialization/retry/error branches have meaningful gaps. |
| `backend/app/application/documents/_edit_helpers.py` | 60% | Edit-helper edge paths and guard clauses insufficiently tested. |
| `backend/app/cli.py` | 0% | No direct tests for admin one-off commands. |

**Critical gaps (files ≤76% coverage):**
| File | Coverage % | What's missing |
|---|---|---|
| `backend/app/cli.py` | 0% | No tests for parser routing (`db-schema`, `db-check`, `config-check`) and exit-code contracts. |
| `backend/app/application/documents/_edit_helpers.py` | 60% | Sparse assertions on normalization/merge edge-cases and defensive branches. |
| `backend/app/infra/database.py` | 73% | Limited coverage for failure/retry paths and sqlite operational edge handling. |
| `backend/app/application/processing/orchestrator.py` | 76% | Missing branch tests for run-state transitions on partial failures and exception paths. |

**Fragile/anti-pattern tests:**
| File | Line(s) | Issue | Suggested fix |
|---|---|---|---|
| `backend/tests/integration/test_extraction_observability_api.py` | 396-399 | Polling with `time.sleep(0.05)` introduces timing flakiness and slows suite under load. | Replace with deterministic synchronization hook (event/callback or bounded helper with mocked scheduler tick). |
| `backend/tests/unit/test_doc_router_parity_contract.py` | 61-69 | Cleanup loop uses repeated `time.sleep(0.2)` retries on Windows lock; non-deterministic and slow. | Use `tmp_path` fixture ownership and deterministic cleanup strategy; isolate fs writes in temp dir fixture. |
| `backend/tests/integration/*` (`test_upload.py`, `test_document_list.py`, `test_document_download.py`, `test_processing_history.py`, `test_raw_text_artifact.py`, `test_document_review.py`) | fixture blocks | Repeated `test_db` env/bootstrap fixture logic across files increases drift risk. | Extract shared fixture in `backend/tests/conftest.py` (`db_path`, `storage_path`, `test_client_factory`). |

**Missing test scenarios (python-testing-patterns):**
| Component/Flow | What should be tested | Priority |
|---|---|---|
| CLI admin commands | Parser dispatch + stdout contract + non-happy command handling for `db-schema`, `db-check`, `config-check`. | P1 |
| DB resilience (`infra/database.py`) | Simulated sqlite lock / connection errors and retry/exception policy expectations. | P1 |
| Processing orchestrator | Run transitions when extraction fails mid-run, step artifact persistence in failure branches, idempotent reruns. | P1 |
| Edit helpers | Edge-cases for field merge/normalization and invalid user edit payloads. | P1 |
| PDF extraction strategies | Branches for forced extractor modes and malformed PDF content in no-deps fallback. | P2 |

**Top 5 actionable improvements (prioritized):**
1. Add a dedicated `test_cli.py` suite validating command routing, output contracts, and return codes for all admin one-off commands.
2. Introduce shared backend fixtures in `backend/tests/conftest.py` to remove repeated env/db/bootstrap setup from integration files.
3. Replace sleep-based polling in tests with deterministic synchronization helpers to reduce flakiness and runtime variance.
4. Expand branch-focused tests for `processing/orchestrator.py` and `infra/database.py` covering failure/retry/state-transition scenarios.
5. Add targeted edge-case tests for `documents/_edit_helpers.py` to protect normalization/merge behavior during review edits.

### F5-A — Documentation audit

**README.md (root) assessment:**
- **Fortalezas:** quickstart Docker-first claro, smoke manual útil, enlaces sólidos a documentación central.
- **Gap detectado:** faltaba un bloque explícito de arquitectura de alto nivel para evaluadores que no abren primero `TECHNICAL_DESIGN.md`.
- **Gap detectado:** faltaba una sección explícita de contribución/checklist de calidad para reforzar prácticas de entrega.
- **Mejora aplicada:** se añadió `Architecture at a glance`, `Delivery evidence and audit trail`, `Local quality gates`, y `How to contribute`.

**docs/README.md assessment:**
- **Fortalezas:** define gobernanza documental y precedencia de autoridad con claridad.
- **Gap detectado:** no priorizaba un recorrido evaluador-first (primeros 10-15 minutos).
- **Gap detectado:** faltaban referencias explícitas a artefactos de auditoría y evidencia incremental.
- **Mejora aplicada:** se añadió sección de lectura rápida para evaluador y sección de `Audit trail and incremental evidence`.

**Documentation structure assessment:**
- **Lo que está bien:** separación `docs/shared` vs `docs/project` y carpeta de `extraction-tracking` como evidencia incremental verificable.
- **Lo que faltaba:** puentes de navegación entre overview (README raíz) y evidencia de auditorías técnicas (`12_FACTOR_AUDIT`, `codebase_audit`).
- **Redundancia potencial (no aplicada):** hay solapamiento parcial entre narrativa de arquitectura en README y `TECHNICAL_DESIGN`; mantenerlo como resumen + deep dive evita ambigüedad.
- **Cambio no controversial aplicado:** solo mejoras de navegación/cross-reference, sin renombrar ni consolidar archivos.

**Top 5 actionable improvements (prioritized):**
1. Publicar ADRs de arquitectura general (modular monolith, SQLite, no ORM, async in-process) y enlazarlos desde `docs/README.md` y README raíz.
2. Añadir una tabla breve de "Key technical decisions" en README raíz con decisión, trade-off principal y enlace al documento fuente.
3. Incluir una mini "Evaluator checklist" de 5 pasos en README raíz (run, smoke, tests, arquitectura, decisiones).
4. Mantener una sección "Current known limitations" en `docs/project/TECHNICAL_DESIGN.md` para transparencia evaluable.
5. Añadir sección "How to review this PR/storyline" en docs para navegar evidencia incremental más rápido.

### F5-B — ADR arguments (defined by Claude)

Below are the 4 architecture ADRs with full arguments, trade-offs, and code evidence. Codex will create the files in F5-C.

#### ADR-ARCH-0001: Modular Monolith over Microservices

- **Status:** Accepted
- **Date:** 2026-02-24
- **Context:** The system processes veterinary medical records for a single clinic — upload PDFs, extract structured data, allow manual review. The team is small (1–2 developers). The evaluator will assess whether the architecture is appropriate to the problem scale and whether it can evolve.
- **Decision Drivers:**
  - Must be deployable with `docker compose up` in ≤5 minutes.
  - Must maintain clear logical boundaries for future decomposition.
  - Must minimize operational complexity (no service mesh, no API gateways, no distributed tracing).
  - Team size is 1–2 — cognitive overhead of microservices is unjustified.
- **Considered Options:**
  - **Option A: Modular monolith with hexagonal architecture** — Single deployable, Protocol-based ports (`DocumentRepository`, `FileStorage`), frozen domain models immune to infra, composition root in `main.py`.
  - **Option B: Microservices** — Separate services for upload, extraction, review. Requires inter-service communication (HTTP/gRPC/events), service discovery, distributed data consistency, and separate deployment pipelines.
  - **Option C: Traditional monolith (no boundaries)** — Simplest but makes future decomposition expensive; hard to test in isolation.
- **Decision:** Option A — Modular monolith with hexagonal architecture.
- **Rationale:**
  1. Protocol-based ports (`backend/app/ports/`) enforce boundaries at compile-check level without deployment overhead.
  2. Frozen dataclasses in `domain/` prevent accidental coupling to infra.
  3. Composition root in `main.py` (lines 86–155) is the only file that knows about concrete implementations — swapping `SqliteDocumentRepository` for a gRPC client requires zero changes to `application/` or `domain/`.
  4. `docker-compose.yml` runs exactly 2 services (backend + frontend) — evaluators can reproduce the entire system instantly.
  5. Microservices would add ≥4 containers, an event broker, and retry/saga logic for a system that processes PDFs sequentially.
- **Consequences:**
  - **Positive:** Sub-minute startup, trivial debugging (single process), Protocol ports ready for future extraction if needed.
  - **Negative:** All processing shares one event loop — a CPU-intensive extraction could impact API latency (mitigated by `asyncio.to_thread`).
  - **Risk:** If the system grows to multi-clinic with horizontal scaling needs, the monolith would require refactoring toward service extraction — but the Protocol boundaries make this a controlled migration, not a rewrite.
- **Code evidence:** `backend/app/ports/document_repository.py` (Protocol with 16+ methods), `backend/app/domain/models.py` (7 frozen dataclasses), `backend/app/main.py` (composition root), `docker-compose.yml` (2 runtime services).

#### ADR-ARCH-0002: SQLite as Primary Database

- **Status:** Accepted
- **Date:** 2026-02-24
- **Context:** The system stores veterinary documents, processing run metadata, and calibration aggregates. Expected volume: tens to hundreds of documents per clinic. The evaluator assesses whether infrastructure choices match the problem scale and whether the path to production alternatives is clear.
- **Decision Drivers:**
  - Must require zero additional containers (Docker-first simplicity).
  - Must support `docker compose up` with no database provisioning step.
  - Must handle concurrent read/write from a single backend process.
  - Should make the upgrade path to PostgreSQL visible.
- **Considered Options:**
  - **Option A: SQLite** — File-based, zero-config, zero-dependency (Python stdlib), volume-mountable.
  - **Option B: PostgreSQL** — Full RDBMS with connection pooling, concurrent writes, row-level locking. Requires container + driver + migration tool.
  - **Option C: MongoDB** — Flexible schema, native JSON. Requires container + driver + schema discipline.
- **Decision:** Option A — SQLite via Python's built-in `sqlite3` module.
- **Rationale:**
  1. The system is single-process, single-clinic — SQLite's write serialization is not a bottleneck.
  2. Zero dependencies: `requirements.txt` has 6 packages, none database-related.
  3. Data lives in `backend/data/documents.db` — a single file, trivially backed up or restored.
  4. Docker volume mount (`${BACKEND_DATA_DIR:-./backend/data}:/app/backend/data`) persists data without a database container.
  5. Schema is code-driven via `ensure_schema()` on startup — no Alembic, no migration files, no migration state to manage.
  6. 5 tables total — far below the complexity threshold where PostgreSQL's features pay off.
- **Consequences:**
  - **Positive:** `docker compose up` runs the entire stack with no DB provisioning. Dev setup is instant. Backups = file copy.
  - **Negative:** No connection pooling (new `sqlite3.connect()` per operation). `WAL` mode needed for concurrent reads during writes. No `LISTEN/NOTIFY` for push-based changes.
  - **Risk:** Multi-user or multi-process deployment would hit SQLite's write lock. Mitigation: the Protocol boundary (`DocumentRepository`) means swapping `SqliteDocumentRepository` for `PostgresDocumentRepository` changes exactly one file + one line in `main.py`.
- **Path to PostgreSQL:** Replace `backend/app/infra/sqlite_document_repository.py` with a `PostgresDocumentRepository` implementing the same `DocumentRepository` Protocol. Update composition root. No application or domain code changes.
- **Code evidence:** `backend/app/infra/database.py` (stdlib `sqlite3`, `ensure_schema()`), `backend/app/settings.py` (`DEFAULT_DB_PATH`), `docker-compose.yml` (volume mount, no DB container), `backend/requirements.txt` (0 DB packages).

#### ADR-ARCH-0003: Raw SQL with Repository Pattern (No ORM)

- **Status:** Accepted
- **Date:** 2026-02-24
- **Context:** The system requires SQL queries ranging from simple CRUD to complex atomic guards (`NOT EXISTS` subqueries), `ON CONFLICT` upserts, and correlated subqueries for document listing. The domain model uses frozen dataclasses that are incompatible with ORM session management.
- **Decision Drivers:**
  - Must preserve frozen (`frozen=True, slots=True`) domain models without ORM "managed state".
  - Must enable idiomatic SQL for complex queries (concurrency guards, upserts).
  - Must keep the Protocol boundary clean — application code never sees SQL.
  - Should minimize dependency count.
- **Considered Options:**
  - **Option A: Raw SQL + Repository Pattern** — Hand-written SQL in `SqliteDocumentRepository`, explicit Row→Domain mapping, Protocol interface for application layer.
  - **Option B: SQLAlchemy ORM** — Model classes, session management, migration via Alembic, automatic change tracking.
  - **Option C: SQLAlchemy Core (query builder)** — SQL expression language without ORM model classes. Still adds dependency + abstraction layer.
- **Decision:** Option A — Raw SQL with explicit Repository Pattern.
- **Rationale:**
  1. Frozen dataclasses are immutable value objects — an ORM's change-tracking and identity-map patterns conflict with this design. The ORM would require separate "entity" classes duplicating the domain models.
  2. Complex queries are idiomatic SQL: `try_start_run()` uses `UPDATE … WHERE … AND NOT EXISTS (SELECT 1 FROM processing_runs WHERE status='RUNNING')` — an atomic concurrency guard that ORMs express awkwardly.
  3. `apply_calibration_deltas()` uses `INSERT … ON CONFLICT … DO UPDATE SET accept_count = MAX(0, accept_count + ?)` — upsert with arithmetic that is natural in SQL, verbose in ORM.
  4. The repository (751 lines) is the **only** file that knows about SQL. Every method maps `sqlite3.Row` → frozen domain dataclass explicitly.
  5. Zero dependency added: no SQLAlchemy, no Peewee, no Alembic. `requirements.txt` stays at 6 packages.
- **Consequences:**
  - **Positive:** Full SQL control per query. No N+1 problems. No ORM session leaks. No impedance mismatch with frozen models.
  - **Negative:** 751 lines of hand-written SQL in one file. Schema changes require manual migration logic (`ensure_schema()` table-swap pattern). No automatic migration generation.
  - **Risk:** As the schema grows beyond ~10 tables, the repository file becomes unwieldy. Mitigation: split into per-aggregate repositories, each implementing a focused Protocol.
- **Code evidence:** `backend/app/infra/sqlite_document_repository.py` (751 lines, all queries), `backend/app/ports/document_repository.py` (Protocol), `backend/app/domain/models.py` (frozen dataclasses), `backend/requirements.txt` (no ORM).

#### ADR-ARCH-0004: In-Process Async Processing (No Task Queue)

- **Status:** Accepted
- **Date:** 2026-02-24
- **Context:** PDF processing (text extraction + LLM-based interpretation) is the heaviest workload — up to 120 seconds per document. The system must process documents asynchronously without blocking API responses. The evaluator assesses whether the processing architecture is appropriate to the problem scale.
- **Decision Drivers:**
  - Must not block API requests during PDF processing.
  - Must work within a single Docker service (no additional containers).
  - Must handle graceful shutdown and crash recovery.
  - Should minimize infrastructure complexity.
- **Considered Options:**
  - **Option A: In-process async scheduler** — `asyncio.create_task` in FastAPI lifespan, DB-backed queue (`processing_runs` table), polling loop.
  - **Option B: Celery + Redis/RabbitMQ** — Separate worker process(es), broker container, result backend, Flower for monitoring.
  - **Option C: RQ (Redis Queue)** — Simpler than Celery but still requires Redis container + worker process.
  - **Option D: arq / Dramatiq** — Modern async-native alternatives. Still require broker infrastructure.
- **Decision:** Option A — In-process async scheduler with DB-backed queue.
- **Rationale:**
  1. Zero additional infrastructure: no Redis, no RabbitMQ, no worker process. `docker-compose.yml` stays at 2 services.
  2. The scheduler is an `asyncio.Task` in the FastAPI lifespan — shares the event loop, starts/stops with the app.
  3. DB-backed queue (`processing_runs` table with status `QUEUED→RUNNING→COMPLETED/FAILED`) provides persistence and observability without a broker.
  4. Concurrency guard via SQL: `try_start_run()` atomically prevents parallel runs on the same document using `NOT EXISTS` — no distributed locks needed.
  5. CPU-bound PDF extraction is offloaded via `asyncio.to_thread()` — the event loop stays responsive for API requests.
  6. Configurable throughput: `PROCESSING_TICK_SECONDS=0.5`, `MAX_RUNS_PER_TICK=10`.
  7. Graceful shutdown via `asyncio.Event`: lifespan manager calls `stop()`, scheduler finishes current work and exits cleanly.
- **Consequences:**
  - **Positive:** Zero-ops processing pipeline. Instant startup. Full observability via DB queries. Timeout per-run (120s) via `asyncio.wait_for`.
  - **Negative:** A process crash loses in-flight work. No automatic retry by a broker.
  - **Risk:** Crash recovery is explicit: `recover_orphaned_runs()` on startup marks `RUNNING` rows as `FAILED` with reason `PROCESS_TERMINATED`. This is less robust than Celery's `acks_late` retry — acceptable for a single-clinic system where a re-upload is trivial.
  - **Scaling limit:** Single-process means throughput is bounded by one event loop. For multi-clinic SaaS, extracting the scheduler into a Celery worker behind the same `DocumentRepository` Protocol would be the natural evolution.
- **Code evidence:** `backend/app/infra/scheduler_lifecycle.py` (`asyncio.create_task`), `backend/app/application/processing/scheduler.py` (polling loop), `backend/app/application/processing/orchestrator.py` (`asyncio.wait_for`, `asyncio.to_thread`), `backend/app/main.py` (lifespan wiring, `recover_orphaned_runs`).

### F6-A — Smoke test del evaluador (Claude)

**README quickstart verification:**
- ✅ Prerequisites: Docker Desktop with Compose v2 — 1 line.
- ✅ Command: `docker compose up --build` — 1 command.
- ✅ URLs: `http://localhost:5173` + `http://localhost:8000` — immediately visible.
- ✅ Stop: `docker compose down` — 1 command.
- ✅ Total: **3 commands** (up, browse, down). Well under the ≤5 limit.

**Test suite verification:**
- ✅ Backend: 249 passed in 10.27s (87% coverage).
- ✅ Frontend: 20 files, 162 tests passed in 12.60s.

**Docker Compose setup:**
- ✅ 2 runtime services (backend + frontend), 2 test profiles.
- ✅ Healthchecks on both services with reasonable intervals.
- ✅ Volume mounts for persistence + reset instructions in README.
- ✅ No database container needed (SQLite file-based).

**First-use UX assessment — evaluator journey:**

| Step | Quality | Notes |
|---|---|---|
| Page load | ⚠️ Medium | Blank white page until React hydrates — no CSS spinner in `index.html`. |
| Empty state | ✅ Good | Clear CTA: "Selecciona un documento…" + clickable upload zone. Sidebar shows 4 skeleton cards during load. |
| Upload flow | ✅ Excellent | Drag-and-drop + click. Client validation (PDF only, 20 MB). "Subiendo…" spinner. Success/error toasts. |
| Processing | ✅ Good | Status chip + fast polling (1.5s→5s). Long-processing warning. Failure displayed inline. |
| Review | ✅ Good | Three-column layout (sidebar, PDF, structured data). Resizable split. Confidence dots. |
| Edit | ✅ Good | Field edit dialog with validation (microchip digits, weight range, date, sex/species). |
| Mark reviewed | ✅ Good | Toggle with tooltip, "Marcando…" spinner, reviewed warning banner. |
| Error handling | ✅ Excellent | Connectivity dedup, graceful degradation, technical details expandable. |

**Frictions found (for Codex to fix):**

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | **Missing Spanish accents in ~20+ UI strings** | High | `Aun`→`Aún`, `aqui`→`aquí`, `revision`→`revisión`, `interpretacion`→`interpretación`, `tecnicos`→`técnicos`, `notificacion`→`notificación`, `tamano`→`tamaño`, `extraccion`→`extracción`, `volvera`→`volverá`, `valido`→`válido`, `intentalo`→`inténtalo`, `mas`→`más`, `esta`→`está`. Must also update test assertions. |
| 2 | **No loading indicator in `index.html`** | Medium | Add a CSS-only spinner in `<div id="root">` that disappears when React mounts. |
| 3 | **`lang="en"` + English page title** | Low | Change to `lang="es"`, title `"Registros Veterinarios"`. |---

## Prompt activo (just-in-time) — write-then-execute

> **Uso:** Claude escribe aquí el próximo prompt de Codex ANTES de que el usuario cambie de agente. Así Codex lo lee directamente del archivo adjunto — cero copy-paste, cero error humano.
>
> **Flujo:** Claude escribe → commit + push → usuario abre Codex → adjunta archivo → "Continúa" → Codex lee esta sección → ejecuta → borra el contenido al terminar.

### Paso objetivo
_Completado: F9-D_

### Prompt
_Vacío._

---

## Skills instaladas y uso recomendado

### Arquitectura / calidad
- `12-factor-apps` — Auditoría cloud-native, configuración por entorno, acoplamiento y escalabilidad.
- `ln-620-codebase-auditor` — Auditoría integral con 9 workers especializados (seguridad, build, arquitectura, calidad, dependencias, dead code, observabilidad, concurrencia, lifecycle). Genera `docs/project/refactor/codebase_audit.md`.

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

### Estado de ejecución extendido (pendiente / en progreso / bloqueado / completado)
Para visibilidad y trazabilidad, es **obligatorio** marcar el paso activo con `⏳ EN PROGRESO` **sin cambiar el checkbox base**.

- **Pendiente:** `- [ ] F?-? ...`
- **En progreso:** `- [ ] F?-? ... ⏳ EN PROGRESO (<agente>, <fecha/hora>)`
- **Bloqueado:** `- [ ] F?-? ... 🚫 BLOQUEADO (<motivo corto>)`
- **Completado:** `- [x] F?-? ...`

Reglas obligatorias:
1. No usar `[-]`, `[~]`, `[...]` ni variantes: solo `[ ]` o `[x]`.
2. Antes de ejecutar un paso `[ ]`, el agente debe marcarlo como `⏳ EN PROGRESO (<agente>, <fecha/hora>)`.
3. `EN PROGRESO` y `BLOQUEADO` son etiquetas de texto al final de la línea, no estados de checkbox.
4. Al completar un paso, eliminar cualquier etiqueta (`EN PROGRESO`/`BLOQUEADO`) y marcar `[x]`.
5. Para `BLOQUEADO`, incluir motivo breve y acción siguiente si aplica.

### Regla de identidad por agente activo (hard rule — se aplica antes que cualquier otra)
**Si el usuario escribe `Continúa`:**
1. Lee el Estado de ejecución y encuentra el primer `[ ]` (incluye líneas con etiquetas `⏳ EN PROGRESO` o `🚫 BLOQUEADO`).
2. Identifica el agente asignado a ese paso (🔄 Codex o 🚧 Claude).
3. Si el paso corresponde al **agente activo de este chat**: procede normalmente.
4. Si el paso corresponde al **otro agente**:
  - **STOP inmediatamente. No leas el prompt. No implementes nada.**
  - Responde EXACTAMENTE con uno de estos mensajes:
    - Si el siguiente paso es Codex: "⚠️ Este paso no corresponde al agente activo. **STOP.** El siguiente paso es de **GPT-5.3-Codex**. Abre un chat nuevo en Copilot → selecciona **GPT-5.3-Codex** → adjunta `AI_ITERATIVE_EXECUTION_PLAN.md` → escribe `Continúa`."
    - Si el siguiente paso es Claude: "⚠️ Este paso no corresponde al agente activo. **STOP.** El siguiente paso es de **Claude Opus 4.6**. Abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta `AI_ITERATIVE_EXECUTION_PLAN.md` → escribe `Continúa`."
5. Si hay ambigüedad: STOP y pregunta al usuario qué agente corresponde.

> **Razón:** Las disculpas no persisten entre chats. La regla escrita sí.

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

### PR progress tracking (mandatory)
**Cada paso completado debe reflejarse en la PR activa de la iteración actual.** Al terminar el SCOPE BOUNDARY (después del push), el agente actualiza el body de la PR con `gh pr edit <pr_number> --body "..."`. Esto es obligatorio tanto para Codex como para Claude. Si el comando falla, reportar al usuario pero NO bloquear el paso.

### CI verification (mandatory — hard rule)
**Ningún paso se considera completado hasta que el CI de GitHub esté verde.** Los tests locales son necesarios pero NO suficientes. Después del push, el agente DEBE:
1. Esperar a que el CI run termine (`gh run list --branch improvement/refactor --limit 1`).
2. Si el CI falla: diagnosticar, arreglar, pushear y esperar de nuevo.
3. Solo después de CI verde: declarar el paso completado al usuario.
4. Si no puede arreglar el CI tras 2 intentos: STOP y pedir ayuda.

**Razón:** Codex declaró un paso completado con CI rojo. El usuario tuvo que diagnosticar manualmente. Esto no debe repetirse.

### Next-step message (mandatory — hard rule)
**Al terminar un paso, el agente SIEMPRE indica al usuario el siguiente movimiento con instrucciones concretas.** Nunca terminar sin decir qué agente usar y qué hacer a continuación. Si no hay siguiente paso, decir "Todos los pasos completados." Referencia: sección "Instrucciones de siguiente paso" y STEP F del template SCOPE BOUNDARY.

**Formato obligatorio del handoff:** siempre "abre un chat nuevo" y siempre con nombre exacto del agente siguiente (**GPT-5.3-Codex** o **Claude Opus 4.6**). Nunca indicar "vuelve a este chat".

### Token-efficiency policy (mandatory)
Para evitar explosión de contexto entre chats y pasos largos, aplicar SIEMPRE:
1. **iterative-retrieval** antes de ejecutar cada paso: cargar solo estado actual (`primer [ ]`), objetivo del paso, archivos target, guardrails y outputs de validación relevantes.
2. **strategic-compact** al cerrar cada paso: resumir únicamente delta implementado, validación ejecutada, riesgos abiertos y siguiente movimiento.
3. Prohibido arrastrar histórico completo del chat si no es necesario para el paso activo.

> **Plantilla mínima de compacto (obligatoria):**
> - Step: F?-?
> - Delta: <cambios concretos>
> - Validation: <tests/guards + resultado>
> - Risks/Open: <si aplica>
> - Next: <agente exacto + instrucción Continúa>

### F8-A — Setup Iteration 2 (meta)
- ✅ Rama de trabajo creada desde `main`: `improvement/refactor-iteration-2`.
- ✅ Estrategia histórica confirmada: este archivo se mantiene **append-only** (F1-F7 intactas).
- ✅ Routing de identidad actualizado a regla por agente activo (Claude/Codex, bidireccional).
- ✅ PR de referencia anterior (`#146`) descartada para esta iteración; usar PR nueva al abrirla.

### F9-A — Iteration 3 backlog and scope definition (Claude)

**Source documents reviewed:**
- `CTO_REVIEW_VERDICT.md` — all 5 CTO improvements addressed in F8; remaining open findings: #5 upload streaming, #6 auth boundary, #11 extraction observability (deferred).
- `FUTURE_IMPROVEMENTS.md` — Week 2 items mostly complete; remaining: upload streaming guard (#9), auth boundary (#15). Week 4: AppWorkspace decomposition (#7b).
- `codebase_audit.md` — 15 findings total. 10 resolved. Open: #5 (upload size), #6 (auth), #11 (observability), #12 (routes.py size), residual.
- `DELIVERY_SUMMARY.md` — 423 tests (255 backend + 168 frontend), 87% backend coverage, all CI green.

**Current baseline:** 255 backend tests, 168 frontend tests, 87% backend coverage. `AppWorkspace.tsx` at 5,770 LOC.

#### F9-B — Upload streaming guard + early size limit + tests
| Attribute | Value |
|---|---|
| **Risk** | Low — additive change to one function, no contract changes |
| **Effort** | S |
| **Agent** | Codex |
| **Acceptance criteria** | Upload size enforced before full memory read via Content-Length header check + chunked streaming read. ≥3 new integration tests. All existing tests green. |
| **Test evidence** | `pytest --tb=short -q` green with new test count. |
| **Do-not-change** | Other endpoints in `routes.py`, `_validate_upload()`, domain/application code, frontend, `MAX_UPLOAD_SIZE` value. |

#### F9-C — Auth boundary minimal (optional by config) + tests/docs
| Attribute | Value |
|---|---|
| **Risk** | Medium — touches middleware layer; must not break evaluator default flow |
| **Effort** | M |
| **Agent** | Codex |
| **Acceptance criteria** | New `AUTH_TOKEN` env var (optional, empty = disabled). When set, all `/api/` endpoints require `Authorization: Bearer <token>` header. When unset/empty, behavior is identical to current (no auth). Integration tests cover both modes. `TECHNICAL_DESIGN.md` §13 updated. |
| **Test evidence** | `pytest --tb=short -q` green. New tests for auth-enabled and auth-disabled modes. |
| **Do-not-change** | Domain models, application services, frontend code, Docker Compose defaults (auth stays disabled by default). Evaluator flow (`docker compose up`) must work unchanged. |

#### F9-D — Initial decomposition of `AppWorkspace.tsx` + regression tests
| Attribute | Value |
|---|---|
| **Risk** | Medium-High — largest file in codebase, many internal dependencies |
| **Effort** | L |
| **Agent** | Codex |
| **Acceptance criteria** | Extract ≥3 cohesive modules from `AppWorkspace.tsx` (target: structured data rendering, review workspace logic, utility functions/constants). `AppWorkspace.tsx` reduced by ≥30% LOC (from 5,770 to ≤4,000). No new file >500 LOC. All existing frontend tests pass. No behavioral changes. |
| **Test evidence** | `npm test` green. Coverage maintained or improved. |
| **Do-not-change** | Backend code. UI behavior/appearance. Existing component contracts. `App.tsx` shell. |

#### F9-E — Validation + PR + close
| Attribute | Value |
|---|---|
| **Risk** | Low — verification and documentation only |
| **Effort** | S |
| **Agent** | Claude |
| **Acceptance criteria** | All F9-B..D marked `[x]`. CI green. PR body updated with iteration 3 summary. `DELIVERY_SUMMARY.md` updated with iteration 3 metrics. `FUTURE_IMPROVEMENTS.md` items resolved marked. |
| **Test evidence** | CI green on final push. |
| **Do-not-change** | Completed code from F9-B..D. |

**Global do-not-change boundaries for Iteration 3:**
- Hexagonal architecture (`domain/`, `ports/`, `infra/`).
- Docker Compose setup and healthchecks.
- CI pipeline structure (only add jobs, never remove).
- ADR content.
- Backend structural decomposition from Phase 2.
- Pre-commit hooks configuration.

---

### F10 — Iteración 4: polish de calidad (docs + lint, zero-risk)

> **Objetivo**: Cerrar inconsistencias entre documentación e implementación, eliminar warnings de linting/build, y asegurar que las instrucciones del README funcionan correctamente out-of-the-box.
> Scope: solo docs y lint — no se toca lógica de negocio, tests ni arquitectura.
> Budget: < 2 horas total.
> Base branch: `improvement/iteration-4` (creada desde `main`).

#### F10-A — Corregir Known Limitations desactualizadas en TECHNICAL_DESIGN.md §14

| Atributo | Valor |
|---|---|
| **Riesgo** | Bajo — solo edición de documentación |
| **Esfuerzo** | S |
| **Agente** | Claude |
| **Por qué** | §14 Known Limitations tiene información desactualizada: la fila #4 dice "Streaming guard in roadmap" pero F9-B ya lo implementó. La fila #5 reporta LOC de AppWorkspace.tsx pre-Iteration 3. Documentación inconsistente con la implementación es deuda técnica. |
| **Tareas** | 1. Actualizar o eliminar fila #4 (streaming guard ya implementado). 2. Actualizar fila #5: reflejar LOC y estado post-Iteration 3. 3. Verificar que ninguna otra fila referencia work "in roadmap" que ya esté completado. |
| **Criterio de aceptación** | Cada fila de §14 refleja estado actual de la implementación. No hay referencias a "in roadmap" para features ya implementados. |
| **Archivos** | `docs/project/TECHNICAL_DESIGN.md` |
| **Ref FUTURE_IMPROVEMENTS** | #9 ✅, #7b ✅ (ya cerrados — solo sync docs) |

#### F10-B — Eliminar ESLint warnings → 0 problemas en lint

| Atributo | Valor |
|---|---|
| **Riesgo** | Bajo — correcciones de memoization/deps, sin cambios de comportamiento |
| **Esfuerzo** | S |
| **Agente** | Claude |
| **Por qué** | `npm run lint` muestra 13 warnings (10× `exhaustive-deps` en AppWorkspace.tsx, 2× `react-refresh` en shadcn ui, 1× `exhaustive-deps` en ExtractionDebugPanel). Warnings acumulados indican deuda de calidad. |
| **Tareas** | 1. Envolver funciones inestables en `useCallback`, corregir deps arrays en AppWorkspace.tsx. 2. Resolver warnings de `react-refresh` en badge.tsx y button.tsx. 3. Corregir `exhaustive-deps` en ExtractionDebugPanel.tsx. 4. Verificar: `npm run lint` → 0 problems, `npm test -- --run` → 168+ tests pasan. |
| **Criterio de aceptación** | `npm run lint` sale con `0 problems (0 errors, 0 warnings)`. Todos los tests frontend pasan sin regresiones. |
| **Archivos** | `frontend/src/AppWorkspace.tsx`, `frontend/src/components/ui/badge.tsx`, `frontend/src/components/ui/button.tsx`, `frontend/src/extraction/ExtractionDebugPanel.tsx` |
| **Ref FUTURE_IMPROVEMENTS** | — |

#### F10-C — Alinear naming docs↔código: `infrastructure` → `infra`

| Atributo | Valor |
|---|---|
| **Riesgo** | Bajo — solo edición de documentación |
| **Esfuerzo** | S |
| **Agente** | Claude |
| **Por qué** | `BACKEND_IMPLEMENTATION.md` dice `infrastructure/` pero el directorio real es `infra/`. Inconsistencia detectable al comparar docs con estructura de archivos. |
| **Tareas** | 1. Buscar ocurrencias de `infrastructure` en `docs/project/BACKEND_IMPLEMENTATION.md` que se refieran al directorio. 2. Reemplazar por `infra`. 3. Buscar la misma inconsistencia en otros docs del proyecto. 4. Corregir todas las ocurrencias. |
| **Criterio de aceptación** | Grep de `infrastructure` en docs del proyecto no retorna referencias al directorio `backend/app/infra/` con nombre incorrecto. |
| **Archivos** | `docs/project/BACKEND_IMPLEMENTATION.md`, posiblemente otros docs |
| **Ref FUTURE_IMPROVEMENTS** | — |

#### F10-D — Eliminar warning de chunk vacío en Vite build

| Atributo | Valor |
|---|---|
| **Riesgo** | Bajo — cambio de configuración de build, no afecta runtime |
| **Esfuerzo** | S |
| **Agente** | Claude |
| **Por qué** | `npm run build` muestra `Generated an empty chunk: "pdfjs-worker"`. Warning en la salida de build indica configuración subóptima. |
| **Tareas** | 1. Revisar `manualChunks` en `frontend/vite.config.ts`. 2. Eliminar o corregir la entrada `pdfjs-worker` que genera chunk vacío. 3. Verificar: `npm run build` → 0 warnings, PDF rendering sigue funcionando. |
| **Criterio de aceptación** | `npm run build` no produce warnings. Bundle output funcional. |
| **Archivos** | `frontend/vite.config.ts` |
| **Ref FUTURE_IMPROVEMENTS** | — |

#### F10-E — Corregir instrucciones de quality gates en README

| Atributo | Valor |
|---|---|
| **Riesgo** | Bajo — solo edición de documentación |
| **Esfuerzo** | S |
| **Agente** | Claude |
| **Por qué** | La sección "Local quality gates" del README no menciona instalar dependencias de desarrollo antes de ejecutar ruff. Un desarrollador siguiendo las instrucciones puede tener una versión incompatible y ver errores de parseo. |
| **Tareas** | 1. Agregar prerequisito explícito: `pip install -r requirements-dev.txt` antes de correr checks de backend. 2. Verificar que `requirements-dev.txt` referencia la versión correcta de ruff. 3. Asegurar que el flujo documentado funciona end-to-end. |
| **Criterio de aceptación** | Seguir las instrucciones de quality gates del README desde cero no produce errores de herramientas. |
| **Archivos** | `README.md` |
| **Ref FUTURE_IMPROVEMENTS** | — |

#### F10-F — Smoke test final + commit + PR

| Atributo | Valor |
|---|---|
| **Riesgo** | Bajo — verificación y entrega |
| **Esfuerzo** | S |
| **Agente** | Claude |
| **Por qué** | Gate final de calidad antes de merge. |
| **Tareas** | 1. Ejecutar smoke checklist: `pytest` → 263+ passed, `npm test` → 168+ passed, `npm run lint` → 0 problems, `tsc --noEmit` → 0 errors, `npm run build` → 0 warnings. 2. Ejecutar DOC_UPDATES normalization pass (per AGENTS.md). 3. Commit + push. 4. Crear PR hacia `main`. |
| **Criterio de aceptación** | Todos los checks del smoke pasan. PR creado con descripción clara. |
| **Archivos** | Todos los modificados en F10-A a F10-E |
| **Ref FUTURE_IMPROVEMENTS** | — |

**Política de la fase — do-not-change:**
- Lógica de negocio, tests existentes, CI pipeline, arquitectura, dependencias.
- Cada paso es atómico; si uno falla, los demás siguen siendo válidos.

---

### Plan-edit-last (hard constraint)
**Codex NO edita `AI_ITERATIVE_EXECUTION_PLAN.md` hasta que los tests pasen y el código esté commiteado.** La secuencia obligatoria es:
1. Commit de código (sin tocar el plan)
2. Tests verdes (el commit ya existe, prueba que el código funciona)
3. Solo entonces: editar el plan (marcar `[x]`, limpiar Prompt activo) en un commit separado
4. Push ambos commits juntos

Esto garantiza que si Codex falla, se queda sin contexto o no termina, el plan nunca dice "completado" para un paso con tests rotos.

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
  → "Abre un chat nuevo en Copilot → selecciona **GPT-5.3-Codex** → adjunta `AI_ITERATIVE_EXECUTION_PLAN.md` → escribe `Continúa`."
- **Si el siguiente paso es de Codex (just-in-time):**
  → "Abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta `AI_ITERATIVE_EXECUTION_PLAN.md` → escribe `Continúa`. Claude preparará el prompt just-in-time."
- **Si el siguiente paso es de Claude (🚧 hard-gate):**
  → "Abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta `AI_ITERATIVE_EXECUTION_PLAN.md` → escribe `Continúa`."
- **Si el siguiente paso es de Claude (🔄 auto-chain):**
  → "Abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta `AI_ITERATIVE_EXECUTION_PLAN.md` → escribe `Continúa`."

Así el usuario nunca necesita consultar el plan para saber qué hacer — simplemente sigue las indicaciones del agente.

### Routing de "Continúa" para Codex
Cuando Codex recibe `Continúa` con este archivo adjunto, sigue esta lógica de decisión:

```
1. Lee Estado de ejecución → encuentra el primer `[ ]`.
2. Si el paso es de Claude (no de Codex):
  → STOP. Dile al usuario: "⚠️ Este paso no corresponde al agente activo. **STOP.** El siguiente paso es de **Claude Opus 4.6**. Abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta `AI_ITERATIVE_EXECUTION_PLAN.md` → escribe `Continúa`."
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

> **PLAN-EDIT-LAST RULE (hard constraint for Codex):**
> **NEVER edit AI_ITERATIVE_EXECUTION_PLAN.md until ALL tests pass and code is committed.**
> The plan file is the source of truth — marking a step `[x]` before tests pass corrupts the entire pipeline.
> If you run out of context before reaching the test gate: STOP and tell the user. Do NOT edit the plan.

```
--- AGENT IDENTITY CHECK ---
This prompt is designed for GPT-5.3-Codex in VS Code Copilot Chat.
If you are not GPT-5.3-Codex: STOP. Tell the user to switch agents.
--- END IDENTITY CHECK ---

--- BRANCH CHECK ---
Run: git branch --show-current
If NOT `<active_iteration_branch>`: STOP. Tell the user to switch to the active iteration branch.
--- END BRANCH CHECK ---

--- SYNC CHECK ---
Run: git pull origin <active_iteration_branch>
This ensures the local copy has the latest Estado, Resultados, and Prompt activo from previous sessions.
--- END SYNC CHECK ---

--- PRE-FLIGHT CHECK (ejecutar antes de empezar) ---
1. Paso anterior completado: verify the previous step in Estado de ejecución has `[x]`. If not: STOP. Tell the user: "⚠️ El paso anterior no está marcado como completado. Complétalo primero."
2. Backlog disponible (si aplica): if this step depends on an audit backlog (F1-C depends on F1-A, F2-C…F depends on F2-A), verify the corresponding `### Resultados de auditorías` section is NOT `_Pendiente_`. If it is: STOP. Tell the user: "⚠️ El backlog de [fase] no está relleno. Ejecuta la auditoría primero."
3. Target files exist: for any file path mentioned in the TASK section below, run `Test-Path <path>`. If any file does NOT exist: STOP. Tell the user which file is missing — it may have been renamed in a prior refactor step.
--- END PRE-FLIGHT CHECK ---

[TASK — rellenado por Claude con instrucciones específicas del paso]

--- TEST GATE (ejecutar ANTES de tocar el plan o commitear) ---
Backend: cd d:/Git/veterinary-medical-records && python -m pytest --tb=short -q
Frontend: cd d:/Git/veterinary-medical-records/frontend && npm test
Si algún test falla: STOP. Reporta los fallos al usuario. NO commitees. NO edites el plan.
Save the last summary line of each test run (e.g. "246 passed in 10.63s") — you will need it for the commit message.
--- END TEST GATE ---

--- SCOPE BOUNDARY (two-commit strategy) ---
Execute these steps IN THIS EXACT ORDER. Do NOT reorder.

STEP A — Commit code (plan file untouched):
1. git add -A -- . ':!docs/project/refactor/AI_ITERATIVE_EXECUTION_PLAN.md'
2. git commit -m "<tipo>(plan-f?-?): <descripción>

Test proof: <pytest summary line> | <npm test summary line>"

STEP B — Commit plan update (only after code is committed):
1. Edit AI_ITERATIVE_EXECUTION_PLAN.md: change `- [ ] F?-?` to `- [x] F?-?`.
2. Clean `## Prompt activo`: replace `### Paso objetivo` content with `_Completado: F?-?_` and `### Prompt` with `_Vacío._`
3. git add docs/project/refactor/AI_ITERATIVE_EXECUTION_PLAN.md
4. git commit -m "docs(plan-f?-?): mark step done"

STEP C — Push both commits:
1. git push origin <active_iteration_branch>

STEP D — Update active PR description:
Run the following command, replacing the progress checklist to reflect the newly completed step.
Use `gh pr edit <pr_number> --body "..."` with the full updated body.
Rules for the body update:
- Keep the existing structure (Summary, Progress, Key metrics, How to test).
- Mark the just-completed step with [x] and add a one-line summary of what was done.
- If a phase is now fully complete, mark the phase checkbox [x] too.
- Do NOT remove or alter content from previously completed phases.
- Keep the body under 3000 chars (GitHub renders poorly above that).

STEP E — CI GATE (mandatory — do NOT skip):
1. Run: gh run list --branch <active_iteration_branch> --limit 1 --json status,conclusion,databaseId
2. If status is "in_progress" or "queued": wait 30 seconds and retry (up to 10 retries).
3. If conclusion is "success": proceed to STEP F.
4. If conclusion is "failure":
   a. Run: gh run view <databaseId> --log-failed | Select-Object -Last 50
   b. Diagnose and fix the failing job(s).
   c. Commit the fix, push, and repeat from step 1.
   d. Do NOT declare the step done until CI is green.
5. If you cannot fix it after 2 attempts: STOP. Tell the user: "⚠️ CI sigue rojo tras 2 intentos de fix. Necesito ayuda para diagnosticar."

STEP F — Tell the user the NEXT STEP (mandatory — never omit):
Look at the Estado de ejecución. Find the next `[ ]` step after the one you just completed.
Then **check the `### Prompt` section inside `## Prompt activo`** to decide the routing.
Tell the user EXACTLY one of these messages (pick the FIRST that matches):

- If next step says "(Codex)" AND `### Prompt` contains `_Vacío._`: "✓ F?-? completado, CI verde, PR actualizada. Siguiente: abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta `AI_ITERATIVE_EXECUTION_PLAN.md` → escribe `Continúa`. Claude preparará el prompt just-in-time para el paso de Codex."
- If next step says "(Codex)" AND `### Prompt` is NOT `_Vacío._`: "✓ F?-? completado, CI verde, PR actualizada. Siguiente: abre un chat nuevo en Copilot → selecciona **GPT-5.3-Codex** → adjunta `AI_ITERATIVE_EXECUTION_PLAN.md` → escribe `Continúa`."
- If next step says "(Claude)": "✓ F?-? completado, CI verde, PR actualizada. Siguiente: abre un chat nuevo en Copilot → selecciona **Claude Opus 4.6** → adjunta `AI_ITERATIVE_EXECUTION_PLAN.md` → escribe `Continúa`."
- If no more steps remain: "✓ F?-? completado, CI verde, PR actualizada. Todos los pasos completados."

NEVER end without telling the user what to do next. This is a hard rule.
**NEVER direct to Codex when `### Prompt` is `_Vacío._`.** Claude must write the prompt first.

7. Stop.
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
1. Write the top-5 backlog items into the `### F1-A — Backlog 12-Factor (top 5)` section of docs/project/refactor/AI_ITERATIVE_EXECUTION_PLAN.md (replace the _Pendiente_ placeholder).
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

Output the audit report to docs/project/refactor/codebase_audit.md as the skill specifies.
Then return a prioritized backlog of the top 10 actionable items for Codex to implement.

--- SCOPE BOUNDARY — STOP HERE ---
Do NOT implement any changes. Your output for this prompt is the audit report + backlog ONLY.
When done:
1. Write the top-5 backlog items into the `### F2-A — Backlog ln-620 codebase audit (top 5)` section of docs/project/refactor/AI_ITERATIVE_EXECUTION_PLAN.md (replace the _Pendiente_ placeholder).
2. Change `- [ ] F2-A` to `- [x] F2-A` in the Estado de ejecución section.
3. git add -A && git commit -m "audit(plan-f2a): ln-620 codebase audit report + remediation backlog" && git push origin improvement/refactor
4. Tell the user: "✓ F2-A completado, pusheado. Siguiente: vuelve a Claude (este chat) con el plan adjunto y escribe `Continúa` para validar el backlog (F2-B 🚧)."
5. Stop.
--- END SCOPE BOUNDARY ---
```

### Flujo de ejecución
1. `Codex` — ejecuta el prompt con `ln-620-codebase-auditor` → genera `docs/project/refactor/codebase_audit.md`.
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

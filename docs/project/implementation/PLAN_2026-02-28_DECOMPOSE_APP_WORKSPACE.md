# Plan: Iteration 13 — Decompose AppWorkspace.tsx (custom hook extraction)

> **Operational rules:** See [EXECUTION_RULES.md](EXECUTION_RULES.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Iteración:** 13
**Rama:** `refactor/decompose-app-workspace`
**PR:** #171
**Prerequisito:** `main` estable con tests verdes.

## Context

`frontend/src/AppWorkspace.tsx` tiene **2221 líneas** en una sola función `App()`. Contiene ~30 `useState`, ~15 `useRef`, ~25 `useEffect`, ~20 `useMemo`, 5 mutations y 5 queries de react-query. Es un God Component clásico que dificulta testing, revisión de PRs y onboarding.

Ya se extrajeron 7 hooks (`useFieldEditing`, `useDocumentsSidebar`, `useReviewSplitPanel`, `useSourcePanelState`, `useStructuredDataFilters`, `useUploadState`, `useRawTextActions`, `useReviewedEditBlocker`), pero el archivo sigue siendo demasiado grande.

**Entry state:** AppWorkspace.tsx = 2221 líneas, 1 función monolítica.

**Exit target:** AppWorkspace.tsx ≤ 350 líneas (composición de hooks + JSX), ~11 nuevos custom hooks con tests unitarios, todos los tests existentes verdes.

## Scope Boundary (strict)

- **In scope:** `frontend/src/AppWorkspace.tsx`, nuevos hooks en `frontend/src/hooks/`, tests en `frontend/src/hooks/`.
- **Out of scope:** Backend, docs, componentes que no se modifiquen, refactors de lógica de negocio.
- **Principio:** Cada hook es una extracción mecánica (move, no rewrite). Zero cambios de comportamiento.

## Dependencias entre hooks

```
useConnectivityToasts (standalone)
useDocumentLoader (standalone, usa fetchOriginalPdf)
useDocumentUpload (depende de useDocumentLoader.requestPdfLoad)
useDocumentListPolling (standalone, usa useQuery)
useReprocessing (standalone, usa useMutation)
useReviewToggle (standalone, usa useMutation)
useInterpretationEdit (standalone, usa useMutation)
useRawTextViewer (standalone, usa useQuery + useRawTextActions)
useConfidenceDiagnostics (depende de interpretationData)
useReviewDataPipeline (depende de confidence policy, interpretationData)
useReviewPanelState (depende de reviewData, isProcessing)
```

Orden de extracción: hooks sin dependencias cruzadas primero → hooks que dependen de la salida de otros después.

---

## Estado de ejecución — update on completion of each step

> **Rationale del orden:** Leaf hooks (sin deps) → hooks con deps simples → pipeline de datos pesado → estado derivado → cleanup final.

**Leyenda:**
- 🔄 **auto-chain** — Codex ejecuta; usuario revisa después.
- 🚧 **hard-gate** — Claude; requiere decisión del usuario.

### Phase 0 — Bootstrap

- [x] R0-A 🔄 — Create branch `refactor/decompose-app-workspace` from `main`, create PR (Codex) — ✅ `5d972b97`

### Phase 1 — Leaf hooks (sin dependencias cruzadas)

- [x] R1-A 🔄 — Extract `useConnectivityToasts` — state: `connectivityToast`, `hasShownListErrorToast`, `showConnectivityToast()`; refs: `lastConnectivityToastAtRef`; effects: toast auto-dismiss, connectivity error detection. Write test. (Codex) — ✅ `a37be999`
- [x] R1-B 🔄 — Extract `useDocumentLoader` — state: `fileUrl`, `filename`; mutation: `loadPdf`; fn: `requestPdfLoad`; refs: `latestLoadRequestIdRef`, `pendingAutoOpenDocumentIdRef`, `autoOpenRetryCountRef`, `autoOpenRetryTimerRef`; effect: cleanup timers. Write test. (Codex) — ✅ `72595a23`
- [x] R1-C 🔄 — Extract `useReprocessing` — state: `reprocessingDocumentId`, `hasObservedProcessingAfterReprocess`, `showRetryModal`; mutation: `reprocessMutation`; fn: `handleConfirmRetry`; effects: reprocess lifecycle tracking. Write test. (Codex) — ✅ `1e9623f0`
- [x] R1-D 🔄 — Extract `useReviewToggle` — mutation: `reviewToggleMutation` with optimistic cache updates on list/detail/review queries. Write test. (Codex) — ✅ `cbb003f2`
- [x] R1-E 🔄 — Extract `useInterpretationEdit` — mutation: `interpretationEditMutation`; fn: `submitInterpretationChanges`. Write test. (Codex) — ✅ `ea7f5a02`

### Phase 2 — Hooks con dependencias simples

- [x] R2-A 🔄 — Extract `useDocumentUpload` — mutation: `uploadMutation`; depends on `requestPdfLoad` from `useDocumentLoader`. Write test. (Codex) — ✅ `3fb87f28`
- [ ] R2-B 🔄 — Extract `useDocumentListPolling` — query: `documentList`; memo: `sortedDocuments`; refs: `listPollingStartedAtRef`; effects: adaptive polling, empty-sidebar collapse. Write test. (Codex) ⏳ EN PROGRESO (Codex, 2026-02-28)
- [ ] R2-C 🔄 — Extract `useRawTextViewer` — query: `rawTextQuery`; state: `rawSearch`, `rawSearchNotice`; derived: `rawTextErrorMessage`, `hasRawText`, `canCopy/canSearch`; integrates existing `useRawTextActions`. Write test. (Codex)

### Phase 3 — Pipeline de datos pesado

- [ ] R3-A 🔄 — Extract `useConfidenceDiagnostics` — memos: `documentConfidencePolicy`; effects: policy diagnostic logging, debug logging, visit grouping diagnostics. Write test. (Codex)
- [ ] R3-B 🔄 — Extract `useReviewDataPipeline` — memos: `extractedReviewFields`, `validationResult`, `validatedReviewFields`, `coreDisplayFields`, `otherDisplayFields`, `groupedCoreFields`, `canonicalVisitFieldOrder`, `reportSections`, `selectableReviewItems`, `detectedFieldsSummary`; effect: extraction debug logging. Write test. (Codex)
- [ ] R3-C 🔄 — Extract `useReviewPanelState` — derived: `reviewPanelState`, `reviewPanelMessage`, `shouldShowReviewEmptyState`, `hasNoStructuredFilterResults`; state: `reviewLoadingDocId`, `reviewLoadingSinceMs`, `isRetryingInterpretation`; fn: `handleRetryInterpretation`. Write test. (Codex)

### Phase 4 — Integration & cleanup

- [ ] R4-A 🚧 — Review: verify all hooks compose correctly in App(), no behavior regressions, line count target met (Claude)
- [ ] R4-B 🔄 — Final cleanup: remove dead imports, verify all existing tests pass (unit + e2e), fix any lint issues (Codex)
- [ ] R4-C 🚧 — User acceptance review of decomposed code (Claude)

---

## Cola de prompts

> Pre-written prompts for semi-unattended execution. Codex reads these directly.
> Prompts that depend on prior results are marked "just-in-time" — Claude writes them after the dependency resolves.

### R0-A — Create branch and PR

```
Crea la rama `refactor/decompose-app-workspace` desde `main` y un PR con título
"refactor: decompose AppWorkspace.tsx into custom hooks" y body que resuma el plan.
No hagas cambios de código aún.
```
⚠️ AUTO-CHAIN → R1-A

### R1-A — Extract useConnectivityToasts

```
Extrae el hook `useConnectivityToasts` de `AppWorkspace.tsx` a `frontend/src/hooks/useConnectivityToasts.ts`.

**Estado que migra:**
- useState: connectivityToast, hasShownListErrorToast
- useRef: lastConnectivityToastAtRef
- Funciones: showConnectivityToast()
- Effects: auto-dismiss de connectivityToast (5s timeout)

**Interfaz del hook:**
- Params: (ninguno, o callbacks si se necesitan)
- Returns: { connectivityToast, showConnectivityToast, setConnectivityToast, hasShownListErrorToast, setHasShownListErrorToast }

**Reglas:**
1. Extracción mecánica: move, no rewrite.
2. En AppWorkspace.tsx, reemplaza el estado/effects migrados con la llamada al hook.
3. Escribe test en `frontend/src/hooks/useConnectivityToasts.test.ts` usando `renderHook` + `vi` (patrón de useUploadState.test.ts).
4. Ejecuta `npm run test` en frontend/ y verifica verde.
```
⚠️ AUTO-CHAIN → R1-B

### R1-B — Extract useDocumentLoader

```
Extrae el hook `useDocumentLoader` de `AppWorkspace.tsx` a `frontend/src/hooks/useDocumentLoader.ts`.

**Estado que migra:**
- useState: fileUrl, filename
- useRef: latestLoadRequestIdRef, pendingAutoOpenDocumentIdRef, autoOpenRetryCountRef, autoOpenRetryTimerRef
- Mutation: loadPdf (useMutation con fetchOriginalPdf)
- Función: requestPdfLoad
- Effects: cleanup de timers en unmount, auto-open retry logic

**Interfaz del hook:**
- Params: { onUploadFeedback: (feedback) => void }
- Returns: { fileUrl, filename, setFileUrl, setFilename, requestPdfLoad, loadPdf, pendingAutoOpenDocumentIdRef }

**Reglas:**
1. Extracción mecánica.
2. Actualiza AppWorkspace.tsx para usar el hook.
3. Test con renderHook + vi.fn() para fetchOriginalPdf mock.
4. `npm run test` verde.
```
⚠️ AUTO-CHAIN → R1-C

### R1-C — Extract useReprocessing

```
Extrae `useReprocessing` de `AppWorkspace.tsx` a `frontend/src/hooks/useReprocessing.ts`.

**Estado que migra:**
- useState: reprocessingDocumentId, hasObservedProcessingAfterReprocess, showRetryModal
- Mutation: reprocessMutation (triggerReprocess, con optimistic updates)
- Función: handleConfirmRetry
- Effects: reprocess lifecycle tracking (observed processing → done)

**Interfaz del hook:**
- Params: { activeId, isActiveDocumentProcessing, onActionFeedback }
- Returns: { reprocessingDocumentId, hasObservedProcessingAfterReprocess, showRetryModal, setShowRetryModal, reprocessMutation, handleConfirmRetry }

**Reglas:** Extracción mecánica. Test. Verde.
```
⚠️ AUTO-CHAIN → R1-D

### R1-D — Extract useReviewToggle

```
Extrae `useReviewToggle` de `AppWorkspace.tsx` a `frontend/src/hooks/useReviewToggle.ts`.

**Estado que migra:**
- Mutation: reviewToggleMutation (markDocumentReviewed / reopenDocumentReview)
- Optimistic cache updates en documentList, documentDetail, documentReview queries

**Interfaz del hook:**
- Params: { onActionFeedback }
- Returns: { reviewToggleMutation }

**Reglas:** Extracción mecánica. Test. Verde.
```
⚠️ AUTO-CHAIN → R1-E

### R1-E — Extract useInterpretationEdit

```
Extrae `useInterpretationEdit` de `AppWorkspace.tsx` a `frontend/src/hooks/useInterpretationEdit.ts`.

**Estado que migra:**
- Mutation: interpretationEditMutation (editRunInterpretation)
- Función: submitInterpretationChanges (requires activeId + documentReview.data)

**Interfaz del hook:**
- Params: { onActionFeedback }
- Returns: { interpretationEditMutation, submitInterpretationChanges }

**Reglas:** Extracción mecánica. Test. Verde.
```
⚠️ AUTO-CHAIN → R2-A

### R2-A — Extract useDocumentUpload

```
Extrae `useDocumentUpload` de `AppWorkspace.tsx` a `frontend/src/hooks/useDocumentUpload.ts`.

**Estado que migra:**
- Mutation: uploadMutation (uploadDocument, optimistic list update)
- Depende de: requestPdfLoad (del hook useDocumentLoader ya extraído)

**Interfaz del hook:**
- Params: { requestPdfLoad, pendingAutoOpenDocumentIdRef, onUploadFeedback, onSetActiveId, onSetActiveViewerTab }
- Returns: { uploadMutation }

**Reglas:** Extracción mecánica. Test. Verde.
```
⚠️ AUTO-CHAIN → R2-B

### R2-B — Extract useDocumentListPolling

```
Extrae `useDocumentListPolling` de `AppWorkspace.tsx` a `frontend/src/hooks/useDocumentListPolling.ts`.

**Estado que migra:**
- Query: documentList (fetchDocuments)
- Memo: sortedDocuments
- Ref: listPollingStartedAtRef
- Effects: adaptive polling (1.5s → 5s), empty-list sidebar collapse

**Interfaz del hook:**
- Params: { setIsDocsSidebarHovered }
- Returns: { documentList, sortedDocuments }

**Reglas:** Extracción mecánica. Test. Verde.
```
⚠️ AUTO-CHAIN → R2-C

### R2-C — Extract useRawTextViewer

```
Extrae `useRawTextViewer` de `AppWorkspace.tsx` a `frontend/src/hooks/useRawTextViewer.ts`.

**Estado que migra:**
- Query: rawTextQuery (fetchRawText)
- useState: rawSearch, rawSearchNotice
- Derived: rawTextContent, hasRawText, canCopyRawText, isRawTextLoading, canSearchRawText, rawTextErrorMessage
- Función: handleRawSearch
- Integra useRawTextActions internamente

**Interfaz del hook:**
- Params: { rawTextRunId, activeViewerTab }
- Returns: { rawSearch, setRawSearch, rawSearchNotice, rawTextContent, hasRawText, canCopyRawText, isRawTextLoading, canSearchRawText, rawTextErrorMessage, handleRawSearch, copyFeedback, isCopyingRawText, handleDownloadRawText, handleCopyRawText }

**Reglas:** Extracción mecánica. Test. Verde.
```
⚠️ AUTO-CHAIN → R3-A

### R3-A — Extract useConfidenceDiagnostics

```
Extrae `useConfidenceDiagnostics` de `AppWorkspace.tsx` a `frontend/src/hooks/useConfidenceDiagnostics.ts`.

**Estado que migra:**
- Memo: documentConfidencePolicy, activeConfidencePolicy, confidencePolicyDegradedReason
- Refs: lastConfidencePolicyDocIdRef, loggedConfidencePolicyDiagnosticsRef, loggedConfidencePolicyDebugRef
- Effects: policy diagnostic event emission, confidence debug logging, visit grouping diagnostics

**Interfaz del hook:**
- Params: { interpretationData, reviewVisits, isCanonicalContract }
- Returns: { activeConfidencePolicy, confidencePolicyDegradedReason }

**Reglas:** Extracción mecánica. Test. Verde.
```
⚠️ AUTO-CHAIN → R3-B

### R3-B — Extract useReviewDataPipeline

```
Extrae `useReviewDataPipeline` de `AppWorkspace.tsx` a `frontend/src/hooks/useReviewDataPipeline.ts`.

**Estado que migra:**
- Memos: extractedReviewFields, explicitOtherReviewFields, validationResult, validatedReviewFields, matchesByKey, coreDisplayFields, otherDisplayFields, groupedCoreFields, canonicalVisitFieldOrder, visibleCoreGroups, visibleOtherDisplayFields, visibleCoreFields, reportSections, selectableReviewItems, detectedFieldsSummary, buildSelectableField
- Refs: lastExtractionDebugDocIdRef, loggedExtractionDebugEventKeysRef
- Effect: extraction debug event logging

**Interfaz del hook:**
- Params: { documentReview, activeConfidencePolicy, structuredDataFilters, hasActiveStructuredFilters }
- Returns: { reportSections, selectableReviewItems, coreDisplayFields, otherDisplayFields, detectedFieldsSummary, reviewVisits, isCanonicalContract, hasMalformedCanonicalFieldSlots, hasVisitGroups, hasUnassignedVisitGroup, canonicalVisitFieldOrder, validatedReviewFields, buildSelectableField, visibleCoreGroups, visibleOtherDisplayFields }

Este es el hook más grande (~400 líneas). Extracción mecánica cuidadosa.
Test con datos mock del schema.
```
⚠️ AUTO-CHAIN → R3-C

### R3-C — Extract useReviewPanelState

```
Extrae `useReviewPanelState` (renombrado para no colisionar con el módulo existente useSourcePanelState) de `AppWorkspace.tsx` a `frontend/src/hooks/useReviewPanelStatus.ts`.

**Estado que migra:**
- useState: reviewLoadingDocId, reviewLoadingSinceMs, isRetryingInterpretation
- Refs: interpretationRetryMinTimerRef
- Derived: reviewPanelState, reviewPanelMessage, shouldShowReviewEmptyState, hasNoStructuredFilterResults
- Función: handleRetryInterpretation
- Effects: review loading minimum visible time, retry min timer

**Interfaz del hook:**
- Params: { activeId, documentReview, isActiveDocumentProcessing, hasActiveStructuredFilters, visibleCoreGroupsLength }
- Returns: { reviewPanelState, reviewPanelMessage, shouldShowReviewEmptyState, hasNoStructuredFilterResults, isRetryingInterpretation, handleRetryInterpretation }

**Reglas:** Extracción mecánica. Test. Verde.
```
⚠️ AUTO-CHAIN → R4-A

### R4-A — Integration review (just-in-time)

_Claude writes after R3-C is complete. Reviews final AppWorkspace.tsx composition._

### R4-B — Final cleanup

```
1. Revisa AppWorkspace.tsx: elimina imports no usados, verifica que no queden useState/useRef/useEffect huérfanos.
2. Ejecuta `npm run lint` en frontend/ y corrige errores.
3. Ejecuta `npm run test` en frontend/ y verifica todo verde.
4. Ejecuta tests e2e si existen: `npx playwright test`.
5. Reporta line count final de AppWorkspace.tsx.
```

### R4-C — User acceptance (just-in-time)

_Claude writes after R4-B._

---

## Prompt activo

### Paso objetivo

_Completado: R1-C_

_Vacío._

---

## Risk log

| Risk | Mitigation |
|---|---|
| Circular deps entre hooks | Dependency graph defined above; extract leaves first |
| QueryClient coupling | Hooks receive queryClient from useQueryClient() internally (same pattern as existing hooks) |
| Render count regression | Each hook encapsulates related state; no extra re-renders vs current monolith |
| Test coverage gap | Every new hook gets a test file; existing tests must stay green |
| Large R3-B (pipeline) | Can split further if >400 lines; Claude reviews at R4-A |

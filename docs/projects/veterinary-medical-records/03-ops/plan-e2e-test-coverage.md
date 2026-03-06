# E2E Coverage Plan - Playwright

## Objective

Define all verifiable user-facing capabilities, group them into coherent usage scenarios, and create repeatable Playwright tests that run on every PR.

---

## 1. Feature Inventory (user perspective)

### A — Application load

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| A1 | The app loads and shows the main layout | `canvas-wrapper`, `main-canvas-layout` |
| A2 | Shows el sidebar de documentos | `documents-sidebar` |
| A3 | Shows la zona de upload (dropzone) | `upload-dropzone` / UploadDropzone visible |
| A4 | El visor shows el estado vacío ("Selecciona un documento…") | `viewer-empty-state` |

### B — Document sidebar

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| B1 | Showsn los documentos existentes agrupados: "Para revisar" / "Revisados" | `left-panel-scroll`, group headers |
| B2 | Selecting a document marks it as active (`aria-pressed`) | `doc-row-{id}` |
| B3 | El documento activo shows indicador visual (barra lateral accent) | `doc-row-{id}[aria-current]` |
| B4 | Pin/unpin sidebar | button "Fijar"/"Fijada" en `sidebar-actions-cluster` |
| B5 | Refresh document list | button "Actualizar" en `sidebar-actions-cluster` |
| B6 | Shows el status chip de cada documento (processing, complete, error) | `DocumentStatusChip` |
| B7 | Hover expands collapsed sidebar | `documents-sidebar[data-expanded]` |
| B8 | Empty state: "Aún no hay documentos cargados." | visible text |
| B9 | Indicador "Tardando más de lo esperado" para procesamiento largo | visible text |

### C — Document upload

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| C1 | Click en dropzone opens file picker | `#upload-document-input` |
| C2 | Upload PDF via file input -> appears in sidebar | `doc-row-{new_id}` |
| C3 | Drag & drop in sidebar dropzone | UploadDropzone + drag events |
| C4 | Drag & drop in PDF viewer | `viewer-dropzone` |
| C5 | Successful upload feedback (toast "Documento subido correctamente") | toast visible |
| C6 | Upload error feedback (toast de error) | toast visible |
| C7 | Auto-open document after upload (PDF loads in viewer) | PDF visible en visor |
| C8 | "Uploading..." indicator during upload | spinner + texto "Subiendo..." |
| C9 | Reject non-PDF file (solo `.pdf`) | toast de error |
| C10 | Reject file >20 MB | toast de error |

### D — PDF viewer

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| D1 | Document renders in viewer (canvas visible) | `pdf-page` (canvas elements) |
| D2 | Loading indicator "Cargando PDF..." | visible text |
| D3 | Zoom In (button +) → zoom incrementa 10% | button "Acercar", `pdf-zoom-indicator` |
| D4 | Zoom Out (button −) → zoom decrementa 10% | button "Alejar", `pdf-zoom-indicator` |
| D5 | Zoom con Ctrl + rueda de ratón | `pdf-scroll-container` wheel event |
| D6 | Fit to width (button) → zoom vuelve a 100% | button "Fit to width" |
| D7 | Zoom indicator shows porcentaje correcto | `pdf-zoom-indicator` |
| D8 | Zoom persiste en localStorage | `pdfViewerZoomLevel` en localStorage |
| D9 | Límites de zoom respetados (50%–200%) | botones disabled en extremos |
| D10 | Navigate to previous page | button "Página anterior" |
| D11 | Navigate to next page | button "Página siguiente" |
| D12 | Current page indicator (n/total) | texto en toolbar |
| D13 | Navigation buttons disabled at bounds (primera/última página) | `disabled` state |
| D14 | Continuous scroll between pages updates page indicator | `pdf-scroll-container` scroll |

### E — Viewer toolbar (tabs)

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| E1 | "Document" tab shows the PDF | button "Documento" `aria-current="page"` |
| E2 | Tab "Texto extraído" shows el texto raw | button "Texto extraído" |
| E3 | Tab "Detalles técnicos" shows el historial | button "Detalles técnicos" |
| E4 | "Download" button opens the PDF in a new tab | button "Descargar" |

### F — Extracted text view (Raw Text)

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| F1 | Extracted text is shown del documento | contenido de visible text |
| F2 | Search in extracted text → "Coincidencia encontrada" | search input + feedback |
| F3 | Search with no result → "No se encontraron coincidencias" | feedback visible |
| F4 | Copy text to clipboard | button Copiar |
| F5 | Download extracted text | button Descargar |
| F6 | Estado de carga del texto | spinner / loading |
| F7 | Error when text is unavailable | mensaje de error |

### G — Technical details (processing history)

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| G1 | Shows el document run history | run list |
| G2 | Expand/collapse step details | button expandir |
| G3 | Reprocess document (button Reintentar) | modal de confirmación |
| G4 | Confirm reprocessing | button en modal |
| G5 | Active processing indicator | status processing |

### H — Extracted data panel (Structured Data)

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| H1 | Shows el panel "Datos extraídos" con campos organizados por secciones | `structured-column-stack` |
| H2 | Fields organized in medical-history sections | secciones con headers |
| H3 | Cada campo shows su valor formateado | field value visible |
| H4 | Campos faltantes showsn placeholder "—" | `MISSING_VALUE_PLACEHOLDER` |
| H5 | Per-field confidence indicator (dot alto/medio/bajo) | `confidence-indicator-{id}` |
| H6 | Badge "Crítico" en campos críticos | CriticalBadge |
| H7 | Detected fields summary (n/total + distribución de confianza) | toolbar summary |
| H8 | "Other extracted data" section for non-canonical fields | sección separada |
| H9 | Loading state (skeleton) while data is being processed | `review-core-skeleton` |
| H10 | Empty state "No hay un run completado" | visible message |
| H11 | Error de interpretación con button "Reintentar" | button Reintentar |
| H12 | Degraded-confidence policy warning | `confidence-policy-degraded` |

### I — Search and filters in extracted data

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| I1 | Buscar campos por texto (clave, label o valor) | `structured-search-shell` input |
| I2 | Clear search (button X) | button "Clear search" |
| I3 | Filter by low confidence | toggle "Baja" |
| I4 | Filter by medium confidence | toggle "Media" |
| I5 | Filter by high confidence | toggle "Alta" |
| I6 | Filter: critical only | toggle "Solo críticos" |
| I7 | Filter: with value only | toggle "Solo con valor" |
| I8 | Filter: empty only | toggle "Solo vacíos" |
| I9 | Reset all filters | button "Resetear filtros" |
| I10 | Empty state cuando filtros no tienen resultados | mensaje "Sin resultados" |

### J — Field editing

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| J1 | Clicking a field opens the edit dialog | `FieldEditDialog` open |
| J2 | Edit free-text value | input en dialog |
| J3 | Editar campo Sexo (dropdown con vocabulario controlado) | select con opciones canónicas |
| J4 | Editar campo Especie (dropdown con vocabulario controlado) | select con opciones canónicas |
| J5 | Validación de microchip (formato) | error visible si inválido |
| J6 | Validación de peso (formato) | error visible si inválido |
| J7 | Validación de edad (formato) | error visible si inválido |
| J8 | Validación de fecha (formato) | error visible si inválido |
| J9 | Save edit → valor actualizado en panel | button "Guardar" |
| J10 | Cancel edit | button "Cancelar" |
| J11 | Candidate suggestions in edit dialog | sección de candidatos visible |
| J12 | Edit lock on "reviewed" document (feedback) | toast de aviso |
| J13 | Add new field (AddFieldDialog) | diálogo con clave + valor |
| J14 | Save new field | button "Guardar" en AddFieldDialog |
| J15 | Confidence updates after manual edit | cambio de indicador |

### K — Review workflow

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| K1 | Button "Marcar revisado" marca documento como revisado | button principal |
| K2 | Button "Reabrir" reabre documento para revisión | button outline |
| K3 | "Marking..." / "Reopening..." indicator during mutation | spinner en button |
| K4 | Reviewed document moves to "Reviewed" group in sidebar | grupo "Revisados" |
| K5 | Reopened document returns to "To review" | grupo "Para revisar" |

### L — Evidence panel (Source Panel)

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| L1 | Selecting a field navigates the PDF to the evidence page | scroll del visor |
| L2 | Shows el panel de fuente con página y snippet | `source-pinned-panel` / `source-drawer` |
| L3 | Pin/unpin source panel | button "Fijar"/"Desfijar" |
| L4 | Close source panel | button X |
| L5 | Shows la evidencia textual del campo | contenido en Source Panel |
| L6 | Visual highlight on the correct PDF page | fondo accent en `pdf-page` |

### M — Layout and split panel

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| M1 | Split panel between PDF viewer and extracted data | `review-split-grid` |
| M2 | Drag handle to resize panels | `review-split-handle` |
| M3 | Double-clicking handle resets ratio | `review-split-handle` dblclick |
| M4 | Keyboard resize for split panel | arrow key events |

### N — Toasts and notifications

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| N1 | Success toast auto-closes tras ~3.5s | auto-dismiss |
| N2 | Error toast auto-closes after ~5s | auto-dismiss |
| N3 | Connectivity toast on network error | toast connectivity |
| N4 | Close toast manually | button cerrar en toast |
| N5 | Action "Abrir documento" en toast de upload exitoso | button acción |

### O — Visits (canonical contract)

| ID | Feature | data-testid / key selector |
|----|---------------|------------------------------|
| O1 | Visit episodes grouped and numbered | `visit-episode-{n}` |
| O2 | Visit metadata (fecha, ingreso, alta, motivo) | campos dentro de visita |
| O3 | Fields with visit scope correctly assigned | fields con `visit_group_id` |
| O4 | "Unassigned" group visible when there are ungrouped fields | `visit-unassigned-group` |

---

## 2. Detailed Test Specification (Given / When / Then)

> Convention: cada test se describe con pasos concretos y expected result.
> Los IDs entre paréntesis (e.g. `[A1]`) referencian el inventario de funcionalidades de la §1.
> **Precondition global:** la app is running en `localhost:80` con Docker Compose.

---

### P0 — Smoke (en cada PR, <30 s cada test)

#### `app-loads.spec.ts`

**Test 1 — "The app loads and shows the main layout"** `[A1, A2, A3, A4]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | — | — |
| When | Navigate to `/` | — |
| Then | El contenedor principal es visible | `[data-testid="canvas-wrapper"]` visible |
| Then | El sidebar de documentos es visible | `[data-testid="documents-sidebar"]` visible |
| Then | La zona de upload (dropzone) es visible | UploadDropzone visible (primer `[data-testid="upload-dropzone"]`) |
| Then | El visor shows estado vacío | `[data-testid="viewer-empty-state"]` visible, o texto "Selecciona un documento" |

---

#### `upload-smoke.spec.ts`

**Test 2 — "Subir un PDF hace que aparezca en el sidebar"** `[C2, C5, C7, B2]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Navigate to `/` y wait sidebar visible | — |
| When | Hover sobre el sidebar para expandirlo | Sidebar expanded |
| When | Subir `sample.pdf` vía `#upload-document-input` | — |
| Then | El sidebar contiene el texto "sample.pdf" (timeout 60 s) | `[data-testid="documents-sidebar"]` contiene texto del filename |
| Then | Existe un row de documento con el `document_id` devuelto | `[data-testid="doc-row-{id}"]` visible |

---

### P1 — Core workflows (en cada PR, <60 s cada test)

#### `pdf-viewer.spec.ts`

> **Precondition compartida:** upload un PDF de 2+ páginas y wait a que el visor lo renderice.

**Test 3 — "El PDF se renderiza en el visor"** `[D1]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Documento subido y seleccionado | — |
| When | Esperar a que el visor cargue | — |
| Then | Al menos un canvas de página es visible | `[data-testid="pdf-page"]` count ≥ 1 |
| Then | El toolbar del PDF es visible | `[data-testid="pdf-toolbar-shell"]` visible |

**Test 4 — "Zoom In incrementa el zoom 10%"** `[D3, D7]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | PDF cargado, zoom en 100% | `[data-testid="pdf-zoom-indicator"]` shows "100%" |
| When | Click en button "Acercar" | — |
| Then | El indicador shows "110%" | `[data-testid="pdf-zoom-indicator"]` texto = "110%" |

**Test 5 — "Zoom Out decrementa el zoom 10%"** `[D4, D7]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | PDF cargado, zoom en 100% | — |
| When | Click en button "Alejar" | — |
| Then | El indicador shows "90%" | `[data-testid="pdf-zoom-indicator"]` texto = "90%" |

**Test 6 — "Fit to width resetea el zoom a 100%"** `[D6, D7]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | PDF cargado, hacer zoom in 2 veces (→120%) | — |
| When | Click en button "Fit to width" | — |
| Then | El indicador shows "100%" | `[data-testid="pdf-zoom-indicator"]` texto = "100%" |

**Test 7 — "Botones de zoom se deshabilitan en los límites"** `[D9]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | PDF cargado | — |
| When | Hacer click en "Alejar" repetidamente hasta 50% | — |
| Then | El button "Alejar" está disabled | `[data-testid="pdf-zoom-out"]` disabled |
| When | Hacer click en "Acercar" repetidamente hasta 200% | — |
| Then | El button "Acercar" está disabled | `[data-testid="pdf-zoom-in"]` disabled |

**Test 8 — "Navegación entre páginas"** `[D10, D11, D12, D13]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | PDF de 2+ páginas cargado, estamos en página 1 | Indicador shows "1/N" |
| Then | Button "Página anterior" está disabled | disabled state |
| When | Click en button "Página siguiente" | — |
| Then | Indicador shows "2/N" | `[data-testid="pdf-page-indicator"]` texto = "2/N" |
| Then | Button "Página anterior" ahora está enabled | — |
| When | En última página, verificar button "Página siguiente" | disabled state |

---

#### `document-sidebar.spec.ts`

> **Precondition:** al menos 1 documento ya existente en el sistema.

**Test 9 — "The document list shows groups 'Para revisar' y 'Revisados'"** `[B1]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Navigate to `/`, sidebar expandido | — |
| When | Observar el sidebar | — |
| Then | Shows al menos un grupo de documentos | Header "Para revisar" o "Revisados" visible |
| Then | Cada documento shows nombre y timestamp | Texto del filename visible en el row |

**Test 10 — "Selecting a document marks it as active"** `[B2, B3]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Sidebar con al menos 1 documento | — |
| When | Click en un `doc-row-{id}` | — |
| Then | El row tiene `aria-pressed="true"` | Atributo verificable |
| Then | El row tiene `aria-current="true"` | Atributo verificable |
| Then | El visor carga el PDF (canvas visible) | `[data-testid="pdf-page"]` visible |

**Test 11 — "Each document shows its status chip"** `[B6]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Sidebar expandido con documentos | — |
| When | Observar los rows | — |
| Then | Cada row contiene un status chip | Element con clase `DocumentStatusChip` presente dentro de cada row |

---

#### `extracted-data.spec.ts`

> **Precondition:** upload `sample.pdf`, wait a que el procesamiento termine (status != PROCESSING).

**Test 12 — "The extracted data panel is shown with sections"** `[H1, H2]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Documento procesado y seleccionado | — |
| When | Esperar a que el panel de datos esté ready | `[data-testid="structured-column-stack"]` visible |
| Then | El panel shows el título "Datos extraídos" | Texto visible |
| Then | Hay al menos una sección con header | Sección con título (e.g., "Datos del paciente") visible |

**Test 13 — "Fields show their formatted values"** `[H3, H4]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Panel de datos extraídos ready | — |
| When | Buscar campos en el panel | — |
| Then | Al menos un campo shows un valor no vacío | Texto del valor visible (≠ "—") |
| Then | Los campos sin valor showsn "—" | Placeholder "—" visible |

**Test 14 — "Fields show confidence indicators"** `[H5, H6, H7]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Panel de datos extraídos ready con campos | — |
| When | Observar los campos | — |
| Then | Al menos un campo tiene indicador de confianza visible | `[data-testid^="confidence-indicator-"]` visible |
| Then | El resumen de campos detectados es visible | Texto con conteo (e.g., "12/20") visible en toolbar |

---

#### `field-editing.spec.ts`

> **Precondition:** documento procesado con al menos un campo editable (e.g., `pet_name`).

**Test 15 — "Clicking a field opens the edit dialog"** `[J1]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Panel de datos ready, campo `pet_name` visible | — |
| When | Click en el trigger del campo (`[data-testid^="field-trigger-"]`) | — |
| Then | Se abre el diálogo de edición | Dialog visible con título del campo |
| Then | El input contiene el valor actual del campo | Input pre-populado |

**Test 16 — "Editing a value and saving updates the panel"** `[J2, J9, J15]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Diálogo de edición abierto para un campo | — |
| When | Borrar el valor actual e introducir "NuevoValorTest" | — |
| When | Click en "Guardar" | — |
| Then | El diálogo se cierra | Dialog no visible |
| Then | El campo shows "NuevoValorTest" en el panel | Texto actualizado visible |
| Then | Aparece toast de éxito | Toast visible (auto-disappears) |

**Test 17 — "Canceling an edit does not change the field"** `[J10]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Diálogo abierto, valor original = "ValorOriginal" | — |
| When | Cambiar texto a "OtroValor" | — |
| When | Click en "Cancelar" | — |
| Then | Diálogo se cierra | Dialog no visible |
| Then | El campo sigue mostrando "ValorOriginal" | Texto original sin cambios |

---

#### `review-workflow.spec.ts`

> **Precondition:** documento procesado y datos extraídos visibles.

**Test 18 — "Mark document as reviewed"** `[K1, K3, K4]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Documento en estado "Para revisar" | Button "Marcar revisado" visible |
| When | Click en "Marcar revisado" | — |
| Then | Aparece indicador "Marcando…" brevemente | Spinner visible |
| Then | El button cambia a "Reabrir" | Texto "Reabrir" visible |
| Then | El documento aparece en grupo "Revisados" del sidebar | Row del doc dentro del grupo "Revisados" |
| Then | Toast de éxito: "Documento marcado como revisado." | Toast visible |

**Test 19 — "Reopen reviewed document"** `[K2, K5]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Documento en estado "Revisado" | Button "Reabrir" visible |
| When | Click en "Reabrir" | — |
| Then | Aparece indicador "Reabriendo…" brevemente | Spinner visible |
| Then | El button cambia a "Marcar revisado" | Texto "Marcar revisado" visible |
| Then | El documento vuelve al grupo "Para revisar" del sidebar | Row del doc dentro del grupo "Para revisar" |
| Then | Toast de éxito: "Documento reabierto para revisión." | Toast visible |

---

### P2 — Secondary features (nightly / pre-release, <90 s cada test)

#### `upload-validation.spec.ts`

**Test 20 — "Reject non-PDF file"** `[C9]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Navigate to `/`, sidebar expandido | — |
| When | Intentar upload `non-pdf.txt` vía file input | — |
| Then | Aparece toast de error: "Solo se admiten archivos PDF." | Toast error visible |
| Then | El archivo NO aparece en el sidebar | Sidebar sin nuevo row |

**Test 21 — "Drag & drop en el visor"** `[C4]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Navigate to `/` | — |
| When | Drag & drop `sample.pdf` sobre el visor | — |
| Then | Overlay de drop visible: "Suelta el PDF para uploadlo" | Texto visible |
| When | Soltar el archivo | — |
| Then | El documento se sube y aparece en sidebar | Row de documento visible |

---

#### `viewer-tabs.spec.ts`

> **Precondition:** documento procesado y cargado en visor.

**Test 22 — "Tab 'Documento' shows el PDF"** `[E1]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | PDF cargado, tab "Documento" activo por defecto | — |
| Then | Canvas de página visible | `[data-testid="pdf-page"]` visible |
| Then | Button "Documento" tiene `aria-current="page"` | Atributo verificable |

**Test 23 — "Tab 'Texto extraído' shows raw text"** `[E2]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | PDF cargado | — |
| When | Click en tab "Texto extraído" | — |
| Then | El contenido del PDF disappears (canvas oculto) | Canvas no visible |
| Then | Shows contenido de texto | Texto del documento visible |

**Test 24 — "Tab 'Detalles técnicos' shows historial"** `[E3]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | PDF cargado | — |
| When | Click en tab "Detalles técnicos" | — |
| Then | Shows información del historial de procesamiento | Contenido técnico visible |

**Test 25 — "Button 'Descargar' abre el PDF"** `[E4]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | PDF cargado | — |
| When | Click en button "Descargar" | — |
| Then | Se abre una nueva pestaña con la URL de descarga | `window.open` llamado con URL correcta |

---

#### `raw-text.spec.ts`

> **Precondition:** documento procesado, tab "Texto extraído" activo.

**Test 26 — "Extracted text is shown"** `[F1]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Tab "Texto extraído" activo | — |
| When | Esperar carga | — |
| Then | Texto del documento es visible | Contenido de texto con length > 0 |

**Test 27 — "Searching existing text shows a match"** `[F2]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Texto extraído visible | — |
| When | Escribir una palabra que existe en el texto en el campo de búsqueda | — |
| When | Ejecutar búsqueda | — |
| Then | Aparece mensaje "Coincidencia encontrada." | Texto visible |

**Test 28 — "Buscar texto inexistente shows 'no encontrado'"** `[F3]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Texto extraído visible | — |
| When | Escribir "xyznonexistent999" en campo de búsqueda | — |
| When | Ejecutar búsqueda | — |
| Then | Aparece mensaje "No se encontraron coincidencias." | Texto visible |

**Test 29 — "Copy text to clipboard"** `[F4]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Texto extraído visible | — |
| When | Click en button "Copiar" | — |
| Then | Texto copiado al portapapeles | Verificar via `page.evaluate(() => navigator.clipboard.readText())` |

**Test 30 — "Download extracted text"** `[F5]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Texto extraído visible | — |
| When | Click en button "Descargar" | — |
| Then | Se descarga un archivo de texto | Download event interceptado |

---

#### `structured-filters.spec.ts`

> **Precondition:** documento procesado con campos extraídos visibles.

**Test 31 — "Searching fields by text filters results"** `[I1]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Panel de datos ready con múltiples campos | — |
| When | Escribir "nombre" en el input de búsqueda | — |
| Then | Solo showsn campos cuya clave/label/valor contiene "nombre" | Campos visibles filtrados |

**Test 32 — "Clear search restores all fields"** `[I2]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Búsqueda activa filtrando resultados | — |
| When | Click en button X de limpiar búsqueda | — |
| Then | Todos los campos vuelven a ser visibles | Conteo de campos restaurado |

**Test 33 — "Filter by low confidence"** `[I3]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Panel con campos de distintas confianzas | — |
| When | Click en toggle "Baja" del filtro de confianza | — |
| Then | Solo showsn campos con confianza baja | Campos filtrados |

**Test 34 — "Filter: critical fields only"** `[I6]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Panel con campos críticos y no críticos | — |
| When | Activar toggle "Solo críticos" | — |
| Then | Solo showsn campos marcados como críticos | Campos con CriticalBadge visibles |

**Test 35 — "Filter: with value only / empty only"** `[I7, I8]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Panel con campos con valor y sin valor | — |
| When | Activar toggle "Solo con valor" | Solo campos con valor ≠ "—" visibles |
| When | Desactivar y activar "Solo vacíos" | Solo campos con valor = "—" visibles |

**Test 36 — "Reset filters restores full view"** `[I9, I10]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Filtros activos, pocos campos visibles | — |
| When | Click en "Resetear filtros" | — |
| Then | Todos los campos y secciones vuelven a ser visibles | Vista completa restaurada |

---

#### `field-validation.spec.ts`

> **Precondition:** documento procesado con campos de cada tipo disponibles.

**Test 37 — "Microchip validation rejects invalid format"** `[J5]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Diálogo de edición abierto para campo `microchip_id` | — |
| When | Escribir "abc" (formato inválido) | — |
| Then | Shows mensaje de error de validación | Error visible bajo el input |
| Then | Button "Guardar" está disabled | disabled state |

**Test 38 — "Edit Sex field with dropdown"** `[J3]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Diálogo abierto para campo `sex` | — |
| Then | Shows un `<select>` con opciones canónicas (Macho, Hembra, etc.) | Select visible con opciones |
| When | Seleccionar "Hembra" | — |
| When | Click "Guardar" | — |
| Then | Campo shows "Hembra" en el panel | Valor actualizado |

**Test 39 — "Edit Species field with dropdown"** `[J4]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Diálogo abierto para campo `species` | — |
| Then | Shows un `<select>` con opciones canónicas | Select visible |
| When | Seleccionar una especie y guardar | — |
| Then | Campo actualizado en el panel | Valor visible |

**Test 40 — "Weight validation rejects non-numeric text"** `[J6]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Diálogo abierto para campo `weight` | — |
| When | Escribir "no-es-un-peso" | — |
| Then | Error de validación visible | Error visible |

**Test 41 — "Date validation rejects invalid format"** `[J8]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Diálogo abierto para campo de fecha (`visit_date` o `document_date`) | — |
| When | Escribir "esto-no-es-fecha" | — |
| Then | Error de validación visible | Error visible |

---

#### `source-panel.spec.ts`

> **Precondition:** documento procesado con campos que tienen evidencia (`evidence.page`).

**Test 42 — "Selecting a field navigates the PDF to the evidence page"** `[L1, L6]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Panel de datos ready con campo que tiene evidencia en página 2 | — |
| When | Click en el campo | — |
| Then | El visor hace scroll a la página 2 | Página 2 visible en el viewport |
| Then | La página tiene highlight visual (fondo accent) | Clase CSS de highlight aplicada |

**Test 43 — "Source panel is shown with snippet"** `[L2, L5]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Campo con evidencia seleccionado | — |
| Then | Panel de fuente visible | `[data-testid="source-drawer"]` o `[data-testid="source-pinned-panel"]` visible |
| Then | Shows "Página N" | Texto con número de página |
| Then | Shows el snippet de evidencia | Texto en sección "Evidencia" |

**Test 44 — "Pin and close source panel"** `[L3, L4]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Panel de fuente abierto | — |
| When | Click en "Fijar" | — |
| Then | Panel permanece visible como panel fijado | `[data-testid="source-pinned-panel"]` visible |
| When | Click en button X de cerrar | — |
| Then | Panel se cierra | Panel no visible |

---

#### `sidebar-interactions.spec.ts`

**Test 45 — "Pin/unpin sidebar"** `[B4]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Sidebar expandido | — |
| When | Click en button "Fijar" | — |
| Then | Sidebar queda fijado (permanece expandido sin hover) | `[data-testid="documents-sidebar"]` expanded persistente |
| When | Click en button "Fijada" (desfijar) | — |
| Then | Sidebar vuelve a modo hover | Se colapsa al salir el ratón |

**Test 46 — "Refresh document list"** `[B5]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Sidebar con documentos | — |
| When | Click en button "Actualizar" | — |
| Then | Shows animación de actualización (spinner) | Icono con clase `animate-spin` |
| Then | La lista se actualiza | Lista de documentos re-renderizada |

**Test 47 — "Hover expands collapsed sidebar"** `[B7]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Sidebar en modo hover (no fijado), colapsado | `[data-expanded="false"]` |
| When | Mover ratón sobre el sidebar | — |
| Then | El sidebar se expande | `[data-expanded="true"]` |
| When | Mover ratón fuera del sidebar | — |
| Then | El sidebar se colapsa | `[data-expanded="false"]` |

---

#### `split-panel.spec.ts`

**Test 48 — "Layout shows split grid between viewer and data"** `[M1]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Documento seleccionado | — |
| Then | El split grid es visible | `[data-testid="review-split-grid"]` visible |
| Then | El handle de redimensión es visible | `[data-testid="review-split-handle"]` visible |

**Test 49 — "Double-clicking handle resets ratio"** `[M3]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Split grid con ratio modificado | — |
| When | Doble-click en `[data-testid="review-split-handle"]` | — |
| Then | El ratio vuelve al valor por defecto | Proporción visual restaurada |

---

#### `zoom-advanced.spec.ts`

> **Precondition:** documento con PDF cargado.

**Test 50 — "Ctrl + mouse wheel zooms"** `[D5]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | PDF en zoom 100% | — |
| When | Ctrl + scroll up sobre el contenedor del PDF | — |
| Then | Zoom incrementa | Indicador shows >100% |
| When | Ctrl + scroll down | — |
| Then | Zoom decrementa | Indicador shows <100% (o vuelve a 100%) |

**Test 51 — "Zoom persists in localStorage"** `[D8]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | PDF cargado | — |
| When | Hacer zoom a 130% | — |
| Then | `localStorage.getItem("pdfViewerZoomLevel")` = "1.3" | Valor verificable vía `page.evaluate` |
| When | Recargar la página y volver a cargar el PDF | — |
| Then | El zoom empieza en 130% | Indicador shows "130%" |

---

#### `reprocess.spec.ts`

> **Precondition:** documento procesado (status COMPLETED o FAILED).

**Test 52 — "Reprocessing a document shows confirmation modal"** `[G3]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Documento seleccionado, tab "Detalles técnicos" activo | — |
| When | Click en button "Reintentar" | — |
| Then | Modal de confirmación visible | `[data-testid="reprocess-confirm-modal"]` visible |

**Test 53 — "Confirming reprocessing starts a new processing run"** `[G4, G5]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Modal de confirmación visible | — |
| When | Click en button de confirmar | — |
| Then | Modal se cierra | Modal no visible |
| Then | Toast: "Reprocesamiento iniciado." | Toast visible |
| Then | El status del documento cambia a PROCESSING | Status chip actualizado |

---

#### `visit-grouping.spec.ts`

> **Precondition:** documento procesado con contrato canónico `visit-grouped-canonical` y 2+ visitas.

**Test 54 — "Visit episodes are shown grouped"** `[O1]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Panel de datos ready con visitas | — |
| Then | Al menos un episodio de visita visible | `[data-testid^="visit-episode-"]` visible |
| Then | Los episodios están numerados | Texto "Visita 1", "Visita 2", etc. |

**Test 55 — "Each visit shows its metadata"** `[O2]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Episodio de visita visible | — |
| Then | Shows fecha de visita | Campo `visit_date` con valor visible |
| Then | Shows motivo de consulta (si existe) | Campo `reason_for_visit` visible |

**Test 56 — "Grupo 'sin asignar' visible para campos huérfanos"** `[O4]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Documento con campos sin agrupar en visita | — |
| Then | Shows grupo "sin asignar" | `[data-testid="visit-unassigned-group"]` visible |

---

#### `toasts.spec.ts`

**Test 57 — "Success toast auto-closes"** `[N1]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Action que genera toast de éxito (e.g., marcar revisado) | — |
| Then | Toast visible | — |
| Then | At ~3.5s el toast disappears | Toast no visible (timeout 5s) |

**Test 58 — "Error toast auto-closes more slowly"** `[N2]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Action que genera error (forzar error de red) | — |
| Then | Toast de error visible | — |
| Then | At ~5s el toast disappears | Toast no visible (timeout 7s) |

**Test 59 — "Close toast manually"** `[N4]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Toast visible | — |
| When | Click en button X del toast | — |
| Then | Toast disappears inmediatamente | Toast no visible |

---

#### `add-field.spec.ts`

> **Precondition:** documento procesado, no revisado.

**Test 60 — "Add new field with key and value"** `[J13, J14]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Panel de datos ready | — |
| When | Abrir diálogo "Añadir campo" | — |
| Then | Diálogo visible con inputs para clave y valor | Título "Añadir campo" visible |
| When | Introducir clave "campo_prueba" y valor "valor_prueba" | — |
| When | Click "Guardar" | — |
| Then | Diálogo se cierra | Dialog no visible |
| Then | El campo "campo_prueba" aparece en la sección "Otros datos extraídos" | Campo visible con valor |

**Test 61 — "Editing is blocked on reviewed document"** `[J12]`

| Step | Action | Expected result |
|------|--------|--------------------|
| Given | Documento marcado como revisado | — |
| When | Intentar click en trigger de campo para editar | — |
| Then | Shows aviso de que el documento está revisado | Toast o feedback visible |
| Then | NO se abre el diálogo de edición | Dialog no visible |

---

## 3. Execution Strategy

### On each PR (CI `e2e` job)
```
P0 (smoke) + P1 (core workflows)
```
- Tiempo máximo target: ~3 minutos
- Workers: 1 (para evitar race conditions con backend compartido)
- Retry: 1 intento en CI

### Nightly / pre-release
```
P0 + P1 + P2 (todos)
```
- Tiempo máximo target: ~10 minutos
- Workers: 1
- Retry: 2 intentos

### Technical configuration

```typescript
// playwright.config.ts — proposed structure
const config = {
  projects: [
    {
      name: "smoke",
      testMatch: /app-loads|upload-smoke/,
      timeout: 30_000,
    },
    {
      name: "core",
      testMatch: /pdf-viewer|extracted-data|field-editing|review-workflow|document-sidebar/,
      timeout: 60_000,
    },
    {
      name: "extended",
      testMatch: /.*/,
      timeout: 90_000,
    },
  ],
};
```

### Proposed npm scripts

```json
{
  "test:e2e": "playwright test --project=smoke --project=core",
  "test:e2e:smoke": "playwright test --project=smoke",
  "test:e2e:all": "playwright test --project=extended",
  "test:e2e:ui": "playwright test --ui"
}
```

---

## 4. Required fixtures and helpers

| Fixture/Helper | Purpose |
|----------------|-----------|
| `sample.pdf` | PDF de 2+ páginas para tests de navegación |
| `sample-multifield.pdf` | PDF de veterinaria real para tests de extracción |
| `oversized.pdf` | PDF >20 MB para test de rechazo (generado en setup) |
| `non-pdf.txt` | Archivo no-PDF para test de tipo MIME |
| `uploadAndWaitForProcessing(page, pdfPath)` | Helper: sube PDF, espera procesamiento, devuelve `document_id` |
| `selectDocument(page, documentId)` | Helper: selecciona un documento existente en sidebar |
| `waitForExtractedData(page)` | Helper: espera a que el panel de datos extraídos esté ready |
| `editField(page, fieldKey, newValue)` | Helper: abre diálogo, cambia valor, guarda |

---

## 5. Additional required `data-testid` values

Algunos tests requieren selectores estables que hoy no existen. Listado de `data-testid` a añadir:

| Componente | data-testid propuesto | Needed by |
|------------|----------------------|----------------|
| UploadDropzone (sidebar expanded) | `upload-dropzone` | C1, C3 |
| Toast container | `toast-host` | N1–N5 |
| Toast individua | `toast-{kind}` | N1–N5 |
| Button "Marcar revisado" / "Reabrir" | `review-toggle-button` | K1, K2 |
| Button "Acercar" (zoom in) | `pdf-zoom-in` | D3 |
| Button "Alejar" (zoom out) | `pdf-zoom-out` | D4 |
| Button "Fit to width" | `pdf-zoom-fit` | D6 |
| Button "Página anterior" | `pdf-page-prev` | D10 |
| Button "Página siguiente" | `pdf-page-next` | D11 |
| Indicador nº página | `pdf-page-indicator` | D12 |
| Tab "Documento" | `viewer-tab-document` | E1 |
| Tab "Texto extraído" | `viewer-tab-raw-text` | E2 |
| Tab "Detalles técnicos" | `viewer-tab-technical` | E3 |
| Button "Descargar" | `viewer-download` | E4 |
| Input búsqueda raw text | `raw-text-search-input` | F2, F3 |
| Button copiar raw text | `raw-text-copy` | F4 |
| Button descargar raw text | `raw-text-download` | F5 |
| Modal reprocesar | `reprocess-confirm-modal` | G3, G4 |
| Button confirmar reproceso | `reprocess-confirm-btn` | G4 |
| Campo editable (trigger) | Ya existe: `field-trigger-{id}` | J1 |
| Sección de visita | Ya existe: `visit-episode-{n}` | O1 |

---

## 6. Coverage by layer

```
┌─────────────────────────────────────────────────────┐
│  P0 Smoke (2 tests, 2 spec files)                   │
│  → App loads, Upload básico                         │
├─────────────────────────────────────────────────────┤
│  P1 Core (5 specs, 13 tests)                        │
│  → PDF viewer (6), Datos extraídos (3),             │
│    Edición (3), Revisión (2), Sidebar docs (3)      │
├─────────────────────────────────────────────────────┤
│  P2 Extended (13 specs, 46 tests)                   │
│  → Upload validation (2), Viewer tabs (4),          │
│    Raw text (4), Structured filters (6),            │
│    Field validation (5), Source panel (3),           │
│    Sidebar interactions (3), Split panel (2),       │
│    Zoom advanced (2), Reprocess (2),                │
│    Visit grouping (3), Toasts (3), Add field (2)    │
└─────────────────────────────────────────────────────┘
```

**Total: 61 tests en 20 spec files.**
**Featurees cubiertas: 87 de 87 (100%).**

### Matriz de trazabilidad Test → Feature

| Test # | Spec file | IDs cubiertos |
|--------|-----------|---------------|
| 1 | `app-loads.spec.ts` | A1, A2, A3, A4 |
| 2 | `upload-smoke.spec.ts` | C2, C5, C7, B2 |
| 3–8 | `pdf-viewer.spec.ts` | D1, D3, D4, D6, D7, D9, D10, D11, D12, D13 |
| 9–11 | `document-sidebar.spec.ts` | B1, B2, B3, B6 |
| 12–14 | `extracted-data.spec.ts` | H1, H2, H3, H4, H5, H6, H7 |
| 15–17 | `field-editing.spec.ts` | J1, J2, J9, J10, J15 |
| 18–19 | `review-workflow.spec.ts` | K1, K2, K3, K4, K5 |
| 20–21 | `upload-validation.spec.ts` | C4, C9 |
| 22–25 | `viewer-tabs.spec.ts` | E1, E2, E3, E4 |
| 26–30 | `raw-text.spec.ts` | F1, F2, F3, F4, F5 |
| 31–36 | `structured-filters.spec.ts` | I1, I2, I3, I6, I7, I8, I9, I10 |
| 37–41 | `field-validation.spec.ts` | J3, J4, J5, J6, J8 |
| 42–44 | `source-panel.spec.ts` | L1, L2, L3, L4, L5, L6 |
| 45–47 | `sidebar-interactions.spec.ts` | B4, B5, B7 |
| 48–49 | `split-panel.spec.ts` | M1, M3 |
| 50–51 | `zoom-advanced.spec.ts` | D5, D8 |
| 52–53 | `reprocess.spec.ts` | G3, G4, G5 |
| 54–56 | `visit-grouping.spec.ts` | O1, O2, O4 |
| 57–59 | `toasts.spec.ts` | N1, N2, N4 |
| 60–61 | `add-field.spec.ts` | J12, J13, J14 |

---

## 7. Recommended implementation order

> **Final state (Iteración 12):** 22 spec files, 65 tests. Phases 1–3 completadas.

1. **Phase 1 — Infrastructure** ✅
   - [x] Playwright instalado y configurado
   - [x] `app-loads.spec.ts` (P0)
   - [x] `upload-smoke.spec.ts` (P0)
   - [x] Añadir `data-testid` faltantes (tabla §5) — 17+ testids añadidos en Iter 11, ampliados en Iter 12
   - [x] Crear helpers reutilizables (`uploadAndWaitForProcessing`, etc.) — `e2e/helpers.ts` + `e2e/fixtures.ts`

2. **Phase 2 — Core P1** ✅ (Iteración 11)
   - [x] `pdf-viewer.spec.ts` (6 tests)
   - [x] `extracted-data.spec.ts` (3 tests)
   - [x] `field-editing.spec.ts` (3 tests)
   - [x] `review-workflow.spec.ts` (2 tests)
   - [x] `document-sidebar.spec.ts` (3 tests)

3. **Phase 3 — Extended P2** ✅ (Iteración 12, F19-A → F19-E)
   - [x] Bloque Viewer: `viewer-tabs` (4), `raw-text` (5), `zoom-advanced` (2) — F19-A
   - [x] Bloque Data: `structured-filters` (6), `field-validation` (5), `add-field` (2) — F19-B
   - [x] Bloque Workflow: `reprocess` (2), `toasts` (3) — F19-C
   - [x] Bloque Layout: `source-panel` (3), `split-panel` (2), `sidebar-interactions` (3) — F19-D
   - [x] Bloque Avanzado: `visit-grouping` (3), `upload-validation` (2) — F19-E

4. **Phase 4 — Accessibility** ✅ (Iteración 12, F19-I + F19-J)
   - [x] `accessibility.spec.ts` (3 tests) — axe-core WCAG 2.1 AA audit
   - [x] aria-labels, focus management, color contrast fixes

---

## How to test

```bash
# Verificar que los tests P0 existentes siguen verdes:
$env:FRONTEND_PORT='80'; docker compose up -d --build --wait
cd frontend
npm run test:e2e
```

---

## Notes

- All UI labels are in Spanish (selectors must use `data-testid`, not visible text).
- El backend tiene polling (~1.5s) para documentos en procesamiento. Los tests deben wait con `expect().toBeVisible({ timeout })` razonables, no con `waitForTimeout`.
- Editing operations are backend mutations (POST to `/runs/{id}/interpretations`), so each test must be idempotent or clean up its state.

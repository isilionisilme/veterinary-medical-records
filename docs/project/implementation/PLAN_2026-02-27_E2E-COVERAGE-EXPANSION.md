# Plan: E2E Coverage Expansion — from 5 to 61 tests

> **Operational rules:** See [EXECUTION_RULES.md](EXECUTION_RULES.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Rama:** `improvement/e2e-coverage-expansion`
**PR:** TBD (single PR → `main`)
**Prerequisito:** Iteration 9 (E2E baseline) merged to `main`.

## Context

Post-Iter 9: 5 E2E specs exist (app-loads, upload-smoke, review-flow, edit-flow, mark-reviewed) covering ~12 of 87 identified functionalities. The full test coverage plan at [`docs/project/testing/PLAN_E2E_TEST_COVERAGE.md`](../testing/PLAN_E2E_TEST_COVERAGE.md) defines 61 tests across 20 spec files covering 100% of user-visible functionalities.

**Entry metrics:** 5 E2E tests, 372+ backend tests (90%), 263+ frontend tests (85%), 0 lint errors.
**Exit metrics target:** 61 E2E tests, 20 spec files, 87/87 functionalities covered, smoke+core < 3 min, full suite < 10 min.

### Current E2E state

| Spec file | Tests | Plan IDs covered |
|-----------|-------|------------------|
| `app-loads.spec.ts` | 1 | A1, A2, A3 (partial — missing A4) |
| `upload-smoke.spec.ts` | 1 | C2, C5 (partial), B2 |
| `review-flow.spec.ts` | 1 | D1, B2 (partial) |
| `edit-flow.spec.ts` | 1 | J1, J2, J9 (mock routes) |
| `mark-reviewed.spec.ts` | 1 | K1, K2 (mock routes) |

### Missing `data-testid` attributes (17)

| File | testids to add |
|------|---------------|
| `src/components/PdfViewer.tsx` | `pdf-zoom-in`, `pdf-zoom-out`, `pdf-zoom-fit`, `pdf-page-prev`, `pdf-page-next`, `pdf-page-indicator` |
| `src/components/viewer/viewerToolbarContent.tsx` | `viewer-tab-document`, `viewer-tab-raw-text`, `viewer-tab-technical`, `viewer-download` |
| `src/components/workspace/PdfViewerPanel.tsx` | `raw-text-search-input`, `raw-text-copy`, `raw-text-download`, `reprocess-confirm-modal`, `reprocess-confirm-btn` |
| `src/components/toast/ToastHost.tsx` | `toast-host`, `toast-success`, `toast-error`, `toast-connectivity` |

### Mocking strategy

- **Backend real:** P0 smoke tests, upload flows, PDF rendering, processing waits
- **Mock routes:** Field editing, review workflow, validations, filters (UI logic, not backend)
- **Rationale:** matches patterns established in Iter 9 (`upload-smoke` → real; `edit-flow` → mocked)

---

## Estado de ejecución — update on completion of each step

> **Protocolo "Continúa":** open a new chat, select the correct agent, attach this file and write `Continúa`. The agent reads the state, executes the next step, and stops on completion.

**Automation legend:**
- 🔄 **auto-chain** — Codex executes alone; you review the result *afterwards*.
- 🚧 **hard-gate** — Requires your decision before continuing. Do not skip.

### Fase 17 — E2E Coverage Expansion

#### Phase 0 — Infrastructure prerequisites

- [ ] F17-A 🔄 — Add 17 missing `data-testid` attributes to UI components (Codex)
- [ ] F17-B 🔄 — Update `playwright.config.ts` with smoke/core/extended projects (Codex)
- [ ] F17-C 🔄 — Add npm scripts: `test:e2e:smoke`, `test:e2e:all` (Codex)
- [ ] F17-D 🔄 — Create reusable E2E helpers (`e2e/helpers.ts`) + fixture files (Codex)
- [ ] F17-E 🔄 — Verify green baseline: existing 5 tests pass (Codex)

#### Phase 1 — Align P0 smoke tests

- [ ] F17-F 🔄 — Refine `app-loads.spec.ts`: add `viewer-empty-state` assertion [A4] (Codex)

#### Phase 2 — Core P1 (5 spec files, 13 tests)

- [ ] F17-G 🔄 — Implement `pdf-viewer.spec.ts`: Tests 3–8 [D1,D3,D4,D6,D7,D9,D10–D13] (Codex)
- [ ] F17-H 🔄 — Implement `document-sidebar.spec.ts`: Tests 9–11 [B1,B2,B3,B6] (Codex)
- [ ] F17-I 🔄 — Implement `extracted-data.spec.ts`: Tests 12–14 [H1–H5,H7] (Codex)
- [ ] F17-J 🔄 — Refactor `edit-flow.spec.ts` → `field-editing.spec.ts`: Tests 15–17 [J1,J2,J9,J10,J15] (Codex)
- [ ] F17-K 🔄 — Refactor `mark-reviewed.spec.ts` → `review-workflow.spec.ts`: Tests 18–19 [K1–K5] (Codex)

#### Phase 3 — Extended P2 (13 spec files, 46 tests)

- [ ] F17-L 🔄 — Bloque Viewer: `viewer-tabs.spec.ts` (Tests 22–25), `raw-text.spec.ts` (Tests 26–30), `zoom-advanced.spec.ts` (Tests 50–51) — 10 tests (Codex)
- [ ] F17-M 🔄 — Bloque Data: `structured-filters.spec.ts` (Tests 31–36), `field-validation.spec.ts` (Tests 37–41), `add-field.spec.ts` (Tests 60–61) — 13 tests (Codex)
- [ ] F17-N 🔄 — Bloque Workflow: `reprocess.spec.ts` (Tests 52–53), `toasts.spec.ts` (Tests 57–59) — 5 tests (Codex)
- [ ] F17-O 🔄 — Bloque Layout: `source-panel.spec.ts` (Tests 42–44), `split-panel.spec.ts` (Tests 48–49), `sidebar-interactions.spec.ts` (Tests 45–47) — 8 tests (Codex)
- [ ] F17-P 🔄 — Bloque Avanzado: `visit-grouping.spec.ts` (Tests 54–56), `upload-validation.spec.ts` (Tests 20–21) — 5 tests (Codex)

#### Phase 4 — Validation & cleanup

- [ ] F17-Q 🔄 — Run full suite in Docker, verify 61 tests green (Codex)
- [ ] F17-R 🔄 — Remove legacy spec files (`review-flow.spec.ts`) absorbed by new specs (Codex)
- [ ] F17-S 🚧 — Update `PLAN_E2E_TEST_COVERAGE.md` §7 checkboxes + metrics (Claude)

---

## Cola de prompts

> Pre-written prompts for semi-unattended execution. Codex reads these directly.

---

### F17-A — Add missing `data-testid` attributes

**Paso objetivo:** Add 17 `data-testid` attributes to 4 component files so E2E tests have stable selectors.

**Prompt:**

**SCOPE BOUNDARY — F17-A**

**Branch:** `improvement/e2e-coverage-expansion` (create from `main` if it doesn't exist).

**Objective:** Add the following `data-testid` attributes. These are purely HTML attributes — no logic changes.

**Changes required:**

1. **`frontend/src/components/PdfViewer.tsx`** — In the toolbar section (~L800-870):
   - `data-testid="pdf-zoom-out"` on the `<IconButton label="Alejar" …>` (~L809)
   - `data-testid="pdf-zoom-in"` on the `<IconButton label="Acercar" …>` (~L828)
   - `data-testid="pdf-zoom-fit"` on the `<IconButton label="Ajustar al ancho" …>` (~L837)
   - `data-testid="pdf-page-prev"` on the `<IconButton label="Página anterior" …>` (~L851)
   - `data-testid="pdf-page-indicator"` on the `<p>` showing `{pageNumber}/{totalPages}` (~L858)
   - `data-testid="pdf-page-next"` on the `<IconButton label="Página siguiente" …>` (~L860)

2. **`frontend/src/components/viewer/viewerToolbarContent.tsx`** — On each toolbar button:
   - `data-testid="viewer-tab-document"` on the `<IconButton label="Documento" …>` (~L22)
   - `data-testid="viewer-tab-raw-text"` on the `<IconButton label="Texto extraído" …>` (~L36)
   - `data-testid="viewer-tab-technical"` on the `<IconButton label="Detalles técnicos" …>` (~L50)
   - `data-testid="viewer-download"` on the `<IconButton label="Descargar" …>` (~L70)

3. **`frontend/src/components/workspace/PdfViewerPanel.tsx`** — In the raw-text and reprocess sections:
   - `data-testid="raw-text-search-input"` on the `<input placeholder="Buscar en el texto" …>` (~L318)
   - `data-testid="raw-text-copy"` on the "Copiar todo" `<Button>` (~L332)
   - `data-testid="raw-text-download"` on the "Descargar texto (.txt)" `<Button>` (~L341)
   - `data-testid="reprocess-confirm-modal"` on the `<DialogContent>` of the reprocess dialog (~L517)
   - `data-testid="reprocess-confirm-btn"` on the "Reprocesar" `<Button>` inside the confirm dialog (~L528)

4. **`frontend/src/components/toast/ToastHost.tsx`** — On the toast containers:
   - `data-testid="toast-host"` on the outermost wrapper (replace fragment with a div if needed)
   - `data-testid="toast-connectivity"` on the connectivity toast container (~L64)
   - `data-testid="toast-success"` / `data-testid="toast-error"` on the action/upload toast containers (~L85, ~L130) — add `data-testid={`toast-${kind}`}` using the `kind` variable if available

**Validation:**
- `cd frontend && npm test` → all unit tests pass
- `cd frontend && npx tsc --noEmit` → no type errors

**Commit:** `feat(plan-f17a): add 17 data-testid attributes for E2E coverage expansion`

**Post-push:** Create draft PR:
```bash
gh pr create --draft --base main \
  --title "feat: E2E coverage expansion — 61 tests across 20 spec files" \
  --body "Tracking: PLAN_2026-02-27_E2E-COVERAGE-EXPANSION.md

## Progress
- [x] F17-A — data-testid attributes (17 new)
- [ ] F17-B — Playwright config projects
- [ ] F17-C — npm scripts
- [ ] F17-D — Reusable helpers + fixtures
- [ ] F17-E — Green baseline verification
- [ ] F17-F — Refine P0 smoke tests
- [ ] F17-G — pdf-viewer.spec.ts (6 tests)
- [ ] F17-H — document-sidebar.spec.ts (3 tests)
- [ ] F17-I — extracted-data.spec.ts (3 tests)
- [ ] F17-J — field-editing.spec.ts (3 tests)
- [ ] F17-K — review-workflow.spec.ts (2 tests)
- [ ] F17-L — Viewer block (10 tests)
- [ ] F17-M — Data block (13 tests)
- [ ] F17-N — Workflow block (5 tests)
- [ ] F17-O — Layout block (8 tests)
- [ ] F17-P — Advanced block (5 tests)
- [ ] F17-Q — Full validation (61 green)
- [ ] F17-R — Legacy cleanup
- [ ] F17-S — Plan update + metrics"
```

⚠️ AUTO-CHAIN → F17-B

---

### F17-B — Update Playwright config with projects

**Paso objetivo:** Add smoke/core/extended projects to Playwright config for tiered test execution.

**Prompt:**

**SCOPE BOUNDARY — F17-B**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Update `frontend/playwright.config.ts` to define three test projects.

**Changes required:**

Replace the current `projects` array with:

```typescript
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
```

Keep all existing `use` settings (baseURL, headless, trace, screenshot, video). Remove the old `chromium` project.

**Validation:**
- `cd frontend && npx playwright test --list` → shows projects
- `cd frontend && npx playwright test --project=smoke --list` → lists only smoke specs

**Commit:** `feat(plan-f17b): add smoke/core/extended projects to Playwright config`

⚠️ AUTO-CHAIN → F17-C

---

### F17-C — Add npm scripts

**Paso objetivo:** Add tiered E2E run scripts to `package.json`.

**Prompt:**

**SCOPE BOUNDARY — F17-C**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Update `frontend/package.json` scripts to support tiered E2E execution.

**Changes required:**

Replace the existing `test:e2e*` scripts with:

```json
"test:e2e": "playwright test --project=smoke --project=core",
"test:e2e:smoke": "playwright test --project=smoke",
"test:e2e:all": "playwright test --project=extended",
"test:e2e:headed": "playwright test --headed",
"test:e2e:ui": "playwright test --ui"
```

**Validation:**
- `cd frontend && npm run test:e2e:smoke -- --list` → lists smoke tests only

**Commit:** `feat(plan-f17c): add tiered E2E npm scripts`

⚠️ AUTO-CHAIN → F17-D

---

### F17-D — Create reusable E2E helpers + fixtures

**Paso objetivo:** Create shared helpers and fixture files used by multiple spec files.

**Prompt:**

**SCOPE BOUNDARY — F17-D**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Create `frontend/e2e/helpers.ts` with reusable E2E functions, and add missing fixture files.

**Changes required:**

1. **Create `frontend/e2e/helpers.ts`** with these exported functions:

```typescript
import fs from "node:fs";
import { type Page, expect } from "@playwright/test";

/**
 * Upload a PDF and wait for it to appear in the sidebar.
 * Returns the document_id from the upload response.
 */
export async function uploadAndWaitForProcessing(
  page: Page,
  pdfPath = "e2e/fixtures/sample.pdf",
  options: { timeout?: number } = {},
): Promise<string> {
  const timeout = options.timeout ?? 90_000;
  const pdfBuffer = fs.readFileSync(pdfPath);
  let docId: string | null = null;

  await page.route("**/documents/upload", async (route) => {
    const response = await route.fetch();
    const json = (await response.json()) as { document_id?: string };
    docId = json.document_id ?? null;
    await route.fulfill({ response });
  });

  await page.getByLabel("Archivo PDF").setInputFiles({
    name: pdfPath.split("/").pop() ?? "sample.pdf",
    mimeType: "application/pdf",
    buffer: pdfBuffer,
  });

  await expect.poll(() => docId, { timeout }).not.toBeNull();
  const row = page.getByTestId(`doc-row-${docId}`);
  await expect(row).toBeVisible({ timeout });

  return docId!;
}

/**
 * Select a document in the sidebar and wait for the review split grid.
 */
export async function selectDocument(page: Page, documentId: string): Promise<void> {
  const row = page.getByTestId(`doc-row-${documentId}`);
  await row.click();
  await expect(page.getByTestId("review-split-grid")).toBeVisible({ timeout: 30_000 });
}

/**
 * Wait for the structured data panel to be ready.
 */
export async function waitForExtractedData(page: Page): Promise<void> {
  await expect(page.getByTestId("structured-column-stack")).toBeVisible({ timeout: 60_000 });
}

/**
 * Open field edit dialog, change value, save.
 */
export async function editField(page: Page, fieldKey: string, newValue: string): Promise<void> {
  await page.getByTestId(`field-edit-btn-${fieldKey}`).click();
  await expect(page.getByTestId("field-edit-dialog")).toBeVisible();
  const input = page.getByTestId("field-edit-input");
  await input.clear();
  await input.fill(newValue);
  await page.getByTestId("field-edit-save").click();
  await expect(page.getByTestId("field-edit-dialog")).not.toBeVisible();
}

/**
 * Pin the sidebar so it stays expanded.
 */
export async function pinSidebar(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("docsSidebarPinned", "1");
  });
}

/**
 * Build a mock review payload for route interception.
 */
export function buildMockReviewPayload(
  documentId: string,
  overrides: {
    reviewStatus?: "IN_REVIEW" | "REVIEWED";
    fields?: Array<Record<string, unknown>>;
    versionNumber?: number;
  } = {},
) {
  return {
    document_id: documentId,
    latest_completed_run: {
      run_id: `run-e2e-${documentId}`,
      state: "COMPLETED",
      completed_at: "2026-02-27T10:00:00Z",
      failure_type: null,
    },
    active_interpretation: {
      interpretation_id: `interp-e2e-${documentId}`,
      version_number: overrides.versionNumber ?? 1,
      data: {
        document_id: documentId,
        processing_run_id: `run-e2e-${documentId}`,
        created_at: "2026-02-27T10:00:00Z",
        fields: overrides.fields ?? [
          {
            field_id: "field-pet-name",
            key: "pet_name",
            value: "Luna",
            value_type: "string",
            field_candidate_confidence: 0.91,
            field_mapping_confidence: 0.91,
            is_critical: false,
            origin: "machine",
          },
          {
            field_id: "field-species",
            key: "species",
            value: "canino",
            value_type: "string",
            field_candidate_confidence: 0.95,
            field_mapping_confidence: 0.95,
            is_critical: false,
            origin: "machine",
          },
        ],
        confidence_policy: {
          policy_version: "v1",
          band_cutoffs: { low_max: 0.5, mid_max: 0.75 },
        },
      },
    },
    raw_text_artifact: {
      run_id: `run-e2e-${documentId}`,
      available: true,
    },
    review_status: overrides.reviewStatus ?? "IN_REVIEW",
    reviewed_at: null,
    reviewed_by: null,
  };
}

/**
 * Build a mock document payload for route interception.
 */
export function buildMockDocumentPayload(
  documentId: string,
  overrides: {
    status?: string;
    reviewStatus?: string;
    filename?: string;
  } = {},
) {
  return {
    document_id: documentId,
    original_filename: overrides.filename ?? "sample.pdf",
    content_type: "application/pdf",
    file_size: 1024,
    created_at: "2026-02-27T10:00:00Z",
    updated_at: "2026-02-27T10:05:00Z",
    status: overrides.status ?? "COMPLETED",
    status_message: "Completado",
    failure_type: null,
    review_status: overrides.reviewStatus ?? "IN_REVIEW",
    reviewed_at: null,
    reviewed_by: null,
    latest_run: {
      run_id: `run-e2e-${documentId}`,
      state: "COMPLETED",
      failure_type: null,
    },
  };
}
```

2. **Create `frontend/e2e/fixtures/non-pdf.txt`** with content: `This is not a PDF file.`

3. **Verify `frontend/e2e/fixtures/sample.pdf`** already exists (it does, 620 bytes).

**Validation:**
- `cd frontend && npx tsc --noEmit` on the newly created file (or verify no import errors)

**Commit:** `feat(plan-f17d): create reusable E2E helpers and fixture files`

⚠️ AUTO-CHAIN → F17-E

---

### F17-E — Green baseline verification

**Paso objetivo:** Run existing 5 E2E tests and confirm they all pass.

**Prompt:**

**SCOPE BOUNDARY — F17-E**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Start the Docker stack and run existing E2E tests to confirm green baseline before adding new tests.

**Steps:**
1. `docker compose up -d --build --wait`
2. `cd frontend && npm run test:e2e:smoke` → both smoke tests pass
3. `cd frontend && npm run test:e2e` → all smoke + core tests pass (at this point, core project has no new tests yet, so it should match just existing files)

**If tests fail:** Fix the failure before proceeding. Do not add new tests on a red baseline.

**Commit:** no code changes expected (verification only). If config tweaks are needed, commit as `fix(plan-f17e): fix baseline E2E test issues`.

⚠️ AUTO-CHAIN → F17-F

---

### F17-F — Refine P0 smoke: `app-loads.spec.ts`

**Paso objetivo:** Add missing `viewer-empty-state` assertion to align with Plan Test 1.

**Prompt:**

**SCOPE BOUNDARY — F17-F**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Add one assertion to `frontend/e2e/app-loads.spec.ts` to verify the empty state message is visible when no document is selected [A4].

**Changes required:**

In `app-loads.spec.ts`, after the existing assertions, add:
```typescript
await expect(
  page.getByTestId("viewer-empty-state").or(page.getByText("Selecciona un documento"))
).toBeVisible();
```

**Validation:**
- `cd frontend && npm run test:e2e:smoke` → passes

**Commit:** `feat(plan-f17f): add viewer-empty-state assertion to smoke test`

⚠️ AUTO-CHAIN → F17-G

---

### F17-G — `pdf-viewer.spec.ts` (Tests 3–8)

**Paso objetivo:** Implement 6 PDF viewer tests covering rendering, zoom, and page navigation.

**Prompt:**

**SCOPE BOUNDARY — F17-G**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Create `frontend/e2e/pdf-viewer.spec.ts` with 6 tests. This uses the real backend — upload a PDF and interact with the viewer.

**Pre-flight:**
- Import helpers from `./helpers` (`uploadAndWaitForProcessing`, `selectDocument`, `pinSidebar`)
- Use `test.describe` to group tests under shared precondition (upload + select document)
- `sample.pdf` is 1 page. PDF navigation tests (Test 8) will only be meaningful if the PDF has 2+ pages. If `sample.pdf` has 1 page, skip the page navigation assertions or create a multi-page fixture.

**Tests to implement (reference: PLAN_E2E_TEST_COVERAGE.md §2):**
- Test 3: PDF renders in viewer — `pdf-page` count ≥ 1, `pdf-toolbar-shell` visible
- Test 4: Zoom In → indicator shows 110%
- Test 5: Zoom Out → indicator shows 90%
- Test 6: Fit to width resets zoom to 100%
- Test 7: Zoom buttons disabled at limits (50% / 200%)
- Test 8: Page navigation (prev/next, indicator, disabled at extremes) — skip if 1-page PDF

**Validation:**
- `cd frontend && npm run test:e2e` → includes these new tests (core project)

**Commit:** `feat(plan-f17g): add pdf-viewer E2E tests (6 tests)`

⚠️ AUTO-CHAIN → F17-H

---

### F17-H — `document-sidebar.spec.ts` (Tests 9–11)

**Paso objetivo:** Implement 3 sidebar tests covering document groups, selection, and status chips.

**Prompt:**

**SCOPE BOUNDARY — F17-H**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Create `frontend/e2e/document-sidebar.spec.ts` with 3 tests.

**Tests to implement:**
- Test 9: Document list shows groups "Para revisar" / "Revisados"
- Test 10: Selecting a document marks it active (`aria-pressed`, `aria-current`, PDF loads)
- Test 11: Each document shows its status chip

**Commit:** `feat(plan-f17h): add document-sidebar E2E tests (3 tests)`

⚠️ AUTO-CHAIN → F17-I

---

### F17-I — `extracted-data.spec.ts` (Tests 12–14)

**Paso objetivo:** Implement 3 tests for the structured data panel.

**Prompt:**

**SCOPE BOUNDARY — F17-I**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Create `frontend/e2e/extracted-data.spec.ts` with 3 tests. Uses real backend — upload PDF, wait for processing to complete.

**Tests to implement:**
- Test 12: Panel shows sections with headers ("Datos extraídos", section titles)
- Test 13: Fields show formatted values; missing fields show "—"
- Test 14: Confidence indicators visible; field count summary in toolbar

**Commit:** `feat(plan-f17i): add extracted-data E2E tests (3 tests)`

⚠️ AUTO-CHAIN → F17-J

---

### F17-J — Refactor `edit-flow.spec.ts` → `field-editing.spec.ts` (Tests 15–17)

**Paso objetivo:** Refactor existing edit-flow into 3 separate tests aligned to the plan.

**Prompt:**

**SCOPE BOUNDARY — F17-J**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Rename `frontend/e2e/edit-flow.spec.ts` to `frontend/e2e/field-editing.spec.ts`. Split the single test into 3 focused tests using shared setup. Import `buildMockReviewPayload` and `buildMockDocumentPayload` from helpers.

**Tests to implement:**
- Test 15: Click on field opens edit dialog (verify dialog title, input pre-populated)
- Test 16: Edit value + save → dialog closes, value updated, toast shown
- Test 17: Cancel edit → dialog closes, value unchanged

**Commit:** `feat(plan-f17j): refactor edit-flow into field-editing spec (3 tests)`

⚠️ AUTO-CHAIN → F17-K

---

### F17-K — Refactor `mark-reviewed.spec.ts` → `review-workflow.spec.ts` (Tests 18–19)

**Paso objetivo:** Refactor existing mark-reviewed into 2 focused tests.

**Prompt:**

**SCOPE BOUNDARY — F17-K**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Rename `frontend/e2e/mark-reviewed.spec.ts` to `frontend/e2e/review-workflow.spec.ts`. Split into 2 tests.

**Tests to implement:**
- Test 18: Mark as reviewed → button changes to "Reabrir", document moves to "Revisados" group
- Test 19: Reopen → button changes to "Marcar revisado", document moves to "Para revisar" group

**Commit:** `feat(plan-f17k): refactor mark-reviewed into review-workflow spec (2 tests)`

⚠️ AUTO-CHAIN → F17-L

---

### F17-L — Bloque Viewer: `viewer-tabs`, `raw-text`, `zoom-advanced` (10 tests)

**Paso objetivo:** Implement 3 spec files for viewer tab switching, raw text features, and advanced zoom.

**Prompt:**

**SCOPE BOUNDARY — F17-L**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Create three spec files:

1. **`frontend/e2e/viewer-tabs.spec.ts`** — Tests 22–25:
   - Test 22: Tab "Documento" shows PDF (default active)
   - Test 23: Tab "Texto extraído" shows raw text
   - Test 24: Tab "Detalles técnicos" shows processing history
   - Test 25: "Descargar" button opens PDF in new tab

2. **`frontend/e2e/raw-text.spec.ts`** — Tests 26–30:
   - Test 26: Extracted text is visible
   - Test 27: Search existing text → "Coincidencia encontrada"
   - Test 28: Search nonexistent → "No se encontraron coincidencias"
   - Test 29: Copy to clipboard
   - Test 30: Download text file

3. **`frontend/e2e/zoom-advanced.spec.ts`** — Tests 50–51:
   - Test 50: Ctrl + scroll wheel zooms in/out
   - Test 51: Zoom persists in localStorage across reload

**Commit:** `feat(plan-f17l): add viewer-tabs, raw-text, zoom-advanced E2E tests (10 tests)`

⚠️ AUTO-CHAIN → F17-M

---

### F17-M — Bloque Data: `structured-filters`, `field-validation`, `add-field` (13 tests)

**Paso objetivo:** Implement 3 spec files for structured data filtering, field validation, and adding fields.

**Prompt:**

**SCOPE BOUNDARY — F17-M**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Create three spec files using mock routes for deterministic data:

1. **`frontend/e2e/structured-filters.spec.ts`** — Tests 31–36:
   - Test 31: Search by text filters results
   - Test 32: Clear search restores all fields
   - Test 33: Filter by low confidence
   - Test 34: Filter critical only
   - Test 35: Filter "with value" / "empty only"
   - Test 36: Reset filters restores full view

2. **`frontend/e2e/field-validation.spec.ts`** — Tests 37–41:
   - Test 37: Microchip invalid format → validation error
   - Test 38: Sex dropdown with canonical options
   - Test 39: Species dropdown with canonical options
   - Test 40: Weight rejects non-numeric
   - Test 41: Date rejects invalid format

3. **`frontend/e2e/add-field.spec.ts`** — Tests 60–61:
   - Test 60: Add new field with key + value
   - Test 61: Editing blocked on reviewed document → shows toast

**Commit:** `feat(plan-f17m): add structured-filters, field-validation, add-field E2E tests (13 tests)`

⚠️ AUTO-CHAIN → F17-N

---

### F17-N — Bloque Workflow: `reprocess`, `toasts` (5 tests)

**Paso objetivo:** Implement 2 spec files for reprocessing and toast behavior.

**Prompt:**

**SCOPE BOUNDARY — F17-N**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Create two spec files:

1. **`frontend/e2e/reprocess.spec.ts`** — Tests 52–53:
   - Test 52: Reprocess button shows confirmation modal
   - Test 53: Confirm reprocess → toast, status changes to PROCESSING

2. **`frontend/e2e/toasts.spec.ts`** — Tests 57–59:
   - Test 57: Success toast auto-closes (~3.5s)
   - Test 58: Error toast auto-closes slower (~5s)
   - Test 59: Manual close toast via X button

**Commit:** `feat(plan-f17n): add reprocess and toasts E2E tests (5 tests)`

⚠️ AUTO-CHAIN → F17-O

---

### F17-O — Bloque Layout: `source-panel`, `split-panel`, `sidebar-interactions` (8 tests)

**Paso objetivo:** Implement 3 spec files for source evidence panel, split layout, and sidebar interactions.

**Prompt:**

**SCOPE BOUNDARY — F17-O**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Create three spec files:

1. **`frontend/e2e/source-panel.spec.ts`** — Tests 42–44:
   - Test 42: Selecting field navigates PDF to evidence page
   - Test 43: Source panel shows page number + snippet
   - Test 44: Pin and close source panel

2. **`frontend/e2e/split-panel.spec.ts`** — Tests 48–49:
   - Test 48: Split grid visible with handle
   - Test 49: Double-click handle resets ratio

3. **`frontend/e2e/sidebar-interactions.spec.ts`** — Tests 45–47:
   - Test 45: Pin/unpin sidebar
   - Test 46: Refresh document list
   - Test 47: Hover expands collapsed sidebar

**Commit:** `feat(plan-f17o): add source-panel, split-panel, sidebar-interactions E2E tests (8 tests)`

⚠️ AUTO-CHAIN → F17-P

---

### F17-P — Bloque Avanzado: `visit-grouping`, `upload-validation` (5 tests)

**Paso objetivo:** Implement 2 spec files for visit episode grouping and upload validation edge cases.

**Prompt:**

**SCOPE BOUNDARY — F17-P**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Create two spec files:

1. **`frontend/e2e/visit-grouping.spec.ts`** — Tests 54–56 (mock routes with multi-visit payload):
   - Test 54: Visit episodes grouped and numbered
   - Test 55: Each visit shows metadata (date, reason)
   - Test 56: Unassigned group visible for orphan fields

2. **`frontend/e2e/upload-validation.spec.ts`** — Tests 20–21:
   - Test 20: Non-PDF file rejected → error toast
   - Test 21: Drag & drop on viewer triggers upload overlay

**Commit:** `feat(plan-f17p): add visit-grouping and upload-validation E2E tests (5 tests)`

⚠️ AUTO-CHAIN → F17-Q

---

### F17-Q — Full validation

**Paso objetivo:** Run the complete test suite and verify all 61 tests pass within time budgets.

**Prompt:**

**SCOPE BOUNDARY — F17-Q**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** End-to-end validation of the full test suite.

**Steps:**
1. `docker compose up -d --build --wait`
2. `cd frontend && npm run test:e2e:all` → 61 tests pass
3. Measure total time: target < 10 minutes
4. Run again to check for flakiness
5. If any test fails, fix it. If flaky, add appropriate waits or retry logic.

**Commit:** `fix(plan-f17q): stabilize E2E suite` (only if fixes needed)

⚠️ AUTO-CHAIN → F17-R

---

### F17-R — Legacy cleanup

**Paso objetivo:** Remove spec files superseded by the new structured tests.

**Prompt:**

**SCOPE BOUNDARY — F17-R**

**Branch:** `improvement/e2e-coverage-expansion` (already exists).

**Objective:** Delete legacy spec files that have been superseded:

- `frontend/e2e/review-flow.spec.ts` → absorbed by `pdf-viewer.spec.ts` + `document-sidebar.spec.ts`
- `frontend/e2e/edit-flow.spec.ts` → replaced by `field-editing.spec.ts` (if renamed in F17-J)
- `frontend/e2e/mark-reviewed.spec.ts` → replaced by `review-workflow.spec.ts` (if renamed in F17-K)

**Validation:**
- `cd frontend && npm run test:e2e:all` → still 61 tests (no fewer, no duplicates)

**Commit:** `chore(plan-f17r): remove legacy E2E specs superseded by coverage expansion`

⚠️ STOP → F17-S requires Claude

---

### F17-S — Update plan + metrics (Claude)

**Paso objetivo:** Update documentation with final metrics and close the iteration.

**Steps:**
1. Update `PLAN_E2E_TEST_COVERAGE.md` §7 checkboxes
2. Update this plan's Estado de ejecución
3. Record in `IMPLEMENTATION_HISTORY.md`
4. Move this plan to `completed/`

---

## Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `sample.pdf` has only 1 page → nav tests fail | High | Verify in F17-E; create 2-page fixture if needed |
| Backend processing >60s → timeouts in CI | Medium | `test.setTimeout(90_000)` for real-backend tests |
| Race conditions with shared backend | Medium | Workers: 1 (configured); each test uploads own doc |
| Mock routes diverge from real API | Medium | Extract payloads to helpers; validate vs `global_schema_contract.json` |
| Drag & drop tests flaky cross-browser | Low | Chromium only; use Playwright's `locator.dispatchEvent` |

---

## How to test

```bash
# After each step:
$env:FRONTEND_PORT='80'; docker compose up -d --build --wait
cd frontend
npm run test:e2e:smoke    # Phase 0-1: smoke (2 tests)
npm run test:e2e          # Phase 2: smoke + core (15 tests)
npm run test:e2e:all      # Phase 3+: full suite (61 tests)
```

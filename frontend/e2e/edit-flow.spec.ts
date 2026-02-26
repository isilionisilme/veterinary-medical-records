import fs from "node:fs";
import { expect, test } from "@playwright/test";

test("editing a field updates value and persists after reload", async ({ page }) => {
  test.setTimeout(90_000);
  const pdfBuffer = fs.readFileSync("e2e/fixtures/sample.pdf");
  let docId: string | null = null;
  let speciesValue = "canino";
  let versionNumber = 1;
  let capturedEditPayload: unknown = null;

  const buildReviewPayload = (documentId: string) => ({
    document_id: documentId,
    latest_completed_run: {
      run_id: "run-e2e-edit",
      state: "COMPLETED",
      completed_at: "2026-02-26T10:00:00Z",
      failure_type: null,
    },
    active_interpretation: {
      interpretation_id: "interp-e2e-edit",
      version_number: versionNumber,
      data: {
        document_id: documentId,
        processing_run_id: "run-e2e-edit",
        created_at: "2026-02-26T10:00:00Z",
        fields: [
          {
            field_id: "field-species-e2e",
            key: "species",
            value: speciesValue,
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
      run_id: "run-e2e-edit",
      available: true,
    },
    review_status: "IN_REVIEW",
    reviewed_at: null,
    reviewed_by: null,
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("docsSidebarPinned", "1");
  });

  await page.route("**/documents/upload", async (route) => {
    const response = await route.fetch();
    const json = (await response.json()) as { document_id?: string };
    docId = json.document_id ?? null;
    await route.fulfill({ response });
  });

  await page.route("**/documents/*/review", async (route) => {
    const currentDocId = docId;
    if (!currentDocId) {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    if (url.pathname === `/documents/${currentDocId}/review`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildReviewPayload(currentDocId)),
      });
      return;
    }
    await route.fallback();
  });

  await page.route("**/documents/*", async (route) => {
    const currentDocId = docId;
    if (!currentDocId || route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    if (url.pathname === `/documents/${currentDocId}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          document_id: currentDocId,
          original_filename: "sample.pdf",
          content_type: "application/pdf",
          file_size: 1024,
          created_at: "2026-02-26T10:00:00Z",
          updated_at: "2026-02-26T10:05:00Z",
          status: "COMPLETED",
          status_message: "Completado",
          failure_type: null,
          review_status: "IN_REVIEW",
          reviewed_at: null,
          reviewed_by: null,
          latest_run: {
            run_id: "run-e2e-edit",
            state: "COMPLETED",
            failure_type: null,
          },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route("**/runs/*/interpretations", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    capturedEditPayload = route.request().postDataJSON();
    const payload = capturedEditPayload as {
      changes?: Array<{ value?: string | null }>;
    };
    const nextValue = payload.changes?.[0]?.value;
    if (typeof nextValue === "string") {
      speciesValue = nextValue;
    }
    versionNumber += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        run_id: "run-e2e-edit",
        interpretation_id: "interp-e2e-edit",
        version_number: versionNumber,
        data: buildReviewPayload(docId ?? "doc-fallback").active_interpretation.data,
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("documents-sidebar")).toBeVisible();

  await page.getByLabel("Archivo PDF").setInputFiles({
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: pdfBuffer,
  });

  await expect.poll(() => docId, { timeout: 90_000 }).not.toBeNull();
  const row = page.getByTestId(`doc-row-${docId}`);
  await expect(row).toBeVisible({ timeout: 90_000 });
  await row.click();

  await expect(page.getByTestId("structured-column-stack")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("field-trigger-core:species")).toContainText(/canino/i);
  await page.getByTestId("field-edit-btn-core:species").click();
  await expect(page.getByTestId("field-edit-dialog")).toBeVisible();

  await page.getByTestId("field-edit-input").selectOption("felino");
  await page.getByTestId("field-edit-save").click();
  await expect(page.getByTestId("field-edit-dialog")).not.toBeVisible();

  await expect.poll(() => capturedEditPayload).not.toBeNull();
  await expect
    .poll(() => capturedEditPayload as { base_version_number?: number })
    .toMatchObject({ base_version_number: 1 });
  await expect
    .poll(
      () =>
        capturedEditPayload as {
          changes?: Array<{ op?: string; field_id?: string; value?: string; value_type?: string }>;
        },
    )
    .toMatchObject({
      changes: [
        {
          op: "UPDATE",
          field_id: "field-species-e2e",
          value: "felino",
          value_type: "string",
        },
      ],
    });

  await expect(page.getByTestId("field-trigger-core:species")).toContainText(/felino/i);

  await page.reload();
  await expect(page.getByTestId("documents-sidebar")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId(`doc-row-${docId}`).click();
  await expect(page.getByTestId("structured-column-stack")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("field-trigger-core:species")).toContainText(/felino/i);
});

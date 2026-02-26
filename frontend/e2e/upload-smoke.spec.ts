import fs from "node:fs";
import { expect, test } from "@playwright/test";

// E2E: full upload flow — upload PDF -> verify sidebar -> verify document is selectable
test("uploading a PDF adds it to documents sidebar", async ({ page }) => {
  test.setTimeout(90_000);
  const samplePdfPath = "e2e/fixtures/sample.pdf";
  const samplePdfBuffer = fs.readFileSync(samplePdfPath);
  let uploadedDocumentId: string | null = null;

  await page.addInitScript(() => {
    window.localStorage.setItem("docsSidebarPinned", "1");
  });

  await page.route("**/documents/upload", async (route) => {
    const response = await route.fetch();
    const status = response.status();
    const payload = (await response.json()) as { document_id?: string };
    expect(status).toBe(201);
    expect(payload.document_id).toBeTruthy();
    uploadedDocumentId = payload.document_id ?? null;
    await route.fulfill({ response });
  });

  await page.goto("/");
  await expect(page.getByTestId("documents-sidebar")).toBeVisible();

  await page.getByLabel("Archivo PDF").setInputFiles({
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: samplePdfBuffer,
  });

  await expect.poll(() => uploadedDocumentId, { timeout: 90_000 }).not.toBeNull();

  const documentRow = page.getByTestId(`doc-row-${uploadedDocumentId}`);
  await expect(documentRow).toBeVisible({ timeout: 90_000 });

  await documentRow.click();
  await expect(
    page
      .getByTestId("document-layout-grid")
      .or(page.getByTestId("review-split-grid")),
  ).toBeVisible({ timeout: 30_000 });

  // The sidebar may show processing-related statuses (e.g., "Procesando" / "Completado")
  // depending on environment timing, so we avoid asserting a specific final status here.
});

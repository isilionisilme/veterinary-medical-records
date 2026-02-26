import fs from "node:fs";
import { expect, test } from "@playwright/test";

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

  await expect(page.getByTestId(`doc-row-${uploadedDocumentId}`)).toBeVisible({
    timeout: 90_000,
  });
});

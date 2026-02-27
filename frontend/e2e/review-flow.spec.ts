import fs from "node:fs";
import { expect, test } from "@playwright/test";

// E2E: review flow — select document -> verify PDF + toolbar + structured panel
test("selecting a document shows PDF viewer and structured panel", async ({ page }) => {
  test.setTimeout(90_000);
  const pdfBuffer = fs.readFileSync("e2e/fixtures/sample.pdf");
  let docId: string | null = null;

  await page.addInitScript(() => {
    window.localStorage.setItem("docsSidebarPinned", "1");
  });

  await page.route("**/documents/upload", async (route) => {
    const response = await route.fetch();
    const json = (await response.json()) as { document_id?: string };
    docId = json.document_id ?? null;
    await route.fulfill({ response });
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

  await expect(page.getByTestId("review-split-grid")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pdf-toolbar-shell")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pdf-scroll-container")).toBeVisible();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("structured-column-stack")).toBeVisible();
});

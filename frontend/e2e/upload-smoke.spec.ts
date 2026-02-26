import fs from "node:fs";
import { expect, test } from "@playwright/test";

test("uploading a PDF adds it to documents sidebar", async ({ page }) => {
  test.setTimeout(90_000);
  const samplePdfPath = "e2e/fixtures/sample.pdf";
  const samplePdfBuffer = fs.readFileSync(samplePdfPath);

  await page.goto("/");
  await page.getByTestId("documents-sidebar").hover();

  await page.locator("#upload-document-input").setInputFiles({
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: samplePdfBuffer,
  });

  await expect(page.getByTestId("documents-sidebar")).toContainText("sample.pdf", {
    timeout: 60_000,
  });
});

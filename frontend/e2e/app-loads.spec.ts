import { expect, test } from "@playwright/test";

test("app loads main layout", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("documents-sidebar")).toBeVisible();
  await expect(page.getByTestId("upload-dropzone").first()).toBeVisible();
});

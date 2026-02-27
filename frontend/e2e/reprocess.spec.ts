import fs from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { buildMockDocumentPayload, buildMockReviewPayload, pinSidebar, selectDocument } from "./helpers";

const DOC_ID = "doc-e2e-reprocess";
const SAMPLE_PDF_BUFFER = fs.readFileSync("e2e/fixtures/sample.pdf");

async function setupReprocessScenario(page: Page): Promise<void> {
  let status: "COMPLETED" | "PROCESSING" = "COMPLETED";

  await pinSidebar(page);
  await page.goto("/");
  await expect(page.getByTestId("documents-sidebar")).toBeVisible();

  await page.route("**/documents?*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            document_id: DOC_ID,
            original_filename: "sample.pdf",
            created_at: "2026-02-27T10:00:00Z",
            status,
            status_label: status === "PROCESSING" ? "Procesando" : "Completado",
            failure_type: null,
            review_status: "IN_REVIEW",
            reviewed_at: null,
            reviewed_by: null,
          },
        ],
        limit: 50,
        offset: 0,
        total: 1,
      }),
    });
  });

  await page.route("**/documents/*/download**", async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/\/documents\/([^/]+)\/download\/?$/);
    const routeDocumentId = match?.[1];
    if (!routeDocumentId || routeDocumentId !== DOC_ID) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: SAMPLE_PDF_BUFFER,
    });
  });

  await page.route("**/documents/*", async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/\/documents\/([^/]+)\/?$/);
    const routeDocumentId = match?.[1];
    if (route.request().method() !== "GET" || !routeDocumentId || routeDocumentId !== DOC_ID) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        buildMockDocumentPayload(DOC_ID, {
          status,
          reviewStatus: "IN_REVIEW",
          filename: "sample.pdf",
        }),
      ),
    });
  });

  await page.route("**/documents/*/review", async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/\/documents\/([^/]+)\/review\/?$/);
    const routeDocumentId = match?.[1];
    if (!routeDocumentId || routeDocumentId !== DOC_ID) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildMockReviewPayload(routeDocumentId)),
    });
  });

  await page.route("**/documents/*/reprocess", async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/\/documents\/([^/]+)\/reprocess\/?$/);
    const routeDocumentId = match?.[1];
    if (route.request().method() !== "POST" || !routeDocumentId || routeDocumentId !== DOC_ID) {
      await route.fallback();
      return;
    }
    status = "PROCESSING";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        run_id: "run-e2e-reprocess-2",
        state: "QUEUED",
        failure_type: null,
      }),
    });
  });

  await page.getByRole("button", { name: "Actualizar" }).click();
  await selectDocument(page, DOC_ID);
  await expect(page.getByTestId("structured-column-stack")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("viewer-tab-raw-text").click();
  await expect(page.getByRole("button", { name: "Reprocesar" })).toBeVisible();
}

test.describe("reprocess workflow", () => {
  test("reprocess button opens confirmation modal", async ({ page }) => {
    test.setTimeout(180_000);
    await setupReprocessScenario(page);

    await page.getByRole("button", { name: "Reprocesar" }).click();
    await expect(page.getByTestId("reprocess-confirm-modal")).toBeVisible();
    await expect(page.getByText("Reprocesar documento")).toBeVisible();
  });

  test("confirm reprocess shows toast and processing state", async ({ page }) => {
    test.setTimeout(180_000);
    await setupReprocessScenario(page);

    await page.getByRole("button", { name: "Reprocesar" }).click();
    await page.getByTestId("reprocess-confirm-btn").click();

    await expect(page.getByText("Reprocesamiento iniciado.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Procesando..." })).toBeVisible();
  });
});

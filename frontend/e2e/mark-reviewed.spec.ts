import fs from "node:fs";
import { expect, test } from "@playwright/test";

test("marking a document as reviewed toggles read-only state and allows reopen", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const pdfBuffer = fs.readFileSync("e2e/fixtures/sample.pdf");
  let docId: string | null = null;
  let reviewStatus: "IN_REVIEW" | "REVIEWED" = "IN_REVIEW";
  let reviewedAt: string | null = null;

  const buildReviewPayload = (documentId: string) => ({
    document_id: documentId,
    latest_completed_run: {
      run_id: "run-e2e-reviewed",
      state: "COMPLETED",
      completed_at: "2026-02-26T10:00:00Z",
      failure_type: null,
    },
    active_interpretation: {
      interpretation_id: "interp-e2e-reviewed",
      version_number: 1,
      data: {
        document_id: documentId,
        processing_run_id: "run-e2e-reviewed",
        created_at: "2026-02-26T10:00:00Z",
        fields: [
          {
            field_id: "field-pet-name-e2e",
            key: "pet_name",
            value: "Luna",
            value_type: "string",
            field_candidate_confidence: 0.91,
            field_mapping_confidence: 0.91,
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
      run_id: "run-e2e-reviewed",
      available: true,
    },
    review_status: reviewStatus,
    reviewed_at: reviewedAt,
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
      await route.continue();
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
    await route.continue();
  });

  await page.route("**/documents/*", async (route) => {
    const currentDocId = docId;
    if (!currentDocId || route.request().method() !== "GET") {
      await route.continue();
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
          review_status: reviewStatus,
          reviewed_at: reviewedAt,
          reviewed_by: null,
          latest_run: {
            run_id: "run-e2e-reviewed",
            state: "COMPLETED",
            failure_type: null,
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.route("**/documents/*/reviewed", async (route) => {
    const currentDocId = docId;
    if (!currentDocId) {
      await route.continue();
      return;
    }
    const method = route.request().method();
    const url = new URL(route.request().url());
    if (url.pathname !== `/documents/${currentDocId}/reviewed`) {
      await route.continue();
      return;
    }
    if (method === "POST") {
      reviewStatus = "REVIEWED";
      reviewedAt = "2026-02-26T10:06:00Z";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          document_id: currentDocId,
          review_status: reviewStatus,
          reviewed_at: reviewedAt,
          reviewed_by: null,
        }),
      });
      return;
    }
    if (method === "DELETE") {
      reviewStatus = "IN_REVIEW";
      reviewedAt = null;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          document_id: currentDocId,
          review_status: reviewStatus,
          reviewed_at: reviewedAt,
          reviewed_by: null,
        }),
      });
      return;
    }
    await route.continue();
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
  const reviewToggleButton = page.getByTestId("review-toggle-btn");

  await expect(reviewToggleButton).toContainText("Marcar revisado");
  await reviewToggleButton.click();
  await expect(reviewToggleButton).toContainText("Reabrir");
  await expect(page.getByText(/solo lectura/i)).toBeVisible();

  await reviewToggleButton.click();
  await expect(reviewToggleButton).toContainText("Marcar revisado");
});

import fs from "node:fs";

import { expect, type Page } from "@playwright/test";

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
  const existingRowTestIds = new Set(
    await page
      .locator('[data-testid^="doc-row-"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid") ?? "")),
  );

  const filename = pdfPath.split("/").pop() ?? "sample.pdf";
  const uploadResponse = await page.request.post("/documents/upload", {
    multipart: {
      file: {
        name: filename,
        mimeType: "application/pdf",
        buffer: pdfBuffer,
      },
    },
  });
  if (uploadResponse.ok()) {
    const json = (await uploadResponse.json()) as { document_id?: string };
    docId = json.document_id ?? null;
  } else {
    await page.getByLabel("Archivo PDF").setInputFiles({
      name: filename,
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });
  }

  await expect
    .poll(
      async () => {
        if (docId) {
          return docId;
        }
        const currentRowTestIds = await page
          .locator('[data-testid^="doc-row-"]')
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid") ?? ""));
        const newRowTestId = currentRowTestIds.find(
          (testId) => testId.startsWith("doc-row-") && !existingRowTestIds.has(testId),
        );
        if (!newRowTestId) {
          return null;
        }
        return newRowTestId.replace("doc-row-", "");
      },
      { timeout },
    )
    .not.toBeNull();

  if (!docId) {
    const currentRowTestIds = await page
      .locator('[data-testid^="doc-row-"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid") ?? ""));
    const newRowTestId = currentRowTestIds.find(
      (testId) => testId.startsWith("doc-row-") && !existingRowTestIds.has(testId),
    );
    if (newRowTestId) {
      docId = newRowTestId.replace("doc-row-", "");
    }
  }

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

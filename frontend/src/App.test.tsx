import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  App,
  MIN_PDF_PANEL_WIDTH_PX,
  REVIEW_SPLIT_MIN_WIDTH_PX,
  SPLITTER_COLUMN_WIDTH_PX,
} from "./App";
import { GLOBAL_SCHEMA } from "./lib/globalSchema";

vi.mock("./components/PdfViewer", () => ({
  PdfViewer: (props: {
    focusPage?: number | null;
    highlightSnippet?: string | null;
    focusRequestId?: number;
    toolbarLeftContent?: ReactNode;
    toolbarRightExtra?: ReactNode;
  }) => (
    <>
      <div data-testid="pdf-viewer-toolbar-left">{props.toolbarLeftContent ?? null}</div>
      <div data-testid="pdf-viewer-toolbar-right">{props.toolbarRightExtra ?? null}</div>
      <div
        data-testid="pdf-viewer"
        data-focus-page={props.focusPage ?? ""}
        data-highlight-snippet={props.highlightSnippet ?? ""}
        data-focus-request-id={props.focusRequestId ?? 0}
      />
    </>
  ),
}));

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

async function withDesktopHoverMatchMedia(run: () => Promise<void> | void) {
  const originalMatchMedia = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("(min-width: 1024px)") || query.includes("(hover: hover)"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  try {
    await run();
  } finally {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  }
}

function createDataTransfer(file: File): DataTransfer {
  return {
    files: [file],
    items: [{ kind: "file", type: file.type }],
    types: ["Files"],
  } as unknown as DataTransfer;
}

async function waitForStructuredDataReady() {
  await waitFor(() => {
    expect(screen.queryByTestId("review-core-skeleton")).toBeNull();
  });
}

function clickPetNameField() {
  const indicator = screen.getByTestId("confidence-indicator-core:pet_name");
  const fieldCard = indicator.closest("article");
  expect(fieldCard).not.toBeNull();
  const trigger = (fieldCard as HTMLElement).querySelector('[role="button"]');
  expect(trigger).not.toBeNull();
  fireEvent.click(trigger as HTMLElement);
}

async function openReadyDocumentAndGetPanel() {
  fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
  await screen.findByRole("heading", { name: /Datos extraídos/i });
  await waitForStructuredDataReady();
  return screen.getByTestId("right-panel-scroll");
}

type CanonicalUs44FetchMockOptions = {
  schemaContract?: string;
  fieldSlots?: Array<Record<string, unknown>>;
  fields?: Array<Record<string, unknown>>;
  visits?: Array<Record<string, unknown>>;
  otherFields?: Array<Record<string, unknown>>;
  confidencePolicy?: Record<string, unknown>;
};

function installCanonicalUs44FetchMock(options?: CanonicalUs44FetchMockOptions) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/documents?") && method === "GET") {
      return new Response(
        JSON.stringify({
          items: [
            {
              document_id: "doc-canonical",
              original_filename: "ready.pdf",
              created_at: "2026-02-10T10:00:00Z",
              status: "COMPLETED",
              status_label: "Listo",
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
        { status: 200 }
      );
    }

    if (url.match(/\/documents\/doc-canonical$/) && method === "GET") {
      return new Response(
        JSON.stringify({
          document_id: "doc-canonical",
          original_filename: "ready.pdf",
          content_type: "application/pdf",
          file_size: 10,
          created_at: "2026-02-10T10:00:00Z",
          updated_at: "2026-02-10T10:00:00Z",
          status: "COMPLETED",
          status_message: "Completed",
          failure_type: null,
          review_status: "IN_REVIEW",
          reviewed_at: null,
          reviewed_by: null,
          latest_run: { run_id: "run-doc-canonical", state: "COMPLETED", failure_type: null },
        }),
        { status: 200 }
      );
    }

    if (url.match(/\/documents\/doc-canonical\/review$/) && method === "GET") {
      return new Response(
        JSON.stringify({
          document_id: "doc-canonical",
          latest_completed_run: {
            run_id: "run-doc-canonical",
            state: "COMPLETED",
            completed_at: "2026-02-10T10:00:00Z",
            failure_type: null,
          },
          active_interpretation: {
            interpretation_id: "interp-doc-canonical",
            version_number: 1,
            data: {
              document_id: "doc-canonical",
              processing_run_id: "run-doc-canonical",
              created_at: "2026-02-10T10:00:00Z",
              schema_contract: options?.schemaContract ?? "visit-grouped-canonical",
              medical_record_view: {
                version: "mvp-1",
                sections: ["clinic", "patient", "owner", "visits", "notes", "other", "report_info"],
                field_slots: options?.fieldSlots ?? [
                  {
                    concept_id: "clinic.name",
                    section: "clinic",
                    scope: "document",
                    canonical_key: "clinic_name",
                    label_key: "clinic_name",
                  },
                  {
                    concept_id: "clinic.nhc",
                    section: "clinic",
                    scope: "document",
                    canonical_key: "nhc",
                    aliases: ["medical_record_number"],
                    label_key: "nhc",
                  },
                  {
                    concept_id: "patient.pet_name",
                    section: "patient",
                    scope: "document",
                    canonical_key: "pet_name",
                    label_key: "pet_name",
                  },
                  {
                    concept_id: "owner.name",
                    section: "owner",
                    scope: "document",
                    canonical_key: "owner_name",
                    label_key: "owner_name",
                  },
                  {
                    concept_id: "owner.address",
                    section: "owner",
                    scope: "document",
                    canonical_key: "owner_address",
                    label_key: "owner_address",
                  },
                  {
                    concept_id: "notes.main",
                    section: "notes",
                    scope: "document",
                    canonical_key: "notes",
                    label_key: "notes",
                  },
                  {
                    concept_id: "report.language",
                    section: "report_info",
                    scope: "document",
                    canonical_key: "language",
                    label_key: "language",
                  },
                  {
                    concept_id: "contract.allow.invoice_total",
                    section: "notes",
                    scope: "document",
                    canonical_key: "invoice_total",
                    label_key: "invoice_total",
                  },
                ],
              },
              fields: options?.fields ?? [
                {
                  field_id: "field-clinic-name-doc-canonical",
                  key: "clinic_name",
                  value: "Centro Norte",
                  value_type: "string",
                  scope: "document",
                  section: "clinic",
                  classification: "medical_record",
                  is_critical: false,
                  origin: "machine",
                },
                {
                  field_id: "field-pet-name-doc-canonical",
                  key: "pet_name",
                  value: "Luna",
                  value_type: "string",
                  scope: "document",
                  section: "patient",
                  classification: "medical_record",
                  is_critical: false,
                  origin: "machine",
                },
                {
                  field_id: "field-owner-name-doc-canonical",
                  key: "owner_name",
                  value: "Ana",
                  value_type: "string",
                  scope: "document",
                  section: "owner",
                  classification: "medical_record",
                  is_critical: false,
                  origin: "machine",
                },
                {
                  field_id: "field-owner-address-doc-canonical",
                  key: "owner_address",
                  value: "Calle Sur 8",
                  value_type: "string",
                  scope: "document",
                  section: "owner",
                  classification: "medical_record",
                  is_critical: false,
                  origin: "machine",
                },
                {
                  field_id: "field-notes-doc-canonical",
                  key: "notes",
                  value: "Revisar evolución",
                  value_type: "string",
                  scope: "document",
                  section: "notes",
                  classification: "medical_record",
                  is_critical: false,
                  origin: "machine",
                },
                {
                  field_id: "field-language-doc-canonical",
                  key: "language",
                  value: "es",
                  value_type: "string",
                  scope: "document",
                  section: "report_info",
                  classification: "medical_record",
                  is_critical: false,
                  origin: "machine",
                },
                {
                  field_id: "field-invoice-total-doc-canonical",
                  key: "invoice_total",
                  value: "123.00",
                  value_type: "string",
                  scope: "document",
                  section: "notes",
                  classification: "medical_record",
                  is_critical: false,
                  origin: "machine",
                },
                {
                  field_id: "field-top-level-other-doc-canonical",
                  key: "top_level_other_should_not_render",
                  value: "NO",
                  value_type: "string",
                  scope: "document",
                  section: "other",
                  classification: "other",
                  is_critical: false,
                  origin: "machine",
                },
              ],
              visits: options?.visits ?? [
                {
                  visit_id: "visit-1",
                  visit_date: "2026-02-11",
                  admission_date: null,
                  discharge_date: null,
                  reason_for_visit: "Control",
                  fields: [
                    {
                      field_id: "field-visit-diagnosis-doc-canonical",
                      key: "diagnosis",
                      value: "Estable",
                      value_type: "string",
                      scope: "visit",
                      section: "visits",
                      classification: "medical_record",
                      is_critical: false,
                      origin: "machine",
                    },
                  ],
                },
              ],
              other_fields: options?.otherFields ?? [
                {
                  field_id: "field-other-contract-doc-canonical",
                  key: "contract_other",
                  value: "VISIBLE",
                  value_type: "string",
                  scope: "document",
                  section: "other",
                  classification: "other",
                  is_critical: false,
                  origin: "machine",
                },
              ],
              confidence_policy: options?.confidencePolicy ?? {
                policy_version: "test-v1",
                band_cutoffs: {
                  low_max: 0.4,
                  mid_max: 0.7,
                },
              },
            },
          },
          raw_text_artifact: {
            run_id: "run-doc-canonical",
            available: true,
          },
          review_status: "IN_REVIEW",
          reviewed_at: null,
          reviewed_by: null,
        }),
        { status: 200 }
      );
    }

    if (url.includes("/processing-history") && method === "GET") {
      return new Response(JSON.stringify({ document_id: "doc-canonical", runs: [] }), { status: 200 });
    }

    if (url.includes("/download") && method === "GET") {
      return new Response(new Blob(["pdf"], { type: "application/pdf" }), { status: 200 });
    }

    if (url.includes("/raw-text") && method === "GET") {
      return new Response(
        JSON.stringify({
          run_id: "run-doc-canonical",
          artifact_type: "RAW_TEXT",
          content_type: "text/plain",
          text: "texto",
        }),
        { status: 200 }
      );
    }

    return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
  }) as typeof fetch;

  globalThis.URL.createObjectURL = vi.fn(() => "blob://mock");
  globalThis.URL.revokeObjectURL = vi.fn();
}

function installReviewedModeFetchMock() {
  const docs: Array<{
    document_id: string;
    original_filename: string;
    created_at: string;
    status: string;
    status_label: string;
    failure_type: string | null;
    review_status: "IN_REVIEW" | "REVIEWED";
    reviewed_at: string | null;
    reviewed_by: string | null;
  }> = [
    {
      document_id: "doc-ready",
      original_filename: "ready.pdf",
      created_at: "2026-02-09T10:00:00Z",
      status: "COMPLETED",
      status_label: "Completed",
      failure_type: null,
      review_status: "IN_REVIEW",
      reviewed_at: null,
      reviewed_by: null,
    },
  ];

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const activeDoc = docs[0];

    if (url.includes("/documents?") && method === "GET") {
      return new Response(
        JSON.stringify({ items: docs, limit: 50, offset: 0, total: docs.length }),
        { status: 200 }
      );
    }

    if (url.includes("/download") && method === "GET") {
      return new Response(new Blob(["pdf"], { type: "application/pdf" }), { status: 200 });
    }

    if (url.includes("/documents/doc-ready/reviewed") && method === "POST") {
      if (activeDoc.review_status !== "REVIEWED") {
        activeDoc.review_status = "REVIEWED";
        activeDoc.reviewed_at = "2026-02-10T10:30:00Z";
        activeDoc.reviewed_by = null;
      }
      return new Response(
        JSON.stringify({
          document_id: activeDoc.document_id,
          review_status: activeDoc.review_status,
          reviewed_at: activeDoc.reviewed_at,
          reviewed_by: activeDoc.reviewed_by,
        }),
        { status: 200 }
      );
    }

    if (url.includes("/documents/doc-ready/reviewed") && method === "DELETE") {
      activeDoc.review_status = "IN_REVIEW";
      activeDoc.reviewed_at = null;
      activeDoc.reviewed_by = null;
      return new Response(
        JSON.stringify({
          document_id: activeDoc.document_id,
          review_status: activeDoc.review_status,
          reviewed_at: activeDoc.reviewed_at,
          reviewed_by: activeDoc.reviewed_by,
        }),
        { status: 200 }
      );
    }

    if (url.match(/\/documents\/doc-ready$/) && method === "GET") {
      return new Response(
        JSON.stringify({
          document_id: activeDoc.document_id,
          original_filename: activeDoc.original_filename,
          content_type: "application/pdf",
          file_size: 10,
          created_at: activeDoc.created_at,
          updated_at: "2026-02-10T10:00:00Z",
          status: activeDoc.status,
          status_message: "Completed",
          failure_type: activeDoc.failure_type,
          review_status: activeDoc.review_status,
          reviewed_at: activeDoc.reviewed_at,
          reviewed_by: activeDoc.reviewed_by,
          latest_run: { run_id: "run-doc-ready", state: "COMPLETED", failure_type: null },
        }),
        { status: 200 }
      );
    }

    if (url.match(/\/documents\/doc-ready\/review$/) && method === "GET") {
      return new Response(
        JSON.stringify({
          document_id: activeDoc.document_id,
          latest_completed_run: {
            run_id: "run-doc-ready",
            state: "COMPLETED",
            completed_at: "2026-02-10T10:00:00Z",
            failure_type: null,
          },
          active_interpretation: {
            interpretation_id: "interp-doc-ready",
            version_number: 1,
            data: {
              document_id: activeDoc.document_id,
              processing_run_id: "run-doc-ready",
              created_at: "2026-02-10T10:00:00Z",
              fields: [
                {
                  field_id: "field-pet-name-doc-ready",
                  key: "pet_name",
                  value: "Luna",
                  value_type: "string",
                  field_candidate_confidence: 0.82,
                  field_mapping_confidence: 0.82,
                  is_critical: false,
                  origin: "machine",
                  evidence: { page: 1, snippet: "Paciente: Luna" },
                },
                {
                  field_id: "field-species-doc-ready",
                  key: "species",
                  value: "Canina",
                  value_type: "string",
                  field_candidate_confidence: 0.9,
                  field_mapping_confidence: 0.9,
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
            run_id: "run-doc-ready",
            available: true,
          },
          review_status: activeDoc.review_status,
          reviewed_at: activeDoc.reviewed_at,
          reviewed_by: activeDoc.reviewed_by,
        }),
        { status: 200 }
      );
    }

    if (url.includes("/processing-history") && method === "GET") {
      return new Response(JSON.stringify({ document_id: "doc-ready", runs: [] }), { status: 200 });
    }

    return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
  }) as typeof fetch;
}

async function openReviewedDocument() {
  fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
  await screen.findByTestId("confidence-indicator-core:pet_name");
}

function getPetNameFieldButton() {
  const indicator = screen.getByTestId("confidence-indicator-core:pet_name");
  const fieldCard = indicator.closest("article");
  expect(fieldCard).not.toBeNull();
  const trigger = (fieldCard as HTMLElement).querySelector('[role="button"]');
  expect(trigger).not.toBeNull();
  return trigger as HTMLElement;
}

describe("App upload and list flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");

    const docs = [
      {
        document_id: "doc-processing",
        original_filename: "processing.pdf",
        created_at: "2026-02-09T10:00:00Z",
        status: "PROCESSING",
        status_label: "Processing",
        failure_type: null,
      },
      {
        document_id: "doc-ready",
        original_filename: "ready.pdf",
        created_at: "2026-02-09T10:00:00Z",
        status: "COMPLETED",
        status_label: "Completed",
        failure_type: null,
      },
      {
        document_id: "doc-failed",
        original_filename: "failed.pdf",
        created_at: "2026-02-09T10:00:00Z",
        status: "FAILED",
        status_label: "Failed",
        failure_type: "EXTRACTION_FAILED",
      },
    ];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents?") && method === "GET") {
        return new Response(
          JSON.stringify({ items: docs, limit: 50, offset: 0, total: docs.length }),
          { status: 200 }
        );
      }

      if (url.endsWith("/documents/upload") && method === "POST") {
        docs.unshift({
          document_id: "doc-new",
          original_filename: "nuevo.pdf",
          created_at: "2026-02-10T10:00:00Z",
          status: "COMPLETED",
          status_label: "Completed",
          failure_type: null,
        });
        return new Response(
          JSON.stringify({
            document_id: "doc-new",
            status: "COMPLETED",
            created_at: "2026-02-10T10:00:00Z",
          }),
          { status: 201 }
        );
      }

      if (url.includes("/download") && method === "GET") {
        return new Response(new Blob(["pdf"], { type: "application/pdf" }), {
          status: 200,
          headers: { "content-disposition": 'inline; filename="record.pdf"' },
        });
      }

      const detailMatch = url.match(/\/documents\/([^/]+)$/);
      if (detailMatch && method === "GET") {
        const docId = detailMatch[1];
        const found = docs.find((doc) => doc.document_id === docId);
        return new Response(
          JSON.stringify({
            document_id: docId,
            original_filename: found?.original_filename ?? "record.pdf",
            content_type: "application/pdf",
            file_size: 10,
            created_at: found?.created_at ?? "2026-02-09T10:00:00Z",
            updated_at: "2026-02-10T10:00:00Z",
            status: found?.status ?? "PROCESSING",
            status_message: "Processing is in progress.",
            failure_type: found?.failure_type ?? null,
            latest_run: { run_id: `run-${docId}`, state: found?.status ?? "PROCESSING", failure_type: null },
          }),
          { status: 200 }
        );
      }

      const reviewMatch = url.match(/\/documents\/([^/]+)\/review$/);
      if (reviewMatch && method === "GET") {
        const docId = reviewMatch[1];
        return new Response(
          JSON.stringify({
            document_id: docId,
            latest_completed_run: {
              run_id: `run-${docId}`,
              state: "COMPLETED",
              completed_at: "2026-02-10T10:00:00Z",
              failure_type: null,
            },
            active_interpretation: {
              interpretation_id: `interp-${docId}`,
              version_number: 1,
              data: {
                document_id: docId,
                processing_run_id: `run-${docId}`,
                created_at: "2026-02-10T10:00:00Z",
                fields: [
                  {
                    field_id: `field-document-date-${docId}`,
                    key: "document_date",
                    value: null,
                    value_type: "date",
                    field_mapping_confidence: 0.32,
                    is_critical: false,
                    origin: "machine",
                  },
                  {
                    field_id: `field-visit-date-${docId}`,
                    key: "visit_date",
                    value: "2026-02-11T00:00:00Z",
                    value_type: "date",
                    field_mapping_confidence: 0.74,
                    is_critical: true,
                    origin: "machine",
                  },
                  {
                    field_id: `field-pet-name-${docId}`,
                    key: "pet_name",
                    value: "Luna",
                    value_type: "string",
                    field_mapping_confidence: 0.82,
                    field_candidate_confidence: 0.65,
                    field_review_history_adjustment: 7,
                    is_critical: false,
                    origin: "machine",
                    evidence: { page: 1, snippet: "Paciente: Luna" },
                  },
                  {
                    field_id: `field-diagnosis-${docId}`,
                    key: "diagnosis",
                    value: "Gastroenteritis",
                    value_type: "string",
                    field_mapping_confidence: 0.62,
                    field_candidate_confidence: 0.71,
                    field_review_history_adjustment: -4,
                    is_critical: false,
                    origin: "machine",
                    evidence: { page: 2, snippet: "Diagnostico: Gastroenteritis" },
                  },
                  {
                    field_id: `field-treatment-${docId}`,
                    key: "treatment_plan",
                    value:
                      "Reposo relativo durante 7 días.\nDieta blanda en 3 tomas al día y control de hidratación.",
                    value_type: "string",
                    field_mapping_confidence: 0.72,
                    is_critical: false,
                    origin: "machine",
                  },
                  {
                    field_id: `field-extra-${docId}`,
                    key: "custom_tag",
                    value: "Prioridad",
                    value_type: "string",
                    field_mapping_confidence: 0.88,
                    is_critical: false,
                    origin: "machine",
                    evidence: { page: 1, snippet: "Prioridad: Alta" },
                  },
                  {
                    field_id: `field-imagen-${docId}`,
                    key: "imagen",
                    value: "Rx abdomen",
                    value_type: "string",
                    field_mapping_confidence: 0.61,
                    is_critical: false,
                    origin: "machine",
                  },
                  {
                    field_id: `field-imagine-${docId}`,
                    key: "imagine",
                    value: "Eco",
                    value_type: "string",
                    field_mapping_confidence: 0.58,
                    is_critical: false,
                    origin: "machine",
                  },
                  {
                    field_id: `field-owner-name-${docId}`,
                    key: "owner_name",
                    value: "BEATRIZ ABARCA",
                    value_type: "string",
                    field_mapping_confidence: 0.84,
                    field_candidate_confidence: null,
                    field_review_history_adjustment: 0,
                    is_critical: false,
                    origin: "machine",
                  },
                  {
                    field_id: `field-owner-address-${docId}`,
                    key: "owner_address",
                    value: "Calle Mayor 10, Madrid",
                    value_type: "string",
                    field_mapping_confidence: 0.77,
                    field_candidate_confidence: 0.77,
                    field_review_history_adjustment: -4,
                    is_critical: false,
                    origin: "machine",
                  },
                  {
                    field_id: `field-imaging-${docId}`,
                    key: "IMAGING:",
                    value: "Radiografia lateral",
                    value_type: "string",
                    field_mapping_confidence: 0.57,
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
              run_id: `run-${docId}`,
              available: true,
            },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/processing-history") && method === "GET") {
        return new Response(JSON.stringify({ document_id: "doc-any", runs: [] }), {
          status: 200,
        });
      }

      if (url.includes("/reprocess") && method === "POST") {
        return new Response(
          JSON.stringify({ run_id: "run-new", state: "QUEUED", created_at: "2026-02-10T10:00:00Z" }),
          { status: 201 }
        );
      }

      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    globalThis.URL.createObjectURL = vi.fn(() => "blob://mock");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("removes the old no-document error block and exposes list control in viewer header", () => {
    renderApp();
    expect(screen.queryByText(/Documento no encontrado o falta ID/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Volver a la lista/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Documentos cargados/i })).toBeNull();
    expect(
      screen.getByText(/Selecciona un documento en la barra lateral o carga uno nuevo\./i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Arrastra un PDF aqui/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/o haz clic para cargar/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Formatos permitidos: PDF\./i)).toBeNull();
    expect(screen.queryByText(/\(\.pdf \/ application\/pdf\)/i)).toBeNull();
    expect(screen.queryByText(/Tamaño máximo: 20 MB\./i)).toBeNull();
    expect(screen.getByLabelText(/Informacion de formatos y tamano/i)).toBeInTheDocument();
    expect(screen.queryByText(/Selecciona un PDF/i)).toBeNull();
  });

  it("shows required list status labels", async () => {
    renderApp();
    expect(await screen.findByText("Procesando")).toBeInTheDocument();
    expect(screen.getByText("Listo")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Tardando mas de lo esperado")).toBeInTheDocument();
  });

  it("updates PROCESSING to Listo after refresh", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const processingDoc = {
      document_id: "doc-transition",
      original_filename: "transition.pdf",
      created_at: "2026-02-10T10:00:00Z",
      status: "PROCESSING",
      status_label: "Processing",
      failure_type: null,
    };

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents?") && method === "GET") {
        return new Response(
          JSON.stringify({ items: [processingDoc], limit: 50, offset: 0, total: 1 }),
          { status: 200 }
        );
      }
      if (url.includes("/download")) {
        return new Response(new Blob(["pdf"], { type: "application/pdf" }), { status: 200 });
      }
      if (url.match(/\/documents\/[^/]+$/) && method === "GET") {
        return new Response(
          JSON.stringify({
            document_id: "doc-transition",
            original_filename: "transition.pdf",
            content_type: "application/pdf",
            file_size: 10,
            created_at: "2026-02-10T10:00:00Z",
            updated_at: "2026-02-10T10:00:00Z",
            status: processingDoc.status,
            status_message: "state",
            failure_type: null,
            latest_run: { run_id: "run-transition", state: processingDoc.status, failure_type: null },
          }),
          { status: 200 }
        );
      }
      if (url.includes("/processing-history")) {
        return new Response(JSON.stringify({ document_id: "doc-transition", runs: [] }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    });

    renderApp();
    await screen.findByText("Procesando");

    expect(
      within(screen.getByRole("button", { name: /transition\.pdf/i })).getByText("Procesando")
    ).toBeInTheDocument();

    processingDoc.status = "COMPLETED";
    fireEvent.click(screen.getByRole("button", { name: /Actualizar/i }));

    await waitFor(() => {
      expect(
        within(screen.getByRole("button", { name: /transition\.pdf/i })).getByText(
          "Listo"
        )
      ).toBeInTheDocument();
    });
  });

  it("uploads a document, shows toast and auto-opens the uploaded document", async () => {
    renderApp();

    const input = screen.getByLabelText(/Archivo PDF/i);
    const file = new File(["pdf"], "nuevo.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Documento subido correctamente/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver documento/i })).toBeNull();

    await waitFor(() => {
      const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      expect(calls.some(([url]) => String(url).includes("/documents/upload"))).toBe(true);
      expect(calls.some(([url]) => String(url).includes("/documents/doc-new/download"))).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /nuevo\.pdf/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });
  });

  it("shows fallback open action only when auto-open fails", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents?") && method === "GET") {
        return new Response(
          JSON.stringify({
            items: [
              {
                document_id: "doc-new",
                original_filename: "nuevo.pdf",
                created_at: "2026-02-10T10:00:00Z",
                status: "COMPLETED",
                status_label: "Completed",
                failure_type: null,
              },
            ],
            limit: 50,
            offset: 0,
            total: 1,
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/documents/upload") && method === "POST") {
        return new Response(
          JSON.stringify({
            document_id: "doc-new",
            status: "COMPLETED",
            created_at: "2026-02-10T10:00:00Z",
          }),
          { status: 201 }
        );
      }

      if (url.includes("/documents/doc-new/download") && method === "GET") {
        return new Response(JSON.stringify({ message: "Not ready" }), { status: 404 });
      }

      if (url.match(/\/documents\/[^/]+$/) && method === "GET") {
        return new Response(
          JSON.stringify({
            document_id: "doc-new",
            original_filename: "nuevo.pdf",
            content_type: "application/pdf",
            file_size: 10,
            created_at: "2026-02-10T10:00:00Z",
            updated_at: "2026-02-10T10:00:00Z",
            status: "COMPLETED",
            status_message: "Completed",
            failure_type: null,
            latest_run: { run_id: "run-doc-new", state: "COMPLETED", failure_type: null },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/processing-history") && method === "GET") {
        return new Response(JSON.stringify({ document_id: "doc-new", runs: [] }), { status: 200 });
      }

      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    renderApp();

    const input = screen.getByLabelText(/Archivo PDF/i);
    const file = new File(["pdf"], "nuevo.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Documento subido correctamente/i)).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /Ver documento/i })).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("auto-dismisses upload toast", async () => {
    renderApp();

    const input = screen.getByLabelText(/Archivo PDF/i);
    const file = new File(["pdf"], "nuevo.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Documento subido correctamente/i)).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 3600));
    await waitFor(() => {
      expect(screen.queryByText(/Documento subido correctamente/i)).toBeNull();
    });
  }, 10000);

  it("shows a clear error when selected file exceeds 20 MB", async () => {
    renderApp();

    const input = screen.getByLabelText(/Archivo PDF/i);
    const oversizedFile = new File([new Uint8Array(20 * 1024 * 1024 + 1)], "grande.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(input, { target: { files: [oversizedFile] } });

    expect(
      await screen.findByText(/El archivo supera el tamaño máximo \(20 MB\)\./i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 5200));
    await waitFor(() => {
      expect(screen.queryByText(/El archivo supera el tamaño máximo \(20 MB\)\./i)).toBeNull();
    });
  }, 12000);

  it("keeps browse defaults when there are no documents and opens upload from CTA", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents?") && method === "GET") {
        return new Response(JSON.stringify({ items: [], limit: 50, offset: 0, total: 0 }), {
          status: 200,
        });
      }

      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    renderApp();

    expect(await screen.findByText(/Aun no hay documentos cargados\./i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Cargar documento/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Selecciona un documento en la barra lateral o carga uno nuevo\./i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("view-mode-toggle")).toBeNull();
    expect(screen.queryByTestId("review-docs-handle")).toBeNull();

    const emptyViewer = screen.getByTestId("viewer-empty-state");
    fireEvent.click(emptyViewer);

    await waitFor(() => {
      expect(screen.getByTestId("viewer-empty-state")).toBeInTheDocument();
    });
  });

  it("does not show select-or-upload empty state when document list fetch fails", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents?") && method === "GET") {
        throw new TypeError("Failed to fetch");
      }

      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    renderApp();

    await screen.findByText(/No se pudo conectar con el servidor\./i);
    expect(screen.getByText(/No se pudo conectar con el servidor\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Sin conexión/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeNull();
    expect(screen.getByText(/Revisa la lista lateral para reintentar la carga de documentos\./i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Selecciona un documento en la barra lateral o carga uno nuevo\./i)
    ).toBeNull();
    expect(screen.queryByText(/Failed to fetch/i)).toBeNull();
    expect(screen.queryByText(/No se pudieron cargar los documentos\./i)).toBeNull();
  });

  it("keeps browse mode with docs, pdf, and structured columns after selecting a document", async () => {
    renderApp();

    await screen.findByRole("button", { name: /ready\.pdf/i });
    fireEvent.click(screen.getByRole("button", { name: /ready\.pdf/i }));

    await waitFor(() => {
      expect(screen.getByTestId("left-panel-scroll")).toBeInTheDocument();
      expect(screen.getByTestId("center-panel-scroll")).toBeInTheDocument();
      expect(screen.getByTestId("right-panel-scroll")).toBeInTheDocument();
      expect(screen.queryByTestId("view-mode-toggle")).toBeNull();
      expect(screen.queryByText(/Vista Docs · PDF · Datos/i)).toBeNull();
    });
  });

  it("uses a unified layout without mode controls or breadcrumb", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    expect(screen.getByTestId("canvas-wrapper")).toHaveClass("p-[var(--canvas-gap)]");
    expect(screen.getByTestId("main-canvas-layout")).toHaveClass("gap-[var(--canvas-gap)]");
    expect(screen.getByTestId("docs-column-stack")).toHaveClass("gap-[var(--canvas-gap)]");
    expect(screen.getByTestId("docs-column-stack")).toHaveClass("p-[var(--canvas-gap)]");
    expect(screen.getByTestId("center-panel-scroll")).toHaveClass("gap-[var(--canvas-gap)]");
    expect(screen.getByTestId("center-panel-scroll")).toHaveClass("p-[var(--canvas-gap)]");
    expect(screen.getByTestId("structured-column-stack")).toHaveClass("gap-[var(--canvas-gap)]");
    expect(screen.getByTestId("structured-column-stack")).toHaveClass("p-[var(--canvas-gap)]");
    const leftScroll = screen.getByTestId("left-panel-scroll");
    expect(leftScroll).toBeInTheDocument();
    expect(screen.getByTestId("center-panel-scroll")).toBeInTheDocument();
    expect(screen.getByTestId("right-panel-scroll")).toBeInTheDocument();
    expect(screen.getByTestId("documents-sidebar").firstElementChild).toHaveClass("panel-shell-muted");
    expect(screen.getByTestId("center-panel-scroll")).toHaveClass("panel-shell-muted");
    expect(screen.getByRole("heading", { name: /Datos extraídos/i }).closest("aside")).toHaveClass(
      "panel-shell-muted"
    );
    expect(screen.getByTestId("structured-search-shell")).toHaveClass("panel-shell");
    const firstDocumentRow = screen.getByTestId("doc-row-doc-ready");
    expect(firstDocumentRow).toHaveClass("bg-surface");
    expect(firstDocumentRow).toHaveClass("border");
    expect(firstDocumentRow).toHaveClass("border-transparent");
    expect(firstDocumentRow).toHaveClass("ring-1");
    expect(firstDocumentRow).toHaveClass("ring-borderSubtle");
    const hoverableDocumentRow = screen.getByTestId("doc-row-doc-processing");
    expect(hoverableDocumentRow).toHaveClass("hover:border-borderSubtle");
    const searchInput = screen.getByRole("textbox", { name: /Buscar en datos extraídos/i });
    expect(searchInput).toHaveClass("border");
    expect(searchInput).toHaveClass("bg-surface");
    expect(screen.queryByTestId("view-mode-toggle")).toBeNull();
    expect(screen.queryByText(/Modo exploración/i)).toBeNull();
    expect(screen.queryByText(/Modo revisión/i)).toBeNull();
    expect(screen.queryByText(/Vista Docs · PDF · Datos/i)).toBeNull();
  });

  it("shows branding and actions inside expanded sidebar and no global brand header", async () => {
    renderApp();

    const sidebar = await screen.findByTestId("documents-sidebar");
    expect(sidebar).toHaveAttribute("data-expanded", "true");
    expect(screen.getByText("Barkibu")).toBeInTheDocument();
    expect(screen.getByText("Revisión de reembolsos")).toBeInTheDocument();
    expect(screen.queryByTestId("header-cluster-row")).toBeNull();

    const actionsCluster = screen.getByTestId("sidebar-actions-cluster");
    const refreshButton = within(actionsCluster).getByRole("button", { name: /Actualizar/i });
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton).toHaveClass("border");
    expect(refreshButton).toHaveClass("bg-surface");
    const pinButton = within(actionsCluster).getByRole("button", {
      name: /(Fijar|Fijada)/i,
    });
    expect(pinButton).toBeInTheDocument();
    expect(pinButton).toHaveClass("border");
    expect(pinButton).toHaveClass("bg-surface");
  });

  it("auto-collapses docs sidebar on desktop after selecting a document and expands on hover", async () => {
    await withDesktopHoverMatchMedia(async () => {
      renderApp();

      const sidebar = await screen.findByTestId("documents-sidebar");
      expect(sidebar).toHaveAttribute("data-expanded", "true");

      fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
      await waitForStructuredDataReady();

      expect(sidebar).toHaveAttribute("data-expanded", "false");
      expect(sidebar.className).toContain("w-16");
      expect(screen.queryByRole("button", { name: /Actualizar/i })).toBeNull();
      expect(screen.getByTestId("sidebar-collapsed-brand-mark")).toBeInTheDocument();
      const leftRailScroll = screen.getByTestId("left-panel-scroll");
      expect(leftRailScroll.className).toContain("[scrollbar-width:none]");

      fireEvent.mouseEnter(sidebar);
      expect(sidebar).toHaveAttribute("data-expanded", "true");
      expect(screen.getByRole("button", { name: /Actualizar/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /processing\.pdf/i }));
      expect(sidebar).toHaveAttribute("data-expanded", "true");

      fireEvent.click(screen.getByRole("button", { name: /failed\.pdf/i }));
      expect(sidebar).toHaveAttribute("data-expanded", "true");

      fireEvent.mouseLeave(sidebar);
      expect(sidebar).toHaveAttribute("data-expanded", "false");

      const collapsedReadyItem = screen.getByRole("button", {
        name: /ready\.pdf\s*\(Listo\)/i,
      });
      expect(collapsedReadyItem).toBeInTheDocument();
      expect(collapsedReadyItem).toHaveAttribute("data-testid", "doc-row-doc-ready");
      const collapsedSelectedItem = screen
        .getAllByRole("button", { name: /\.pdf/i })
        .find((button) => button.getAttribute("aria-pressed") === "true");
      expect(collapsedSelectedItem).toBeTruthy();
      const collapsedIcon = collapsedSelectedItem?.querySelector("svg");
      expect(collapsedIcon?.parentElement).toHaveClass("rounded-full");
      expect(collapsedIcon?.parentElement).toHaveClass("bg-surface");
      expect(collapsedIcon?.parentElement).toHaveClass("border");
      expect(collapsedIcon?.parentElement).toHaveClass("border-transparent");
      expect(collapsedIcon?.parentElement).toHaveClass("ring-1");
      expect(collapsedIcon?.parentElement).toHaveClass("ring-borderSubtle");
      const statusDot = collapsedReadyItem.querySelector('span[aria-hidden="true"]');
      expect(statusDot).toBeTruthy();
      expect(statusDot?.className).toContain("ring-2");

      fireEvent.click(collapsedReadyItem);
      expect(screen.getByTestId("pdf-viewer")).toHaveAttribute("data-focus-page", "");
    });
  });

  it("uploads from collapsed sidebar dropzone without auto-expanding", async () => {
    await withDesktopHoverMatchMedia(async () => {
      renderApp();
      const sidebar = await screen.findByTestId("documents-sidebar");

      fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
      await waitForStructuredDataReady();
      expect(sidebar).toHaveAttribute("data-expanded", "false");

      const dropzoneContainer = screen.getByTestId("sidebar-collapsed-dropzone");
      const dropzone = within(dropzoneContainer).getByRole("button");
      const file = new File(["pdf"], "rail-upload.pdf", { type: "application/pdf" });
      const dataTransfer = createDataTransfer(file);

      fireEvent.dragEnter(dropzone, { dataTransfer });
      expect(sidebar).toHaveAttribute("data-expanded", "false");

      fireEvent.drop(dropzone, { dataTransfer });
      expect(sidebar).toHaveAttribute("data-expanded", "false");

      await waitFor(() => {
        const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
        expect(calls.some(([url]) => String(url).includes("/documents/upload"))).toBe(true);
      });
    });
  });

  it("keeps sidebar open on mouse leave when pinned, and collapses again after unpin", async () => {
    await withDesktopHoverMatchMedia(async () => {
      renderApp();
      const sidebar = await screen.findByTestId("documents-sidebar");

      fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
      await waitForStructuredDataReady();
      expect(sidebar).toHaveAttribute("data-expanded", "false");

      fireEvent.mouseEnter(sidebar);
      expect(sidebar).toHaveAttribute("data-expanded", "true");

      fireEvent.click(screen.getByRole("button", { name: /Fijar/i }));
      fireEvent.mouseLeave(sidebar);
      expect(sidebar).toHaveAttribute("data-expanded", "true");

      fireEvent.mouseEnter(sidebar);
      fireEvent.click(screen.getByRole("button", { name: /Fijada/i }));
      expect(sidebar).toHaveAttribute("data-expanded", "true");
      fireEvent.mouseLeave(sidebar);
      expect(sidebar).toHaveAttribute("data-expanded", "false");
    });
  });

  it("uses polished structured header actions without Documento original button", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    const activeViewerTool = screen.getByRole("button", { name: /^Documento$/i });
    expect(activeViewerTool).toHaveAttribute("aria-pressed", "true");
    expect(activeViewerTool).toHaveClass("bg-surfaceMuted");

    expect(screen.getByRole("heading", { name: /Datos extraídos/i })).toBeInTheDocument();
    expect(screen.queryByText(/La confianza guia la atencion, no bloquea decisiones\./i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Abrir texto/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Documento original/i })).toBeNull();
  });

  it("shows clear search control and keeps focus after clearing", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    const searchInput = screen.getByRole("textbox", { name: /Buscar en datos extraídos/i });
    expect(screen.queryByRole("button", { name: /Limpiar búsqueda/i })).toBeNull();

    fireEvent.change(searchInput, { target: { value: "Luna" } });
    const clearButton = screen.getByRole("button", { name: /Limpiar búsqueda/i });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(searchInput).toHaveValue("");
    expect(searchInput).toHaveFocus();
    expect(screen.queryByRole("button", { name: /Limpiar búsqueda/i })).toBeNull();
  });

  it("shows only connectivity toast when preview download fails (no global red banner)", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents?") && method === "GET") {
        return new Response(
          JSON.stringify({
            items: [
              {
                document_id: "doc-ready",
                original_filename: "ready.pdf",
                created_at: "2026-02-09T10:00:00Z",
                status: "COMPLETED",
                status_label: "Completed",
                failure_type: null,
              },
            ],
            limit: 50,
            offset: 0,
            total: 1,
          }),
          { status: 200 }
        );
      }

      if (url.includes("/documents/doc-ready/download") && method === "GET") {
        throw new TypeError("Failed to fetch");
      }

      if (url.endsWith("/documents/doc-ready") && method === "GET") {
        return new Response(
          JSON.stringify({
            document_id: "doc-ready",
            original_filename: "ready.pdf",
            content_type: "application/pdf",
            file_size: 10,
            created_at: "2026-02-09T10:00:00Z",
            updated_at: "2026-02-10T10:00:00Z",
            status: "COMPLETED",
            status_message: "Completed.",
            failure_type: null,
            latest_run: { run_id: "run-doc-ready", state: "COMPLETED", failure_type: null },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/documents/doc-ready/review") && method === "GET") {
        return new Response(
          JSON.stringify({
            document_id: "doc-ready",
            latest_completed_run: {
              run_id: "run-doc-ready",
              state: "COMPLETED",
              completed_at: "2026-02-10T10:00:00Z",
              failure_type: null,
            },
            active_interpretation: {
              interpretation_id: "interp-doc-ready",
              version_number: 1,
              data: {
                document_id: "doc-ready",
                processing_run_id: "run-doc-ready",
                created_at: "2026-02-10T10:00:00Z",
                fields: [],
                confidence_policy: {
                  policy_version: "v1",
                  band_cutoffs: { low_max: 0.5, mid_max: 0.75 },
                },
              },
            },
            raw_text_artifact: {
              run_id: "run-doc-ready",
              available: false,
            },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/processing-history") && method === "GET") {
        return new Response(JSON.stringify({ document_id: "doc-ready", runs: [] }), { status: 200 });
      }

      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));

    expect(await screen.findByText(/No se pudo conectar con el servidor\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Sin conexión/i)).toBeNull();
    expect(screen.queryByText(/No se pudo cargar la vista previa del documento\./i)).toBeNull();
  });

  it("deduplicates connectivity toasts when preview and review fail in the same attempt", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents?") && method === "GET") {
        return new Response(
          JSON.stringify({
            items: [
              {
                document_id: "doc-ready",
                original_filename: "ready.pdf",
                created_at: "2026-02-09T10:00:00Z",
                status: "COMPLETED",
                status_label: "Completed",
                failure_type: null,
              },
            ],
            limit: 50,
            offset: 0,
            total: 1,
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/documents/doc-ready") && method === "GET") {
        return new Response(
          JSON.stringify({
            document_id: "doc-ready",
            original_filename: "ready.pdf",
            content_type: "application/pdf",
            file_size: 10,
            created_at: "2026-02-09T10:00:00Z",
            updated_at: "2026-02-10T10:00:00Z",
            status: "COMPLETED",
            status_message: "Completed.",
            failure_type: null,
            latest_run: { run_id: "run-doc-ready", state: "COMPLETED", failure_type: null },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/documents/doc-ready/download") && method === "GET") {
        throw new TypeError("Failed to fetch");
      }

      if (url.includes("/documents/doc-ready/review") && method === "GET") {
        throw new TypeError("Failed to fetch");
      }

      if (url.includes("/processing-history") && method === "GET") {
        return new Response(JSON.stringify({ document_id: "doc-ready", runs: [] }), { status: 200 });
      }

      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/No se pudo conectar con el servidor\./i)).toHaveLength(1);
    });
  });

  it("supports drag and drop upload from the viewer empty state", async () => {
    renderApp();

    const emptyState = screen.getByTestId("viewer-empty-state");
    const file = new File(["pdf"], "dragged.pdf", { type: "application/pdf" });
    const dataTransfer = createDataTransfer(file);

    fireEvent.dragEnter(emptyState, { dataTransfer });
    expect(screen.getByText(/Suelta el PDF para subirlo/i)).toBeInTheDocument();

    fireEvent.drop(emptyState, { dataTransfer });

    expect(await screen.findByText(/Documento subido correctamente/i)).toBeInTheDocument();

    await waitFor(() => {
      const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      expect(calls.some(([url]) => String(url).includes("/documents/upload"))).toBe(true);
      expect(calls.some(([url]) => String(url).includes("/documents/doc-new/download"))).toBe(true);
    });
  });

  it("copies the full extracted text with Copy all", async () => {
    const rawText = "Linea uno\nLinea dos\nLinea tres";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents?") && method === "GET") {
        return new Response(
          JSON.stringify({
            items: [
              {
                document_id: "doc-ready",
                original_filename: "ready.pdf",
                created_at: "2026-02-09T10:00:00Z",
                status: "COMPLETED",
                status_label: "Completed",
                failure_type: null,
              },
            ],
            limit: 50,
            offset: 0,
            total: 1,
          }),
          { status: 200 }
        );
      }

      if (url.includes("/documents/doc-ready/download") && method === "GET") {
        return new Response(new Blob(["pdf"], { type: "application/pdf" }), { status: 200 });
      }

      if (url.match(/\/documents\/doc-ready$/) && method === "GET") {
        return new Response(
          JSON.stringify({
            document_id: "doc-ready",
            original_filename: "ready.pdf",
            content_type: "application/pdf",
            file_size: 10,
            created_at: "2026-02-09T10:00:00Z",
            updated_at: "2026-02-10T10:00:00Z",
            status: "COMPLETED",
            status_message: "Completed",
            failure_type: null,
            latest_run: { run_id: "run-doc-ready", state: "COMPLETED", failure_type: null },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/processing-history") && method === "GET") {
        return new Response(JSON.stringify({ document_id: "doc-ready", runs: [] }), {
          status: 200,
        });
      }

      if (url.includes("/runs/run-doc-ready/artifacts/raw-text") && method === "GET") {
        return new Response(
          JSON.stringify({
            run_id: "run-doc-ready",
            artifact_type: "RAW_TEXT",
            content_type: "text/plain",
            text: rawText,
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    fireEvent.click(screen.getByRole("button", { name: /Texto extraido/i }));

    await screen.findByText(/Linea uno/i);
    fireEvent.click(screen.getByRole("button", { name: /Copiar todo/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(rawText);
    });
    expect(screen.getByText(/Texto copiado\./i)).toBeInTheDocument();
  });

  it("refreshes extracted text after reprocess without switching tabs", async () => {
    let phase: "initial" | "processing" | "completed" = "initial";
    let processingPollCount = 0;
    const oldText = "Texto antiguo";
    const newText = "Texto actualizado";

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents?") && method === "GET") {
        return new Response(
          JSON.stringify({
            items: [
              {
                document_id: "doc-ready",
                original_filename: "ready.pdf",
                created_at: "2026-02-09T10:00:00Z",
                status: phase === "processing" ? "PROCESSING" : "COMPLETED",
                status_label: "Completed",
                failure_type: null,
              },
            ],
            limit: 50,
            offset: 0,
            total: 1,
          }),
          { status: 200 }
        );
      }

      if (url.includes("/documents/doc-ready/download") && method === "GET") {
        return new Response(new Blob(["pdf"], { type: "application/pdf" }), {
          status: 200,
          headers: { "content-disposition": 'inline; filename="ready.pdf"' },
        });
      }

      if (url.endsWith("/documents/doc-ready") && method === "GET") {
        let latestState = "COMPLETED";
        let status = "COMPLETED";
        if (phase === "processing") {
          processingPollCount += 1;
          latestState = "RUNNING";
          status = "PROCESSING";
          if (processingPollCount >= 2) {
            phase = "completed";
            latestState = "COMPLETED";
            status = "COMPLETED";
          }
        }
        return new Response(
          JSON.stringify({
            document_id: "doc-ready",
            original_filename: "ready.pdf",
            content_type: "application/pdf",
            file_size: 10,
            created_at: "2026-02-09T10:00:00Z",
            updated_at: "2026-02-10T10:00:00Z",
            status,
            status_message: "state",
            failure_type: null,
            latest_run: { run_id: "run-doc-ready", state: latestState, failure_type: null },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/processing-history") && method === "GET") {
        return new Response(JSON.stringify({ document_id: "doc-ready", runs: [] }), {
          status: 200,
        });
      }

      if (url.includes("/documents/doc-ready/reprocess") && method === "POST") {
        phase = "processing";
        processingPollCount = 0;
        return new Response(
          JSON.stringify({
            run_id: "run-doc-ready",
            state: "QUEUED",
            created_at: "2026-02-10T10:00:00Z",
          }),
          { status: 201 }
        );
      }

      if (url.includes("/runs/run-doc-ready/artifacts/raw-text") && method === "GET") {
        if (phase === "processing") {
          return new Response(
            JSON.stringify({
              error_code: "ARTIFACT_NOT_READY",
              message: "Not ready",
              details: { reason: "RAW_TEXT_NOT_READY" },
            }),
            { status: 409 }
          );
        }
        return new Response(
          JSON.stringify({
            run_id: "run-doc-ready",
            artifact_type: "RAW_TEXT",
            content_type: "text/plain",
            text: phase === "initial" ? oldText : newText,
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    fireEvent.click(screen.getByRole("button", { name: /Texto extraido/i }));
    expect(
      screen.getByText(/¿El texto no es correcto\? Puedes reprocesarlo para regenerar la extraccion\./i)
    ).toBeInTheDocument();

    await screen.findByText(oldText);

    fireEvent.click(screen.getByRole("button", { name: /^Reprocesar$/i }));
    const reprocessDialog = await screen.findByRole("dialog", { name: /Reprocesar documento/i });
    fireEvent.click(within(reprocessDialog).getByRole("button", { name: /^Reprocesar$/i }));

    expect(await screen.findByText(/Reprocesamiento iniciado\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Procesamiento reiniciado/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reprocesando\.\.\./i })).toBeDisabled();
    expect(
      within(screen.getByRole("button", { name: /ready\.pdf/i })).getByText("Procesando")
    ).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByText(newText)).toBeInTheDocument();
        expect(
          within(screen.getByRole("button", { name: /ready\.pdf/i })).getByText("Listo")
        ).toBeInTheDocument();
      },
      { timeout: 10000 }
    );
  }, 12000);

  it("rolls back optimistic processing state when reprocess fails", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents?") && method === "GET") {
        return new Response(
          JSON.stringify({
            items: [
              {
                document_id: "doc-ready",
                original_filename: "ready.pdf",
                created_at: "2026-02-09T10:00:00Z",
                status: "COMPLETED",
                status_label: "Completed",
                failure_type: null,
              },
            ],
            limit: 50,
            offset: 0,
            total: 1,
          }),
          { status: 200 }
        );
      }

      if (url.includes("/documents/doc-ready/download") && method === "GET") {
        return new Response(new Blob(["pdf"], { type: "application/pdf" }), { status: 200 });
      }

      if (url.endsWith("/documents/doc-ready") && method === "GET") {
        return new Response(
          JSON.stringify({
            document_id: "doc-ready",
            original_filename: "ready.pdf",
            content_type: "application/pdf",
            file_size: 10,
            created_at: "2026-02-09T10:00:00Z",
            updated_at: "2026-02-10T10:00:00Z",
            status: "COMPLETED",
            status_message: "Completed",
            failure_type: null,
            latest_run: { run_id: "run-doc-ready", state: "COMPLETED", failure_type: null },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/processing-history") && method === "GET") {
        return new Response(JSON.stringify({ document_id: "doc-ready", runs: [] }), {
          status: 200,
        });
      }

      if (url.includes("/documents/doc-ready/reprocess") && method === "POST") {
        return new Response(JSON.stringify({ message: "reprocess failed" }), { status: 500 });
      }

      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    fireEvent.click(screen.getByRole("button", { name: /Texto extraido/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Reprocesar$/i }));
    const reprocessDialog = await screen.findByRole("dialog", { name: /Reprocesar documento/i });
    fireEvent.click(within(reprocessDialog).getByRole("button", { name: /^Reprocesar$/i }));

    expect((await screen.findAllByText(/reprocess failed/i)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        within(screen.getByRole("button", { name: /ready\.pdf/i })).getByText("Listo")
      ).toBeInTheDocument();
    });
  });

  it("does not show stale empty-search warning when there is no text", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents?") && method === "GET") {
        return new Response(
          JSON.stringify({
            items: [
              {
                document_id: "doc-empty",
                original_filename: "empty.pdf",
                created_at: "2026-02-09T10:00:00Z",
                status: "COMPLETED",
                status_label: "Completed",
                failure_type: null,
              },
            ],
            limit: 50,
            offset: 0,
            total: 1,
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/documents/doc-empty") && method === "GET") {
        return new Response(
          JSON.stringify({
            document_id: "doc-empty",
            original_filename: "empty.pdf",
            content_type: "application/pdf",
            file_size: 10,
            created_at: "2026-02-09T10:00:00Z",
            updated_at: "2026-02-10T10:00:00Z",
            status: "COMPLETED",
            status_message: "Completed",
            failure_type: null,
            latest_run: { run_id: "run-empty", state: "COMPLETED", failure_type: null },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/documents/doc-empty/download") && method === "GET") {
        return new Response(new Blob(["pdf"], { type: "application/pdf" }), {
          status: 200,
          headers: { "content-disposition": 'inline; filename="empty.pdf"' },
        });
      }

      if (url.includes("/processing-history") && method === "GET") {
        return new Response(JSON.stringify({ document_id: "doc-empty", runs: [] }), {
          status: 200,
        });
      }

      if (url.includes("/runs/run-empty/artifacts/raw-text") && method === "GET") {
        return new Response(
          JSON.stringify({
            error_code: "ARTIFACT_NOT_AVAILABLE",
            message: "Not available",
            details: { reason: "RAW_TEXT_NOT_AVAILABLE" },
          }),
          { status: 404 }
        );
      }

      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /empty\.pdf/i }));
    fireEvent.click(screen.getByRole("button", { name: /Texto extraido/i }));

    expect(screen.getByPlaceholderText(/Buscar en el texto/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Buscar$/i })).toBeDisabled();
    expect(screen.getByText(/Sin texto extraido\./i)).toBeInTheDocument();
    expect(screen.queryByText(/No hay texto disponible para buscar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/El texto extraido no esta disponible para este run\./i)).not.toBeInTheDocument();
  });

  it("opens the file picker when clicking anywhere in empty viewer", async () => {
    renderApp();

    const input = screen.getByLabelText(/Archivo PDF/i) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.click(screen.getByTestId("viewer-empty-state"));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("supports drag and drop upload when a document is already open", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitFor(() => {
      expect(screen.getByTestId("center-panel-scroll")).toBeInTheDocument();
    });

    const dropzone = screen.getByTestId("viewer-dropzone");
    const file = new File(["pdf"], "dragged-open.pdf", { type: "application/pdf" });
    const dataTransfer = createDataTransfer(file);

    fireEvent.dragEnter(dropzone, { dataTransfer });
    fireEvent.drop(dropzone, { dataTransfer });
    expect(await screen.findByText(/Documento subido correctamente/i)).toBeInTheDocument();

    await waitFor(() => {
      const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      expect(calls.some(([url]) => String(url).includes("/documents/upload"))).toBe(true);
      expect(calls.some(([url]) => String(url).includes("/documents/doc-new/download"))).toBe(true);
    });
  });

  it("shows validation error when dropping a non-PDF file", async () => {
    renderApp();

    const emptyState = screen.getByTestId("viewer-empty-state");
    const file = new File(["text"], "notes.txt", { type: "text/plain" });
    const dataTransfer = createDataTransfer(file);

    fireEvent.drop(emptyState, { dataTransfer });

    expect(await screen.findByText(/Solo se admiten archivos PDF\./i)).toBeInTheDocument();

    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls.some(([url]) => String(url).includes("/documents/upload"))).toBe(false);
  });

  it("shows size validation error when dropping a PDF over 20 MB", async () => {
    renderApp();

    const emptyState = screen.getByTestId("viewer-empty-state");
    const file = new File([new Uint8Array(20 * 1024 * 1024 + 1)], "huge.pdf", {
      type: "application/pdf",
    });
    const dataTransfer = createDataTransfer(file);

    fireEvent.drop(emptyState, { dataTransfer });

    expect(
      await screen.findByText(/El archivo supera el tamaño máximo \(20 MB\)\./i)
    ).toBeInTheDocument();

    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls.some(([url]) => String(url).includes("/documents/upload"))).toBe(false);
  }, 12000);

  it("renders the full Global Schema template with explicit missing states", async () => {
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();

    const hiddenCoreKeys = new Set([
      "claim_id",
      "document_date",
      "owner_id",
      "invoice_total",
      "covered_amount",
      "non_covered_amount",
      "line_item",
    ]);
    const uiLabelOverrides: Record<string, string> = {
      clinic_name: "Nombre",
      clinic_address: "Dirección",
      pet_name: "Nombre",
      dob: "Nacimiento",
      owner_name: "Nombre",
      owner_address: "Dirección",
      nhc: "NHC",
    };

    GLOBAL_SCHEMA.filter((field) => !hiddenCoreKeys.has(field.key)).forEach((field) => {
      const expectedLabel = uiLabelOverrides[field.key] ?? field.label;
      expect(within(panel).getAllByText(expectedLabel).length).toBeGreaterThan(0);
    });
    expect(within(panel).queryByText("ID de reclamacion")).toBeNull();
    expect(within(panel).queryByText("Fecha del documento")).toBeNull();
    expect(within(panel).queryByText("Importe total")).toBeNull();
    expect(within(panel).getByText("Plan de tratamiento")).toBeInTheDocument();
    expect(within(panel).getAllByText("—").length).toBeGreaterThan(0);
    expect(within(panel).getByText("Otros campos detectados")).toBeInTheDocument();
    expect(within(panel).getAllByText("Custom tag").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("Prioridad").length).toBeGreaterThan(0);
  });

  it("hides configured extracted fields from the extra section", async () => {
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();
    const extraSection = within(panel).getByTestId("other-extracted-fields-section");

    expect(within(extraSection).queryByText("Document date")).toBeNull();
    expect(within(extraSection).queryByText("Imagen")).toBeNull();
    expect(within(extraSection).queryByText("Imagine")).toBeNull();
    expect(within(extraSection).queryByText(/Imaging/i)).toBeNull();
  });

  it("uses structured owner/visit rows and long-text wrappers", async () => {
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();

    const ownerSectionTitle = within(panel).getByText("Propietario");
    const ownerSection = ownerSectionTitle.closest("section");
    expect(ownerSection).not.toBeNull();
    const caseSectionTitle = within(panel).getByText("Centro Veterinario");
    const caseSection = caseSectionTitle.closest("section");
    expect(caseSection).not.toBeNull();
    const clinicRow = within(caseSection as HTMLElement).getByTestId("core-row-clinic_name");
    expect(clinicRow).toHaveClass("grid");
    expect(clinicRow).toHaveClass("grid-cols-[var(--field-row-label-col)_minmax(0,1fr)]");
    expect(clinicRow).toHaveClass("gap-x-[var(--field-row-gap-x)]");
    const clinicValue = within(caseSection as HTMLElement).getByTestId("core-value-clinic_name");
    expect(clinicValue).toHaveClass("w-full");
    expect(clinicValue).toHaveClass("bg-surfaceMuted");
    expect(clinicValue).toHaveClass("border");
    expect(clinicValue).toHaveClass("border-borderSubtle");
    const treatmentValueCandidates = within(panel).getAllByTestId("field-value-treatment_plan");
    const treatmentValue =
      treatmentValueCandidates.find((node) => node.textContent?.includes("Reposo relativo")) ??
      treatmentValueCandidates[0];
    expect(treatmentValue.tagName).toBe("DIV");
    expect(treatmentValue).toHaveClass("min-h-[var(--long-text-min-height)]");
    expect(treatmentValue).toHaveClass("max-h-[var(--long-text-max-height)]");
    expect(treatmentValue).toHaveClass("overflow-auto");
    expect(treatmentValue).toHaveClass("px-[var(--value-padding-long-x)]");
    expect(treatmentValue).toHaveClass("whitespace-pre-wrap");
    expect(treatmentValue).toHaveClass("break-words");
    expect(within(panel).queryAllByRole("textbox")).toHaveLength(0);
    const ownerGrid = (ownerSection as HTMLElement).querySelector("div.grid");
    expect(ownerGrid).not.toBeNull();
    expect(ownerGrid).toHaveClass("grid-cols-1");
    expect(ownerGrid).not.toHaveClass("lg:grid-cols-2");

    const ownerNameRow = within(ownerSection as HTMLElement).getByTestId("owner-row-owner_name");
    expect(ownerNameRow).toHaveClass("grid");
    expect(ownerNameRow).toHaveClass("grid-cols-[var(--field-row-label-col)_minmax(0,1fr)]");
    expect(ownerNameRow).toHaveClass("gap-x-[var(--field-row-gap-x)]");

    const ownerNameLabel = within(ownerSection as HTMLElement).getByTestId("owner-label-owner_name");
    expect(ownerNameLabel).toHaveClass("self-start");
    const ownerNameDot = within(ownerSection as HTMLElement).getByTestId("owner-dot-owner_name");
    expect(ownerNameDot).toHaveClass("self-start");
    expect(ownerNameDot).toHaveClass("mt-[var(--dot-offset)]");
    expect(ownerNameDot).toHaveClass("h-4");
    expect(ownerNameDot).toHaveClass("w-4");
    expect(ownerNameDot).toHaveClass("items-center");
    expect(ownerNameDot).toHaveClass("justify-center");

    const ownerNameValue = within(ownerSection as HTMLElement).getByText("BEATRIZ ABARCA");
    expect(ownerNameValue).toHaveAttribute("data-testid", "owner-value-owner_name");
    expect(ownerNameValue).toHaveClass("text-left");
    expect(ownerNameValue).toHaveClass("break-words");
    expect(ownerNameValue).toHaveClass("bg-surfaceMuted");
    expect(ownerNameValue).toHaveClass("rounded-md");
    expect(ownerNameValue).toHaveClass("w-full");
    expect(ownerNameValue).toHaveClass("min-w-0");
    expect(ownerNameValue).toHaveClass("border");
    expect(ownerNameValue).toHaveClass("border-borderSubtle");

    const ownerAddressValue =
      within(ownerSection as HTMLElement).queryByTestId("owner-value-owner_address") ??
      within(ownerSection as HTMLElement).getByTestId("core-value-owner_address");
    expect(ownerAddressValue).toHaveClass("w-full");
    expect(ownerAddressValue).toHaveClass("bg-surfaceMuted");

    const visitSectionTitle = within(panel).getByText("Visitas");
    const visitSection = visitSectionTitle.closest("section");
    expect(visitSection).not.toBeNull();
    const visitGrid = (visitSection as HTMLElement).querySelector("div.grid");
    expect(visitGrid).not.toBeNull();
    expect(visitGrid).toHaveClass("lg:grid-cols-2");

    const visitDateRow = within(visitSection as HTMLElement).getByTestId("visit-row-visit_date");
    const visitReasonRow = within(visitSection as HTMLElement).getByTestId("visit-row-reason_for_visit");
    expect(visitDateRow).toHaveClass("grid");
    expect(visitReasonRow).toHaveClass("grid");
    expect(visitDateRow).toHaveClass("grid-cols-[var(--field-row-label-col)_minmax(0,1fr)]");
    expect(visitDateRow).toHaveClass("gap-x-[var(--field-row-gap-x)]");
    expect(visitReasonRow).toHaveClass("grid-cols-[var(--field-row-label-col)_minmax(0,1fr)]");
    expect(visitReasonRow).toHaveClass("gap-x-[var(--field-row-gap-x)]");

    const visitReasonLabel = within(visitSection as HTMLElement).getByTestId("visit-label-reason_for_visit");
    expect(visitReasonLabel).toHaveClass("self-start");
    const visitReasonDot = within(visitSection as HTMLElement).getByTestId("visit-dot-reason_for_visit");
    expect(visitReasonDot).toHaveClass("self-start");
    expect(visitReasonDot).toHaveClass("mt-[var(--dot-offset)]");

    const visitDateValue = within(visitSection as HTMLElement).getByTestId("visit-value-visit_date");
    const visitReasonValue = within(visitSection as HTMLElement).getByTestId("field-value-reason_for_visit");
    expect(visitDateValue).toHaveClass("w-full");
    expect(visitReasonValue).toHaveClass("w-full");
    expect(visitReasonValue).toHaveClass("min-h-[var(--long-text-min-height)]");
    expect(visitDateValue).toHaveClass("bg-surfaceMuted");
    expect(visitReasonValue).toHaveClass("bg-surfaceMuted");
    expect(visitDateValue).toHaveClass("border");
    expect(visitReasonValue).toHaveClass("border");

    const editButtons = within(panel).getAllByRole("button", { name: /Editar/i });
    expect(editButtons[0]).toHaveClass("border");
    expect(editButtons[0]).toHaveClass("hover:border-borderSubtle");
  });

  it("shows subtle CRÍTICO marker and confidence tooltip for core fields", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));

    await waitForStructuredDataReady();

    const panel = screen.getByTestId("right-panel-scroll");
    const criticalFields = GLOBAL_SCHEMA.filter((field) => field.critical);
    const nonCriticalFields = GLOBAL_SCHEMA.filter((field) => !field.critical);

    criticalFields.forEach((field) => {
      expect(within(panel).queryByTestId(`critical-indicator-${field.key}`)).toBeInTheDocument();
    });

    nonCriticalFields.forEach((field) => {
      expect(within(panel).queryByTestId(`critical-indicator-${field.key}`)).toBeNull();
    });

    const petNameCard = within(panel)
      .getByTestId("confidence-indicator-core:pet_name")
      .closest("article");
    expect(petNameCard).not.toBeNull();
    const petNameCritical = within(petNameCard as HTMLElement).getByTestId(
      "critical-indicator-pet_name"
    );
    expect(petNameCritical).toBeInTheDocument();
    const petNameConfidence = within(petNameCard as HTMLElement).getByTestId(
      "confidence-indicator-core:pet_name"
    );
    expect(petNameConfidence).toHaveAttribute("aria-label", expect.stringMatching(/Confianza:\s*\d+%/i));
    expect(petNameConfidence).toHaveAttribute(
      "aria-label",
      expect.not.stringMatching(/\((Alta|Media|Baja)\)/i)
    );
    expect(petNameConfidence).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Fiabilidad del candidato:\s*65%/i)
    );
    expect(petNameConfidence).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Ajuste por histórico de revisiones:\s*\+7%/i)
    );

    const clinicalRecordCard = within(panel).getByTestId("core-row-clinic_name").closest("article");
    expect(clinicalRecordCard).not.toBeNull();
    const clinicalRecordConfidence = within(clinicalRecordCard as HTMLElement).getByTestId(
      "confidence-indicator-core:clinic_name"
    );
    expect(clinicalRecordConfidence).toHaveAttribute("aria-label", "Campo vacío");
    expect(within(panel).queryByTestId("critical-indicator-diagnosis")).toBeInTheDocument();
  });

  it("renders canonical sections in US-44 fixed order", async () => {
    installCanonicalUs44FetchMock();
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();
    const panelText = panel.textContent ?? "";

    const orderedSections = [
      "Centro Veterinario",
      "Paciente",
      "Propietario",
      "Visitas",
      "Notas internas",
      "Otros campos detectados",
      "Detalles del informe",
    ];

    let lastIndex = -1;
    orderedSections.forEach((section) => {
      const index = panelText.indexOf(section);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    });
  });

  it("uses canonical field_slots for required placeholders (NHC missing renders —)", async () => {
    installCanonicalUs44FetchMock();
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();

    expect(within(panel).getByText("NHC")).toBeInTheDocument();
    expect(within(panel).getByText("NHC")).toHaveAttribute("title", "Número de historial clínico");
    expect(within(panel).getByTestId("core-value-nhc")).toHaveTextContent("—");
    const nhcIndicator = within(panel).getByTestId("confidence-indicator-core:nhc");
    expect(nhcIndicator).toHaveAttribute("aria-label", "Campo vacío");
    expect(nhcIndicator.className).toContain("border");
    expect(nhcIndicator.className).toContain("border-muted");
    expect(nhcIndicator.className).toContain("bg-surface");
    expect(nhcIndicator.className).not.toContain("bg-missing");
  });

  it("falls back to legacy-flat rendering when explicit schema_contract is legacy-flat and field_slots are malformed", async () => {
    installCanonicalUs44FetchMock({
      schemaContract: "legacy-flat",
      fieldSlots: { malformed: true } as unknown as Array<Record<string, unknown>>,
      visits: [],
    });
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();

    expect(within(panel).getByText("Visitas")).toBeInTheDocument();
    expect(within(panel).queryByText("Sin visitas detectadas.")).toBeNull();
    expect(within(panel).getByTestId("core-row-pet_name")).toBeInTheDocument();
  });

  it("shows Visitas empty state in canonical contract when visits=[]", async () => {
    installCanonicalUs44FetchMock({ visits: [] });
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();

    expect(within(panel).getByText("Visitas")).toBeInTheDocument();
    expect(within(panel).getByText("Sin visitas detectadas.")).toBeInTheDocument();
  });

  it("shows unassigned helper text in canonical contract when unassigned visit group is present", async () => {
    installCanonicalUs44FetchMock({
      visits: [
        {
          visit_id: "visit-regular",
          visit_date: "2026-02-20",
          admission_date: null,
          discharge_date: null,
          reason_for_visit: "Control",
          fields: [],
        },
        {
          visit_id: "unassigned",
          visit_date: null,
          admission_date: null,
          discharge_date: null,
          reason_for_visit: null,
          fields: [
            {
              field_id: "f-unassigned-diagnosis",
              key: "diagnosis",
              value: "Sin fecha de visita",
              value_type: "string",
              scope: "visit",
              section: "visits",
              classification: "medical_record",
              is_critical: true,
              origin: "machine",
            },
          ],
        },
      ],
    });
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();

    const hints = within(panel).getAllByTestId("visits-unassigned-hint");
    expect(hints).toHaveLength(1);
    expect(hints[0]).toHaveTextContent("Elementos detectados sin fecha/visita asociada.");
    expect(within(panel).queryAllByText("Elementos detectados sin fecha/visita asociada.")).toHaveLength(1);
    expect(within(panel).queryByText("Sin visitas detectadas.")).toBeNull();
  });

  it("suppresses Visitas empty state when only unassigned visit group exists", async () => {
    installCanonicalUs44FetchMock({
      visits: [
        {
          visit_id: "unassigned",
          visit_date: null,
          admission_date: null,
          discharge_date: null,
          reason_for_visit: null,
          fields: [],
        },
      ],
    });
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();

    expect(within(panel).queryByTestId("visits-unassigned-hint")).toBeNull();
    expect(within(panel).queryByText("Sin visitas detectadas.")).toBeNull();
  });

  it("does not show unassigned helper when all visit groups are assigned", async () => {
    installCanonicalUs44FetchMock({
      visits: [
        {
          visit_id: "visit-1",
          visit_date: "2026-02-20",
          admission_date: null,
          discharge_date: null,
          reason_for_visit: "Control",
          fields: [],
        },
      ],
    });
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();

    expect(within(panel).queryByTestId("visits-unassigned-hint")).toBeNull();
    expect(within(panel).queryByText("Sin visitas detectadas.")).toBeNull();
  });

  it("uses canonical detected summary as X/30 and increments X with visit concepts", async () => {
    const controlledFields = [
      {
        field_id: "f-nhc-alias",
        key: "medical_record_number",
        value: "NHC-001",
        value_type: "string",
        scope: "document",
        section: "clinic",
        classification: "medical_record",
        field_mapping_confidence: 0.6,
        origin: "machine",
      },
      {
        field_id: "f-pet-name",
        key: "pet_name",
        value: "Luna",
        value_type: "string",
        scope: "document",
        section: "patient",
        classification: "medical_record",
        field_mapping_confidence: 0.85,
        origin: "machine",
      },
      {
        field_id: "f-language",
        key: "language",
        value: "es",
        value_type: "string",
        scope: "document",
        section: "report_info",
        classification: "medical_record",
        field_mapping_confidence: 0.2,
        origin: "machine",
      },
      {
        field_id: "f-invoice-total",
        key: "invoice_total",
        value: "123.00",
        value_type: "string",
        scope: "document",
        section: "notes",
        classification: "medical_record",
        field_mapping_confidence: 0.95,
        origin: "machine",
      },
    ];
    const controlledVisits = [
      {
        visit_id: "visit-1",
        visit_date: "2026-02-11",
        admission_date: null,
        discharge_date: null,
        reason_for_visit: "Control",
        fields: [
          {
            field_id: "f-visit-diagnosis",
            key: "diagnosis",
            value: "Estable",
            value_type: "string",
            scope: "visit",
            section: "visits",
            classification: "medical_record",
            field_mapping_confidence: 0.65,
            origin: "machine",
          },
          {
            field_id: "f-visit-procedure",
            key: "procedure",
            value: "Exploración",
            value_type: "string",
            scope: "visit",
            section: "visits",
            classification: "medical_record",
            field_mapping_confidence: 0.3,
            origin: "machine",
          },
        ],
      },
    ];

    const expectedDetected = 3 + 2 + 2;
    installCanonicalUs44FetchMock({ fields: controlledFields, visits: controlledVisits });
    renderApp();
    await openReadyDocumentAndGetPanel();

    expect(screen.getByText("Campos detectados:")).toBeInTheDocument();
    expect(screen.getByTestId("detected-summary-total")).toHaveTextContent(
      `${expectedDetected}/30`
    );

    const low = Number(screen.getByTestId("detected-summary-low").textContent ?? "0");
    const medium = Number(screen.getByTestId("detected-summary-medium").textContent ?? "0");
    const high = Number(screen.getByTestId("detected-summary-high").textContent ?? "0");
    const unknown = Number(screen.getByTestId("detected-summary-unknown").textContent ?? "0");
    expect(low + medium + high + unknown).toBe(expectedDetected);
  });

  it("keeps canonical total at 30 and counts only document concepts when visits=[]", async () => {
    const documentOnlyFields = [
      {
        field_id: "f-pet-name",
        key: "pet_name",
        value: "Luna",
        value_type: "string",
        scope: "document",
        section: "patient",
        classification: "medical_record",
        field_mapping_confidence: 0.8,
        origin: "machine",
      },
      {
        field_id: "f-notes",
        key: "notes",
        value: "Sin incidencias",
        value_type: "string",
        scope: "document",
        section: "notes",
        classification: "medical_record",
        origin: "machine",
      },
    ];

    const expectedDetected = 2;
    installCanonicalUs44FetchMock({ fields: documentOnlyFields, visits: [] });
    renderApp();
    await openReadyDocumentAndGetPanel();

    expect(screen.getByTestId("detected-summary-total")).toHaveTextContent(
      `${expectedDetected}/30`
    );

    const low = Number(screen.getByTestId("detected-summary-low").textContent ?? "0");
    const medium = Number(screen.getByTestId("detected-summary-medium").textContent ?? "0");
    const high = Number(screen.getByTestId("detected-summary-high").textContent ?? "0");
    const unknown = Number(screen.getByTestId("detected-summary-unknown").textContent ?? "0");
    expect(low + medium + high + unknown).toBe(expectedDetected);
  });

  it("shows Spanish confidence labels in header dots and unknown tooltip", async () => {
    installCanonicalUs44FetchMock();
    renderApp();
    await openReadyDocumentAndGetPanel();

    expect(screen.getByTestId("detected-summary-dot-low")).toHaveAttribute(
      "aria-label",
      "Confianza baja"
    );
    expect(screen.getByTestId("detected-summary-dot-medium")).toHaveAttribute(
      "aria-label",
      "Confianza media"
    );
    expect(screen.getByTestId("detected-summary-dot-high")).toHaveAttribute(
      "aria-label",
      "Confianza alta"
    );
    expect(screen.getByTestId("detected-summary-dot-unknown")).toHaveAttribute(
      "aria-label",
      "Detectado (sin confianza)"
    );
    expect(screen.getByTestId("detected-summary-dot-unknown")).toHaveAttribute(
      "title",
      "Detectado (sin confianza)"
    );
  });

  it("renders Otros campos detectados only from other_fields[] in canonical contract", async () => {
    installCanonicalUs44FetchMock();
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();
    const extraSection = within(panel).getByTestId("other-extracted-fields-section");

    expect(within(extraSection).getByText("Contract other")).toBeInTheDocument();
    expect(within(extraSection).getByText("VISIBLE")).toBeInTheDocument();
    expect(within(extraSection).queryByText("Top level other should not render")).toBeNull();
    expect(within(extraSection).queryByText("NO")).toBeNull();
  });

  it("hides billing keys in canonical contract even when contract/data include them", async () => {
    installCanonicalUs44FetchMock();
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();

    expect(within(panel).queryByText("Invoice total")).toBeNull();
    expect(within(panel).queryByText("123.00")).toBeNull();
  });

  it("keeps canonical medical record panel clinical-only even when invoice_total is injected in field_slots and fields", async () => {
    installCanonicalUs44FetchMock({
      fieldSlots: [
        {
          concept_id: "clinic.name",
          section: "clinic",
          scope: "document",
          canonical_key: "clinic_name",
          label_key: "clinic_name",
        },
        {
          concept_id: "contract.invoice_total",
          section: "notes",
          scope: "document",
          canonical_key: "invoice_total",
          label_key: "invoice_total",
        },
      ],
      fields: [
        {
          field_id: "field-clinic-name-doc-canonical",
          key: "clinic_name",
          value: "Centro Norte",
          value_type: "string",
          scope: "document",
          section: "clinic",
          classification: "medical_record",
          is_critical: false,
          origin: "machine",
        },
        {
          field_id: "field-invoice-total-doc-canonical",
          key: "invoice_total",
          value: "123.00",
          value_type: "string",
          scope: "document",
          section: "notes",
          classification: "medical_record",
          is_critical: false,
          origin: "machine",
        },
      ],
    });
    renderApp();
    const panel = await openReadyDocumentAndGetPanel();

    expect(within(panel).getByText("Centro Veterinario")).toBeInTheDocument();
    expect(within(panel).queryByText(/invoice/i)).toBeNull();
    expect(within(panel).queryByText("123.00")).toBeNull();
  });

  it("shows an empty list state for repeatable fields", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));

    await waitForStructuredDataReady();

    const panel = screen.getByTestId("right-panel-scroll");
    const medicationCard = within(panel).getByText("Medicacion").closest("article");
    expect(medicationCard).not.toBeNull();
    expect(within(medicationCard as HTMLElement).getByText("Sin elementos")).toBeInTheDocument();
  });

  it("uses empty indicator for missing fields and keeps low-confidence filter scoped to non-empty values", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));

    await waitForStructuredDataReady();

    const panel = screen.getByTestId("right-panel-scroll");
    const missingIndicator = within(panel).getByTestId("confidence-indicator-core:clinic_name");
    expect(missingIndicator).toHaveAttribute("aria-label", "Campo vacío");
    expect(missingIndicator.className).toContain("border");
    expect(missingIndicator.className).toContain("border-muted");
    expect(missingIndicator.className).toContain("bg-surface");
    expect(missingIndicator.className).not.toContain("bg-missing");

    fireEvent.click(screen.getByRole("button", { name: "Baja" }));
    expect(within(screen.getByTestId("right-panel-scroll")).queryByTestId("field-trigger-core:clinic_name")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Baja" }));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar solo campos vacíos" }));
    expect(within(screen.getByTestId("right-panel-scroll")).getByTestId("field-trigger-core:clinic_name")).toBeInTheDocument();
  });

  it("shows degraded confidence mode and emits a diagnostic event when policy config is missing", async () => {
    const baseFetch = globalThis.fetch as typeof fetch;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/documents/doc-ready/review") && method === "GET") {
        const response = await baseFetch(input, init);
        const payload = await response.json();
        delete payload.active_interpretation?.data?.confidence_policy;
        return new Response(JSON.stringify(payload), { status: 200 });
      }
      return baseFetch(input, init);
    }) as typeof fetch;

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByTestId("confidence-policy-degraded");

    const indicator = screen.getByTestId("confidence-indicator-core:pet_name");
    expect(indicator).not.toHaveAttribute("aria-label", "Campo vacío");
    expect(indicator.className).toContain("bg-missing");
    expect(warnSpy).toHaveBeenCalledWith(
      "[confidence-policy]",
      expect.objectContaining({
        event_type: "CONFIDENCE_POLICY_CONFIG_MISSING",
        reason: "missing_policy_version",
      })
    );
  });

  it("does not show degraded confidence mode when policy config is valid", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    expect(screen.queryByTestId("confidence-policy-degraded")).toBeNull();
  });

  it("does not fallback to legacy confidence when field_mapping_confidence is missing", async () => {
    const baseFetch = globalThis.fetch as typeof fetch;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/documents/doc-ready/review") && method === "GET") {
        const response = await baseFetch(input, init);
        const payload = await response.json();
        const fields = payload.active_interpretation?.data?.fields;
        if (Array.isArray(fields)) {
          fields.forEach((field: Record<string, unknown>) => {
            delete field.field_mapping_confidence;
            field.confidence = 0.99;
          });
        }
        return new Response(JSON.stringify(payload), { status: 200 });
      }
      return baseFetch(input, init);
    }) as typeof fetch;

    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    expect(screen.queryByTestId("confidence-policy-degraded")).toBeNull();
    const indicator = screen.getByTestId("confidence-indicator-core:pet_name");
    expect(indicator.className).toContain("bg-missing");
    expect(indicator).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Confianza de mapeo no disponible/i)
    );
  });

  it("does not post extraction snapshots from the UI", async () => {
    const baseFetch = globalThis.fetch as typeof fetch;
    let snapshotPostAttempts = 0;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/debug/extraction-runs") && method === "POST") {
        snapshotPostAttempts += 1;
      }
      return baseFetch(input, init);
    }) as typeof fetch;

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    fireEvent.click(screen.getByRole("button", { name: /Actualizar/i }));
    await waitForStructuredDataReady();

    await waitFor(() => {
      expect(snapshotPostAttempts).toBe(0);
    });
  });

  it("shows visit date value when present", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));

    await waitForStructuredDataReady();

    const panel = screen.getByTestId("right-panel-scroll");
    const expectedDate = new Date("2026-02-11T00:00:00Z").toLocaleDateString("es-ES");
    const visitDateCard = within(panel).getByText("Fecha de visita").closest("article");
    expect(visitDateCard).not.toBeNull();
    expect(within(visitDateCard as HTMLElement).getByText(expectedDate)).toBeInTheDocument();
  });

  it("keeps right panel mounted and shows skeleton while loading interpretation", async () => {
    const baseFetch = globalThis.fetch as typeof fetch;
    let releaseReviewRequest!: () => void;

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents/doc-ready/review") && method === "GET") {
        return new Promise<Response>((resolve) => {
          releaseReviewRequest = () => {
            void baseFetch(input, init).then(resolve);
          };
        });
      }

      return baseFetch(input, init);
    }) as typeof fetch;

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));

    expect(await screen.findByText("Cargando interpretacion estructurada...")).toBeInTheDocument();
    expect(screen.getByTestId("right-panel-scroll")).toBeInTheDocument();
    expect(screen.getByTestId("review-core-skeleton")).toBeInTheDocument();
    expect(within(screen.getByTestId("right-panel-scroll")).queryByText("—")).toBeNull();

    expect(typeof releaseReviewRequest).toBe("function");
    releaseReviewRequest();

    expect(await screen.findByRole("heading", { name: /Datos extraídos/i })).toBeInTheDocument();
  });

  it("shows centered interpretation empty state, retries with loading button, and recovers on success", async () => {
    let reviewAttempts = 0;
    let resolveRetryReview!: () => void;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/documents?") && method === "GET") {
        return new Response(
          JSON.stringify({
            items: [
              {
                document_id: "doc-ready",
                original_filename: "ready.pdf",
                created_at: "2026-02-09T10:00:00Z",
                status: "COMPLETED",
                status_label: "Completed",
                failure_type: null,
              },
            ],
            limit: 50,
            offset: 0,
            total: 1,
          }),
          { status: 200 }
        );
      }

      if (url.includes("/documents/doc-ready/download") && method === "GET") {
        return new Response(new Blob(["pdf"], { type: "application/pdf" }), { status: 200 });
      }

      if (url.endsWith("/documents/doc-ready") && method === "GET") {
        return new Response(
          JSON.stringify({
            document_id: "doc-ready",
            original_filename: "ready.pdf",
            content_type: "application/pdf",
            file_size: 10,
            created_at: "2026-02-09T10:00:00Z",
            updated_at: "2026-02-10T10:00:00Z",
            status: "COMPLETED",
            status_message: "Completed.",
            failure_type: null,
            latest_run: { run_id: "run-doc-ready", state: "COMPLETED", failure_type: null },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/documents/doc-ready/review") && method === "GET") {
        reviewAttempts += 1;
        if (reviewAttempts === 1) {
          throw new TypeError("Failed to fetch");
        }
        return new Promise<Response>((resolve) => {
          resolveRetryReview = () =>
            resolve(
              new Response(
                JSON.stringify({
                  document_id: "doc-ready",
                  latest_completed_run: {
                    run_id: "run-doc-ready",
                    state: "COMPLETED",
                    completed_at: "2026-02-10T10:00:00Z",
                    failure_type: null,
                  },
                  active_interpretation: {
                    interpretation_id: "interp-doc-ready",
                    version_number: 1,
                    data: {
                      document_id: "doc-ready",
                      processing_run_id: "run-doc-ready",
                      created_at: "2026-02-10T10:00:00Z",
                      fields: [
                        {
                          field_id: "field-pet-name-doc-ready",
                          key: "pet_name",
                          value: "Luna",
                          value_type: "string",
                          field_candidate_confidence: 0.82,
                          field_mapping_confidence: 0.82,
                          is_critical: false,
                          origin: "machine",
                          evidence: { page: 1, snippet: "Paciente: Luna" },
                        },
                      ],
                      confidence_policy: {
                        policy_version: "v1",
                        band_cutoffs: { low_max: 0.5, mid_max: 0.75 },
                      },
                    },
                  },
                  raw_text_artifact: {
                    run_id: "run-doc-ready",
                    available: true,
                  },
                }),
                { status: 200 }
              )
            );
        });
      }

      if (url.includes("/processing-history") && method === "GET") {
        return new Response(JSON.stringify({ document_id: "doc-ready", runs: [] }), { status: 200 });
      }

      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));

    const unavailableTitle = await screen.findByText("Interpretación no disponible");
    const unavailableCard = unavailableTitle.closest("section");
    expect(unavailableCard).not.toBeNull();
    expect(
      within(unavailableCard as HTMLElement).getByText(
        /No se pudo cargar la interpretación\. Comprueba tu conexión y vuelve a intentarlo\./i
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Error loading interpretation/i)).toBeNull();
    expect(screen.queryByText(/No completed run found/i)).toBeNull();

    const panelRetryButton = within(unavailableCard as HTMLElement).getByRole("button", {
      name: /Reintentar/i,
    });
    const attemptsBeforeRetry = reviewAttempts;
    fireEvent.click(panelRetryButton);
    await waitFor(() => {
      expect(reviewAttempts).toBeGreaterThan(attemptsBeforeRetry);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Reintentando\.\.\./i }) ??
          screen.queryByText(/Cargando interpretacion estructurada\.\.\./i)
      ).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /Ver detalles técnicos/i })).toBeNull();

    expect(typeof resolveRetryReview).toBe("function");
    resolveRetryReview();
    expect(await screen.findByRole("heading", { name: /Datos extraídos/i })).toBeInTheDocument();
    expect(screen.getByText(/No se pudo conectar con el servidor\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Sin conexión/i)).toBeNull();
  });

  it("keeps docs sidebar available in unified layout", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    expect(screen.getByTestId("documents-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("left-panel-scroll")).toBeInTheDocument();
    expect(screen.getByTestId("right-panel-scroll")).toBeInTheDocument();
    expect(screen.getByTestId("center-panel-scroll")).toBeInTheDocument();
  });

  it("renders review split grid with draggable handle", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    const layoutGrid = screen.getByTestId("document-layout-grid");
    expect(layoutGrid).toBeInTheDocument();
    expect(screen.getByTestId("review-split-grid")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Redimensionar paneles de revisión/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Restablecer ancho de paneles/i })).toBeNull();
  });

  it("updates split ratio on drag and persists snapped value", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    const splitGrid = screen.getByTestId("review-split-grid") as HTMLDivElement;
    vi.spyOn(splitGrid, "getBoundingClientRect").mockReturnValue({
      width: 1200,
      height: 800,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const handle = screen.getByTestId("review-split-handle");
    fireEvent.mouseDown(handle, { clientX: 620 });
    fireEvent.mouseMove(window, { clientX: 740 });
    fireEvent.mouseUp(window);

    await waitFor(() => {
      const storedRatio = Number(window.localStorage.getItem("reviewSplitRatio"));
      expect(storedRatio).toBeGreaterThan(0.64);
      expect(storedRatio).toBeLessThan(0.65);
      expect(splitGrid.style.gridTemplateColumns).toContain(`${storedRatio}fr`);
    });
  });

  it("clamps split drag to current container width when sidebar is collapsed", async () => {
    const INITIAL_GRID_WIDTH_PX = 1380;
    const NARROW_GRID_WIDTH_PX = 1030;
    await withDesktopHoverMatchMedia(async () => {
      renderApp();

      const sidebar = await screen.findByTestId("documents-sidebar");
      fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
      await waitForStructuredDataReady();
      expect(sidebar).toHaveAttribute("data-expanded", "false");

      const splitGrid = screen.getByTestId("review-split-grid") as HTMLDivElement;
      let simulatedWidth = INITIAL_GRID_WIDTH_PX;
      vi.spyOn(splitGrid, "getBoundingClientRect").mockImplementation(
        () =>
          ({
            width: simulatedWidth,
            height: 800,
            top: 0,
            left: 0,
            right: simulatedWidth,
            bottom: 800,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }) as DOMRect
      );

      const handle = screen.getByTestId("review-split-handle");
      fireEvent.mouseDown(handle, { clientX: 640 });

      fireEvent.mouseEnter(sidebar);
      expect(sidebar).toHaveAttribute("data-expanded", "true");
      simulatedWidth = NARROW_GRID_WIDTH_PX;

      fireEvent.mouseMove(window, { clientX: 10 });
      fireEvent.mouseUp(window);

      const expectedMinRatio = MIN_PDF_PANEL_WIDTH_PX / (simulatedWidth - SPLITTER_COLUMN_WIDTH_PX);
      await waitFor(() => {
        const storedRatio = Number(window.localStorage.getItem("reviewSplitRatio"));
        expect(storedRatio).toBeGreaterThanOrEqual(expectedMinRatio - 0.001);
      });
    });
  });

  it("re-clamps split ratio after expanding sidebar when splitter was dragged to minimum", async () => {
    const COLLAPSED_GRID_WIDTH_PX = 1380;
    const EXPANDED_GRID_WIDTH_PX = 1030;
    await withDesktopHoverMatchMedia(async () => {
      renderApp();

      const sidebar = await screen.findByTestId("documents-sidebar");
      fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
      await waitForStructuredDataReady();
      expect(sidebar).toHaveAttribute("data-expanded", "false");

      const splitGrid = screen.getByTestId("review-split-grid") as HTMLDivElement;
      let simulatedWidth = COLLAPSED_GRID_WIDTH_PX;
      vi.spyOn(splitGrid, "getBoundingClientRect").mockImplementation(
        () =>
          ({
            width: simulatedWidth,
            height: 800,
            top: 0,
            left: 0,
            right: simulatedWidth,
            bottom: 800,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }) as DOMRect
      );

      const handle = screen.getByTestId("review-split-handle");
      fireEvent.mouseDown(handle, { clientX: 640 });
      fireEvent.mouseMove(window, { clientX: 10 });
      fireEvent.mouseUp(window);

      simulatedWidth = EXPANDED_GRID_WIDTH_PX;
      fireEvent.mouseEnter(sidebar);
      expect(sidebar).toHaveAttribute("data-expanded", "true");

      const expectedExpandedMinRatio =
        MIN_PDF_PANEL_WIDTH_PX / (simulatedWidth - SPLITTER_COLUMN_WIDTH_PX);
      await waitFor(() => {
        const storedRatio = Number(window.localStorage.getItem("reviewSplitRatio"));
        expect(storedRatio).toBeGreaterThanOrEqual(expectedExpandedMinRatio - 0.001);
      });
    });
  });

  it("keeps stable split bounds when expanded width is narrower than the split min width", async () => {
    const COLLAPSED_GRID_WIDTH_PX = 1380;
    const EXPANDED_GRID_WIDTH_PX = 900;
    await withDesktopHoverMatchMedia(async () => {
      renderApp();

      const sidebar = await screen.findByTestId("documents-sidebar");
      fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
      await waitForStructuredDataReady();
      expect(sidebar).toHaveAttribute("data-expanded", "false");

      const splitGrid = screen.getByTestId("review-split-grid") as HTMLDivElement;
      let simulatedWidth = COLLAPSED_GRID_WIDTH_PX;
      vi.spyOn(splitGrid, "getBoundingClientRect").mockImplementation(
        () =>
          ({
            width: simulatedWidth,
            height: 800,
            top: 0,
            left: 0,
            right: simulatedWidth,
            bottom: 800,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }) as DOMRect
      );
      Object.defineProperty(splitGrid, "scrollWidth", {
        configurable: true,
        get: () => REVIEW_SPLIT_MIN_WIDTH_PX,
      });

      const handle = screen.getByTestId("review-split-handle");
      fireEvent.mouseDown(handle, { clientX: 640 });
      fireEvent.mouseMove(window, { clientX: 10 });
      fireEvent.mouseUp(window);

      simulatedWidth = EXPANDED_GRID_WIDTH_PX;
      fireEvent.mouseEnter(sidebar);
      expect(sidebar).toHaveAttribute("data-expanded", "true");

      await waitFor(() => {
        const storedRatio = Number(window.localStorage.getItem("reviewSplitRatio"));
        const expectedMinRatio =
          MIN_PDF_PANEL_WIDTH_PX / (REVIEW_SPLIT_MIN_WIDTH_PX - SPLITTER_COLUMN_WIDTH_PX);
        expect(storedRatio).toBeGreaterThanOrEqual(expectedMinRatio - 0.001);
      });
      expect(splitGrid.style.minWidth).toBe(`${REVIEW_SPLIT_MIN_WIDTH_PX}px`);
    });
  });

  it("restores default split ratio on handle double-click", async () => {
    window.localStorage.setItem("reviewSplitRatio", "0.5");
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    const splitGrid = screen.getByTestId("review-split-grid") as HTMLDivElement;
    vi.spyOn(splitGrid, "getBoundingClientRect").mockReturnValue({
      width: 1200,
      height: 800,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const handle = screen.getByTestId("review-split-handle");
    expect(splitGrid.style.gridTemplateColumns).toContain("0.5fr");
    fireEvent.doubleClick(handle);

    await waitFor(() => {
      expect(splitGrid.style.gridTemplateColumns).toContain("0.62fr");
      expect(window.localStorage.getItem("reviewSplitRatio")).toBe("0.62");
    });
  });

  it("navigates PDF from row click without opening source drawer", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    const hasInlinePdf = Boolean(screen.queryByTestId("center-panel-scroll"));
    clickPetNameField();

    expect(screen.queryByTestId("source-drawer")).toBeNull();
    const viewer = screen.getByTestId("pdf-viewer");
    expect(viewer).toHaveAttribute("data-focus-page", "1");
    expect(viewer).toHaveAttribute("data-highlight-snippet", "Paciente: Luna");
    if (hasInlinePdf) {
      expect(screen.getByTestId("center-panel-scroll")).toBeInTheDocument();
    }
  });

  it("keeps independent scroll containers and preserves right panel scroll on row clicks", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    const leftPanelScroll = screen.getByTestId("left-panel-scroll");
    const centerPanelScroll = screen.getByTestId("center-panel-scroll");
    const rightPanelScroll = screen.getByTestId("right-panel-scroll");
    expect(leftPanelScroll).toBeInTheDocument();
    expect(centerPanelScroll).toBeInTheDocument();
    expect(rightPanelScroll).toBeInTheDocument();

    rightPanelScroll.scrollTop = 140;
    fireEvent.scroll(rightPanelScroll);

    clickPetNameField();

    expect(screen.getByTestId("right-panel-scroll")).toBe(rightPanelScroll);
    expect(rightPanelScroll.scrollTop).toBe(140);
  });

  it("keeps evidence behavior deterministic with tooltip fallback and row navigation", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    const confidenceIndicator = screen.getByTestId("confidence-indicator-core:pet_name");
    expect(confidenceIndicator).toHaveAttribute("aria-label", expect.stringMatching(/Página 1/i));
    expect(confidenceIndicator).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Ajuste por histórico de revisiones:\s*\+7%/i)
    );

    clickPetNameField();
    const viewer = screen.getAllByTestId("pdf-viewer")[0];
    expect(viewer).toHaveAttribute("data-focus-page", "1");
    expect(viewer).toHaveAttribute("data-highlight-snippet", "Paciente: Luna");
    expect(screen.queryByTestId("source-drawer")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Especie/i }));
    expect(screen.queryByText(/Sin evidencia disponible para este campo\./i)).toBeNull();
    expect(screen.queryByTestId("source-drawer")).toBeNull();
  });

  it("hides inline Fuente rows and keeps evidence details in confidence tooltip", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    expect(screen.queryByText(/^Fuente:/i)).toBeNull();
    const withEvidence = screen.getByTestId("confidence-indicator-core:pet_name");
    expect(withEvidence).toHaveAttribute("aria-label", expect.stringMatching(/Página 1/i));
    expect(withEvidence).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Fiabilidad del candidato:\s*65%/i)
    );

    const withoutEvidence = screen.getByTestId("confidence-indicator-core:owner_name");
    expect(withoutEvidence).toHaveAttribute("aria-label", expect.not.stringMatching(/Página/i));
    expect(withoutEvidence).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Ajuste por histórico de revisiones:\s*0%/i)
    );
    expect(withoutEvidence).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Fiabilidad del candidato:\s*No disponible/i)
    );
    const fieldTrigger = screen.getByTestId("field-trigger-core:pet_name");
    fireEvent.focus(fieldTrigger);
    await waitFor(() => {
      expect(
        Array.from(document.body.querySelectorAll("p")).some((node) =>
          /Fiabilidad del candidato:\s*65%/i.test(node.textContent ?? "")
        )
      ).toBe(true);
    });
    fireEvent.blur(fieldTrigger);
    expect(screen.queryByTestId("source-drawer")).toBeNull();
  });

  it("hands off tooltip visibility between field row and critical badge hover", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    const fieldTrigger = screen.getByTestId("field-trigger-core:pet_name");
    const criticalIndicator = screen.getByTestId("critical-indicator-pet_name");
    const hasFieldTooltipContent = () =>
      Array.from(document.body.querySelectorAll("p")).some((node) =>
        /Fiabilidad del candidato:/i.test(node.textContent ?? "")
      );
    const hasCriticalTooltip = () =>
      Array.from(document.body.querySelectorAll('[role="tooltip"]')).some((node) =>
        /CRÍTICO/i.test(node.textContent ?? "")
      );

    fireEvent.mouseEnter(fieldTrigger);
    await waitFor(() => {
      expect(hasFieldTooltipContent()).toBe(true);
    });
    expect(hasCriticalTooltip()).toBe(false);

    fireEvent.mouseEnter(criticalIndicator);
    await waitFor(() => {
      expect(hasCriticalTooltip()).toBe(true);
    });
    expect(hasFieldTooltipContent()).toBe(false);

    fireEvent.mouseLeave(criticalIndicator);
    fireEvent.mouseEnter(fieldTrigger);
    await waitFor(() => {
      expect(hasFieldTooltipContent()).toBe(true);
    });
    expect(hasCriticalTooltip()).toBe(false);

    fireEvent.mouseLeave(fieldTrigger);
    await waitFor(() => {
      expect(hasFieldTooltipContent()).toBe(false);
    });
  });

  it("applies semantic styling for positive, negative and neutral adjustment values in tooltip", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();
    const findAdjustmentLine = async (pattern: RegExp): Promise<HTMLElement> => {
      let line: HTMLElement | undefined;
      await waitFor(() => {
        line = Array.from(document.body.querySelectorAll("p")).find((node) =>
          pattern.test(node.textContent ?? "")
        ) as HTMLElement | undefined;
        expect(line).toBeDefined();
      });
      return line!;
    };
    const resolveTriggerFromIndicator = (indicator: HTMLElement): HTMLElement => {
      const fieldCard = indicator.closest("article");
      expect(fieldCard).not.toBeNull();
      const trigger = (fieldCard as HTMLElement).querySelector('[role="button"]');
      expect(trigger).not.toBeNull();
      return trigger as HTMLElement;
    };

    const positiveIndicator = screen.getByTestId("confidence-indicator-core:pet_name");
    expect(positiveIndicator).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Ajuste por histórico de revisiones:\s*\+7%/i)
    );
    const positive = resolveTriggerFromIndicator(positiveIndicator);
    fireEvent.focus(positive);
    const positiveLine = await findAdjustmentLine(
      /Ajuste por histórico de revisiones:\s*\+7%/i
    );
    const positiveValue = positiveLine.querySelector("span");
    expect(positiveValue).not.toBeNull();
    expect(positiveValue).toHaveClass("text-[var(--status-success)]");
    fireEvent.blur(positive);

    const negativeIndicator = screen
      .getAllByTestId(/confidence-indicator-/)
      .find((element) =>
        element.getAttribute("aria-label")?.includes("Ajuste por histórico de revisiones: -4%")
      );
    expect(negativeIndicator).toBeDefined();
    if (!negativeIndicator) {
      throw new Error("Expected negative adjustment indicator to exist.");
    }
    expect(negativeIndicator).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Ajuste por histórico de revisiones:\s*-4%/i)
    );
    const negative = resolveTriggerFromIndicator(negativeIndicator);
    fireEvent.focus(negative);
    const negativeLine = await findAdjustmentLine(
      /Ajuste por histórico de revisiones:\s*-4%/i
    );
    const negativeValue = negativeLine.querySelector("span");
    expect(negativeValue).not.toBeNull();
    expect(negativeValue).toHaveClass("text-[var(--status-error)]");
    fireEvent.blur(negative);

    const neutralIndicator = screen.getByTestId("confidence-indicator-core:owner_name");
    expect(neutralIndicator).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Ajuste por histórico de revisiones:\s*0%/i)
    );
    const neutral = resolveTriggerFromIndicator(neutralIndicator);
    fireEvent.focus(neutral);
    const neutralLine = await findAdjustmentLine(
      /Ajuste por histórico de revisiones:\s*0%/i
    );
    const neutralValue = neutralLine.querySelector("span");
    expect(neutralValue).not.toBeNull();
    expect(neutralValue).toHaveClass("text-muted");
  });

  it("toggles report layout in DEV with Shift+L and persists selection", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    expect(screen.queryByRole("button", { name: /\+\s*Añadir/i })).toBeNull();
    expect(window.localStorage.getItem("reportLayout")).toBe("2");

    fireEvent.keyDown(window, { key: "L", shiftKey: true });

    await waitFor(() => {
      expect(window.localStorage.getItem("reportLayout")).toBe("1");
    });
    expect(screen.queryByRole("button", { name: /\+\s*Añadir/i })).toBeNull();

    fireEvent.keyDown(window, { key: "L", shiftKey: true });

    await waitFor(() => {
      expect(window.localStorage.getItem("reportLayout")).toBe("2");
    });
    expect(screen.queryByRole("button", { name: /\+\s*Añadir/i })).toBeNull();
  });

  it("initializes report layout from query param before localStorage", async () => {
    window.localStorage.setItem("reportLayout", "2");
    window.history.replaceState({}, "", "/?reportLayout=1");
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();
    expect(screen.queryByRole("button", { name: /\+\s*Añadir/i })).toBeNull();
    expect(window.localStorage.getItem("reportLayout")).toBe("1");
  });

  it("initializes report layout from localStorage when query param is missing", async () => {
    window.localStorage.setItem("reportLayout", "1");
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();
    expect(screen.queryByRole("button", { name: /\+\s*Añadir/i })).toBeNull();
    expect(window.localStorage.getItem("reportLayout")).toBe("1");
  });

  it("synchronizes selected field with viewer context repeatedly, including repeated same-field clicks", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    fireEvent.click(screen.getByRole("button", { name: /Gastroenteritis/i }));
    let viewer = screen.getByTestId("pdf-viewer");
    expect(viewer).toHaveAttribute("data-focus-page", "2");
    expect(viewer).toHaveAttribute("data-highlight-snippet", "Diagnostico: Gastroenteritis");
    const firstRequestId = Number(viewer.getAttribute("data-focus-request-id"));

    clickPetNameField();
    viewer = screen.getByTestId("pdf-viewer");
    expect(viewer).toHaveAttribute("data-focus-page", "1");
    expect(viewer).toHaveAttribute("data-highlight-snippet", "Paciente: Luna");
    const secondRequestId = Number(viewer.getAttribute("data-focus-request-id"));
    expect(secondRequestId).toBeGreaterThan(firstRequestId);

    clickPetNameField();
    viewer = screen.getByTestId("pdf-viewer");
    const thirdRequestId = Number(viewer.getAttribute("data-focus-request-id"));
    expect(thirdRequestId).toBeGreaterThan(secondRequestId);
    expect(screen.queryByTestId("source-drawer")).toBeNull();
  });

  it("keeps source drawer closed on plain field click", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await waitForStructuredDataReady();

    clickPetNameField();
    expect(screen.queryByTestId("source-drawer")).toBeNull();
  });

  it("shows destructive blocked-edit toast on first reviewed-mode click", async () => {
    installReviewedModeFetchMock();
    renderApp();

    await openReviewedDocument();
    fireEvent.click(screen.getByRole("button", { name: /Marcar revisado/i }));
    await screen.findByRole("button", { name: /^Reabrir$/i });
    expect(getPetNameFieldButton()).toHaveAttribute("aria-disabled", "true");

    fireEvent.mouseUp(getPetNameFieldButton(), { button: 0 });

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Documento revisado: edición bloqueada.");
    expect(status).toHaveClass("border-red-300", "bg-red-50", "text-red-700");
  });

  it("does not show blocked-edit toast while selecting text in reviewed mode", async () => {
    installReviewedModeFetchMock();
    const getSelectionSpy = vi
      .spyOn(window, "getSelection")
      .mockReturnValue({ toString: () => "Luna" } as unknown as Selection);

    renderApp();
    await openReviewedDocument();

    fireEvent.click(screen.getByRole("button", { name: /Marcar revisado/i }));
    await screen.findByRole("button", { name: /^Reabrir$/i });
    fireEvent.click(screen.getByLabelText(/Cerrar notificacion de accion/i));

    fireEvent.mouseUp(getPetNameFieldButton(), { button: 0 });

    expect(screen.queryByText(/Documento revisado: edición bloqueada\./i)).toBeNull();
    getSelectionSpy.mockRestore();
  });

  it("renders reviewed warning banner with amber border styling", async () => {
    installReviewedModeFetchMock();
    renderApp();

    await openReviewedDocument();
    fireEvent.click(screen.getByRole("button", { name: /Marcar revisado/i }));

    const bannerText = await screen.findByText(/Los datos están en modo de solo lectura\./i);
    const banner = bannerText.closest("p");
    expect(banner).not.toBeNull();
    expect(banner).toHaveClass("border", "border-statusWarn", "bg-surface", "text-text");
  });

  it("toggles reviewed action visual state and supports keyboard blocked-edit feedback", async () => {
    installReviewedModeFetchMock();
    renderApp();

    await openReviewedDocument();

    const markButton = screen.getByRole("button", { name: /Marcar revisado/i });
    expect(markButton).toHaveClass("bg-accent", "text-accentForeground");
    fireEvent.click(markButton);

    const reopenButton = await screen.findByRole("button", { name: /^Reabrir$/i });
    expect(reopenButton).toHaveClass("border", "bg-surface", "text-text");

    fireEvent.keyDown(getPetNameFieldButton(), { key: "Enter" });
    await screen.findByText(/Documento revisado: edición bloqueada\./i);

    fireEvent.click(reopenButton);
    await screen.findByRole("button", { name: /Marcar revisado/i });
  });
});


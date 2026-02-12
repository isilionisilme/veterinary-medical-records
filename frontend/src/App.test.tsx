import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";
import { GLOBAL_SCHEMA_V0 } from "./lib/globalSchemaV0";

vi.mock("./components/PdfViewer", () => ({
  PdfViewer: (props: {
    focusPage?: number | null;
    highlightSnippet?: string | null;
    focusRequestId?: number;
  }) => (
    <div
      data-testid="pdf-viewer"
      data-focus-page={props.focusPage ?? ""}
      data-highlight-snippet={props.highlightSnippet ?? ""}
      data-focus-request-id={props.focusRequestId ?? 0}
    />
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

function createDataTransfer(file: File): DataTransfer {
  return {
    files: [file],
    items: [{ kind: "file", type: file.type }],
    types: ["Files"],
  } as unknown as DataTransfer;
}

describe("App upload and list flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

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
                schema_version: "v0",
                document_id: docId,
                processing_run_id: `run-${docId}`,
                created_at: "2026-02-10T10:00:00Z",
                fields: [
                  {
                    field_id: `field-document-date-${docId}`,
                    key: "document_date",
                    value: null,
                    value_type: "date",
                    confidence: 0.32,
                    is_critical: false,
                    origin: "machine",
                  },
                  {
                    field_id: `field-visit-date-${docId}`,
                    key: "visit_date",
                    value: "2026-02-11T00:00:00Z",
                    value_type: "date",
                    confidence: 0.74,
                    is_critical: true,
                    origin: "machine",
                  },
                  {
                    field_id: `field-pet-name-${docId}`,
                    key: "pet_name",
                    value: "Luna",
                    value_type: "string",
                    confidence: 0.82,
                    is_critical: false,
                    origin: "machine",
                    evidence: { page: 1, snippet: "Paciente: Luna" },
                  },
                  {
                    field_id: `field-diagnosis-${docId}`,
                    key: "diagnosis",
                    value: "Gastroenteritis",
                    value_type: "string",
                    confidence: 0.62,
                    is_critical: false,
                    origin: "machine",
                    evidence: { page: 2, snippet: "Diagnostico: Gastroenteritis" },
                  },
                  {
                    field_id: `field-extra-${docId}`,
                    key: "custom_tag",
                    value: "Prioridad",
                    value_type: "string",
                    confidence: 0.88,
                    is_critical: false,
                    origin: "machine",
                    evidence: { page: 1, snippet: "Prioridad: Alta" },
                  },
                ],
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
    expect(screen.queryByText(/Tamaño maximo: 20 MB\./i)).toBeNull();
    expect(screen.getByLabelText(/Informacion de formatos y tamano/i)).toBeInTheDocument();
    expect(screen.queryByText(/Selecciona un PDF/i)).toBeNull();
  });

  it("shows required list status labels", async () => {
    renderApp();
    expect(await screen.findByText("Procesando")).toBeInTheDocument();
    expect(screen.getByText("Listo para revision")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Tardando mas de lo esperado")).toBeInTheDocument();
  });

  it("updates PROCESSING to Listo para revision after refresh", async () => {
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
          "Listo para revision"
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
      expect(screen.queryByTestId("review-docs-handle")).toBeNull();
      expect(screen.getByTestId("view-mode-browse")).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByTestId("view-mode-review")).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: /Modo revisión/i })).toBeInTheDocument();
    });
  });

  it("uses consistent docs sidebar visibility by mode", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByText("Campos core");

    expect(screen.getByTestId("left-panel-scroll")).toBeInTheDocument();
    expect(screen.queryByTestId("review-docs-handle")).toBeNull();

    fireEvent.click(screen.getByTestId("view-mode-review"));
    expect(screen.queryByTestId("left-panel-scroll")).toBeNull();
    expect(screen.getByTestId("review-docs-handle")).toBeInTheDocument();
    expect(screen.queryByText(/Mostrar documentos/i)).toBeNull();

    fireEvent.click(screen.getByTestId("view-mode-browse"));
    expect(screen.getByTestId("left-panel-scroll")).toBeInTheDocument();
    expect(screen.queryByTestId("review-docs-handle")).toBeNull();
  });

  it("uses polished structured header actions and opens source from Documento original", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByText("Campos core");

    expect(screen.getByRole("heading", { name: /Datos estructurados/i })).toBeInTheDocument();
    expect(screen.queryByText(/La confianza guia la atencion, no bloquea decisiones\./i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Abrir texto/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Documento original/i }));
    expect(screen.getByTestId("source-drawer")).toBeInTheDocument();
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
                schema_version: "v0",
                document_id: "doc-ready",
                processing_run_id: "run-doc-ready",
                created_at: "2026-02-10T10:00:00Z",
                fields: [],
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
    fireEvent.click((await screen.findAllByRole("button", { name: /^Reprocesar$/i }))[1]);

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
          within(screen.getByRole("button", { name: /ready\.pdf/i })).getByText("Listo para revision")
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
    fireEvent.click((await screen.findAllByRole("button", { name: /^Reprocesar$/i }))[1]);

    expect((await screen.findAllByText(/reprocess failed/i)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        within(screen.getByRole("button", { name: /ready\.pdf/i })).getByText("Listo para revision")
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

  it("renders the full Global Schema v0 template with explicit missing states", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));

    expect(await screen.findByText("Campos core")).toBeInTheDocument();
    const panel = screen.getByTestId("right-panel-scroll");
    GLOBAL_SCHEMA_V0.forEach((field) => {
      expect(within(panel).getByText(field.label)).toBeInTheDocument();
    });
    expect(within(panel).getAllByText("—").length).toBeGreaterThan(0);
    expect(within(panel).getByText("Otros campos extraídos")).toBeInTheDocument();
    expect(within(panel).getByText("Custom tag")).toBeInTheDocument();
    expect(within(panel).getByText("Prioridad")).toBeInTheDocument();
  });

  it("shows CRÍTICO badge for critical core fields only", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));

    await screen.findByText("Campos core");

    const panel = screen.getByTestId("right-panel-scroll");
    const criticalFields = GLOBAL_SCHEMA_V0.filter((field) => field.critical);
    const nonCriticalFields = GLOBAL_SCHEMA_V0.filter((field) => !field.critical);

    criticalFields.forEach((field) => {
      const fieldCard = within(panel).getByText(field.label).closest("article");
      expect(fieldCard).not.toBeNull();
      const card = fieldCard as HTMLElement;
      const hasConfidenceBadge = within(card).queryByText(/Confianza\s+\d+%/i) !== null;
      if (hasConfidenceBadge) {
        expect(within(card).queryAllByText("CRÍTICO").length).toBeGreaterThan(0);
      }
    });

    nonCriticalFields.forEach((field) => {
      const fieldCard = within(panel).getByText(field.label).closest("article");
      expect(fieldCard).not.toBeNull();
      expect(within(fieldCard as HTMLElement).queryByText("CRÍTICO")).toBeNull();
    });
  });

  it("shows an empty list state for repeatable fields", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));

    await screen.findByText("Campos core");

    const panel = screen.getByTestId("right-panel-scroll");
    const medicationCard = within(panel).getByText("Medicacion").closest("article");
    expect(medicationCard).not.toBeNull();
    expect(within(medicationCard as HTMLElement).getByText("Sin elementos")).toBeInTheDocument();
  });

  it("falls back to visit date when document date is missing", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));

    await screen.findByText("Campos core");

    const panel = screen.getByTestId("right-panel-scroll");
    const documentDateCard = within(panel).getByText("Fecha del documento").closest("article");
    const expectedDate = new Date("2026-02-11T00:00:00Z").toLocaleDateString("es-ES");
    expect(documentDateCard).not.toBeNull();
    expect(within(documentDateCard as HTMLElement).getByText(expectedDate)).toBeInTheDocument();
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

    expect(await screen.findByText("Campos core")).toBeInTheDocument();
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
                      schema_version: "v0",
                      document_id: "doc-ready",
                      processing_run_id: "run-doc-ready",
                      created_at: "2026-02-10T10:00:00Z",
                      fields: [
                        {
                          field_id: "field-pet-name-doc-ready",
                          key: "pet_name",
                          value: "Luna",
                          value_type: "string",
                          confidence: 0.82,
                          is_critical: false,
                          origin: "machine",
                          evidence: { page: 1, snippet: "Paciente: Luna" },
                        },
                      ],
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
    expect(await screen.findByText("Campos core")).toBeInTheDocument();
    expect(screen.getByText(/No se pudo conectar con el servidor\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Sin conexión/i)).toBeNull();
  });

  it("collapses docs list in review mode and keeps left handle visible", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByText("Campos core");

    fireEvent.click(screen.getByRole("button", { name: /Modo revisión/i }));

    expect(screen.getByTestId("review-docs-handle")).toBeInTheDocument();
    expect(screen.queryByTestId("left-panel-scroll")).toBeNull();
    expect(screen.getByTestId("center-panel-scroll")).toBeInTheDocument();
    expect(screen.getByTestId("right-panel-scroll")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("review-docs-handle"));
    expect(await screen.findByTestId("left-panel-scroll")).toBeInTheDocument();
    expect(screen.getByTestId("center-panel-scroll")).toBeInTheDocument();
  });

  it("changes layout grid classes when toggling between browse and review mode", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByText("Campos core");

    const layoutGrid = screen.getByTestId("document-layout-grid");
    expect(layoutGrid.className).toContain("grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");

    fireEvent.click(screen.getByRole("button", { name: /Modo revisión/i }));
    expect(layoutGrid.className).toContain("lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]");

    fireEvent.click(screen.getByRole("button", { name: /Modo exploración/i }));
    expect(layoutGrid.className).toContain("grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
  });

  it("opens source from evidence in review mode with persistent two-column layout", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByText("Campos core");
    fireEvent.click(screen.getByRole("button", { name: /Modo revisión/i }));

    expect(screen.getByTestId("center-panel-scroll")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Fuente:\s*Página 1/i })[0]);

    expect(screen.getByTestId("source-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("center-panel-scroll")).toBeInTheDocument();
  });

  it("keeps independent scroll containers and preserves right panel scroll on evidence clicks", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByText("Campos core");

    const leftPanelScroll = screen.getByTestId("left-panel-scroll");
    const centerPanelScroll = screen.getByTestId("center-panel-scroll");
    const rightPanelScroll = screen.getByTestId("right-panel-scroll");
    expect(leftPanelScroll).toBeInTheDocument();
    expect(centerPanelScroll).toBeInTheDocument();
    expect(rightPanelScroll).toBeInTheDocument();

    rightPanelScroll.scrollTop = 140;
    fireEvent.scroll(rightPanelScroll);

    fireEvent.click(screen.getAllByRole("button", { name: /Fuente:\s*Página /i })[0]);

    expect(screen.getByTestId("right-panel-scroll")).toBe(rightPanelScroll);
    expect(rightPanelScroll.scrollTop).toBe(140);
  });

  it("keeps evidence behavior deterministic with source links and fallback", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByText("Campos core");

    const sourceLinks = screen.getAllByRole("button", { name: /Página /i });
    fireEvent.click(sourceLinks[0]);

    expect(screen.getByTestId("source-drawer")).toBeInTheDocument();
    const viewer = screen.getAllByTestId("pdf-viewer")[0];
    expect(viewer).toHaveAttribute("data-focus-page", "1");
    expect(viewer).toHaveAttribute("data-highlight-snippet", "Paciente: Luna");
    expect(screen.getByText(/Mostrando fuente en la página 1\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Especie/i }));
    expect(screen.queryByText(/Sin evidencia disponible para este campo\./i)).toBeNull();
    expect(screen.getByTestId("source-drawer")).toBeInTheDocument();
  });

  it("opens and closes source drawer from evidence link with backdrop and escape", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByText("Campos core");
    fireEvent.click(screen.getByRole("button", { name: /Modo revisión/i }));

    fireEvent.click(screen.getAllByRole("button", { name: /Fuente:\s*Página 1/i })[0]);
    expect(screen.getByTestId("source-drawer")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("source-drawer-backdrop"));
    expect(screen.queryByTestId("source-drawer")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /Fuente:\s*Página 1/i })[0]);
    expect(screen.getByTestId("source-drawer")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("source-drawer")).toBeNull();
  });

  it("keeps review mode as two-column layout even when source pin is toggled on desktop", async () => {
    const originalMatchMedia = window.matchMedia;
    try {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: vi.fn((query: string) => ({
          matches: query.includes("min-width"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      renderApp();

      fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
      await screen.findByText("Campos core");
      fireEvent.click(screen.getByRole("button", { name: /Modo revisión/i }));
      fireEvent.click(screen.getAllByRole("button", { name: /Fuente:\s*Página 1/i })[0]);

      fireEvent.click(screen.getByRole("button", { name: /📌 Fijar/i }));
      expect(screen.getByTestId("source-drawer")).toBeInTheDocument();
      expect(screen.queryByTestId("source-pinned-panel")).toBeNull();
      expect(screen.getByTestId("center-panel-scroll")).toBeInTheDocument();
      expect(screen.getByTestId("right-panel-scroll")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("resets source state when switching documents", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByText("Campos core");
    fireEvent.click(screen.getByRole("button", { name: /Modo revisión/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Fuente:\s*Página 1/i })[0]);
    expect(screen.getByTestId("source-drawer")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("review-docs-handle"));
    fireEvent.click(screen.getByRole("button", { name: /processing\.pdf/i }));
    expect(screen.queryByTestId("source-drawer")).toBeNull();
  });

  it("renders evidence links for available source and disabled state for missing source", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByText("Campos core");

    expect(screen.getAllByRole("button", { name: /Fuente:\s*Página /i }).length).toBeGreaterThan(0);

    const missingSource = screen.getAllByRole("button", { name: /Fuente:\s*—/i })[0];
    expect(missingSource).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(missingSource);
    expect(screen.getByText(/Sin evidencia disponible para este campo\./i)).toBeInTheDocument();
    expect(screen.queryByTestId("source-drawer")).toBeNull();
  });

  it("synchronizes selected field with viewer context repeatedly, including repeated same-field clicks", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByText("Campos core");

    fireEvent.click(screen.getByRole("button", { name: /Gastroenteritis/i }));
    let viewer = screen.getByTestId("pdf-viewer");
    expect(viewer).toHaveAttribute("data-focus-page", "2");
    expect(viewer).toHaveAttribute("data-highlight-snippet", "Diagnostico: Gastroenteritis");
    const firstRequestId = Number(viewer.getAttribute("data-focus-request-id"));

    fireEvent.click(screen.getByRole("button", { name: /Nombre del paciente/i }));
    viewer = screen.getByTestId("pdf-viewer");
    expect(viewer).toHaveAttribute("data-focus-page", "1");
    expect(viewer).toHaveAttribute("data-highlight-snippet", "Paciente: Luna");
    const secondRequestId = Number(viewer.getAttribute("data-focus-request-id"));
    expect(secondRequestId).toBeGreaterThan(firstRequestId);

    fireEvent.click(screen.getByRole("button", { name: /Nombre del paciente/i }));
    viewer = screen.getByTestId("pdf-viewer");
    const thirdRequestId = Number(viewer.getAttribute("data-focus-request-id"));
    expect(thirdRequestId).toBeGreaterThan(secondRequestId);
    expect(screen.queryByTestId("source-drawer")).toBeNull();
  });

  it("does not open source drawer on plain field click in review mode, only from evidence/document action", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /ready\.pdf/i }));
    await screen.findByText("Campos core");
    fireEvent.click(screen.getByTestId("view-mode-review"));

    fireEvent.click(screen.getByRole("button", { name: /Nombre del paciente/i }));
    expect(screen.queryByTestId("source-drawer")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /Fuente:\s*Página 1/i })[0]);
    expect(screen.getByTestId("source-drawer")).toBeInTheDocument();
  });
});


import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";

vi.mock("./components/PdfViewer", () => ({
  PdfViewer: () => <div data-testid="pdf-viewer" />,
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
    expect(screen.queryByText(/Formatos admitidos: PDF\./i)).toBeNull();
    expect(screen.getByText(/Tamaño maximo: 20 MB\./i)).not.toBeVisible();
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
    fireEvent.click(screen.getByRole("button", { name: /Subir documento/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /Subir documento/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /Subir documento/i }));

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
  });
});


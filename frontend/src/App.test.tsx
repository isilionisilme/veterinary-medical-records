import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";

vi.mock("./components/PdfViewer", () => ({
  PdfViewer: () => <div data-testid="pdf-viewer" />,
}));

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

describe("App document navigation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/documents?")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                document_id: "doc-123",
                original_filename: "record.pdf",
                created_at: "2026-02-09T10:00:00Z",
                status: "COMPLETED",
                status_label: "Ready for review",
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
      if (url.includes("/documents/doc-123/download")) {
        return new Response(new Blob(["pdf"], { type: "application/pdf" }), {
          status: 200,
          headers: { "content-disposition": 'inline; filename="record.pdf"' },
        });
      }
      if (url.endsWith("/documents/doc-123")) {
        return new Response(
          JSON.stringify({
            document_id: "doc-123",
            original_filename: "record.pdf",
            content_type: "application/pdf",
            file_size: 10,
            created_at: "2026-02-09T10:00:00Z",
            updated_at: "2026-02-09T10:00:00Z",
            status: "COMPLETED",
            status_message: "Processing completed.",
            failure_type: null,
            latest_run: { run_id: "run-123", state: "COMPLETED", failure_type: null },
          }),
          { status: 200 }
        );
      }
      if (url.includes("/processing-history")) {
        return new Response(JSON.stringify({ document_id: "doc-123", runs: [] }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    }) as typeof fetch;

    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn(() => "blob://mock");
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    }
  });

  it("does not render manual open by ID controls", () => {
    renderApp();
    expect(screen.queryByLabelText(/ID del documento/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Abrir/i })).toBeNull();
  });

  it("shows missing document state with back action", () => {
    renderApp();
    expect(
      screen.getByText(/Documento no encontrado o falta ID/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Volver a la lista/i })).toBeInTheDocument();
  });

  it("loads document details when selected from the list", async () => {
    renderApp();
    const itemButton = await screen.findByRole("button", { name: /record\.pdf/i });
    fireEvent.click(itemButton);

    await waitFor(() => {
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument();
    });
  });

  it("renders viewer tabs and defaults to Documento", () => {
    renderApp();
    expect(screen.getByRole("button", { name: "Documento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Texto extraido" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Detalles tecnicos" })).toBeInTheDocument();
    expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument();
  });

  it("shows processing history only under Detalles tecnicos", async () => {
    renderApp();
    const itemButton = await screen.findByRole("button", { name: /record\.pdf/i });
    fireEvent.click(itemButton);

    expect(screen.queryByText(/Historial de procesamiento/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Detalles tecnicos" }));

    await waitFor(() => {
      expect(screen.getByText(/Historial de procesamiento/i)).toBeInTheDocument();
    });
  });

  it("shows retry callout in Texto extraido tab", async () => {
    renderApp();
    const itemButton = await screen.findByRole("button", { name: /record\.pdf/i });
    fireEvent.click(itemButton);

    fireEvent.click(screen.getByRole("button", { name: "Texto extraido" }));
    expect(screen.getByText(/El texto parece incorrecto/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reintentar procesamiento/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Buscar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copiar todo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Descargar texto/i })).toBeInTheDocument();
  });

  it("opens confirmation dialog and triggers reprocess", async () => {
    renderApp();
    const itemButton = await screen.findByRole("button", { name: /record\.pdf/i });
    fireEvent.click(itemButton);

    fireEvent.click(screen.getByRole("button", { name: "Texto extraido" }));
    fireEvent.click(screen.getByRole("button", { name: /Reintentar procesamiento/i }));

    expect(screen.getByText(/Reintentar procesamiento/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reintentar$/i }));

    await waitFor(() => {
      const calls =
        (globalThis.fetch as unknown as { mock: { calls: unknown[][] } } | undefined)?.mock
          ?.calls ?? [];
      expect(
        calls.some(([url]) => String(url).includes("/documents/doc-123/reprocess"))
      ).toBe(true);
    });
  });

  it("disables retry action while processing", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/documents?")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                document_id: "doc-123",
                original_filename: "record.pdf",
                created_at: "2026-02-09T10:00:00Z",
                status: "PROCESSING",
                status_label: "Processing",
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
      if (url.includes("/documents/doc-123/download")) {
        return new Response(new Blob(["pdf"], { type: "application/pdf" }), {
          status: 200,
          headers: { "content-disposition": 'inline; filename="record.pdf"' },
        });
      }
      if (url.endsWith("/documents/doc-123")) {
        return new Response(
          JSON.stringify({
            document_id: "doc-123",
            original_filename: "record.pdf",
            content_type: "application/pdf",
            file_size: 10,
            created_at: "2026-02-09T10:00:00Z",
            updated_at: "2026-02-09T10:00:00Z",
            status: "PROCESSING",
            status_message: "Processing is in progress.",
            failure_type: null,
            latest_run: { run_id: "run-123", state: "RUNNING", failure_type: null },
          }),
          { status: 200 }
        );
      }
      if (url.includes("/processing-history")) {
        return new Response(JSON.stringify({ document_id: "doc-123", runs: [] }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ error_code: "NOT_FOUND" }), { status: 404 });
    });

    renderApp();
    const itemButton = await screen.findByRole("button", { name: /record\.pdf/i });
    fireEvent.click(itemButton);

    fireEvent.click(screen.getByRole("button", { name: "Texto extraido" }));
    expect(screen.getByRole("button", { name: /Procesando/i })).toBeDisabled();
  });

  it("removes the old status block from the viewer header", async () => {
    renderApp();
    const itemButton = await screen.findByRole("button", { name: /record\.pdf/i });
    fireEvent.click(itemButton);

    await waitFor(() => {
      expect(screen.queryByText(/Estado actual/i)).toBeNull();
    });
  });
});

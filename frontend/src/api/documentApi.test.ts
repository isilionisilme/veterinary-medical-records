import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  copyTextToClipboard,
  editRunInterpretation,
  fetchDocumentDetails,
  fetchDocumentReview,
  fetchDocuments,
  fetchOriginalPdf,
  fetchProcessingHistory,
  fetchRawText,
  markDocumentReviewed,
  reopenDocumentReview,
  triggerReprocess,
  uploadDocument,
} from "./documentApi";
import { ApiResponseError, UiError } from "../types/appWorkspace";

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

describe("documentApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:generated-url");
    globalThis.fetch = vi.fn();
  });

  it("fetchOriginalPdf returns blob URL and parsed filename", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(new Blob(["pdf-bytes"]), {
        status: 200,
        headers: { "content-disposition": 'attachment; filename="record.pdf"' },
      }),
    );

    const result = await fetchOriginalPdf("doc-1");

    expect(result).toEqual({ url: "blob:generated-url", filename: "record.pdf" });
  });

  it("fetchOriginalPdf maps network failures to UiError", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(fetchOriginalPdf("doc-1")).rejects.toMatchObject<Partial<UiError>>({
      name: "UiError",
      userMessage: "No se pudo conectar con el servidor.",
    });
  });

  it("fetchDocuments returns empty payload on 404", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response("Not found", { status: 404 }));

    await expect(fetchDocuments()).resolves.toEqual({
      items: [],
      limit: 50,
      offset: 0,
      total: 0,
    });
  });

  it("fetchDocuments returns data on success", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({ items: [{ document_id: "doc-1" }], limit: 50, offset: 0, total: 1 }),
    );

    await expect(fetchDocuments()).resolves.toMatchObject({ total: 1 });
  });

  it("fetchDocuments uses generic message when error body is not JSON", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("not-json", { status: 500, headers: { "content-type": "text/plain" } }),
    );

    await expect(fetchDocuments()).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "No se pudieron cargar los documentos.",
    });
  });

  it("fetchDocumentDetails propagates API message on non-OK responses", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({ message: "Documento inexistente" }, 500),
    );

    await expect(fetchDocumentDetails("doc-missing")).rejects.toMatchObject<Partial<UiError>>({
      name: "UiError",
      userMessage: "Documento inexistente",
    });
  });

  it("fetchDocumentDetails returns payload and maps network errors", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse({ document_id: "doc-2" }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(fetchDocumentDetails("doc-2")).resolves.toMatchObject({ document_id: "doc-2" });
    await expect(fetchDocumentDetails("doc-2")).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "No se pudo conectar con el servidor.",
    });
  });

  it("fetchDocumentReview returns ApiResponseError with code and reason", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          message: "Review blocked",
          error_code: "REVIEW_BLOCKED",
          details: { reason: "RUN_PENDING" },
        },
        409,
      ),
    );

    await expect(fetchDocumentReview("doc-2")).rejects.toMatchObject<Partial<ApiResponseError>>({
      name: "ApiResponseError",
      userMessage: "Review blocked",
      errorCode: "REVIEW_BLOCKED",
      reason: "RUN_PENDING",
    });
  });

  it("fetchDocumentReview returns payload on success", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ document_id: "doc-2" }));

    await expect(fetchDocumentReview("doc-2")).resolves.toMatchObject({ document_id: "doc-2" });
  });

  it("fetchProcessingHistory returns payload on success", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({ document_id: "doc-1", runs: [] }),
    );

    await expect(fetchProcessingHistory("doc-1")).resolves.toEqual({
      document_id: "doc-1",
      runs: [],
    });
  });

  it("triggerReprocess throws Error with API message on failure", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ message: "No queue" }, 503));

    await expect(triggerReprocess("doc-3")).rejects.toThrow("No queue");
  });

  it("triggerReprocess returns latest run on success", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({ run_id: "run-1", state: "QUEUED" }),
    );

    await expect(triggerReprocess("doc-3")).resolves.toMatchObject({ run_id: "run-1" });
  });

  it("markDocumentReviewed and reopenDocumentReview call reviewed endpoint with POST/DELETE", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse({ review_status: "REVIEWED" }))
      .mockResolvedValueOnce(jsonResponse({ review_status: "IN_REVIEW" }));

    await expect(markDocumentReviewed("doc-4")).resolves.toEqual({ review_status: "REVIEWED" });
    await expect(reopenDocumentReview("doc-4")).resolves.toEqual({ review_status: "IN_REVIEW" });

    expect(vi.mocked(globalThis.fetch).mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(vi.mocked(globalThis.fetch).mock.calls[1][1]).toMatchObject({ method: "DELETE" });
  });

  it("markDocumentReviewed and reopenDocumentReview map API failures", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse({ message: "Already reviewed" }, 409))
      .mockResolvedValueOnce(new Response("broken", { status: 500 }));

    await expect(markDocumentReviewed("doc-4")).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "Already reviewed",
    });
    await expect(reopenDocumentReview("doc-4")).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "No se pudo reabrir el documento.",
    });
  });

  it("editRunInterpretation posts JSON payload and parses response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ interpretation_id: "int-1" }));

    const payload = {
      base_version_number: 2,
      changes: [{ type: "set", field_id: "field-1", value: "Luna" }],
    };

    await expect(editRunInterpretation("run-7", payload)).resolves.toEqual({
      interpretation_id: "int-1",
    });
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringMatching(/\/runs\/run-7\/interpretations$/),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("editRunInterpretation maps API/network errors", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: "Version conflict",
            error_code: "VERSION_CONFLICT",
            details: { reason: "STALE_BASE_VERSION" },
          },
          409,
        ),
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      editRunInterpretation("run-1", { base_version_number: 1, changes: [] }),
    ).rejects.toMatchObject<Partial<ApiResponseError>>({
      userMessage: "Version conflict",
      errorCode: "VERSION_CONFLICT",
      reason: "STALE_BASE_VERSION",
    });

    await expect(
      editRunInterpretation("run-1", { base_version_number: 1, changes: [] }),
    ).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "No se pudo conectar con el servidor.",
    });
  });

  it("fetchRawText returns ApiResponseError details when backend reports structured error", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          message: "Artifact missing",
          error_code: "RAW_TEXT_NOT_AVAILABLE",
          details: { reason: "PROCESSING_INCOMPLETE" },
        },
        404,
      ),
    );

    await expect(fetchRawText("run-9")).rejects.toMatchObject<Partial<ApiResponseError>>({
      name: "ApiResponseError",
      userMessage: "Artifact missing",
      errorCode: "RAW_TEXT_NOT_AVAILABLE",
      reason: "PROCESSING_INCOMPLETE",
    });
  });

  it("fetchRawText returns payload and maps network failures", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse({ run_id: "run-9", text: "contenido" }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(fetchRawText("run-9")).resolves.toMatchObject({ run_id: "run-9" });
    await expect(fetchRawText("run-9")).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "No se pudo conectar con el servidor.",
    });
  });

  it("uploadDocument maps API error_code values to user-friendly messages", async () => {
    const file = new File(["bytes"], "bad.pdf", { type: "application/pdf" });

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse({ error_code: "UNSUPPORTED_MEDIA_TYPE" }, 415))
      .mockResolvedValueOnce(jsonResponse({ error_code: "FILE_TOO_LARGE" }, 413))
      .mockResolvedValueOnce(jsonResponse({ error_code: "INVALID_REQUEST" }, 400));

    await expect(uploadDocument(file)).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "Solo se admiten archivos PDF.",
    });
    await expect(uploadDocument(file)).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "El PDF supera el tamaño máximo permitido de 20 MB.",
    });
    await expect(uploadDocument(file)).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "El archivo no es válido. Selecciona un PDF e inténtalo otra vez.",
    });
  });

  it("uploadDocument returns payload and maps network errors", async () => {
    const file = new File(["bytes"], "ok.pdf", { type: "application/pdf" });
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse({ document_id: "doc-10", status: "QUEUED" }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ message: "Custom backend message" }, 400));

    await expect(uploadDocument(file)).resolves.toMatchObject({ document_id: "doc-10" });
    await expect(uploadDocument(file)).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "No se pudo subir el documento.",
    });
    await expect(uploadDocument(file)).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "Custom backend message",
    });
  });

  it("copyTextToClipboard supports clipboard API and fallback execCommand", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await copyTextToClipboard("texto 1");
    expect(writeText).toHaveBeenCalledWith("texto 1");

    // fallback branch
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    await copyTextToClipboard("texto 2");
    expect(execCommand).toHaveBeenCalledWith("copy");

    execCommand.mockReturnValue(false);
    await expect(copyTextToClipboard("texto 3")).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "No se pudo copiar el texto al portapapeles.",
    });

    await expect(copyTextToClipboard("")).rejects.toMatchObject<Partial<UiError>>({
      userMessage: "No hay texto disponible para copiar.",
    });
  });
});

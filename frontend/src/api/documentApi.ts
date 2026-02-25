import { API_BASE_URL } from "../constants/appWorkspace";
import { isNetworkFetchError, parseFilename } from "../lib/appWorkspaceUtils";
import {
  ApiResponseError,
  type DocumentDetailResponse,
  type DocumentListResponse,
  type DocumentReviewResponse,
  type DocumentUploadResponse,
  type InterpretationChangePayload,
  type InterpretationEditResponse,
  type LatestRun,
  type LoadResult,
  type ProcessingHistoryResponse,
  type RawTextArtifactResponse,
  type ReviewToggleResponse,
  UiError,
} from "../types/appWorkspace";

export async function fetchOriginalPdf(documentId: string): Promise<LoadResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/documents/${documentId}/download`,
      );
    }
    throw error;
  }
  if (!response.ok) {
    let errorMessage = "No pudimos cargar el documento.";
    try {
      const payload = await response.json();
      errorMessage = payload.message ?? errorMessage;
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new UiError(
      errorMessage,
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/${documentId}/download`,
    );
  }
  const blob = await response.blob();
  const filename = parseFilename(response.headers.get("content-disposition"));
  return { url: URL.createObjectURL(blob), filename };
}

export async function fetchDocuments(): Promise<DocumentListResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents?limit=50&offset=0`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudieron cargar los documentos.",
        `Network error calling ${API_BASE_URL}/documents`,
      );
    }
    throw error;
  }
  if (!response.ok) {
    if (response.status === 404) {
      return {
        items: [],
        limit: 50,
        offset: 0,
        total: 0,
      };
    }
    let errorMessage = "No se pudieron cargar los documentos.";
    try {
      const payload = await response.json();
      if (typeof payload?.message === "string" && payload.message.trim().length > 0) {
        errorMessage = payload.message;
      }
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new UiError(errorMessage, `HTTP ${response.status} calling ${API_BASE_URL}/documents`);
  }
  return response.json();
}

export async function fetchDocumentDetails(documentId: string): Promise<DocumentDetailResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/${documentId}`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/documents/${documentId}`,
      );
    }
    throw error;
  }
  if (!response.ok) {
    let errorMessage = "No pudimos cargar el estado del documento.";
    try {
      const payload = await response.json();
      errorMessage = payload.message ?? errorMessage;
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new UiError(
      errorMessage,
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/${documentId}`,
    );
  }
  return response.json();
}

export async function fetchDocumentReview(documentId: string): Promise<DocumentReviewResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/${documentId}/review`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/documents/${documentId}/review`,
      );
    }
    throw error;
  }

  if (!response.ok) {
    let errorMessage = "No se pudo cargar la revisión del documento.";
    let errorCode: string | undefined;
    let reason: string | undefined;
    try {
      const payload = await response.json();
      if (typeof payload?.message === "string" && payload.message.trim()) {
        errorMessage = payload.message;
      }
      if (typeof payload?.error_code === "string") {
        errorCode = payload.error_code;
      }
      if (typeof payload?.details?.reason === "string") {
        reason = payload.details.reason;
      }
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new ApiResponseError(
      errorMessage,
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/${documentId}/review`,
      errorCode,
      reason,
    );
  }

  return response.json();
}

export async function fetchProcessingHistory(documentId: string): Promise<ProcessingHistoryResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/${documentId}/processing-history`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/documents/${documentId}/processing-history`,
      );
    }
    throw error;
  }
  if (!response.ok) {
    let errorMessage = "No pudimos cargar el historial de procesamiento.";
    try {
      const payload = await response.json();
      errorMessage = payload.message ?? errorMessage;
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new UiError(
      errorMessage,
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/${documentId}/processing-history`,
    );
  }
  return response.json();
}

export async function triggerReprocess(documentId: string): Promise<LatestRun> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/reprocess`, {
    method: "POST",
  });
  if (!response.ok) {
    let errorMessage = "No pudimos reprocesar el documento.";
    try {
      const payload = await response.json();
      errorMessage = payload.message ?? errorMessage;
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export async function markDocumentReviewed(documentId: string): Promise<ReviewToggleResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/${documentId}/reviewed`, {
      method: "POST",
    });
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/documents/${documentId}/reviewed`,
      );
    }
    throw error;
  }

  if (!response.ok) {
    let errorMessage = "No se pudo marcar como revisado.";
    try {
      const payload = await response.json();
      if (typeof payload?.message === "string" && payload.message.trim()) {
        errorMessage = payload.message;
      }
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new UiError(
      errorMessage,
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/${documentId}/reviewed`,
    );
  }

  return response.json();
}

export async function reopenDocumentReview(documentId: string): Promise<ReviewToggleResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/${documentId}/reviewed`, {
      method: "DELETE",
    });
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/documents/${documentId}/reviewed`,
      );
    }
    throw error;
  }

  if (!response.ok) {
    let errorMessage = "No se pudo reabrir el documento.";
    try {
      const payload = await response.json();
      if (typeof payload?.message === "string" && payload.message.trim()) {
        errorMessage = payload.message;
      }
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new UiError(
      errorMessage,
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/${documentId}/reviewed`,
    );
  }

  return response.json();
}

export async function editRunInterpretation(
  runId: string,
  payload: {
    base_version_number: number;
    changes: InterpretationChangePayload[];
  },
): Promise<InterpretationEditResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/runs/${runId}/interpretations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/runs/${runId}/interpretations`,
      );
    }
    throw error;
  }

  if (!response.ok) {
    let errorMessage = "No se pudo guardar la edición.";
    let errorCode: string | undefined;
    let reason: string | undefined;
    try {
      const body = await response.json();
      if (typeof body?.message === "string" && body.message.trim()) {
        errorMessage = body.message;
      }
      if (typeof body?.error_code === "string") {
        errorCode = body.error_code;
      }
      if (typeof body?.details?.reason === "string") {
        reason = body.details.reason;
      }
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new ApiResponseError(
      errorMessage,
      `HTTP ${response.status} calling ${API_BASE_URL}/runs/${runId}/interpretations`,
      errorCode,
      reason,
    );
  }

  return response.json();
}

export async function fetchRawText(runId: string): Promise<RawTextArtifactResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/runs/${runId}/artifacts/raw-text`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/runs/${runId}/artifacts/raw-text`,
      );
    }
    throw error;
  }

  if (!response.ok) {
    let errorMessage = "No se pudo cargar el texto extraído.";
    let errorCode: string | undefined;
    let reason: string | undefined;
    try {
      const payload = await response.json();
      if (typeof payload?.message === "string" && payload.message.trim()) {
        errorMessage = payload.message;
      }
      if (typeof payload?.error_code === "string") {
        errorCode = payload.error_code;
      }
      if (typeof payload?.details?.reason === "string") {
        reason = payload.details.reason;
      }
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new ApiResponseError(
      errorMessage,
      `HTTP ${response.status} calling ${API_BASE_URL}/runs/${runId}/artifacts/raw-text`,
      errorCode,
      reason,
    );
  }

  return response.json();
}

export async function uploadDocument(file: File): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo subir el documento.",
        `Network error calling ${API_BASE_URL}/documents/upload`,
      );
    }
    throw error;
  }
  if (!response.ok) {
    let errorMessage = "No pudimos subir el documento.";
    try {
      const payload = await response.json();
      if (payload?.error_code === "UNSUPPORTED_MEDIA_TYPE") {
        errorMessage = "Solo se admiten archivos PDF.";
      } else if (payload?.error_code === "FILE_TOO_LARGE") {
        errorMessage = "El PDF supera el tamaño máximo permitido de 20 MB.";
      } else if (payload?.error_code === "INVALID_REQUEST") {
        errorMessage = "El archivo no es válido. Selecciona un PDF e inténtalo otra vez.";
      } else if (payload?.message) {
        errorMessage = payload.message as string;
      }
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new UiError(
      errorMessage,
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/upload`,
    );
  }
  return response.json();
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (!text) {
    throw new UiError("No hay texto disponible para copiar.");
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    try {
      const copied = document.execCommand("copy");
      if (!copied) {
        throw new UiError("No se pudo copiar el texto al portapapeles.");
      }
      return;
    } finally {
      document.body.removeChild(textarea);
    }
  }

  throw new UiError("No se pudo copiar el texto al portapapeles.");
}

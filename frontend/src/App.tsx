import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PdfViewer } from "./components/PdfViewer";
import { UploadDropzone } from "./components/UploadDropzone";
import { Button } from "./components/ui/button";
import { groupProcessingSteps } from "./lib/processingHistory";
import {
  formatDuration,
  formatShortDate,
  formatTime,
  shouldShowDetails,
  statusIcon,
} from "./lib/processingHistoryView";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

type LoadResult = {
  url: string;
  filename: string | null;
};

type DocumentListItem = {
  document_id: string;
  original_filename: string;
  created_at: string;
  status: string;
  status_label: string;
  failure_type: string | null;
};

type DocumentListResponse = {
  items: DocumentListItem[];
  limit: number;
  offset: number;
  total: number;
};

type LatestRun = {
  run_id: string;
  state: string;
  failure_type: string | null;
};

type DocumentDetailResponse = {
  document_id: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
  status: string;
  status_message: string;
  failure_type: string | null;
  latest_run: LatestRun | null;
};

type ProcessingStep = {
  step_name: string;
  step_status: string;
  attempt: number;
  started_at: string | null;
  ended_at: string | null;
  error_code: string | null;
};

type ProcessingHistoryRun = {
  run_id: string;
  state: string;
  failure_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  steps: ProcessingStep[];
};

type ProcessingHistoryResponse = {
  document_id: string;
  runs: ProcessingHistoryRun[];
};

type RawTextArtifactResponse = {
  run_id: string;
  artifact_type: string;
  content_type: string;
  text: string;
};

type DocumentUploadResponse = {
  document_id: string;
  status: string;
  created_at: string;
};

type UploadFeedback = {
  kind: "success" | "error";
  message: string;
  documentId?: string;
  showOpenAction?: boolean;
  technicalDetails?: string;
};

type ActionFeedback = {
  kind: "success" | "error";
  message: string;
  technicalDetails?: string;
};

class UiError extends Error {
  readonly userMessage: string;
  readonly technicalDetails?: string;

  constructor(userMessage: string, technicalDetails?: string) {
    super(userMessage);
    this.name = "UiError";
    this.userMessage = userMessage;
    this.technicalDetails = technicalDetails;
  }
}

class ApiResponseError extends UiError {
  readonly errorCode?: string;
  readonly reason?: string;

  constructor(
    userMessage: string,
    technicalDetails?: string,
    errorCode?: string,
    reason?: string
  ) {
    super(userMessage, technicalDetails);
    this.name = "ApiResponseError";
    this.errorCode = errorCode;
    this.reason = reason;
  }
}

function isNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    error.name === "TypeError" &&
    (message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("load failed"))
  );
}

function getUserErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UiError) {
    return error.userMessage;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getTechnicalDetails(error: unknown): string | undefined {
  if (error instanceof UiError) {
    return error.technicalDetails;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return undefined;
}

function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return match ? match[1] : null;
}

async function fetchOriginalPdf(documentId: string): Promise<LoadResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/documents/${documentId}/download`
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
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/${documentId}/download`
    );
  }
  const blob = await response.blob();
  const filename = parseFilename(response.headers.get("content-disposition"));
  return { url: URL.createObjectURL(blob), filename };
}

async function fetchDocuments(): Promise<DocumentListResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents?limit=50&offset=0`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudieron cargar los documentos.",
        `Network error calling ${API_BASE_URL}/documents`
      );
    }
    throw error;
  }
  if (!response.ok) {
    if (response.status === 404) {
      // Empty-state compatibility: some environments return 404 when there are no docs yet.
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
    throw new UiError(
      errorMessage,
      `HTTP ${response.status} calling ${API_BASE_URL}/documents`
    );
  }
  return response.json();
}

async function fetchDocumentDetails(documentId: string): Promise<DocumentDetailResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/${documentId}`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/documents/${documentId}`
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
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/${documentId}`
    );
  }
  return response.json();
}

async function fetchProcessingHistory(documentId: string): Promise<ProcessingHistoryResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/${documentId}/processing-history`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/documents/${documentId}/processing-history`
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
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/${documentId}/processing-history`
    );
  }
  return response.json();
}

async function triggerReprocess(documentId: string): Promise<LatestRun> {
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

async function fetchRawText(runId: string): Promise<RawTextArtifactResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/runs/${runId}/artifacts/raw-text`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/runs/${runId}/artifacts/raw-text`
      );
    }
    throw error;
  }

  if (!response.ok) {
    let errorMessage = "No se pudo cargar el texto extraido.";
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
      reason
    );
  }

  return response.json();
}

async function uploadDocument(file: File): Promise<DocumentUploadResponse> {
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
        `Network error calling ${API_BASE_URL}/documents/upload`
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
        errorMessage = "El PDF supera el tamano maximo permitido de 20 MB.";
      } else if (payload?.error_code === "INVALID_REQUEST") {
        errorMessage = "El archivo no es valido. Selecciona un PDF e intentalo otra vez.";
      } else if (payload?.message) {
        errorMessage = payload.message as string;
      }
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new UiError(
      errorMessage,
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/upload`
    );
  }
  return response.json();
}

async function copyTextToClipboard(text: string): Promise<void> {
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

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isDocumentProcessing(status: string): boolean {
  return status === "PROCESSING" || status === "UPLOADED";
}

function mapDocumentStatus(item: DocumentListItem): { label: string; tone: "ok" | "warn" | "error" } {
  // Source of truth: derived processing status from GET /documents -> `item.status`.
  if (item.status === "FAILED" || item.status === "TIMED_OUT" || item.failure_type) {
    return { label: "Error", tone: "error" };
  }
  if (item.status === "COMPLETED") {
    return { label: "Listo para revision", tone: "ok" };
  }
  return { label: "Procesando", tone: "warn" };
}

function isProcessingTooLong(createdAt: string, status: string): boolean {
  if (!isDocumentProcessing(status)) {
    return false;
  }
  const createdAtMs = Date.parse(createdAt);
  if (Number.isNaN(createdAtMs)) {
    return false;
  }
  return Date.now() - createdAtMs > 2 * 60 * 1000;
}

const RUN_STATE_LABELS: Record<string, string> = {
  QUEUED: "En cola",
  RUNNING: "En curso",
  COMPLETED: "Completado",
  FAILED: "Fallido",
  TIMED_OUT: "Tiempo agotado",
};

const NON_TECHNICAL_FAILURE: Record<string, string> = {
  EXTRACTION_FAILED: "No se pudo leer el contenido del documento.",
  INTERPRETATION_FAILED: "No se pudo interpretar la informacion del documento.",
  PROCESS_TERMINATED: "El procesamiento se interrumpio antes de terminar.",
  UNKNOWN_ERROR: "Ocurrio un problema durante el procesamiento.",
};

function explainFailure(failureCode: string | null | undefined): string | null {
  if (!failureCode) {
    return null;
  }
  return (
    NON_TECHNICAL_FAILURE[failureCode] ??
    "Ocurrio un problema durante el procesamiento."
  );
}

function formatRunHeader(run: ProcessingHistoryRun): string {
  const runId = run.run_id;
  const dateSource = run.started_at ?? run.completed_at;
  const shortDate = formatShortDate(dateSource);
  const startTime = formatTime(run.started_at);
  const endTime = formatTime(run.completed_at);
  const duration = formatDuration(run.started_at, run.completed_at);
  const timeRange =
    startTime && endTime ? `${startTime} \u2192 ${endTime}` : startTime ?? "--:--";
  const datePrefix = shortDate ? `${shortDate} ` : "";
  const durationPart = duration ? ` \u00b7 ${duration}` : "";
  return `Run ${runId} \u00b7 ${datePrefix}${timeRange}${durationPart} \u00b7 ${
    RUN_STATE_LABELS[run.state] ?? run.state
  }`;
}

export function App() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeViewerTab, setActiveViewerTab] = useState<
    "document" | "raw_text" | "technical"
  >("document");
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [reprocessingDocumentId, setReprocessingDocumentId] = useState<string | null>(null);
  const [hasObservedProcessingAfterReprocess, setHasObservedProcessingAfterReprocess] =
    useState(false);
  const [rawSearch, setRawSearch] = useState("");
  const [rawSearchNotice, setRawSearchNotice] = useState<string | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [hasShownListErrorToast, setHasShownListErrorToast] = useState(false);
  const [isDragOverViewer, setIsDragOverViewer] = useState(false);
  const [isDragOverSidebarUpload, setIsDragOverSidebarUpload] = useState(false);
  const [showUploadInfo, setShowUploadInfo] = useState(false);
  const [showRefreshFeedback, setShowRefreshFeedback] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isCopyingRawText, setIsCopyingRawText] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(true);
  const [uploadInfoPosition, setUploadInfoPosition] = useState({ top: 0, left: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInfoTriggerRef = useRef<HTMLButtonElement | null>(null);
  const uploadInfoContentRef = useRef<HTMLDivElement | null>(null);
  const uploadInfoCloseTimerRef = useRef<number | null>(null);
  const uploadPanelRef = useRef<HTMLDivElement | null>(null);
  const viewerDragDepthRef = useRef(0);
  const sidebarUploadDragDepthRef = useRef(0);
  const pendingAutoOpenDocumentIdRef = useRef<string | null>(null);
  const autoOpenRetryCountRef = useRef<Record<string, number>>({});
  const autoOpenRetryTimerRef = useRef<number | null>(null);
  const refreshFeedbackTimerRef = useRef<number | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const latestLoadRequestIdRef = useRef<string | null>(null);
  const latestRawTextRefreshRef = useRef<string | null>(null);
  const listPollingStartedAtRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  const downloadUrl = useMemo(() => {
    if (!activeId) {
      return null;
    }
    return `${API_BASE_URL}/documents/${activeId}/download?download=true`;
  }, [activeId]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setIsHoverDevice(true);
      return;
    }

    const mediaQuery = window.matchMedia("(hover: hover)");
    const syncInputMode = () => setIsHoverDevice(mediaQuery.matches);
    syncInputMode();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncInputMode);
      return () => mediaQuery.removeEventListener("change", syncInputMode);
    }

    mediaQuery.addListener(syncInputMode);
    return () => mediaQuery.removeListener(syncInputMode);
  }, []);

  useEffect(() => {
    return () => {
      if (uploadInfoCloseTimerRef.current) {
        window.clearTimeout(uploadInfoCloseTimerRef.current);
      }
      if (autoOpenRetryTimerRef.current) {
        window.clearTimeout(autoOpenRetryTimerRef.current);
      }
      if (refreshFeedbackTimerRef.current) {
        window.clearTimeout(refreshFeedbackTimerRef.current);
      }
      if (copyFeedbackTimerRef.current) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!showUploadInfo) {
      return;
    }

    const updatePosition = () => {
      if (!uploadInfoTriggerRef.current || !uploadInfoContentRef.current) {
        return;
      }

      const triggerRect = uploadInfoTriggerRef.current.getBoundingClientRect();
      const tooltipRect = uploadInfoContentRef.current.getBoundingClientRect();
      const offset = 10;
      const viewportPadding = 8;

      let top = triggerRect.top - tooltipRect.height - offset;
      if (top < viewportPadding) {
        top = triggerRect.bottom + offset;
      }

      let left = triggerRect.left;
      const maxLeft = window.innerWidth - tooltipRect.width - viewportPadding;
      if (left > maxLeft) {
        left = maxLeft;
      }
      if (left < viewportPadding) {
        left = viewportPadding;
      }

      setUploadInfoPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showUploadInfo]);

  useEffect(() => {
    if (!showUploadInfo || isHoverDevice) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        uploadInfoTriggerRef.current?.contains(target) ||
        uploadInfoContentRef.current?.contains(target)
      ) {
        return;
      }
      setShowUploadInfo(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showUploadInfo, isHoverDevice]);

  const loadPdf = useMutation({
    mutationFn: async (docId: string) => fetchOriginalPdf(docId),
    onSuccess: (result, docId) => {
      if (latestLoadRequestIdRef.current !== docId) {
        URL.revokeObjectURL(result.url);
        return;
      }
      if (pendingAutoOpenDocumentIdRef.current === docId) {
        pendingAutoOpenDocumentIdRef.current = null;
        delete autoOpenRetryCountRef.current[docId];
        if (autoOpenRetryTimerRef.current) {
          window.clearTimeout(autoOpenRetryTimerRef.current);
          autoOpenRetryTimerRef.current = null;
        }
        setUploadFeedback((current) => {
          if (current?.kind !== "success" || current.documentId !== docId) {
            return current;
          }
          return { ...current, showOpenAction: false };
        });
      }
      setActiveId(docId);
      setFileUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return result.url;
      });
      setFilename(result.filename);
    },
    onError: (_, docId) => {
      if (latestLoadRequestIdRef.current !== docId) {
        return;
      }
      if (pendingAutoOpenDocumentIdRef.current === docId) {
        const retries = autoOpenRetryCountRef.current[docId] ?? 0;
        if (retries < 1) {
          autoOpenRetryCountRef.current[docId] = retries + 1;
          autoOpenRetryTimerRef.current = window.setTimeout(() => {
            latestLoadRequestIdRef.current = docId;
            requestPdfLoad(docId);
          }, 1000);
          return;
        }
        pendingAutoOpenDocumentIdRef.current = null;
        delete autoOpenRetryCountRef.current[docId];
        setUploadFeedback({
          kind: "success",
          message: "Documento subido correctamente.",
          documentId: docId,
          showOpenAction: true,
        });
      }
    },
  });

  const requestPdfLoad = (docId: string) => {
    latestLoadRequestIdRef.current = docId;
    loadPdf.mutate(docId);
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => uploadDocument(file),
    onSuccess: async (result, file) => {
      const createdAt = result.created_at || new Date().toISOString();
      queryClient.setQueryData<DocumentListResponse | undefined>(["documents", "list"], (current) => {
        if (!current) {
          return current;
        }
        const exists = current.items.some((item) => item.document_id === result.document_id);
        const items = exists
          ? current.items
          : [
              {
                document_id: result.document_id,
                original_filename: file.name,
                created_at: createdAt,
                status: result.status,
                status_label: result.status,
                failure_type: null,
              },
              ...current.items,
            ];
        return { ...current, items, total: exists ? current.total : current.total + 1 };
      });

      setActiveViewerTab("document");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      pendingAutoOpenDocumentIdRef.current = result.document_id;
      autoOpenRetryCountRef.current[result.document_id] = 0;
      setActiveId(result.document_id);
      setUploadFeedback({
        kind: "success",
        message: "Documento subido correctamente.",
        documentId: result.document_id,
        showOpenAction: false,
      });
      requestPdfLoad(result.document_id);
      queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
      try {
        await queryClient.fetchQuery({
          queryKey: ["documents", "list"],
          queryFn: fetchDocuments,
        });
      } catch {
        // Keep optimistic list item and fallback open action when refetch fails.
      }
      queryClient.invalidateQueries({ queryKey: ["documents", "detail", result.document_id] });
      queryClient.invalidateQueries({ queryKey: ["documents", "history", result.document_id] });
    },
    onError: (error) => {
      setUploadFeedback({
        kind: "error",
        message: getUserErrorMessage(error, "No se pudo subir el documento."),
        technicalDetails: getTechnicalDetails(error),
      });
    },
  });

  const validateUploadFile = (file: File): string | null => {
    const hasPdfMime = file.type === "application/pdf";
    const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
    if (!hasPdfMime && !hasPdfExtension) {
      return "Solo se admiten archivos PDF.";
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return "El archivo supera el tamaño máximo (20 MB).";
    }
    return null;
  };

  const queueUpload = (file: File) => {
    if (uploadMutation.isPending) {
      return false;
    }
    const validationError = validateUploadFile(file);
    if (validationError) {
      setUploadFeedback({
        kind: "error",
        message: validationError,
      });
      return false;
    }
    setUploadFeedback(null);
    uploadMutation.mutate(file);
    return true;
  };

  const handleViewerDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    viewerDragDepthRef.current += 1;
    setIsDragOverViewer(true);
  };

  const handleViewerDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!isDragOverViewer) {
      setIsDragOverViewer(true);
    }
  };

  const handleViewerDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    viewerDragDepthRef.current = Math.max(0, viewerDragDepthRef.current - 1);
    if (viewerDragDepthRef.current === 0) {
      setIsDragOverViewer(false);
    }
  };

  const handleViewerDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    viewerDragDepthRef.current = 0;
    setIsDragOverViewer(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    queueUpload(file);
  };

  const handleSidebarUploadDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    sidebarUploadDragDepthRef.current += 1;
    setIsDragOverSidebarUpload(true);
  };

  const handleSidebarUploadDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!isDragOverSidebarUpload) {
      setIsDragOverSidebarUpload(true);
    }
  };

  const handleSidebarUploadDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    sidebarUploadDragDepthRef.current = Math.max(0, sidebarUploadDragDepthRef.current - 1);
    if (sidebarUploadDragDepthRef.current === 0) {
      setIsDragOverSidebarUpload(false);
    }
  };

  const handleSidebarUploadDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    sidebarUploadDragDepthRef.current = 0;
    setIsDragOverSidebarUpload(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    queueUpload(file);
  };

  const openUploadFilePicker = () => {
    if (uploadMutation.isPending) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleOpenUploadArea = (event?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    event?.stopPropagation?.();
    // Keep the native file picker call synchronous with the user gesture.
    openUploadFilePicker();
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
    }
  };

  const handleSelectDocument = (docId: string) => {
    setActiveId(docId);
    requestPdfLoad(docId);
  };

  const documentList = useQuery({
    queryKey: ["documents", "list"],
    queryFn: fetchDocuments,
  });

  const documentDetails = useQuery({
    queryKey: ["documents", "detail", activeId],
    queryFn: () => fetchDocumentDetails(activeId ?? ""),
    enabled: Boolean(activeId),
  });

  const processingHistory = useQuery({
    queryKey: ["documents", "history", activeId],
    queryFn: () => fetchProcessingHistory(activeId ?? ""),
    enabled: Boolean(activeId),
  });

  const rawTextRunId = documentDetails.data?.latest_run?.run_id ?? null;
  const rawTextQuery = useQuery({
    queryKey: ["runs", "raw-text", rawTextRunId],
    queryFn: () => fetchRawText(rawTextRunId ?? ""),
    enabled: activeViewerTab === "raw_text" && Boolean(rawTextRunId),
    retry: false,
  });

  const sortedDocuments = useMemo(() => {
    const items = documentList.data?.items ?? [];
    return [...items].sort((a, b) => {
      const aTime = Date.parse(a.created_at);
      const bTime = Date.parse(b.created_at);
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return a.document_id.localeCompare(b.document_id);
      }
      if (Number.isNaN(aTime)) {
        return 1;
      }
      if (Number.isNaN(bTime)) {
        return -1;
      }
      return bTime - aTime;
    });
  }, [documentList.data?.items]);

  useEffect(() => {
    if (!activeId || !documentDetails.data) {
      return;
    }
    const latestState = documentDetails.data.latest_run?.state;
    const shouldPoll =
      documentDetails.data.status === "PROCESSING" ||
      latestState === "QUEUED" ||
      latestState === "RUNNING";
    if (!shouldPoll) {
      return;
    }
    const intervalId = window.setInterval(() => {
      documentDetails.refetch();
      processingHistory.refetch();
    }, 1500);
    return () => window.clearInterval(intervalId);
  }, [
    activeId,
    documentDetails,
    documentDetails.data?.status,
    documentDetails.data?.latest_run?.state,
    processingHistory,
  ]);

  const documentListItems = documentList.data?.items ?? [];

  useEffect(() => {
    const items = documentListItems;
    const processingItems = items.filter((item) => isDocumentProcessing(item.status));
    if (processingItems.length === 0) {
      listPollingStartedAtRef.current = null;
      return;
    }

    const now = Date.now();
    if (listPollingStartedAtRef.current === null) {
      listPollingStartedAtRef.current = now;
    }

    const elapsedMs = now - listPollingStartedAtRef.current;
    const maxPollingWindowMs = 10 * 60 * 1000;
    if (elapsedMs > maxPollingWindowMs) {
      return;
    }

    const intervalMs = elapsedMs < 2 * 60 * 1000 ? 1500 : 5000;
    const intervalId = window.setInterval(() => {
      documentList.refetch();
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [documentList.refetch, documentListItems]);

  useEffect(() => {
    if (documentList.status !== "success") {
      return;
    }
    if (sortedDocuments.length === 0) {
      setIsSidebarOpen(true);
    }
  }, [documentList.status, sortedDocuments.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const reprocessMutation = useMutation({
    mutationFn: async (docId: string) => triggerReprocess(docId),
    onMutate: async (docId) => {
      const previousDocumentList = queryClient.getQueryData<DocumentListResponse>([
        "documents",
        "list",
      ]);
      const previousDocumentDetail = queryClient.getQueryData<DocumentDetailResponse>([
        "documents",
        "detail",
        docId,
      ]);
      setReprocessingDocumentId(docId);
      setHasObservedProcessingAfterReprocess(false);
      await queryClient.cancelQueries({ queryKey: ["documents", "list"] });
      queryClient.setQueryData<DocumentListResponse | undefined>(["documents", "list"], (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          items: current.items.map((item) =>
            item.document_id === docId ? { ...item, status: "PROCESSING" } : item
          ),
        };
      });
      queryClient.setQueryData<DocumentDetailResponse | undefined>(
        ["documents", "detail", docId],
        (current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            status: "PROCESSING",
            latest_run: current.latest_run
              ? { ...current.latest_run, state: "QUEUED" }
              : current.latest_run,
          };
        }
      );
      return { previousDocumentList, previousDocumentDetail, docId };
    },
    onSuccess: (latestRun, docId) => {
      queryClient.setQueryData<DocumentDetailResponse | undefined>(
        ["documents", "detail", docId],
        (current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            status: "PROCESSING",
            latest_run: {
              run_id: latestRun.run_id,
              state: latestRun.state,
              failure_type: latestRun.failure_type,
            },
          };
        }
      );
      setActionFeedback({
        kind: "success",
        message: "Reprocesamiento iniciado.",
      });
      queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
      queryClient.invalidateQueries({ queryKey: ["documents", "detail", docId] });
      queryClient.invalidateQueries({ queryKey: ["documents", "history", docId] });
      queryClient.invalidateQueries({ queryKey: ["runs", "raw-text"] });
      queryClient.refetchQueries({ queryKey: ["documents", "list"], type: "active" });
      queryClient.refetchQueries({ queryKey: ["documents", "detail", docId], type: "active" });
      queryClient.refetchQueries({ queryKey: ["documents", "history", docId], type: "active" });
      latestRawTextRefreshRef.current = null;
    },
    onError: (error, docId, context) => {
      if (context?.previousDocumentList) {
        queryClient.setQueryData(["documents", "list"], context.previousDocumentList);
      }
      if (context?.previousDocumentDetail) {
        queryClient.setQueryData(["documents", "detail", docId], context.previousDocumentDetail);
      }
      queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
      queryClient.invalidateQueries({ queryKey: ["documents", "detail", docId] });
      queryClient.refetchQueries({ queryKey: ["documents", "list"], type: "active" });
      queryClient.refetchQueries({ queryKey: ["documents", "detail", docId], type: "active" });
      setActionFeedback({
        kind: "error",
        message: getUserErrorMessage(error, "No pudimos iniciar el reprocesamiento."),
        technicalDetails: getTechnicalDetails(error),
      });
      setReprocessingDocumentId(null);
      setHasObservedProcessingAfterReprocess(false);
    },
  });

  const handleRefresh = () => {
    setShowRefreshFeedback(true);
    if (refreshFeedbackTimerRef.current) {
      window.clearTimeout(refreshFeedbackTimerRef.current);
    }
    refreshFeedbackTimerRef.current = window.setTimeout(() => {
      setShowRefreshFeedback(false);
      refreshFeedbackTimerRef.current = null;
    }, 350);
    documentList.refetch();
    if (activeId) {
      documentDetails.refetch();
      processingHistory.refetch();
    }
  };
  const isListRefreshing =
    (documentList.isFetching || showRefreshFeedback) && !documentList.isLoading;
  const panelHeightClass =
    "h-[clamp(1180px,94vh,1480px)]";

  const toggleStepDetails = (key: string) => {
    setExpandedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const latestState = documentDetails.data?.latest_run?.state;
  const latestRunId = documentDetails.data?.latest_run?.run_id;
  const activeListDocument = useMemo(
    () => (activeId ? (documentList.data?.items ?? []).find((item) => item.document_id === activeId) : null),
    [activeId, documentList.data?.items]
  );
  const isActiveListProcessing = Boolean(
    activeListDocument && isDocumentProcessing(activeListDocument.status)
  );
  const isProcessing =
    documentDetails.data?.status === "PROCESSING" ||
    latestState === "QUEUED" ||
    latestState === "RUNNING";
  const isActiveDocumentProcessing = isProcessing || isActiveListProcessing;

  useEffect(() => {
    if (!latestRunId || !latestState) {
      return;
    }

    const shouldRefreshRawText =
      latestState === "COMPLETED" || latestState === "FAILED" || latestState === "TIMED_OUT";
    if (!shouldRefreshRawText) {
      return;
    }

    const refreshKey = `${latestRunId}:${latestState}`;
    if (latestRawTextRefreshRef.current === refreshKey) {
      return;
    }

    latestRawTextRefreshRef.current = refreshKey;
    queryClient.invalidateQueries({ queryKey: ["runs", "raw-text", latestRunId] });
  }, [latestRunId, latestState, queryClient]);

  useEffect(() => {
    if (!reprocessingDocumentId || activeId !== reprocessingDocumentId) {
      return;
    }
    if (isActiveDocumentProcessing && !hasObservedProcessingAfterReprocess) {
      setHasObservedProcessingAfterReprocess(true);
      return;
    }
    if (hasObservedProcessingAfterReprocess && !isActiveDocumentProcessing) {
      setReprocessingDocumentId(null);
      setHasObservedProcessingAfterReprocess(false);
    }
  }, [
    activeId,
    hasObservedProcessingAfterReprocess,
    isActiveDocumentProcessing,
    reprocessingDocumentId,
  ]);

  useEffect(() => {
    if (!uploadFeedback) {
      return;
    }
    const timeoutMs = uploadFeedback.kind === "success" ? 3500 : 5000;
    const timer = window.setTimeout(() => setUploadFeedback(null), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [uploadFeedback]);

  useEffect(() => {
    if (!actionFeedback) {
      return;
    }
    const timeoutMs = actionFeedback.kind === "success" ? 3500 : 5000;
    const timer = window.setTimeout(() => setActionFeedback(null), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [actionFeedback]);

  useEffect(() => {
    if (documentList.isError) {
      if (!hasShownListErrorToast) {
        setUploadFeedback({
          kind: "error",
          message: getUserErrorMessage(documentList.error, "No se pudieron cargar los documentos."),
          technicalDetails: getTechnicalDetails(documentList.error),
        });
        setHasShownListErrorToast(true);
      }
      return;
    }
    if (documentList.isSuccess && hasShownListErrorToast) {
      setHasShownListErrorToast(false);
    }
  }, [documentList.isError, documentList.isSuccess, documentList.error, hasShownListErrorToast]);

  const handleConfirmRetry = () => {
    if (!activeId) {
      setShowRetryModal(false);
      return;
    }
    setShowRetryModal(false);
    reprocessMutation.mutate(activeId);
  };

  const rawTextContent = rawTextQuery.data?.text ?? null;
  const hasRawText = Boolean(rawTextContent && rawTextContent.length > 0);
  const canCopyRawText = hasRawText && !rawTextQuery.isLoading && !rawTextQuery.isError;

  const isRawTextLoading = rawTextQuery.isLoading || rawTextQuery.isFetching;
  const canSearchRawText = hasRawText && !isRawTextLoading && !rawTextQuery.isError;

  const handleRawSearch = () => {
    if (!rawTextContent || !rawSearch.trim()) {
      setRawSearchNotice(null);
      return;
    }
    const match = rawTextContent.toLowerCase().includes(rawSearch.trim().toLowerCase());
    setRawSearchNotice(match ? "Coincidencia encontrada." : "No se encontraron coincidencias.");
  };

  const rawTextErrorMessage = (() => {
    if (!rawTextQuery.isError) {
      return null;
    }
    if (rawTextQuery.error instanceof ApiResponseError) {
      if (rawTextQuery.error.reason === "RAW_TEXT_NOT_READY") {
        return null;
      }
      if (rawTextQuery.error.reason === "RAW_TEXT_NOT_AVAILABLE") {
        return null;
      }
      if (rawTextQuery.error.reason === "RAW_TEXT_NOT_USABLE") {
        return null;
      }
      if (rawTextQuery.error.errorCode === "ARTIFACT_MISSING") {
        return null;
      }
      return rawTextQuery.error.userMessage;
    }
    return getUserErrorMessage(rawTextQuery.error, "No se pudo cargar el texto extraido.");
  })();

  const handleDownloadRawText = () => {
    if (!rawTextContent) {
      return;
    }
    const blob = new Blob([rawTextContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "texto-extraido.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const setCopyFeedbackWithTimeout = (message: string) => {
    setCopyFeedback(message);
    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }
    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopyFeedback(null);
      copyFeedbackTimerRef.current = null;
    }, 2500);
  };

  const handleCopyRawText = async () => {
    if (!rawTextContent) {
      setCopyFeedbackWithTimeout("No hay texto extraido para copiar.");
      return;
    }
    setIsCopyingRawText(true);
    try {
      await copyTextToClipboard(rawTextContent);
      setCopyFeedbackWithTimeout("Texto copiado.");
    } catch (error) {
      setCopyFeedbackWithTimeout(
        getUserErrorMessage(error, "No se pudo copiar el texto.")
      );
    } finally {
      setIsCopyingRawText(false);
    }
  };

  const openUploadInfo = () => {
    if (uploadInfoCloseTimerRef.current) {
      window.clearTimeout(uploadInfoCloseTimerRef.current);
      uploadInfoCloseTimerRef.current = null;
    }
    setShowUploadInfo(true);
  };

  const closeUploadInfo = (withDelay: boolean) => {
    if (uploadInfoCloseTimerRef.current) {
      window.clearTimeout(uploadInfoCloseTimerRef.current);
      uploadInfoCloseTimerRef.current = null;
    }
    if (withDelay) {
      uploadInfoCloseTimerRef.current = window.setTimeout(() => {
        setShowUploadInfo(false);
      }, 150);
      return;
    }
    setShowUploadInfo(false);
  };

  const viewerTabButton = (key: "document" | "raw_text" | "technical", label: string) => (
    <button
      type="button"
      onClick={() => setActiveViewerTab(key)}
      className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
        activeViewerTab === key
          ? "bg-ink text-white"
          : "border border-black/10 bg-white text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen px-6 py-10">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <p className="text-sm uppercase tracking-[0.3em] text-muted">
          Carga asistiva de documentos
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-4xl font-semibold text-ink">
              Subida de documentos medicos
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Sube un PDF y revisa el documento en cuanto quede disponible.
            </p>
          </div>
          {downloadUrl && (
            <a href={downloadUrl} className="self-start" target="_blank" rel="noreferrer">
              <Button>
                <Download size={16} />
                Descargar
              </Button>
            </a>
          )}
        </div>
      </header>

      <main className="relative mx-auto mt-10 w-full max-w-6xl">
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="ghost"
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-label={isSidebarOpen ? "Cerrar lista de documentos" : "Abrir lista de documentos"}
          >
            <span className="text-lg font-semibold">{isSidebarOpen ? "←" : "≡"}</span>
          </Button>
          <span className="text-sm text-muted">
            {isSidebarOpen ? "Ocultar lista" : "Mostrar lista"}
          </span>
        </div>

        <div className="relative z-20 flex gap-6">
          <aside
            className={`flex-shrink-0 transition-all duration-300 ${
              isSidebarOpen ? "w-80" : "w-0"
            }`}
          >
            <div
              className={`overflow-hidden rounded-3xl border border-black/10 bg-white/80 shadow-xl transition-all ${
                isSidebarOpen ? "opacity-100" : "opacity-0"
              }`}
            >
          <section className={`flex flex-col p-6 ${panelHeightClass}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Documentos</h2>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={handleRefresh}
                    type="button"
                    title="Actualizar"
                    aria-label="Actualizar"
                    disabled={documentList.isFetching || showRefreshFeedback}
                    className="rounded-full border border-black/15 bg-white p-2 text-ink shadow-sm hover:bg-accentSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <RefreshCw
                      size={16}
                      className={documentList.isFetching || showRefreshFeedback ? "animate-spin" : ""}
                    />
                  </Button>
                </div>

                <div
                  ref={uploadPanelRef}
                  className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">Cargar documento</h3>
                    <button
                      ref={uploadInfoTriggerRef}
                      type="button"
                      aria-label="Informacion de formatos y tamano"
                      aria-expanded={showUploadInfo}
                      onFocus={openUploadInfo}
                      onBlur={() => closeUploadInfo(false)}
                      onMouseEnter={() => {
                        if (isHoverDevice) {
                          openUploadInfo();
                        }
                      }}
                      onMouseLeave={() => {
                        if (isHoverDevice) {
                          closeUploadInfo(true);
                        }
                      }}
                      onClick={(event) => {
                        if (isHoverDevice) {
                          return;
                        }
                        event.stopPropagation();
                        setShowUploadInfo((current) => !current);
                      }}
                      className="text-sm text-muted"
                    >
                      ⓘ
                    </button>
                  </div>
                  <UploadDropzone
                    className="mt-3"
                    isDragOver={isDragOverSidebarUpload}
                    onActivate={handleOpenUploadArea}
                    onDragEnter={handleSidebarUploadDragEnter}
                    onDragOver={handleSidebarUploadDragOver}
                    onDragLeave={handleSidebarUploadDragLeave}
                    onDrop={handleSidebarUploadDrop}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      id="upload-document-input"
                      ref={fileInputRef}
                      type="file"
                      aria-label="Archivo PDF"
                      accept=".pdf,application/pdf"
                      className="sr-only"
                      disabled={uploadMutation.isPending}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        if (!file) {
                          setUploadFeedback(null);
                          return;
                        }
                        const queued = queueUpload(file);
                        if (!queued) {
                          event.currentTarget.value = "";
                        }
                      }}
                    />
                    {uploadMutation.isPending && (
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Subiendo...</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                  {documentList.isLoading && (
                    <div className="space-y-2 rounded-2xl border border-black/10 bg-white/70 p-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={`skeleton-initial-${index}`} className="animate-pulse rounded-xl border border-black/10 bg-white/80 p-3">
                          <div className="h-3 w-2/3 rounded bg-black/10" />
                          <div className="mt-2 h-2.5 w-1/2 rounded bg-black/10" />
                        </div>
                      ))}
                    </div>
                  )}

                  {documentList.isError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <p>{getUserErrorMessage(documentList.error, "No se pudieron cargar los documentos.")}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button variant="ghost" type="button" onClick={() => documentList.refetch()}>
                          Reintentar
                        </Button>
                        {getTechnicalDetails(documentList.error) && (
                          <details className="text-xs text-muted">
                            <summary className="cursor-pointer">Ver detalles tecnicos</summary>
                            <p className="mt-1">{getTechnicalDetails(documentList.error)}</p>
                          </details>
                        )}
                      </div>
                    </div>
                  )}

                  {documentList.data &&
                    (isListRefreshing ? (
                      <div className="space-y-2 rounded-2xl border border-black/10 bg-white/70 p-4">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <div
                            key={`skeleton-refresh-${index}`}
                            className="animate-pulse rounded-xl border border-black/10 bg-white/80 p-3"
                          >
                            <div className="h-3 w-2/3 rounded bg-black/10" />
                            <div className="mt-2 h-2.5 w-1/2 rounded bg-black/10" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sortedDocuments.length === 0 ? (
                          <p className="px-1 py-2 text-sm text-muted">Aun no hay documentos cargados.</p>
                        ) : (
                          sortedDocuments.map((item) => {
                            const isActive = activeId === item.document_id;
                            const status = mapDocumentStatus(item);
                            return (
                              <button
                                key={item.document_id}
                                type="button"
                                onClick={() => handleSelectDocument(item.document_id)}
                                aria-pressed={isActive}
                                className={`w-full rounded-xl border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                                  isActive
                                    ? "border-ink/30 bg-black/[0.04] text-ink shadow-sm ring-1 ring-ink/25"
                                    : "border-black/10 bg-white/80 text-ink hover:bg-white"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{item.original_filename}</p>
                                    <p className="mt-0.5 text-xs text-muted">
                                      Subido: {formatTimestamp(item.created_at)}
                                    </p>
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                      status.tone === "ok"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : status.tone === "error"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-amber-100 text-amber-700"
                                    }`}
                                  >
                                    {status.tone === "warn" && (
                                      <span className="mr-1 inline-block h-2 w-2 animate-spin rounded-full border border-current border-r-transparent align-middle" />
                                    )}
                                    {status.label}
                                  </span>
                                </div>
                                {isProcessingTooLong(item.created_at, item.status) && (
                                  <p className="mt-2 text-xs text-muted">
                                    Tardando mas de lo esperado
                                  </p>
                                )}
                                {item.failure_type && (
                                  <p className="mt-2 text-xs text-red-600">
                                    Error: {item.failure_type}
                                  </p>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    ))}
                </div>
              </section>
            </div>
          </aside>

          <section className={`flex flex-1 flex-col rounded-3xl border border-black/10 bg-white/70 p-6 shadow-xl ${panelHeightClass}`}>
            {loadPdf.isError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {getUserErrorMessage(loadPdf.error, "No se pudo cargar la vista previa del documento.")}
              </div>
            )}
            {activeId && (
              <div className={loadPdf.isError ? "mt-4" : ""}>
                {documentDetails.isLoading && (
                  <p className="text-xs text-muted">Cargando estado del documento...</p>
                )}
              </div>
            )}
            <div className="mt-4 flex min-h-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2">
                {viewerTabButton("document", "Documento")}
                {viewerTabButton("raw_text", "Texto extraido")}
                {viewerTabButton("technical", "Detalles tecnicos")}
              </div>
              <div className="mt-4 min-h-0 flex-1">
                {activeViewerTab === "document" && (
                  <div
                    data-testid="viewer-dropzone"
                    className="relative h-full min-h-0"
                    onDragEnter={handleViewerDragEnter}
                    onDragOver={handleViewerDragOver}
                    onDragLeave={handleViewerDragLeave}
                    onDrop={handleViewerDrop}
                  >
                    {!activeId ? (
                    documentList.isError ? (
                      <div className="flex h-full flex-col rounded-2xl border border-black/10 bg-white/80 p-6">
                        <div className="flex flex-1 items-center justify-center text-center">
                          <p className="text-sm text-muted">
                            Revisa la lista lateral para reintentar la carga de documentos.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div
                        data-testid="viewer-empty-state"
                        className="relative flex h-full flex-col rounded-2xl border border-black/10 bg-white/80 p-6"
                        role="button"
                        tabIndex={0}
                        onClick={handleOpenUploadArea}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleOpenUploadArea();
                          }
                        }}
                      >
                        <div className="flex flex-1 flex-col items-center justify-center text-center">
                          <p className="text-sm text-muted">
                            Selecciona un documento en la barra lateral o carga uno nuevo.
                          </p>
                          <UploadDropzone
                            className="mt-4 w-full max-w-sm"
                            isDragOver={isDragOverViewer}
                            onActivate={handleOpenUploadArea}
                            onDragEnter={handleViewerDragEnter}
                            onDragOver={handleViewerDragOver}
                            onDragLeave={handleViewerDragLeave}
                            onDrop={handleViewerDrop}
                            showDropOverlay
                          />
                        </div>
                      </div>
                    )
                    ) : (
                      <PdfViewer
                        key={activeId ?? "viewer-empty"}
                        fileUrl={fileUrl}
                        filename={filename}
                        isDragOver={isDragOverViewer}
                      />
                    )}
                  </div>
                )}
                {activeViewerTab === "raw_text" && (
                  <div className="flex h-full flex-col rounded-2xl border border-black/10 bg-white/80 p-4">
                    <div className="rounded-2xl border border-black/10 bg-white/90 p-3">
                      <div className="flex flex-col gap-2 text-xs text-ink">
                        <span className="text-muted">
                          ¿El texto no es correcto? Puedes reprocesarlo para regenerar la extraccion.
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            disabled={!activeId || isActiveDocumentProcessing || reprocessMutation.isPending}
                            onClick={() => setShowRetryModal(true)}
                          >
                            {reprocessMutation.isPending ||
                            (Boolean(activeId) &&
                              reprocessingDocumentId === activeId &&
                              (!hasObservedProcessingAfterReprocess || isActiveDocumentProcessing))
                              ? "Reprocesando..."
                              : isActiveDocumentProcessing
                              ? "Procesando..."
                              : "Reprocesar"}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="w-full rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-muted outline-none sm:w-64"
                        placeholder="Buscar en el texto"
                        value={rawSearch}
                        disabled={!canSearchRawText}
                        onChange={(event) => setRawSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            handleRawSearch();
                          }
                        }}
                      />
                      <Button type="button" disabled={!canSearchRawText} onClick={handleRawSearch}>
                        Buscar
                      </Button>
                      <Button
                        type="button"
                        disabled={!canCopyRawText || isCopyingRawText}
                        onClick={() => {
                          void handleCopyRawText();
                        }}
                      >
                        {isCopyingRawText
                          ? "Copiando..."
                          : copyFeedback === "Texto copiado."
                          ? "Copiado"
                          : "Copiar todo"}
                      </Button>
                      <Button type="button" disabled={!rawTextContent} onClick={handleDownloadRawText}>
                        Descargar texto (.txt)
                      </Button>
                    </div>
                    {copyFeedback && (
                      <p className="mt-2 text-xs text-muted" role="status" aria-live="polite">
                        {copyFeedback}
                      </p>
                    )}
                    {hasRawText && rawSearchNotice && (
                      <p className="mt-2 text-xs text-muted">{rawSearchNotice}</p>
                    )}
                    {isRawTextLoading && (
                      <p className="mt-2 text-xs text-muted">Cargando texto extraido...</p>
                    )}
                    {rawTextErrorMessage && (
                      <p className="mt-2 text-xs text-red-600">
                        {rawTextErrorMessage}
                      </p>
                    )}
                    <div className="mt-3 flex-1 overflow-y-auto rounded-xl border border-dashed border-black/10 bg-white/70 p-3 font-mono text-xs text-muted">
                      {rawTextContent ? (
                        <pre>{rawTextContent}</pre>
                      ) : (
                        "Sin texto extraido."
                      )}
                    </div>
                  </div>
                )}
                {activeViewerTab === "technical" && (
                  <div className="h-full overflow-y-auto rounded-2xl border border-black/10 bg-white/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        Historial de procesamiento
                      </p>
                      <Button
                        type="button"
                        disabled={!activeId || isActiveDocumentProcessing || reprocessMutation.isPending}
                        onClick={() => setShowRetryModal(true)}
                      >
                        {isActiveDocumentProcessing
                          ? "Procesando..."
                          : reprocessMutation.isPending
                          ? "Reprocesando..."
                          : "Reprocesar"}
                      </Button>
                    </div>
                    {!activeId && (
                      <p className="mt-2 text-xs text-muted">
                        Selecciona un documento para ver los detalles tecnicos.
                      </p>
                    )}
                    {activeId && processingHistory.isLoading && (
                      <p className="mt-2 text-xs text-muted">Cargando historial...</p>
                    )}
                    {activeId && processingHistory.isError && (
                      <p className="mt-2 text-xs text-red-600">
                        {getUserErrorMessage(
                          processingHistory.error,
                          "No se pudo cargar el historial de procesamiento."
                        )}
                      </p>
                    )}
                    {activeId &&
                      processingHistory.data &&
                      processingHistory.data.runs.length === 0 && (
                        <p className="mt-2 text-xs text-muted">
                          No hay ejecuciones registradas para este documento.
                        </p>
                      )}
                    {activeId &&
                      processingHistory.data &&
                      processingHistory.data.runs.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {processingHistory.data.runs.map((run) => (
                            <div
                              key={run.run_id}
                              className="rounded-xl border border-black/10 bg-white/90 p-2"
                            >
                              <div className="text-xs font-semibold text-ink">
                                {formatRunHeader(run)}
                              </div>
                              {run.failure_type && (
                                <p className="mt-1 text-xs text-red-600">
                                  {explainFailure(run.failure_type)}
                                </p>
                              )}
                              <div className="mt-2 space-y-1">
                                {run.steps.length === 0 && (
                                  <p className="text-xs text-muted">
                                    Sin pasos registrados.
                                  </p>
                                )}
                                {run.steps.length > 0 &&
                                  groupProcessingSteps(run.steps).map((step, index) => {
                                    const stepKey = `${run.run_id}-${step.step_name}-${step.attempt}-${index}`;
                                    const duration = formatDuration(step.start_time, step.end_time);
                                    const startTime = formatTime(step.start_time);
                                    const endTime = formatTime(step.end_time);
                                    const timeRange =
                                      startTime && endTime
                                        ? `${startTime} \u2192 ${endTime}`
                                        : startTime ?? "--:--";
                                    return (
                                      <div
                                        key={stepKey}
                                        className="rounded-lg border border-black/5 bg-white p-2"
                                      >
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                          <span
                                            className={
                                              step.status === "FAILED"
                                                ? "text-red-600"
                                                : step.status === "COMPLETED"
                                                ? "text-green-600"
                                                : "text-amber-600"
                                            }
                                          >
                                            {statusIcon(step.status)}
                                          </span>
                                          <span className="font-semibold text-ink">
                                            {step.step_name}
                                          </span>
                                          <span>intento {step.attempt}</span>
                                          <span>{timeRange}</span>
                                          {duration && <span>{duration}</span>}
                                        </div>
                                        {step.status === "FAILED" && (
                                          <p className="mt-1 text-xs text-red-600">
                                            {explainFailure(
                                              step.raw_events.find(
                                                (event) => event.step_status === "FAILED"
                                              )?.error_code
                                            )}
                                          </p>
                                        )}
                                        {shouldShowDetails(step) && (
                                          <div className="mt-1">
                                            <button
                                              type="button"
                                              className="text-xs font-semibold text-muted"
                                              onClick={() => toggleStepDetails(stepKey)}
                                            >
                                              {expandedSteps[stepKey]
                                                ? "Ocultar detalles"
                                                : "Ver detalles"}
                                            </button>
                                          </div>
                                        )}
                                        {shouldShowDetails(step) && expandedSteps[stepKey] && (
                                          <div className="mt-2 space-y-1 rounded-lg border border-black/5 bg-white/80 p-2">
                                            {step.raw_events.map((event, eventIndex) => (
                                              <div
                                                key={`${stepKey}-event-${eventIndex}`}
                                                className="text-xs text-muted"
                                              >
                                                <span className="font-semibold text-ink">
                                                  {event.step_status}
                                                </span>
                                                <span>
                                                  {event.started_at
                                                    ? ` · Inicio: ${formatTime(event.started_at) ?? "--:--"}`
                                                    : ""}
                                                </span>
                                                <span>
                                                  {event.ended_at
                                                    ? ` · Fin: ${formatTime(event.ended_at) ?? "--:--"}`
                                                    : ""}
                                                </span>
                                                {event.error_code && (
                                                  <span className="text-red-600">
                                                    {` · ${explainFailure(event.error_code)}`}
                                                  </span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
      {showUploadInfo &&
        createPortal(
          <div
            ref={uploadInfoContentRef}
            role="tooltip"
            style={{ top: `${uploadInfoPosition.top}px`, left: `${uploadInfoPosition.left}px` }}
            className="fixed z-[70] w-64 rounded-xl border border-black/10 bg-white p-3 text-xs text-ink shadow-lg"
            onMouseEnter={() => {
              if (isHoverDevice) {
                openUploadInfo();
              }
            }}
            onMouseLeave={() => {
              if (isHoverDevice) {
                closeUploadInfo(true);
              }
            }}
          >
            <p>Formatos permitidos: PDF.</p>
            <p className="mt-1">Tamaño maximo: 20 MB.</p>
          </div>,
          document.body
        )}
      {showRetryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-ink">Reprocesar documento</p>
            <p className="mt-2 text-xs text-muted">
              Esto volvera a ejecutar extraccion e interpretacion y puede cambiar los resultados.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowRetryModal(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleConfirmRetry}>
                Reprocesar
              </Button>
            </div>
          </div>
        </div>
      )}
            {uploadFeedback && (
              <div className="fixed left-1/2 top-10 z-[60] w-full max-w-lg -translate-x-1/2 px-4 sm:w-[32rem]">
                <div
            className={`rounded-2xl border px-5 py-4 text-base shadow-xl ${
              uploadFeedback.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
            role="status"
          >
                  <div className="flex items-center justify-between gap-3">
                    <span>{uploadFeedback.message}</span>
              <button
                type="button"
                aria-label="Cerrar notificacion"
                className="text-lg font-semibold leading-none text-ink"
                onClick={() => setUploadFeedback(null)}
              >
                &times;
              </button>
            </div>
                  {uploadFeedback.kind === "success" &&
                    uploadFeedback.documentId &&
                    uploadFeedback.showOpenAction && (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-ink underline"
                onClick={() => {
                  setActiveViewerTab("document");
                  requestPdfLoad(uploadFeedback.documentId!);
                  setUploadFeedback(null);
                }}
              >
                Ver documento
              </button>
                  )}
                  {uploadFeedback.kind === "error" && (
                    <div className="mt-2 flex items-center gap-3">
                      {uploadFeedback.technicalDetails && (
                        <details className="text-xs text-muted">
                          <summary className="cursor-pointer">Ver detalles tecnicos</summary>
                          <p className="mt-1">{uploadFeedback.technicalDetails}</p>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {actionFeedback && (
              <div className="fixed left-1/2 top-28 z-[60] w-full max-w-lg -translate-x-1/2 px-4 sm:w-[32rem]">
                <div
                  className={`rounded-2xl border px-5 py-4 text-base shadow-xl ${
                    actionFeedback.kind === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                  role="status"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>{actionFeedback.message}</span>
                    <button
                      type="button"
                      aria-label="Cerrar notificacion de accion"
                      className="text-lg font-semibold leading-none text-ink"
                      onClick={() => setActionFeedback(null)}
                    >
                      &times;
                    </button>
                  </div>
                  {actionFeedback.kind === "error" && actionFeedback.technicalDetails && (
                    <div className="mt-2 flex items-center gap-3">
                      <details className="text-xs text-muted">
                        <summary className="cursor-pointer">Ver detalles tecnicos</summary>
                        <p className="mt-1">{actionFeedback.technicalDetails}</p>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            )}
    </div>
  );
}









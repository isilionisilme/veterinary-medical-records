import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Upload } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PdfViewer } from "./components/PdfViewer";
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
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`);
  if (!response.ok) {
    let errorMessage = "No pudimos cargar el documento.";
    try {
      const payload = await response.json();
      errorMessage = payload.message ?? errorMessage;
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new Error(errorMessage);
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
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`);
  if (!response.ok) {
    let errorMessage = "No pudimos cargar el estado del documento.";
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

async function fetchProcessingHistory(documentId: string): Promise<ProcessingHistoryResponse> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/processing-history`);
  if (!response.ok) {
    let errorMessage = "No pudimos cargar el historial de procesamiento.";
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
        errorMessage = "Solo se admiten archivos PDF en esta etapa.";
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

function formatRelativeUploadAge(value: string): string | null {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  const elapsedMs = Date.now() - timestamp;
  if (elapsedMs < 0) {
    return null;
  }
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 60) {
    return `Subido hace ${elapsedSeconds}s`;
  }
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `Subido hace ${elapsedMinutes} min`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `Subido hace ${elapsedHours} h`;
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
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [rawSearch, setRawSearch] = useState("");
  const [rawSearchNotice, setRawSearchNotice] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback | null>(null);
  const [showUploadInfo, setShowUploadInfo] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(true);
  const [uploadInfoPosition, setUploadInfoPosition] = useState({ top: 0, left: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInfoTriggerRef = useRef<HTMLButtonElement | null>(null);
  const uploadInfoContentRef = useRef<HTMLDivElement | null>(null);
  const uploadInfoCloseTimerRef = useRef<number | null>(null);
  const pendingAutoOpenDocumentIdRef = useRef<string | null>(null);
  const autoOpenRetryCountRef = useRef<Record<string, number>>({});
  const autoOpenRetryTimerRef = useRef<number | null>(null);
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
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      setActiveId(docId);
      setFileUrl(result.url);
      setFilename(result.filename);
    },
    onError: (_, docId) => {
      if (pendingAutoOpenDocumentIdRef.current === docId) {
        const retries = autoOpenRetryCountRef.current[docId] ?? 0;
        if (retries < 1) {
          autoOpenRetryCountRef.current[docId] = retries + 1;
          autoOpenRetryTimerRef.current = window.setTimeout(() => {
            loadPdf.mutate(docId);
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
      setSelectedFile(null);
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
      loadPdf.mutate(result.document_id);
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

  const handleUpload = () => {
    if (!selectedFile) {
      return;
    }
    if (selectedFile.size > MAX_UPLOAD_SIZE_BYTES) {
      setUploadFeedback({
        kind: "error",
        message: "El archivo supera el tamaño máximo (20 MB).",
      });
      return;
    }
    uploadMutation.mutate(selectedFile);
  };

  const handleSelectDocument = (docId: string) => {
    setActiveId(docId);
    loadPdf.mutate(docId);
    setIsSidebarOpen(false);
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

  useEffect(() => {
    const items = documentList.data?.items ?? [];
    const processingItems = items.filter((item) => isDocumentProcessing(item.status));
    if (processingItems.length === 0) {
      return;
    }

    const oldestMs = processingItems
      .map((item) => Date.parse(item.created_at))
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => a - b)[0];

    const maxPollingWindowMs = 3 * 60 * 1000;
    if (oldestMs && Date.now() - oldestMs > maxPollingWindowMs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      documentList.refetch();
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [documentList, documentList.data?.items]);

  const reprocessMutation = useMutation({
    mutationFn: async (docId: string) => triggerReprocess(docId),
    onSuccess: (_, docId) => {
      queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
      queryClient.invalidateQueries({ queryKey: ["documents", "detail", docId] });
      queryClient.invalidateQueries({ queryKey: ["documents", "history", docId] });
      setRetryNotice("Procesamiento reiniciado");
    },
    onError: () => {
      setRetryNotice("No pudimos reiniciar el procesamiento.");
    },
  });

  const handleRefresh = () => {
    documentList.refetch();
    if (activeId) {
      documentDetails.refetch();
      processingHistory.refetch();
    }
  };

  const toggleStepDetails = (key: string) => {
    setExpandedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const latestState = documentDetails.data?.latest_run?.state;
  const isProcessing =
    documentDetails.data?.status === "PROCESSING" ||
    latestState === "QUEUED" ||
    latestState === "RUNNING";

  useEffect(() => {
    if (!retryNotice) {
      return;
    }
    const timer = window.setTimeout(() => setRetryNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [retryNotice]);

  useEffect(() => {
    if (!uploadFeedback || uploadFeedback.kind !== "success") {
      return;
    }
    const timer = window.setTimeout(() => setUploadFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [uploadFeedback]);

  const handleConfirmRetry = () => {
    if (!activeId) {
      setShowRetryModal(false);
      return;
    }
    setShowRetryModal(false);
    reprocessMutation.mutate(activeId);
  };

  const [rawTextContent] = useState<string | null>(null);

  const handleRawSearch = () => {
    if (!rawTextContent || !rawSearch.trim()) {
      setRawSearchNotice("No hay texto disponible para buscar.");
      return;
    }
    const match = rawTextContent.toLowerCase().includes(rawSearch.trim().toLowerCase());
    setRawSearchNotice(match ? "Coincidencia encontrada." : "No se encontraron coincidencias.");
  };

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

        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-10 bg-transparent"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

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
              <section className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Documentos cargados</h2>
                    <p className="mt-2 text-xs text-muted">
                      Lista informativa con el progreso de procesamiento.
                    </p>
                  </div>
                  <Button variant="ghost" onClick={handleRefresh} type="button">
                    Actualizar
                  </Button>
                </div>

                <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">Subir documento</h3>
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
                  <div className="mt-2 flex flex-col gap-2">
                    <input
                      id="upload-document-input"
                      ref={fileInputRef}
                      type="file"
                      aria-label="Archivo PDF"
                      accept=".pdf,application/pdf"
                      className="w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        if (file && file.size > MAX_UPLOAD_SIZE_BYTES) {
                          setSelectedFile(null);
                          event.currentTarget.value = "";
                          setUploadFeedback({
                            kind: "error",
                            message: "El archivo supera el tamaño máximo (20 MB).",
                          });
                          return;
                        }
                        setSelectedFile(file);
                        setUploadFeedback(null);
                      }}
                    />
                    <Button
                      onClick={handleUpload}
                      disabled={uploadMutation.isPending || !selectedFile}
                      type="button"
                      className="w-full"
                    >
                      <Upload size={16} />
                      {uploadMutation.isPending ? "Subiendo..." : "Subir documento"}
                    </Button>
                  </div>
                </div>

                {documentList.isLoading && (
                  <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-muted">
                    Cargando documentos...
                  </div>
                )}

                {documentList.isError && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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

                {documentList.data && (
                  <div className="mt-4 space-y-3">
                    {documentList.data.items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-4 text-sm text-muted">
                        <p>Aun no hay documentos cargados.</p>
                        <Button
                          variant="ghost"
                          type="button"
                          className="mt-3"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Subir documento
                        </Button>
                      </div>
                    ) : (
                      documentList.data.items.map((item, index) => {
                        const isActive = activeId === item.document_id;
                        const status = mapDocumentStatus(item);
                        const relativeUploadAge = index === 0 ? formatRelativeUploadAge(item.created_at) : null;
                        return (
                          <button
                            key={item.document_id}
                            type="button"
                            onClick={() => handleSelectDocument(item.document_id)}
                            aria-pressed={isActive}
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                              isActive
                                ? "border-accent bg-accentSoft font-semibold text-ink"
                                : "border-black/10 bg-white/80 text-ink hover:bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm">{item.original_filename}</p>
                                <p className="mt-1 text-xs text-muted">
                                  Subido: {formatTimestamp(item.created_at)}
                                </p>
                                {relativeUploadAge && (
                                  <p className="mt-1 text-xs text-muted">{relativeUploadAge}</p>
                                )}
                              </div>
                              <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-ink">
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
                )}
              </section>
            </div>
          </aside>

          <section className="flex-1 rounded-3xl border border-black/10 bg-white/70 p-6 shadow-xl">
            {loadPdf.isError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {(loadPdf.error as Error).message}
              </div>
            )}
            {activeId && (
              <div className={loadPdf.isError ? "mt-4" : ""}>
                {documentDetails.isLoading && (
                  <p className="text-xs text-muted">Cargando estado del documento...</p>
                )}
                {documentDetails.isError && (
                  <p className="text-xs text-red-600">
                    {(documentDetails.error as Error).message}
                  </p>
                )}
              </div>
            )}
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                {viewerTabButton("document", "Documento")}
                {viewerTabButton("raw_text", "Texto extraido")}
                {viewerTabButton("technical", "Detalles tecnicos")}
              </div>
              <div className="mt-4 h-[65vh]">
                {activeViewerTab === "document" && (
                  <PdfViewer fileUrl={fileUrl} filename={filename} />
                )}
                {activeViewerTab === "raw_text" && (
                  <div className="flex h-full flex-col rounded-2xl border border-black/10 bg-white/80 p-4">
                    <div className="rounded-2xl border border-black/10 bg-white/90 p-3">
                      <div className="flex flex-col gap-2 text-xs text-ink">
                        <span className="font-semibold">¿El texto parece incorrecto?</span>
                        <span className="text-muted">
                          Puedes reintentar el procesamiento para regenerar la extraccion.
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            disabled={!activeId || isProcessing || reprocessMutation.isPending}
                            onClick={() => setShowRetryModal(true)}
                          >
                            {isProcessing
                              ? "Procesando..."
                              : reprocessMutation.isPending
                              ? "Reprocesando..."
                              : "Reintentar procesamiento"}
                          </Button>
                          {retryNotice && (
                            <span className="text-xs text-muted">{retryNotice}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="w-full rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-muted outline-none sm:w-64"
                        placeholder="Buscar en el texto"
                        value={rawSearch}
                        onChange={(event) => setRawSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            handleRawSearch();
                          }
                        }}
                      />
                      <Button type="button" onClick={handleRawSearch}>
                        Buscar
                      </Button>
                      <Button type="button" disabled={!rawTextContent}>
                        Copiar todo
                      </Button>
                      <Button type="button" disabled={!rawTextContent} onClick={handleDownloadRawText}>
                        Descargar texto (.txt)
                      </Button>
                    </div>
                    {rawSearchNotice && (
                      <p className="mt-2 text-xs text-muted">{rawSearchNotice}</p>
                    )}
                    <div className="mt-3 flex-1 overflow-y-auto rounded-xl border border-dashed border-black/10 bg-white/70 p-3 font-mono text-xs text-muted">
                      {rawTextContent ? (
                        <pre>{rawTextContent}</pre>
                      ) : (
                        "Texto extraido no disponible en esta version."
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
                        disabled={!activeId || isProcessing || reprocessMutation.isPending}
                        onClick={() => setShowRetryModal(true)}
                      >
                        {isProcessing
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
                        {(processingHistory.error as Error).message}
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
            <p>Formatos admitidos: PDF (.pdf / application/pdf).</p>
            <p className="mt-1">Tamaño maximo: 20 MB.</p>
          </div>,
          document.body
        )}
      {showRetryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-ink">Reintentar procesamiento</p>
            <p className="mt-2 text-xs text-muted">
              Esto volvera a ejecutar extraccion e interpretacion y puede cambiar los resultados.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowRetryModal(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleConfirmRetry}>
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      )}
            {uploadFeedback && (
              <div className="fixed left-1/2 top-28 z-[60] w-full max-w-lg -translate-x-1/2 px-4">
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
                className="text-xs font-semibold text-ink"
                onClick={() => setUploadFeedback(null)}
              >
                Cerrar
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
                  loadPdf.mutate(uploadFeedback.documentId!);
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
    </div>
  );
}









import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PdfViewer } from "./components/PdfViewer";
import { SourcePanel } from "./components/SourcePanel";
import { UploadDropzone } from "./components/UploadDropzone";
import { Button } from "./components/ui/button";
import { useSourcePanelState } from "./hooks/useSourcePanelState";
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

type ReviewEvidence = {
  page: number;
  snippet: string;
};

type ReviewField = {
  field_id: string;
  key: string;
  value: string | number | boolean | null;
  value_type: string;
  confidence: number;
  is_critical: boolean;
  origin: "machine" | "human";
  evidence?: ReviewEvidence;
};

type StructuredInterpretationData = {
  schema_version: string;
  document_id: string;
  processing_run_id: string;
  created_at: string;
  fields: ReviewField[];
};

type CoreFieldDefinition = {
  key: string;
  label: string;
  section: string;
  order: number;
  value_type: "string" | "number" | "boolean" | "date" | "unknown";
  core: true;
};

type ReviewDisplayField = {
  id: string;
  key: string;
  label: string;
  section: string;
  order: number;
  valueType: string;
  displayValue: string;
  isMissing: boolean;
  confidence: number;
  source: "core" | "extracted";
  evidence?: ReviewEvidence;
  rawField?: ReviewField;
};

type ReviewPanelState = "idle" | "loading" | "ready" | "no_completed_run" | "error";

type DocumentReviewResponse = {
  document_id: string;
  latest_completed_run: {
    run_id: string;
    state: string;
    completed_at: string | null;
    failure_type: string | null;
  };
  active_interpretation: {
    interpretation_id: string;
    version_number: number;
    data: StructuredInterpretationData;
  };
  raw_text_artifact: {
    run_id: string;
    available: boolean;
  };
};

const CORE_FIELD_CATALOG: CoreFieldDefinition[] = [
  { key: "pet_name", label: "Nombre del paciente", section: "Paciente", order: 1, value_type: "string", core: true },
  { key: "species", label: "Especie", section: "Paciente", order: 2, value_type: "string", core: true },
  { key: "sex", label: "Sexo", section: "Paciente", order: 3, value_type: "string", core: true },
  { key: "weight", label: "Peso", section: "Paciente", order: 4, value_type: "number", core: true },
  { key: "visit_date", label: "Fecha de visita", section: "Consulta", order: 5, value_type: "date", core: true },
  { key: "chief_complaint", label: "Motivo de consulta", section: "Consulta", order: 6, value_type: "string", core: true },
  { key: "findings", label: "Hallazgos", section: "Evaluacion", order: 7, value_type: "string", core: true },
  { key: "diagnosis", label: "Diagnostico", section: "Evaluacion", order: 8, value_type: "string", core: true },
  { key: "tests_results", label: "Pruebas y resultados", section: "Plan", order: 9, value_type: "string", core: true },
  { key: "treatment_plan", label: "Plan de tratamiento", section: "Plan", order: 10, value_type: "string", core: true },
  { key: "medications", label: "Medicación", section: "Plan", order: 11, value_type: "string", core: true },
  { key: "follow_up", label: "Seguimiento", section: "Plan", order: 12, value_type: "string", core: true },
];

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

async function fetchDocumentReview(documentId: string): Promise<DocumentReviewResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/${documentId}/review`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/documents/${documentId}/review`
      );
    }
    throw error;
  }

  if (!response.ok) {
    let errorMessage = "No se pudo cargar la revision del documento.";
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
      reason
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

function formatReviewKeyLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function getConfidenceLabel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) {
    return "high";
  }
  if (confidence >= 0.55) {
    return "medium";
  }
  return "low";
}

function formatFieldValue(value: string | number | boolean | null, valueType: string): string {
  if (value === null || value === undefined || value === "") {
    return "No encontrado";
  }
  if (valueType === "boolean") {
    return value ? "Sí" : "No";
  }
  if (valueType === "date") {
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("es-ES");
    }
  }
  return String(value);
}

function truncateText(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 1).trimEnd()}…`;
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
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [evidenceNotice, setEvidenceNotice] = useState<string | null>(null);
  const [showMissingCoreFields, setShowMissingCoreFields] = useState(true);
  const [onlyLowConfidence, setOnlyLowConfidence] = useState(false);
  const [expandedFieldValues, setExpandedFieldValues] = useState<Record<string, boolean>>({});
  const [reviewLoadingDocId, setReviewLoadingDocId] = useState<string | null>(null);
  const [reviewLoadingSinceMs, setReviewLoadingSinceMs] = useState<number | null>(null);
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
  // Pin mode is desktop-only to avoid overcrowding tablet/mobile layouts.
  const sourcePinMediaQuery = "(min-width: 1280px)";
  const [isDesktopForPin, setIsDesktopForPin] = useState(false);
  const latestRawTextRefreshRef = useRef<string | null>(null);
  const listPollingStartedAtRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const sourcePanel = useSourcePanelState({
    isDesktopForPin,
    onNotice: setEvidenceNotice,
  });

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
    if (typeof window.matchMedia !== "function") {
      setIsDesktopForPin(true);
      return;
    }

    const mediaQuery = window.matchMedia(sourcePinMediaQuery);
    const syncPinCapability = () => setIsDesktopForPin(mediaQuery.matches);
    syncPinCapability();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncPinCapability);
      return () => mediaQuery.removeEventListener("change", syncPinCapability);
    }

    mediaQuery.addListener(syncPinCapability);
    return () => mediaQuery.removeListener(syncPinCapability);
  }, [sourcePinMediaQuery]);

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
      queryClient.invalidateQueries({ queryKey: ["documents", "review", result.document_id] });
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

  const documentReview = useQuery({
    queryKey: ["documents", "review", activeId],
    queryFn: () => fetchDocumentReview(activeId ?? ""),
    enabled: Boolean(activeId),
    retry: false,
  });

  useEffect(() => {
    if (!activeId) {
      setReviewLoadingDocId(null);
      setReviewLoadingSinceMs(null);
      return;
    }
    setReviewLoadingDocId(activeId);
    setReviewLoadingSinceMs(Date.now());
  }, [activeId]);

  useEffect(() => {
    if (!activeId || reviewLoadingDocId !== activeId) {
      return;
    }
    if (documentReview.isFetching) {
      return;
    }

    const minimumVisibleMs = 300;
    const elapsed = reviewLoadingSinceMs ? Date.now() - reviewLoadingSinceMs : minimumVisibleMs;
    if (elapsed >= minimumVisibleMs) {
      setReviewLoadingDocId(null);
      setReviewLoadingSinceMs(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setReviewLoadingDocId(null);
      setReviewLoadingSinceMs(null);
    }, minimumVisibleMs - elapsed);
    return () => window.clearTimeout(timer);
  }, [activeId, documentReview.isFetching, reviewLoadingDocId, reviewLoadingSinceMs]);

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
    setSelectedFieldId(null);
    setEvidenceNotice(null);
    setExpandedFieldValues({});
    sourcePanel.reset();
  }, [activeId]);

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
      documentReview.refetch();
    }, 1500);
    return () => window.clearInterval(intervalId);
  }, [
    activeId,
    documentDetails,
    documentDetails.data?.status,
    documentDetails.data?.latest_run?.state,
    processingHistory,
    documentReview,
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
      queryClient.invalidateQueries({ queryKey: ["documents", "review", docId] });
      queryClient.invalidateQueries({ queryKey: ["runs", "raw-text"] });
      queryClient.refetchQueries({ queryKey: ["documents", "list"], type: "active" });
      queryClient.refetchQueries({ queryKey: ["documents", "detail", docId], type: "active" });
      queryClient.refetchQueries({ queryKey: ["documents", "history", docId], type: "active" });
      queryClient.refetchQueries({ queryKey: ["documents", "review", docId], type: "active" });
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
      queryClient.invalidateQueries({ queryKey: ["documents", "review", docId] });
      queryClient.refetchQueries({ queryKey: ["documents", "list"], type: "active" });
      queryClient.refetchQueries({ queryKey: ["documents", "detail", docId], type: "active" });
      queryClient.refetchQueries({ queryKey: ["documents", "review", docId], type: "active" });
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
      documentReview.refetch();
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

  const extractedReviewFields = useMemo(
    () => documentReview.data?.active_interpretation.data.fields ?? [],
    [documentReview.data?.active_interpretation.data.fields]
  );

  const coreDisplayFields = useMemo(() => {
    const matchesByKey = new Map<string, ReviewField[]>();
    extractedReviewFields.forEach((field) => {
      const group = matchesByKey.get(field.key) ?? [];
      group.push(field);
      matchesByKey.set(field.key, group);
    });

    return CORE_FIELD_CATALOG.map((definition): ReviewDisplayField => {
      const candidates = matchesByKey.get(definition.key) ?? [];
      const bestCandidate = candidates.sort(
        (a, b) => clampConfidence(b.confidence) - clampConfidence(a.confidence)
      )[0];
      if (!bestCandidate) {
        return {
          id: `core:${definition.key}`,
          key: definition.key,
          label: definition.label,
          section: definition.section,
          order: definition.order,
          valueType: definition.value_type,
          displayValue: "No encontrado",
          isMissing: true,
          confidence: 0,
          source: "core",
        };
      }
      return {
        id: `core:${definition.key}`,
        key: definition.key,
        label: definition.label,
        section: definition.section,
        order: definition.order,
        valueType: bestCandidate.value_type,
        displayValue: formatFieldValue(bestCandidate.value, bestCandidate.value_type),
        isMissing: false,
        confidence: clampConfidence(bestCandidate.confidence),
        source: "core",
        evidence: bestCandidate.evidence,
        rawField: bestCandidate,
      };
    }).sort((a, b) => a.order - b.order);
  }, [extractedReviewFields]);

  const otherDisplayFields = useMemo(() => {
    const coreKeys = new Set(CORE_FIELD_CATALOG.map((field) => field.key));
    return extractedReviewFields
      .filter((field) => !coreKeys.has(field.key))
      .map((field, index): ReviewDisplayField => ({
        id: `extra:${field.field_id}:${index}`,
        key: field.key,
        label: formatReviewKeyLabel(field.key),
        section: "Otros campos extraídos",
        order: index + 1,
        valueType: field.value_type,
        displayValue: formatFieldValue(field.value, field.value_type),
        isMissing: false,
        confidence: clampConfidence(field.confidence),
        source: "extracted",
        evidence: field.evidence,
        rawField: field,
      }))
      .sort((a, b) => a.order - b.order);
  }, [extractedReviewFields]);

  const filteredCoreFields = useMemo(() => {
    return coreDisplayFields.filter((field) => {
      if (!showMissingCoreFields && field.isMissing) {
        return false;
      }
      if (onlyLowConfidence && field.confidence >= 0.55) {
        return false;
      }
      return true;
    });
  }, [coreDisplayFields, onlyLowConfidence, showMissingCoreFields]);

  const groupedCoreFields = useMemo(() => {
    const sectionOrder = ["Paciente", "Consulta", "Evaluacion", "Plan"];
    const groups = new Map<string, ReviewDisplayField[]>();
    filteredCoreFields.forEach((field) => {
      const current = groups.get(field.section) ?? [];
      current.push(field);
      groups.set(field.section, current);
    });
    return sectionOrder
      .filter((section) => groups.has(section))
      .map((section) => ({
        section,
        fields: (groups.get(section) ?? []).sort((a, b) => a.order - b.order),
      }));
  }, [filteredCoreFields]);

  const filteredOtherFields = useMemo(() => {
    return otherDisplayFields.filter((field) => {
      if (onlyLowConfidence && field.confidence >= 0.55) {
        return false;
      }
      return true;
    });
  }, [onlyLowConfidence, otherDisplayFields]);

  const reviewPanelState: ReviewPanelState = (() => {
    if (!activeId) {
      return "idle";
    }
    if (reviewLoadingDocId === activeId) {
      return "loading";
    }
    if (documentReview.isFetching && !documentReview.isError) {
      return "loading";
    }
    if (documentReview.isError) {
      if (
        documentReview.error instanceof ApiResponseError &&
        documentReview.error.reason === "NO_COMPLETED_RUN"
      ) {
        return "no_completed_run";
      }
      return "error";
    }
    if (!documentReview.data) {
      return "error";
    }
    return "ready";
  })();

  const reviewPanelMessage = (() => {
    if (reviewPanelState === "idle") {
      return "Selecciona un documento para empezar la revision.";
    }
    if (reviewPanelState === "loading") {
      return "Loading structured interpretation...";
    }
    if (reviewPanelState === "no_completed_run") {
      return "No completed run found";
    }
    if (reviewPanelState === "error") {
      return "Error loading interpretation";
    }
    return null;
  })();

  const handleSelectReviewField = (field: ReviewDisplayField) => {
    setSelectedFieldId(field.id);
    sourcePanel.openFromEvidence(field.evidence);
  };

  useEffect(() => {
    if (!selectedFieldId) {
      return;
    }
    const currentIds = new Set([
      ...coreDisplayFields.map((field) => field.id),
      ...otherDisplayFields.map((field) => field.id),
    ]);
    if (!currentIds.has(selectedFieldId)) {
      setSelectedFieldId(null);
    }
  }, [coreDisplayFields, otherDisplayFields, selectedFieldId]);

  useEffect(() => {
    if (!evidenceNotice) {
      return;
    }
    const timer = window.setTimeout(() => setEvidenceNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [evidenceNotice]);

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

  const sourcePanelContent = (
    <SourcePanel
      sourcePage={sourcePanel.sourcePage}
      sourceSnippet={sourcePanel.sourceSnippet}
      isSourcePinned={sourcePanel.isSourcePinned}
      isDesktopForPin={isDesktopForPin}
      onTogglePin={sourcePanel.togglePin}
      onClose={() => sourcePanel.closeOverlay()}
      content={
        fileUrl ? (
          <PdfViewer
            key={`source-${activeId ?? "empty"}`}
            fileUrl={fileUrl}
            filename={filename}
            isDragOver={false}
            focusPage={sourcePanel.sourcePage}
            highlightSnippet={sourcePanel.sourceSnippet}
            focusRequestId={sourcePanel.focusRequestId}
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted">
            No hay PDF disponible para este documento.
          </div>
        )
      }
    />
  );

  return (
    <div className="min-h-screen px-6 py-10">
      <header className="sticky top-0 z-40 mx-auto flex w-full max-w-6xl flex-col gap-3 bg-white/90 pb-3 backdrop-blur">
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

                <div
                  data-testid="left-panel-scroll"
                  className="relative mt-4 min-h-0 flex-1 overflow-y-auto pr-1"
                >
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
                    className="h-full min-h-0"
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
                      <div
                        className={`h-full min-h-0 ${
                          sourcePanel.isSourceOpen &&
                          sourcePanel.isSourcePinned &&
                          isDesktopForPin
                            ? "grid grid-cols-[minmax(0,1fr)_minmax(360px,420px)] gap-4"
                            : ""
                        }`}
                      >
                        <aside
                          data-testid="center-panel-scroll"
                          className="flex h-full w-full min-h-0 flex-col rounded-2xl border border-black/10 bg-white/80 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                                Datos estructurados
                              </p>
                              <p className="mt-1 text-xs text-muted">
                                La confianza guia la atencion, no bloquea decisiones.
                              </p>
                            </div>
                            <Button
                              type="button"
                              onClick={() => setActiveViewerTab("raw_text")}
                              disabled={!documentReview.data?.raw_text_artifact.available}
                            >
                              Abrir texto
                            </Button>
                            <Button type="button" variant="ghost" onClick={sourcePanel.openSource}>
                              Fuente
                            </Button>
                          </div>

                          {reviewPanelState === "ready" && (
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={showMissingCoreFields}
                                  onChange={(event) => setShowMissingCoreFields(event.target.checked)}
                                />
                                Mostrar faltantes
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={onlyLowConfidence}
                                  onChange={(event) => setOnlyLowConfidence(event.target.checked)}
                                />
                                Baja confianza
                              </label>
                            </div>
                          )}

                          <div
                            data-testid="right-panel-scroll"
                            className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
                          >
                            {reviewPanelState === "loading" && (
                              <section aria-live="polite" className="space-y-2">
                                <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                                  {reviewPanelMessage}
                                </p>
                                <div data-testid="review-core-skeleton" className="space-y-2">
                                  {Array.from({ length: 6 }).map((_, index) => (
                                    <div
                                      key={`review-skeleton-${index}`}
                                      className="animate-pulse rounded-xl border border-black/10 bg-white/90 p-3"
                                    >
                                      <div className="h-3 w-1/2 rounded bg-black/10" />
                                      <div className="mt-2 h-2.5 w-5/6 rounded bg-black/10" />
                                      <div className="mt-3 h-2 w-1/3 rounded bg-black/10" />
                                    </div>
                                  ))}
                                </div>
                              </section>
                            )}

                            {reviewPanelState !== "loading" &&
                              reviewPanelState !== "ready" &&
                              reviewPanelMessage && (
                                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                  {reviewPanelMessage}
                                </p>
                              )}

                            {reviewPanelState === "ready" && (
                              <>
                                <section>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                                  Campos core
                                </p>
                                <div className="mt-2 space-y-2">
                                  {groupedCoreFields.length === 0 && (
                                    <p className="rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-xs text-muted">
                                      Ningún campo core coincide con los filtros.
                                    </p>
                                  )}
                                  {groupedCoreFields.map((group) => (
                                    <div key={group.section} className="space-y-2">
                                      <p className="text-[11px] font-semibold text-muted">{group.section}</p>
                                      {group.fields.map((field) => {
                                        const confidenceTone = getConfidenceLabel(field.confidence);
                                        const isSelected = selectedFieldId === field.id;
                                        const isExpanded = Boolean(expandedFieldValues[field.id]);
                                        const valueText = isExpanded
                                          ? field.displayValue
                                          : truncateText(field.displayValue, 140);
                                        const canExpand = field.displayValue.length > 140;
                                        return (
                                          <article
                                            key={field.id}
                                            className={`rounded-xl border bg-white p-3 ${
                                              isSelected ? "border-accent ring-1 ring-accent/40" : "border-black/10"
                                            }`}
                                          >
                                        <button
                                          type="button"
                                          className="w-full text-left"
                                          onClick={() => handleSelectReviewField(field)}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="text-xs font-semibold text-ink">{field.label}</p>
                                            <span
                                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                confidenceTone === "high"
                                                  ? "bg-emerald-100 text-emerald-700"
                                                  : confidenceTone === "medium"
                                                  ? "bg-amber-100 text-amber-700"
                                                  : "bg-red-100 text-red-700"
                                              }`}
                                            >
                                              Confianza {(field.confidence * 100).toFixed(0)}%
                                            </span>
                                          </div>
                                          <p
                                            className={`mt-2 text-sm ${
                                              field.isMissing ? "italic text-muted" : "text-ink"
                                            }`}
                                          >
                                            {valueText}
                                          </p>
                                        </button>
                                        {canExpand && (
                                          <button
                                            type="button"
                                            className="mt-1 text-xs font-semibold text-muted underline underline-offset-2"
                                            onClick={() =>
                                              setExpandedFieldValues((current) => ({
                                                ...current,
                                                [field.id]: !current[field.id],
                                              }))
                                            }
                                          >
                                            {isExpanded ? "Ver menos" : "Ver más"}
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          aria-disabled={!field.evidence?.page}
                                          className={`mt-2 inline-flex items-center gap-1 text-[11px] ${
                                            field.evidence?.page
                                              ? "text-ink underline underline-offset-2"
                                              : "cursor-not-allowed text-muted/70"
                                          }`}
                                          onClick={() => handleSelectReviewField(field)}
                                        >
                                          <span className="text-muted">Fuente:</span>
                                          <span className="font-semibold">
                                            {field.evidence?.page ? `Página ${field.evidence.page}` : "—"}
                                          </span>
                                        </button>
                                        </article>
                                      );
                                    })}
                                    </div>
                                  ))}
                                </div>
                              </section>

                                <section>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                                  Otros campos extraídos
                                </p>
                                <div className="mt-2 space-y-2">
                                  {filteredOtherFields.length === 0 && (
                                    <p className="rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-xs text-muted">
                                      No hay otros campos extraídos.
                                    </p>
                                  )}
                                  {filteredOtherFields.map((field) => {
                                    const confidenceTone = getConfidenceLabel(field.confidence);
                                    const isSelected = selectedFieldId === field.id;
                                    return (
                                      <article
                                        key={field.id}
                                        className={`rounded-xl border bg-white p-3 ${
                                          isSelected ? "border-accent ring-1 ring-accent/40" : "border-black/10"
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          className="w-full text-left"
                                          onClick={() => handleSelectReviewField(field)}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="text-xs font-semibold text-ink">{field.label}</p>
                                            <span
                                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                confidenceTone === "high"
                                                  ? "bg-emerald-100 text-emerald-700"
                                                  : confidenceTone === "medium"
                                                  ? "bg-amber-100 text-amber-700"
                                                  : "bg-red-100 text-red-700"
                                              }`}
                                            >
                                              Confianza {(field.confidence * 100).toFixed(0)}%
                                            </span>
                                          </div>
                                          <p className="mt-2 text-sm text-ink">{field.displayValue}</p>
                                        </button>
                                        <button
                                          type="button"
                                          aria-disabled={!field.evidence?.page}
                                          className={`mt-2 inline-flex items-center gap-1 text-[11px] ${
                                            field.evidence?.page
                                              ? "text-ink underline underline-offset-2"
                                              : "cursor-not-allowed text-muted/70"
                                          }`}
                                          onClick={() => handleSelectReviewField(field)}
                                        >
                                          <span className="text-muted">Fuente:</span>
                                          <span className="font-semibold">
                                            {field.evidence?.page ? `Página ${field.evidence.page}` : "—"}
                                          </span>
                                        </button>
                                      </article>
                                    );
                                  })}
                                </div>
                                </section>
                              </>
                            )}
                          </div>

                          {evidenceNotice && (
                            <p className="mt-3 rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-xs text-muted">
                              {evidenceNotice}
                            </p>
                          )}
                        </aside>

                        {sourcePanel.isSourceOpen && sourcePanel.isSourcePinned && isDesktopForPin && (
                          <aside data-testid="source-pinned-panel" className="min-h-0">
                            {sourcePanelContent}
                          </aside>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {activeViewerTab === "document" &&
                  sourcePanel.isSourceOpen &&
                  (!sourcePanel.isSourcePinned || !isDesktopForPin) && (
                  <>
                    <button
                      type="button"
                      data-testid="source-drawer-backdrop"
                      className="fixed inset-0 z-40 bg-black/30"
                      aria-label="Cerrar fuente"
                      onClick={sourcePanel.closeOverlay}
                    />
                    <div
                      data-testid="source-drawer"
                      className="fixed inset-y-0 right-0 z-50 w-full max-w-xl p-4"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Fuente"
                    >
                      {sourcePanelContent}
                    </div>
                  </>
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









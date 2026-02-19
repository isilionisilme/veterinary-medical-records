import {
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlignLeft, Download, FileText, Info, Pencil, RefreshCw, Search, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfidenceDot } from "./components/app/ConfidenceDot";
import { CriticalBadge, CriticalIcon } from "./components/app/CriticalBadge";
import { FieldBlock, FieldRow, RepeatableList, ValueSurface } from "./components/app/Field";
import { IconButton } from "./components/app/IconButton";
import { SectionBlock, SectionHeader } from "./components/app/Section";
import { DocumentsSidebar } from "./components/DocumentsSidebar";
import { PdfViewer } from "./components/PdfViewer";
import { SourcePanel } from "./components/SourcePanel";
import { AddFieldDialog } from "./components/structured/AddFieldDialog";
import { FieldEditDialog } from "./components/structured/FieldEditDialog";
import { UploadDropzone } from "./components/UploadDropzone";
import { ToastHost } from "./components/toast/ToastHost";
import {
  type ActionFeedback,
  type ConnectivityToast,
  type UploadFeedback,
} from "./components/toast/toast-types";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "./components/ui/toggle-group";
import { Tooltip } from "./components/ui/tooltip";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { useSourcePanelState } from "./hooks/useSourcePanelState";
import {
  logExtractionDebugEvent,
  type ExtractionDebugEvent,
} from "./extraction/extractionDebug";
import {
  resolveCandidateSuggestionSections,
  type CandidateSuggestion,
} from "./extraction/candidateSuggestions";
import { getControlledVocabOptionValues, validateFieldValue } from "./extraction/fieldValidators";
import { groupProcessingSteps } from "./lib/processingHistory";
import {
  GLOBAL_SCHEMA_SECTION_ORDER,
  GLOBAL_SCHEMA_V0,
} from "./lib/globalSchemaV0";
import {
  formatDuration,
  formatShortDate,
  formatTime,
  shouldShowDetails,
  statusIcon,
} from "./lib/processingHistoryView";
import {
  type ConfidenceBucket,
  matchesStructuredDataFilters,
} from "./lib/structuredDataFilters";
import { mapDocumentStatus } from "./lib/documentStatus";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const DEBUG_CONFIDENCE_POLICY = import.meta.env.VITE_DEBUG_CONFIDENCE === "true";
const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;
const MISSING_VALUE_PLACEHOLDER = "—";
const EMPTY_LIST_PLACEHOLDER = "Sin elementos";
const OTHER_EXTRACTED_FIELDS_SECTION_TITLE = "Other extracted fields";
const OTHER_EXTRACTED_FIELDS_EMPTY_STATE = "No other extracted fields.";
const REPORT_LAYOUT_STORAGE_KEY = "reportLayout";
const DOCS_SIDEBAR_PIN_STORAGE_KEY = "docsSidebarPinned";
const REVIEW_SPLIT_RATIO_STORAGE_KEY = "reviewSplitRatio";
const DEFAULT_REVIEW_SPLIT_RATIO = 0.62;
export const MIN_PDF_PANEL_WIDTH_PX = 560;
const MIN_STRUCTURED_PANEL_WIDTH_PX = 420;
export const SPLITTER_COLUMN_WIDTH_PX = 14;
const REVIEW_SPLIT_RATIO_EPSILON = 0.0005;
export const REVIEW_SPLIT_MIN_WIDTH_PX =
  MIN_PDF_PANEL_WIDTH_PX + MIN_STRUCTURED_PANEL_WIDTH_PX + SPLITTER_COLUMN_WIDTH_PX;
const SPLIT_SNAP_POINTS = [0.7, 0.6, 0.5] as const;
const STRUCTURED_FIELD_ROW_CLASS = "w-full";
const STRUCTURED_FIELD_LABEL_CLASS = "min-w-0 text-sm font-medium leading-5 break-words";
const STRUCTURED_FIELD_STACK_CLASS = "space-y-[var(--field-row-gap-y)]";
const LONG_TEXT_FALLBACK_THRESHOLD = 180;
const LONG_TEXT_FIELD_KEYS = new Set([
  "treatment_plan",
  "diagnosis",
  "symptoms",
  "procedure",
  "medication",
  "reason_for_visit",
]);
const OWNER_SECTION_FIELD_KEYS = new Set([
  "owner_name",
  "owner_address",
]);
const VISIT_SECTION_FIELD_KEYS = new Set([
  "visit_date",
  "reason_for_visit",
]);

function isLongTextFieldKey(fieldKey: string): boolean {
  return LONG_TEXT_FIELD_KEYS.has(fieldKey);
}

function shouldRenderLongTextValue(fieldKey: string, value: string): boolean {
  if (isLongTextFieldKey(fieldKey)) {
    return true;
  }
  return value.includes("\n") || value.length > LONG_TEXT_FALLBACK_THRESHOLD;
}

function getStructuredFieldPrefix(fieldKey: string): "owner" | "visit" | "core" {
  if (OWNER_SECTION_FIELD_KEYS.has(fieldKey)) {
    return "owner";
  }
  if (VISIT_SECTION_FIELD_KEYS.has(fieldKey)) {
    return "visit";
  }
  return "core";
}

const HIDDEN_EXTRACTED_FIELDS = new Set([
  "document date",
  "document_date",
  "fecha de documento",
  "fecha documento",
  "fecha_documento",
  "imaging",
  "imagine",
  "imagen",
]);

const SECTION_LABELS: Record<string, string> = {
  "Identificacion del caso": "Datos de la clínica",
  "Visita / episodio": "Visitas",
};

const FIELD_LABELS: Record<string, string> = {
  clinic_name: "Nombre",
  clinic_address: "Dirección",
  pet_name: "Nombre",
  dob: "Nacimiento",
  owner_name: "Nombre",
  owner_id: "Dirección",
};

const HIDDEN_REVIEW_FIELDS = new Set(["document_date", "claim_id"]);

type ConfidencePolicyDiagnosticEvent = {
  event_type: "CONFIDENCE_POLICY_CONFIG_MISSING";
  document_id: string | null;
  reason: "missing_policy_version" | "missing_band_cutoffs" | "invalid_band_cutoffs";
};

declare global {
  interface Window {
    __confidencePolicyDiagnostics?: ConfidencePolicyDiagnosticEvent[];
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getReviewSplitBounds(containerWidth: number): {
  availablePanelWidth: number;
  minPdfPanelWidth: number;
  maxPdfPanelWidth: number;
  canFitBothMinWidths: boolean;
} {
  const safeContainerWidth = Number.isFinite(containerWidth) ? Math.max(containerWidth, 0) : 0;
  const availablePanelWidth = Math.max(safeContainerWidth - SPLITTER_COLUMN_WIDTH_PX, 0);
  const minPdfPanelWidth = MIN_PDF_PANEL_WIDTH_PX;
  const maxPdfPanelWidth = Math.max(availablePanelWidth - MIN_STRUCTURED_PANEL_WIDTH_PX, 0);
  const canFitBothMinWidths =
    availablePanelWidth >= MIN_PDF_PANEL_WIDTH_PX + MIN_STRUCTURED_PANEL_WIDTH_PX;
  return { availablePanelWidth, minPdfPanelWidth, maxPdfPanelWidth, canFitBothMinWidths };
}

function clampReviewSplitPx(rawSplitPx: number, containerWidth: number): number {
  const { availablePanelWidth, minPdfPanelWidth, maxPdfPanelWidth, canFitBothMinWidths } =
    getReviewSplitBounds(containerWidth);
  if (availablePanelWidth <= 0) {
    return 0;
  }
  if (!canFitBothMinWidths) {
    return clampNumber(rawSplitPx, 0, availablePanelWidth);
  }
  return clampNumber(rawSplitPx, minPdfPanelWidth, maxPdfPanelWidth);
}

function splitPxToReviewSplitRatio(splitPx: number, containerWidth: number): number {
  const { availablePanelWidth } = getReviewSplitBounds(containerWidth);
  if (availablePanelWidth <= 0) {
    return DEFAULT_REVIEW_SPLIT_RATIO;
  }
  const clampedSplitPx = clampReviewSplitPx(splitPx, containerWidth);
  return clampedSplitPx / availablePanelWidth;
}

function reviewSplitRatioToPx(rawRatio: number, containerWidth: number): number {
  const { availablePanelWidth } = getReviewSplitBounds(containerWidth);
  const normalizedRatio = Number.isFinite(rawRatio) ? rawRatio : DEFAULT_REVIEW_SPLIT_RATIO;
  return clampReviewSplitPx(normalizedRatio * availablePanelWidth, containerWidth);
}

function clampReviewSplitRatio(rawRatio: number, containerWidth: number): number {
  const splitPx = reviewSplitRatioToPx(rawRatio, containerWidth);
  return splitPxToReviewSplitRatio(splitPx, containerWidth);
}

function snapReviewSplitRatio(rawRatio: number): number {
  const nearestPoint = SPLIT_SNAP_POINTS.reduce((nearest, candidate) =>
    Math.abs(candidate - rawRatio) < Math.abs(nearest - rawRatio) ? candidate : nearest
  );

  if (Math.abs(nearestPoint - rawRatio) <= 0.03) {
    return nearestPoint;
  }

  return rawRatio;
}

function renderLongTextValue(options: {
  value: string;
  isMissing: boolean;
  missingClassName: string;
  valueClassName: string;
  testId?: string;
}): ReactNode {
  const { value, isMissing, missingClassName, valueClassName, testId } = options;

  return (
    <ValueSurface
      variant="long"
      testId={testId}
      className={isMissing ? `italic ${missingClassName}` : valueClassName}
    >
      {value}
    </ValueSurface>
  );
}

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
  review_status?: "IN_REVIEW" | "REVIEWED";
  reviewed_at?: string | null;
  reviewed_by?: string | null;
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
  review_status: "IN_REVIEW" | "REVIEWED";
  reviewed_at: string | null;
  reviewed_by: string | null;
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

type ConfidenceBandCutoffs = {
  low_max: number;
  mid_max: number;
};

type ConfidencePolicyConfig = {
  policy_version: string;
  band_cutoffs: ConfidenceBandCutoffs;
};

type ReviewField = {
  field_id: string;
  key: string;
  value: string | number | boolean | null;
  value_type: string;
  candidate_suggestions?: CandidateSuggestion[];
  field_candidate_confidence?: number | null;
  field_mapping_confidence?: number;
  text_extraction_reliability?: number | null;
  field_review_history_adjustment?: number;
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
  confidence_policy?: ConfidencePolicyConfig;
};

type ReviewSelectableField = {
  id: string;
  key: string;
  label: string;
  section: string;
  order: number;
  valueType: string;
  displayValue: string;
  isMissing: boolean;
  hasMappingConfidence: boolean;
  confidence: number;
  confidenceBand: ConfidenceBucket | null;
  source: "core" | "extracted";
  evidence?: ReviewEvidence;
  rawField?: ReviewField;
  repeatable: boolean;
};

type ReviewDisplayField = {
  id: string;
  key: string;
  label: string;
  section: string;
  order: number;
  isCritical: boolean;
  valueType: string;
  repeatable: boolean;
  items: ReviewSelectableField[];
  isEmptyList: boolean;
  source: "core" | "extracted";
};

type ReviewPanelState = "idle" | "loading" | "ready" | "no_completed_run" | "error";
type ReportLayout = 1 | 2;

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
  review_status: "IN_REVIEW" | "REVIEWED";
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type DocumentUploadResponse = {
  document_id: string;
  status: string;
  created_at: string;
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

function isConnectivityOrServerError(error: unknown): boolean {
  if (error instanceof UiError) {
    const details = error.technicalDetails?.toLowerCase() ?? "";
    if (details.includes("network error calling")) {
      return true;
    }
    if (/http 5\d\d calling/.test(details)) {
      return true;
    }
  }
  return isNetworkFetchError(error);
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

type ReviewToggleResponse = {
  document_id: string;
  review_status: "IN_REVIEW" | "REVIEWED";
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type InterpretationChangePayload = {
  op: "ADD" | "UPDATE" | "DELETE";
  field_id?: string;
  key?: string;
  value?: string | number | boolean | null;
  value_type?: string;
};

type InterpretationEditResponse = {
  run_id: string;
  interpretation_id: string;
  version_number: number;
  data: StructuredInterpretationData;
};

async function markDocumentReviewed(documentId: string): Promise<ReviewToggleResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/${documentId}/reviewed`, {
      method: "POST",
    });
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/documents/${documentId}/reviewed`
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
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/${documentId}/reviewed`
    );
  }

  return response.json();
}

async function reopenDocumentReview(documentId: string): Promise<ReviewToggleResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/${documentId}/reviewed`, {
      method: "DELETE",
    });
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new UiError(
        "No se pudo conectar con el servidor.",
        `Network error calling ${API_BASE_URL}/documents/${documentId}/reviewed`
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
      `HTTP ${response.status} calling ${API_BASE_URL}/documents/${documentId}/reviewed`
    );
  }

  return response.json();
}

async function editRunInterpretation(
  runId: string,
  payload: {
    base_version_number: number;
    changes: InterpretationChangePayload[];
  }
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
        `Network error calling ${API_BASE_URL}/runs/${runId}/interpretations`
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
      reason
    );
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

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }
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

function normalizeFieldIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldHideExtractedField(key: string): boolean {
  const normalizedKey = normalizeFieldIdentifier(key);
  if (HIDDEN_EXTRACTED_FIELDS.has(normalizedKey)) {
    return true;
  }
  const normalizedLabel = normalizeFieldIdentifier(formatReviewKeyLabel(key));
  return HIDDEN_EXTRACTED_FIELDS.has(normalizedLabel);
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

type ConfidenceTone = "low" | "med" | "high";

function formatSignedPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const isInteger = Number.isInteger(rounded);
  const absText = isInteger ? Math.abs(rounded).toFixed(0) : Math.abs(rounded).toFixed(1);
  if (rounded > 0) {
    return `+${absText}%`;
  }
  if (rounded < 0) {
    return `-${absText}%`;
  }
  return "0%";
}

function getConfidenceTone(
  confidence: number,
  cutoffs: ConfidenceBandCutoffs
): ConfidenceTone {
  const value = clampConfidence(confidence);
  if (value < cutoffs.low_max) {
    return "low";
  }
  if (value < cutoffs.mid_max) {
    return "med";
  }
  return "high";
}

function resolveMappingConfidence(field: ReviewField): number | null {
  const raw = field.field_mapping_confidence;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }
  return clampConfidence(raw);
}

function resolveConfidencePolicy(
  policy: StructuredInterpretationData["confidence_policy"] | undefined
):
  | {
      value: ConfidencePolicyConfig | null;
      degradedReason: ConfidencePolicyDiagnosticEvent["reason"] | null;
    }
  | null {
  if (!policy) {
    return { value: null, degradedReason: "missing_policy_version" };
  }
  const policyVersion = policy.policy_version?.trim();
  if (!policyVersion) {
    return { value: null, degradedReason: "missing_policy_version" };
  }
  const cutoffs = policy.band_cutoffs;
  if (!cutoffs) {
    return { value: null, degradedReason: "missing_band_cutoffs" };
  }
  const lowMax = cutoffs.low_max;
  const midMax = cutoffs.mid_max;
  if (
    !Number.isFinite(lowMax) ||
    !Number.isFinite(midMax) ||
    lowMax < 0 ||
    midMax > 1 ||
    lowMax >= midMax
  ) {
    return { value: null, degradedReason: "invalid_band_cutoffs" };
  }
  return {
    value: {
      policy_version: policyVersion,
      band_cutoffs: {
        low_max: lowMax,
        mid_max: midMax,
      },
    },
    degradedReason: null,
  };
}

function emitConfidencePolicyDiagnosticEvent(event: ConfidencePolicyDiagnosticEvent): void {
  if (typeof window !== "undefined") {
    const store = window.__confidencePolicyDiagnostics ?? [];
    store.push(event);
    window.__confidencePolicyDiagnostics = store;
  }
  console.warn("[confidence-policy]", event);
}

function isFieldValueEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function formatFieldValue(value: string | number | boolean | null, valueType: string): string {
  if (isFieldValueEmpty(value)) {
    return MISSING_VALUE_PLACEHOLDER;
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
  const [connectivityToast, setConnectivityToast] = useState<ConnectivityToast | null>(null);
  const [hasShownListErrorToast, setHasShownListErrorToast] = useState(false);
  const [isDragOverViewer, setIsDragOverViewer] = useState(false);
  const [isDragOverSidebarUpload, setIsDragOverSidebarUpload] = useState(false);
  const [showRefreshFeedback, setShowRefreshFeedback] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isCopyingRawText, setIsCopyingRawText] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<ReviewSelectableField | null>(null);
  const [editingFieldDraftValue, setEditingFieldDraftValue] = useState("");
  const [isAddFieldDialogOpen, setIsAddFieldDialogOpen] = useState(false);
  const [addFieldKeyDraft, setAddFieldKeyDraft] = useState("");
  const [addFieldValueDraft, setAddFieldValueDraft] = useState("");
  const [evidenceNotice, setEvidenceNotice] = useState<string | null>(null);
  const [expandedFieldValues, setExpandedFieldValues] = useState<Record<string, boolean>>({});
  const [reviewLoadingDocId, setReviewLoadingDocId] = useState<string | null>(null);
  const [reviewLoadingSinceMs, setReviewLoadingSinceMs] = useState<number | null>(null);
  const [isRetryingInterpretation, setIsRetryingInterpretation] = useState(false);
  const [fieldNavigationRequestId, setFieldNavigationRequestId] = useState(0);
  const [structuredSearchInput, setStructuredSearchInput] = useState("");
  const [structuredSearchTerm, setStructuredSearchTerm] = useState("");
  const [selectedConfidenceBuckets, setSelectedConfidenceBuckets] = useState<ConfidenceBucket[]>([]);
  const [showOnlyCritical, setShowOnlyCritical] = useState(false);
  const [showOnlyWithValue, setShowOnlyWithValue] = useState(false);
  const [showOnlyEmpty, setShowOnlyEmpty] = useState(false);
  const [hoveredFieldTriggerId, setHoveredFieldTriggerId] = useState<string | null>(null);
  const [hoveredCriticalTriggerId, setHoveredCriticalTriggerId] = useState<string | null>(null);
  const [reviewSplitRatio, setReviewSplitRatio] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_REVIEW_SPLIT_RATIO;
    }
    const stored = Number(window.localStorage.getItem(REVIEW_SPLIT_RATIO_STORAGE_KEY));
    if (!Number.isFinite(stored) || stored <= 0 || stored >= 1) {
      return DEFAULT_REVIEW_SPLIT_RATIO;
    }
    return stored;
  });
  const [isDraggingReviewSplit, setIsDraggingReviewSplit] = useState(false);
  const [reportLayout, setReportLayout] = useState<ReportLayout>(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") {
      return 2;
    }
    const queryValue = new URLSearchParams(window.location.search).get("reportLayout");
    if (queryValue === "1" || queryValue === "2") {
      return Number(queryValue) as ReportLayout;
    }
    const stored = window.localStorage.getItem(REPORT_LAYOUT_STORAGE_KEY);
    if (stored === "1" || stored === "2") {
      return Number(stored) as ReportLayout;
    }
    return 2;
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadPanelRef = useRef<HTMLDivElement | null>(null);
  const structuredSearchInputRef = useRef<HTMLInputElement | null>(null);
  const reviewSplitGridRef = useRef<HTMLDivElement | null>(null);
  const [reviewSplitGridElement, setReviewSplitGridElement] = useState<HTMLDivElement | null>(null);
  const reviewSplitDragStateRef = useRef<{
    startX: number;
    startSplitPx: number;
  } | null>(null);
  const reviewSplitRatioRef = useRef(reviewSplitRatio);
  const lastExtractionDebugDocIdRef = useRef<string | null>(null);
  const lastConfidencePolicyDocIdRef = useRef<string | null>(null);
  const loggedExtractionDebugEventKeysRef = useRef<Set<string>>(new Set());
  const loggedConfidencePolicyDiagnosticsRef = useRef<Set<string>>(new Set());
  const loggedConfidencePolicyDebugRef = useRef<Set<string>>(new Set());
  const viewerDragDepthRef = useRef(0);
  const sidebarUploadDragDepthRef = useRef(0);
  const suppressDocsSidebarHoverUntilRef = useRef(0);
  const pendingAutoOpenDocumentIdRef = useRef<string | null>(null);
  const autoOpenRetryCountRef = useRef<Record<string, number>>({});
  const autoOpenRetryTimerRef = useRef<number | null>(null);
  const refreshFeedbackTimerRef = useRef<number | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const latestLoadRequestIdRef = useRef<string | null>(null);
  const isPointerInsideDocsSidebarRef = useRef(false);
  // Desktop-only hover sidebar for Documents; touch/mobile is deferred to avoid accidental opens.
  const docsHoverSidebarMediaQuery = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";
  const [isDesktopForDocsSidebar, setIsDesktopForDocsSidebar] = useState(false);
  const [isDocsSidebarHovered, setIsDocsSidebarHovered] = useState(false);
  const [isDocsSidebarPinned, setIsDocsSidebarPinned] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(DOCS_SIDEBAR_PIN_STORAGE_KEY) === "1";
  });
  // Pin mode is desktop-only to avoid overcrowding tablet/mobile layouts.
  const sourcePinMediaQuery = "(min-width: 1280px)";
  const [isDesktopForPin, setIsDesktopForPin] = useState(false);
  const latestRawTextRefreshRef = useRef<string | null>(null);
  const listPollingStartedAtRef = useRef<number | null>(null);
  const interpretationRetryMinTimerRef = useRef<number | null>(null);
  const lastConnectivityToastAtRef = useRef(0);
  const queryClient = useQueryClient();
  const sourcePanel = useSourcePanelState({
    isDesktopForPin,
    onNotice: setEvidenceNotice,
  });
  const effectiveViewMode = "browse";
  const isReviewMode = false;
  const isBrowseMode = true;
  const shouldUseHoverDocsSidebar = isDesktopForDocsSidebar;
  const shouldAutoCollapseDocsSidebar =
    shouldUseHoverDocsSidebar && Boolean(activeId) && !isDocsSidebarPinned;
  const isDocsSidebarExpanded = !shouldAutoCollapseDocsSidebar || isDocsSidebarHovered;
  const getReviewSplitMeasuredWidth = useCallback(() => {
    const grid = reviewSplitGridRef.current;
    if (!grid) {
      return 0;
    }
    return Math.max(grid.getBoundingClientRect().width, grid.scrollWidth);
  }, []);
  const clampReviewSplitToContainer = useCallback(() => {
    const containerWidth = getReviewSplitMeasuredWidth();
    if (containerWidth <= 0) {
      return;
    }
    setReviewSplitRatio((current) => {
      const next = clampReviewSplitRatio(current, containerWidth);
      if (Math.abs(next - current) < REVIEW_SPLIT_RATIO_EPSILON) {
        return current;
      }
      return next;
    });
  }, [getReviewSplitMeasuredWidth]);

  const downloadUrl = useMemo(() => {
    if (!activeId) {
      return null;
    }
    return `${API_BASE_URL}/documents/${activeId}/download?download=true`;
  }, [activeId]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(REPORT_LAYOUT_STORAGE_KEY, String(reportLayout));
  }, [reportLayout]);

  useEffect(() => {
    reviewSplitRatioRef.current = reviewSplitRatio;
  }, [reviewSplitRatio]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(REVIEW_SPLIT_RATIO_STORAGE_KEY, String(reviewSplitRatio));
  }, [reviewSplitRatio]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(DOCS_SIDEBAR_PIN_STORAGE_KEY, isDocsSidebarPinned ? "1" : "0");
  }, [isDocsSidebarPinned]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStructuredSearchTerm(structuredSearchInput);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [structuredSearchInput]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") {
      return;
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!event.shiftKey || (event.key !== "L" && event.key !== "l")) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      setReportLayout((current) => (current === 1 ? 2 : 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
    if (typeof window.matchMedia !== "function") {
      setIsDesktopForDocsSidebar(false);
      return;
    }

    const mediaQuery = window.matchMedia(docsHoverSidebarMediaQuery);
    const syncDocsSidebarCapability = () => setIsDesktopForDocsSidebar(mediaQuery.matches);
    syncDocsSidebarCapability();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncDocsSidebarCapability);
      return () => mediaQuery.removeEventListener("change", syncDocsSidebarCapability);
    }

    mediaQuery.addListener(syncDocsSidebarCapability);
    return () => mediaQuery.removeListener(syncDocsSidebarCapability);
  }, [docsHoverSidebarMediaQuery]);

  useEffect(() => {
    if (!isDraggingReviewSplit) {
      return;
    }

    const onMouseMove = (event: globalThis.MouseEvent) => {
      const dragState = reviewSplitDragStateRef.current;
      if (!dragState) {
        return;
      }

      const containerWidth = Math.max(
        getReviewSplitMeasuredWidth(),
        0
      );
      if (containerWidth <= 0) {
        return;
      }
      const nextSplitPx = dragState.startSplitPx + (event.clientX - dragState.startX);
      const nextRatio = splitPxToReviewSplitRatio(nextSplitPx, containerWidth);
      setReviewSplitRatio(nextRatio);
    };

    const onMouseUp = () => {
      const containerWidth = Math.max(
        getReviewSplitMeasuredWidth(),
        0
      );
      if (containerWidth <= 0) {
        setIsDraggingReviewSplit(false);
        reviewSplitDragStateRef.current = null;
        return;
      }
      setIsDraggingReviewSplit(false);
      reviewSplitDragStateRef.current = null;
      setReviewSplitRatio((current) =>
        clampReviewSplitRatio(snapReviewSplitRatio(current), containerWidth)
      );
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [getReviewSplitMeasuredWidth, isDraggingReviewSplit]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const rafId = window.requestAnimationFrame(clampReviewSplitToContainer);
    const resizeObserver =
      reviewSplitGridElement && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(clampReviewSplitToContainer)
        : null;
    // Observe the current grid node; callback-ref updates this dependency when the node changes.
    if (resizeObserver && reviewSplitGridElement) {
      resizeObserver.observe(reviewSplitGridElement);
    }
    window.addEventListener("resize", clampReviewSplitToContainer);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", clampReviewSplitToContainer);
    };
  }, [clampReviewSplitToContainer, reviewSplitGridElement]);

  useEffect(() => {
    if (typeof window === "undefined" || !reviewSplitGridRef.current) {
      return;
    }
    // Sidebar width animates over 200ms; clamp immediately and again after layout settles.
    clampReviewSplitToContainer();
    let rafB: number | null = null;
    const rafA = window.requestAnimationFrame(() => {
      clampReviewSplitToContainer();
      rafB = window.requestAnimationFrame(clampReviewSplitToContainer);
    });
    const settleTimer = window.setTimeout(clampReviewSplitToContainer, 240);
    return () => {
      window.cancelAnimationFrame(rafA);
      if (rafB !== null) {
        window.cancelAnimationFrame(rafB);
      }
      window.clearTimeout(settleTimer);
    };
  }, [clampReviewSplitToContainer, isDocsSidebarExpanded, isDocsSidebarPinned, shouldAutoCollapseDocsSidebar]);

  const handleReviewSplitGridRef = useCallback((node: HTMLDivElement | null) => {
    reviewSplitGridRef.current = node;
    setReviewSplitGridElement(node);
  }, []);

  useEffect(() => {
    return () => {
      if (autoOpenRetryTimerRef.current) {
        window.clearTimeout(autoOpenRetryTimerRef.current);
      }
      if (refreshFeedbackTimerRef.current) {
        window.clearTimeout(refreshFeedbackTimerRef.current);
      }
      if (copyFeedbackTimerRef.current) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      if (interpretationRetryMinTimerRef.current) {
        window.clearTimeout(interpretationRetryMinTimerRef.current);
      }
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

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
    suppressDocsSidebarHoverUntilRef.current = Date.now() + 400;
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
    openUploadFilePicker();
  };

  const handleSidebarFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setUploadFeedback(null);
      return;
    }
    const queued = queueUpload(file);
    if (!queued) {
      event.currentTarget.value = "";
    }
  };

  const handleDocsSidebarMouseEnter = (event: ReactMouseEvent<HTMLElement>) => {
    isPointerInsideDocsSidebarRef.current = true;
    if (Date.now() < suppressDocsSidebarHoverUntilRef.current) {
      return;
    }
    if (sidebarUploadDragDepthRef.current > 0 || isDragOverSidebarUpload) {
      return;
    }
    if (shouldAutoCollapseDocsSidebar && event.buttons === 0) {
      setIsDocsSidebarHovered(true);
    }
  };

  const handleDocsSidebarMouseLeave = () => {
    isPointerInsideDocsSidebarRef.current = false;
    if (shouldAutoCollapseDocsSidebar) {
      setIsDocsSidebarHovered(false);
    }
  };

  const handleToggleDocsSidebarPin = () => {
    setIsDocsSidebarPinned((current) => {
      const next = !current;
      if (next) {
        setIsDocsSidebarHovered(true);
      } else {
        setIsDocsSidebarHovered(isPointerInsideDocsSidebarRef.current);
      }
      return next;
    });
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
      setIsRetryingInterpretation(false);
      if (interpretationRetryMinTimerRef.current) {
        window.clearTimeout(interpretationRetryMinTimerRef.current);
        interpretationRetryMinTimerRef.current = null;
      }
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
    setFieldNavigationRequestId(0);
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
      setIsDocsSidebarHovered(false);
    }
  }, [documentList.status, sortedDocuments.length]);

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

  const reviewToggleMutation = useMutation({
    mutationFn: async (variables: { docId: string; target: "reviewed" | "in_review" }) => {
      if (variables.target === "reviewed") {
        return markDocumentReviewed(variables.docId);
      }
      return reopenDocumentReview(variables.docId);
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData<DocumentListResponse | undefined>(["documents", "list"], (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          items: current.items.map((item) =>
            item.document_id === variables.docId
              ? {
                  ...item,
                  review_status: result.review_status,
                  reviewed_at: result.reviewed_at,
                  reviewed_by: result.reviewed_by,
                }
              : item
          ),
        };
      });
      queryClient.setQueryData<DocumentDetailResponse | undefined>(
        ["documents", "detail", variables.docId],
        (current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            review_status: result.review_status,
            reviewed_at: result.reviewed_at,
            reviewed_by: result.reviewed_by,
          };
        }
      );
      queryClient.setQueryData<DocumentReviewResponse | undefined>(
        ["documents", "review", variables.docId],
        (current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            review_status: result.review_status,
            reviewed_at: result.reviewed_at,
            reviewed_by: result.reviewed_by,
          };
        }
      );

      setActionFeedback({
        kind: "success",
        message:
          result.review_status === "REVIEWED"
            ? "Documento marcado como revisado."
            : "Documento reabierto para revisión.",
      });
      queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
      queryClient.invalidateQueries({ queryKey: ["documents", "detail", variables.docId] });
      queryClient.invalidateQueries({ queryKey: ["documents", "review", variables.docId] });
    },
    onError: (error) => {
      setActionFeedback({
        kind: "error",
        message: getUserErrorMessage(error, "No se pudo actualizar el estado de revisión."),
        technicalDetails: getTechnicalDetails(error),
      });
    },
  });

  const interpretationEditMutation = useMutation({
    mutationFn: async (variables: {
      docId: string;
      runId: string;
      baseVersionNumber: number;
      changes: InterpretationChangePayload[];
      successMessage: string;
    }) =>
      editRunInterpretation(variables.runId, {
        base_version_number: variables.baseVersionNumber,
        changes: variables.changes,
      }),
    onSuccess: (result, variables) => {
      queryClient.setQueryData<DocumentReviewResponse | undefined>(
        ["documents", "review", variables.docId],
        (current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            active_interpretation: {
              interpretation_id: result.interpretation_id,
              version_number: result.version_number,
              data: result.data,
            },
          };
        }
      );
      setActionFeedback({
        kind: "success",
        message: variables.successMessage,
      });
      queryClient.invalidateQueries({ queryKey: ["documents", "review", variables.docId] });
    },
    onError: (error) => {
      setActionFeedback({
        kind: "error",
        message: getUserErrorMessage(error, "No se pudo guardar la edición."),
        technicalDetails: getTechnicalDetails(error),
      });
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
    "h-[clamp(720px,88vh,980px)]";

  const toggleStepDetails = (key: string) => {
    setExpandedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const latestState = documentDetails.data?.latest_run?.state;
  const latestRunId = documentDetails.data?.latest_run?.run_id;
  const activeListDocument = useMemo(
    () => (activeId ? (documentList.data?.items ?? []).find((item) => item.document_id === activeId) : null),
    [activeId, documentList.data?.items]
  );
  const activeReviewStatus =
    documentDetails.data?.review_status ?? activeListDocument?.review_status ?? "IN_REVIEW";
  const isDocumentReviewed = activeReviewStatus === "REVIEWED";
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
    if (!connectivityToast) {
      return;
    }
    const timer = window.setTimeout(() => setConnectivityToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [connectivityToast]);

  const showConnectivityToast = () => {
    const now = Date.now();
    if (now - lastConnectivityToastAtRef.current < 5000) {
      return;
    }
    lastConnectivityToastAtRef.current = now;
    setConnectivityToast({});
  };

  useEffect(() => {
    if (documentList.isError) {
      if (isConnectivityOrServerError(documentList.error)) {
        showConnectivityToast();
        return;
      }
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

  useEffect(() => {
    if (!activeId || !documentReview.isError || !isConnectivityOrServerError(documentReview.error)) {
      return;
    }
    showConnectivityToast();
  }, [
    activeId,
    documentReview.isError,
    documentReview.error,
    documentReview.errorUpdatedAt,
    documentReview.refetch,
  ]);

  useEffect(() => {
    if (!loadPdf.isError || !isConnectivityOrServerError(loadPdf.error)) {
      return;
    }
    showConnectivityToast();
  }, [loadPdf.error, loadPdf.failureCount, loadPdf.isError]);

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
  const documentConfidencePolicy = useMemo(
    () => resolveConfidencePolicy(documentReview.data?.active_interpretation.data.confidence_policy),
    [documentReview.data?.active_interpretation.data.confidence_policy]
  );
  const activeConfidencePolicy = documentConfidencePolicy?.value ?? null;
  const confidencePolicyDegradedReason = documentConfidencePolicy?.degradedReason ?? null;

  const validationResult = useMemo(() => {
    const fieldsByKey = new Map<string, number>();
    const acceptedFields: ReviewField[] = [];
    const debugEvents: ExtractionDebugEvent[] = [];
    const documentId = documentReview.data?.active_interpretation.data.document_id;

    extractedReviewFields.forEach((field) => {
      fieldsByKey.set(field.key, (fieldsByKey.get(field.key) ?? 0) + 1);
    });

    extractedReviewFields.forEach((field) => {
      const rawValue = field.value === null || field.value === undefined ? "" : String(field.value);
      const validation = validateFieldValue(field.key, rawValue);

      if (!validation.ok) {
        debugEvents.push({
          field: field.key,
          status: "rejected",
          raw: rawValue,
          reason: validation.reason,
          docId: documentId,
          page: field.evidence?.page,
        });
        return;
      }

      const normalizedValue = validation.normalized ?? rawValue.trim();
      acceptedFields.push({
        ...field,
        value: normalizedValue,
      });

      debugEvents.push({
        field: field.key,
        status: "accepted",
        raw: rawValue,
        normalized: normalizedValue,
        docId: documentId,
        page: field.evidence?.page,
      });
    });

    GLOBAL_SCHEMA_V0.forEach((definition) => {
      if ((fieldsByKey.get(definition.key) ?? 0) > 0) {
        return;
      }

      debugEvents.push({
        field: definition.key,
        status: "missing",
        docId: documentId,
      });
    });

    return {
      acceptedFields,
      debugEvents,
    };
  }, [documentReview.data?.active_interpretation.data.document_id, extractedReviewFields]);

  useEffect(() => {
    const documentId = documentReview.data?.active_interpretation.data.document_id ?? null;
    if (lastExtractionDebugDocIdRef.current !== documentId) {
      loggedExtractionDebugEventKeysRef.current.clear();
      lastExtractionDebugDocIdRef.current = documentId;
    }

    validationResult.debugEvents.forEach((event) => {
      const eventKey = [
        event.docId ?? "",
        event.field,
        event.status,
        event.raw ?? "",
        event.normalized ?? "",
        event.reason ?? "",
        event.page ?? "",
      ].join("|");
      if (loggedExtractionDebugEventKeysRef.current.has(eventKey)) {
        return;
      }
      loggedExtractionDebugEventKeysRef.current.add(eventKey);
      logExtractionDebugEvent(event);
    });
  }, [documentReview.data?.active_interpretation.data.document_id, validationResult.debugEvents]);

  useEffect(() => {
    const documentId = documentReview.data?.active_interpretation.data.document_id ?? null;
    if (documentId === null) {
      return;
    }
    if (lastConfidencePolicyDocIdRef.current !== documentId) {
      loggedConfidencePolicyDiagnosticsRef.current.clear();
      lastConfidencePolicyDocIdRef.current = documentId;
    }
    if (!confidencePolicyDegradedReason) {
      return;
    }
    const eventKey = `${documentId ?? ""}|${confidencePolicyDegradedReason}`;
    if (loggedConfidencePolicyDiagnosticsRef.current.has(eventKey)) {
      return;
    }
    loggedConfidencePolicyDiagnosticsRef.current.add(eventKey);
    emitConfidencePolicyDiagnosticEvent({
      event_type: "CONFIDENCE_POLICY_CONFIG_MISSING",
      document_id: documentId,
      reason: confidencePolicyDegradedReason,
    });
  }, [
    confidencePolicyDegradedReason,
    documentReview.data?.active_interpretation.data.document_id,
  ]);

  useEffect(() => {
    if (!DEBUG_CONFIDENCE_POLICY) {
      return;
    }

    const interpretationData = documentReview.data?.active_interpretation.data;
    const documentId = interpretationData?.document_id ?? null;
    if (!documentId) {
      return;
    }

    const eventKey = `${documentId}|${confidencePolicyDegradedReason ?? "valid"}`;
    if (loggedConfidencePolicyDebugRef.current.has(eventKey)) {
      return;
    }
    loggedConfidencePolicyDebugRef.current.add(eventKey);

    const rawPolicy = interpretationData?.confidence_policy;
    const sampleField =
      interpretationData?.fields.find((field) => field.key === "pet_name") ??
      interpretationData?.fields[0];
    console.info("[confidence-policy][debug]", {
      document_id: documentId,
      has_confidence_policy: Boolean(rawPolicy),
      degraded_reason: confidencePolicyDegradedReason,
      policy_version: rawPolicy?.policy_version ?? null,
      has_band_cutoffs: Boolean(rawPolicy?.band_cutoffs),
      sample_field_mapping_confidence: sampleField
        ? {
            field_key: sampleField.key,
            has_field_mapping_confidence: typeof sampleField.field_mapping_confidence === "number",
          }
        : null,
    });
  }, [
    confidencePolicyDegradedReason,
    documentReview.data?.active_interpretation.data,
  ]);

  const validatedReviewFields = validationResult.acceptedFields;

  const buildSelectableField = (
    base: Omit<
      ReviewSelectableField,
      "hasMappingConfidence" | "confidence" | "confidenceBand" | "isMissing" | "rawField"
    >,
    rawField: ReviewField | undefined,
    isMissing: boolean
  ): ReviewSelectableField => {
    const mappingConfidence = rawField ? resolveMappingConfidence(rawField) : null;
    let confidenceBand: ConfidenceBucket | null = null;
    if (mappingConfidence !== null && activeConfidencePolicy) {
      const tone = getConfidenceTone(mappingConfidence, activeConfidencePolicy.band_cutoffs);
      confidenceBand = tone === "med" ? "medium" : tone;
    }
    return {
      ...base,
      isMissing,
      hasMappingConfidence: mappingConfidence !== null,
      confidence: mappingConfidence ?? 0,
      confidenceBand,
      rawField,
    };
  };

  const matchesByKey = useMemo(() => {
    const matches = new Map<string, ReviewField[]>();
    validatedReviewFields.forEach((field) => {
      const group = matches.get(field.key) ?? [];
      group.push(field);
      matches.set(field.key, group);
    });
    return matches;
  }, [validatedReviewFields]);

  const coreDisplayFields = useMemo(() => {
    return GLOBAL_SCHEMA_V0.filter((definition) => !HIDDEN_REVIEW_FIELDS.has(definition.key)).map(
      (definition): ReviewDisplayField => {
      const uiSection = SECTION_LABELS[definition.section] ?? definition.section;
      const uiLabel = FIELD_LABELS[definition.key] ?? definition.label;
      let candidates = matchesByKey.get(definition.key) ?? [];

      if (definition.repeatable) {
        const items = candidates
          .filter((candidate) => !isFieldValueEmpty(candidate.value))
          .map((candidate, index): ReviewSelectableField =>
            buildSelectableField(
              {
                id: `core:${definition.key}:${candidate.field_id}:${index}`,
                key: definition.key,
                label: uiLabel,
                section: uiSection,
                order: definition.order,
                valueType: candidate.value_type,
                displayValue: formatFieldValue(candidate.value, candidate.value_type),
                source: "core",
                evidence: candidate.evidence,
                repeatable: true,
              },
              candidate,
              false
            )
          );

        return {
          id: `core:${definition.key}`,
          key: definition.key,
          label: uiLabel,
          section: uiSection,
          order: definition.order,
          isCritical: definition.critical,
          valueType: definition.value_type,
          repeatable: true,
          items,
          isEmptyList: items.length === 0,
          source: "core",
        };
      }

      const bestCandidate = candidates
        .filter((candidate) => !isFieldValueEmpty(candidate.value))
        .sort(
          (a, b) =>
            clampConfidence(resolveMappingConfidence(b) ?? -1) -
            clampConfidence(resolveMappingConfidence(a) ?? -1)
        )[0];
      const displayValue = bestCandidate
        ? formatFieldValue(bestCandidate.value, bestCandidate.value_type)
        : MISSING_VALUE_PLACEHOLDER;
      const item: ReviewSelectableField = buildSelectableField(
        {
          id: `core:${definition.key}`,
          key: definition.key,
          label: uiLabel,
          section: uiSection,
          order: definition.order,
          valueType: bestCandidate?.value_type ?? definition.value_type,
          displayValue,
          source: "core",
          evidence: bestCandidate?.evidence,
          repeatable: false,
        },
        bestCandidate,
        !bestCandidate
      );
      return {
        id: `core:${definition.key}`,
        key: definition.key,
        label: uiLabel,
        section: uiSection,
        order: definition.order,
        isCritical: definition.critical,
        valueType: definition.value_type,
        repeatable: false,
        items: [item],
        isEmptyList: false,
        source: "core",
      };
    }).sort((a, b) => a.order - b.order);
  }, [matchesByKey]);

  const otherDisplayFields = useMemo(() => {
    const coreKeys = new Set(GLOBAL_SCHEMA_V0.map((field) => field.key));
    const grouped = new Map<string, ReviewField[]>();
    const orderedKeys: string[] = [];

    validatedReviewFields.forEach((field) => {
      if (coreKeys.has(field.key)) {
        return;
      }
      if (shouldHideExtractedField(field.key)) {
        return;
      }
      if (!grouped.has(field.key)) {
        grouped.set(field.key, []);
        orderedKeys.push(field.key);
      }
      grouped.get(field.key)?.push(field);
    });

    return orderedKeys.map((key, index): ReviewDisplayField => {
      const fields = grouped.get(key) ?? [];
      const label = formatReviewKeyLabel(key);
      if (fields.length > 1) {
        const items = fields
          .filter((field) => !isFieldValueEmpty(field.value))
          .map((field, itemIndex): ReviewSelectableField =>
            buildSelectableField(
              {
                id: `extra:${field.field_id}:${itemIndex}`,
                key,
                label,
                section: OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
                order: index + 1,
                valueType: field.value_type,
                displayValue: formatFieldValue(field.value, field.value_type),
                source: "extracted",
                evidence: field.evidence,
                repeatable: true,
              },
              field,
              false
            )
          );
        return {
          id: `extra:${key}`,
          key,
          label,
          section: OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
          order: index + 1,
          isCritical: false,
          valueType: fields[0]?.value_type ?? "string",
          repeatable: true,
          items,
          isEmptyList: items.length === 0,
          source: "extracted",
        };
      }

      const field = fields[0];
      const hasValue = Boolean(field && !isFieldValueEmpty(field.value));
      const displayValue = hasValue
        ? formatFieldValue(field.value, field.value_type)
        : MISSING_VALUE_PLACEHOLDER;
      const item: ReviewSelectableField = buildSelectableField(
        {
          id: field ? `extra:${field.field_id}:0` : `extra:${key}:missing`,
          key,
          label,
          section: OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
          order: index + 1,
          valueType: field?.value_type ?? "string",
          displayValue,
          source: "extracted",
          evidence: field?.evidence,
          repeatable: false,
        },
        field,
        !hasValue
      );
      return {
        id: `extra:${key}`,
        key,
        label,
        section: OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
        order: index + 1,
        isCritical: false,
        valueType: field?.value_type ?? "string",
        repeatable: false,
        items: [item],
        isEmptyList: false,
        source: "extracted",
      };
    });
  }, [activeConfidencePolicy, validatedReviewFields]);

  const groupedCoreFields = useMemo(() => {
    const groups = new Map<string, ReviewDisplayField[]>();
    coreDisplayFields.forEach((field) => {
      const current = groups.get(field.section) ?? [];
      current.push(field);
      groups.set(field.section, current);
    });
    const orderedSections = [
      ...new Set(GLOBAL_SCHEMA_SECTION_ORDER.map((section) => SECTION_LABELS[section] ?? section)),
    ];
    return orderedSections.map((section) => ({
      section,
      fields: (groups.get(section) ?? []).sort((a, b) => a.order - b.order),
    }));
  }, [coreDisplayFields]);

  const structuredDataFilters = useMemo(
    () => ({
      searchTerm: structuredSearchTerm,
      selectedConfidence: selectedConfidenceBuckets,
      onlyCritical: showOnlyCritical,
      onlyWithValue: showOnlyWithValue,
      onlyEmpty: showOnlyEmpty,
    }),
    [
      selectedConfidenceBuckets,
      showOnlyCritical,
      showOnlyWithValue,
      showOnlyEmpty,
      structuredSearchTerm,
    ]
  );

  useEffect(() => {
    if (activeConfidencePolicy || selectedConfidenceBuckets.length === 0) {
      return;
    }
    setSelectedConfidenceBuckets([]);
  }, [activeConfidencePolicy, selectedConfidenceBuckets]);

  const hasValueRestriction = showOnlyWithValue !== showOnlyEmpty;

  const hasActiveStructuredFilters =
    structuredSearchTerm.trim().length > 0 ||
    selectedConfidenceBuckets.length > 0 ||
    showOnlyCritical ||
    hasValueRestriction;

  const visibleCoreGroups = useMemo(() => {
    if (!hasActiveStructuredFilters) {
      return groupedCoreFields;
    }
    return groupedCoreFields
      .map((group) => ({
        section: group.section,
        fields: group.fields.filter((field) => matchesStructuredDataFilters(field, structuredDataFilters)),
      }))
      .filter((group) => group.fields.length > 0);
  }, [groupedCoreFields, hasActiveStructuredFilters, structuredDataFilters]);

  const visibleOtherDisplayFields = hasActiveStructuredFilters ? [] : otherDisplayFields;

  const visibleCoreFields = useMemo(
    () => visibleCoreGroups.flatMap((group) => group.fields),
    [visibleCoreGroups]
  );

  const reportSections = useMemo(
    () => [
      ...visibleCoreGroups.map((group) => ({
        id: `core:${group.section}`,
        title: group.section,
        fields: group.fields,
      })),
      ...(!hasActiveStructuredFilters
        ? [
            {
              id: "extra:section",
              title: OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
              fields: visibleOtherDisplayFields,
            },
          ]
        : []),
    ],
    [hasActiveStructuredFilters, visibleCoreGroups, visibleOtherDisplayFields]
  );

  const selectableReviewItems = useMemo(
    () => [...visibleCoreFields, ...visibleOtherDisplayFields].flatMap((field) => field.items),
    [visibleCoreFields, visibleOtherDisplayFields]
  );

  const selectedReviewField = useMemo(() => {
    if (!selectedFieldId) {
      return null;
    }
    return (
      selectableReviewItems.find((field) => field.id === selectedFieldId) ??
      null
    );
  }, [selectableReviewItems, selectedFieldId]);

  const reviewPanelState: ReviewPanelState = (() => {
    if (!activeId) {
      return "idle";
    }
    const hasStructuredPayload =
      Boolean(documentReview.data?.active_interpretation?.data) &&
      documentReview.data?.document_id === activeId;

    if (reviewLoadingDocId === activeId) {
      return "loading";
    }
    if (isActiveDocumentProcessing && !hasStructuredPayload) {
      return "loading";
    }
    if (!hasStructuredPayload && !documentReview.isError && documentReview.isFetching) {
      return "loading";
    }
    if (!isRetryingInterpretation && documentReview.isFetching && !documentReview.isError) {
      return "loading";
    }
    if (documentReview.isError) {
      if (
        documentReview.error instanceof ApiResponseError &&
        (documentReview.error.reason === "NO_COMPLETED_RUN" ||
          documentReview.error.reason === "INTERPRETATION_MISSING")
      ) {
        if (isActiveDocumentProcessing) {
          return "loading";
        }
        return "no_completed_run";
      }
      return "error";
    }
    if (!hasStructuredPayload) {
      return "error";
    }
    return "ready";
  })();

  const reviewPanelMessage = (() => {
    if (reviewPanelState === "idle") {
      return "Selecciona un documento para empezar la revision.";
    }
    if (reviewPanelState === "loading") {
      return "Cargando interpretacion estructurada...";
    }
    if (reviewPanelState === "no_completed_run") {
      return "Interpretacion no disponible";
    }
    if (reviewPanelState === "error") {
      return "Interpretacion no disponible";
    }
    return null;
  })();

  const shouldShowReviewEmptyState =
    reviewPanelState !== "loading" && reviewPanelState !== "ready" && Boolean(reviewPanelMessage);
  const hasNoStructuredFilterResults =
    reviewPanelState === "ready" && hasActiveStructuredFilters && visibleCoreGroups.length === 0;
  const detectedFieldsSummary = useMemo(() => {
    let detected = 0;
    let low = 0;
    let medium = 0;
    let high = 0;

    if (!activeConfidencePolicy) {
      return {
        detected,
        total: GLOBAL_SCHEMA_V0.length,
        low,
        medium,
        high,
      };
    }

    coreDisplayFields.forEach((field) => {
      const presentItems = field.items.filter(
        (item) => !item.isMissing && item.confidenceBand !== null
      );
      if (presentItems.length === 0) {
        return;
      }
      detected += 1;
      if (presentItems.some((item) => item.confidenceBand === "low")) {
        low += 1;
        return;
      }
      if (presentItems.some((item) => item.confidenceBand === "medium")) {
        medium += 1;
        return;
      }
      high += 1;
    });

    return {
      detected,
      total: GLOBAL_SCHEMA_V0.length,
      low,
      medium,
      high,
    };
  }, [activeConfidencePolicy, coreDisplayFields]);
  const shouldShowLoadPdfErrorBanner =
    loadPdf.isError && !isConnectivityOrServerError(loadPdf.error);
  const isPinnedSourcePanelVisible =
    isBrowseMode && sourcePanel.isSourceOpen && sourcePanel.isSourcePinned && isDesktopForPin;
  const reviewSplitLayoutStyle = useMemo<CSSProperties>(
    () => ({
      minWidth: `${REVIEW_SPLIT_MIN_WIDTH_PX}px`,
      gridTemplateColumns: `minmax(${MIN_PDF_PANEL_WIDTH_PX}px, ${reviewSplitRatio}fr) ${SPLITTER_COLUMN_WIDTH_PX}px minmax(${MIN_STRUCTURED_PANEL_WIDTH_PX}px, ${1 - reviewSplitRatio}fr)`,
    }),
    [reviewSplitRatio]
  );

  const isDocumentListConnectivityError =
    documentList.isError && isConnectivityOrServerError(documentList.error);

  const handleSelectReviewItem = (field: ReviewSelectableField) => {
    setSelectedFieldId(field.id);
    setFieldNavigationRequestId((current) => current + 1);
  };

  const handleReviewedEditAttempt = (event: ReactMouseEvent<HTMLElement>) => {
    if (!isDocumentReviewed || event.button !== 0) {
      return;
    }
    const selectedText = window.getSelection?.()?.toString().trim() ?? "";
    if (selectedText.length > 0) {
      return;
    }
    setActionFeedback({
      kind: "error",
      message: "Documento revisado: edición bloqueada.",
    });
  };

  const handleReviewedKeyboardEditAttempt = (
    event: ReactKeyboardEvent<HTMLElement>
  ) => {
    if (!isDocumentReviewed) {
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    setActionFeedback({
      kind: "error",
      message: "Documento revisado: edición bloqueada.",
    });
  };

  const resetReviewSplitRatio = () => {
    const containerWidth = Math.max(
      getReviewSplitMeasuredWidth(),
      0
    );
    if (containerWidth <= 0) {
      return;
    }
    setReviewSplitRatio(clampReviewSplitRatio(DEFAULT_REVIEW_SPLIT_RATIO, containerWidth));
  };

  const startReviewSplitDragging = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const containerWidth = Math.max(
      getReviewSplitMeasuredWidth(),
      0
    );
    if (containerWidth <= 0) {
      return;
    }
    reviewSplitDragStateRef.current = {
      startX: event.clientX,
      startSplitPx: reviewSplitRatioToPx(reviewSplitRatioRef.current, containerWidth),
    };
    setIsDraggingReviewSplit(true);
    event.preventDefault();
  };

  const handleReviewSplitKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const containerWidth = Math.max(
      getReviewSplitMeasuredWidth(),
      0
    );
    if (containerWidth <= 0) {
      return;
    }
    const stepPx = 40;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setReviewSplitRatio((current) =>
        splitPxToReviewSplitRatio(reviewSplitRatioToPx(current, containerWidth) - stepPx, containerWidth)
      );
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setReviewSplitRatio((current) =>
        splitPxToReviewSplitRatio(reviewSplitRatioToPx(current, containerWidth) + stepPx, containerWidth)
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      resetReviewSplitRatio();
    }
  };

  useEffect(() => {
    if (!selectedFieldId) {
      return;
    }
    const currentIds = new Set(selectableReviewItems.map((field) => field.id));
    if (!currentIds.has(selectedFieldId)) {
      setSelectedFieldId(null);
    }
  }, [selectableReviewItems, selectedFieldId]);

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

  const viewerModeToolbarIcons = (
    <>
      <IconButton
        label="Documento"
        tooltip="Documento"
        pressed={activeViewerTab === "document"}
        className={activeViewerTab === "document" ? "border-accent bg-accentSoft/35 text-accent ring-2 ring-accent/25" : undefined}
        aria-current={activeViewerTab === "document" ? "page" : undefined}
        onClick={() => setActiveViewerTab("document")}
      >
        <FileText size={16} aria-hidden="true" />
      </IconButton>
      <IconButton
        label="Texto extraido"
        tooltip="Texto extraído"
        pressed={activeViewerTab === "raw_text"}
        className={activeViewerTab === "raw_text" ? "border-accent bg-accentSoft/35 text-accent ring-2 ring-accent/25" : undefined}
        aria-current={activeViewerTab === "raw_text" ? "page" : undefined}
        onClick={() => setActiveViewerTab("raw_text")}
      >
        <AlignLeft size={16} aria-hidden="true" />
      </IconButton>
      <IconButton
        label="Detalles tecnicos"
        tooltip="Detalles técnicos"
        pressed={activeViewerTab === "technical"}
        className={activeViewerTab === "technical" ? "border-accent bg-accentSoft/35 text-accent ring-2 ring-accent/25" : undefined}
        aria-current={activeViewerTab === "technical" ? "page" : undefined}
        onClick={() => setActiveViewerTab("technical")}
      >
        <Info size={16} aria-hidden="true" />
      </IconButton>
    </>
  );

  const viewerDownloadIcon = downloadUrl ? (
    <IconButton
      label="Descargar"
      tooltip="Descargar"
      onClick={() => window.open(downloadUrl, "_blank", "noopener,noreferrer")}
    >
      <Download size={16} aria-hidden="true" />
    </IconButton>
  ) : null;

  const submitInterpretationChanges = (
    changes: InterpretationChangePayload[],
    successMessage: string
  ) => {
    const reviewPayload = documentReview.data;
    if (!activeId || !reviewPayload) {
      return;
    }
    interpretationEditMutation.mutate({
      docId: activeId,
      runId: reviewPayload.latest_completed_run.run_id,
      baseVersionNumber: reviewPayload.active_interpretation.version_number,
      changes,
      successMessage,
    });
  };

  const handleAddField = () => {
    setAddFieldKeyDraft("");
    setAddFieldValueDraft("");
    setIsAddFieldDialogOpen(true);
  };

  const closeAddFieldDialog = () => {
    setIsAddFieldDialogOpen(false);
    setAddFieldKeyDraft("");
    setAddFieldValueDraft("");
  };

  const saveAddFieldDialog = () => {
    const key = addFieldKeyDraft.trim();
    if (!key) {
      setActionFeedback({
        kind: "error",
        message: "La clave del campo no puede estar vacía.",
      });
      return;
    }
    const value = addFieldValueDraft.trim();
    submitInterpretationChanges(
      [
        {
          op: "ADD",
          key,
          value: value.length > 0 ? value : null,
          value_type: "string",
        },
      ],
      "Campo añadido."
    );
    closeAddFieldDialog();
  };

  const openFieldEditDialog = (item: ReviewSelectableField) => {
    const rawCurrentValue = item.rawField?.value;
    const currentValue =
      rawCurrentValue === null || rawCurrentValue === undefined
        ? ""
        : String(rawCurrentValue);
    setEditingField(item);
    setEditingFieldDraftValue(currentValue);
  };

  const closeFieldEditDialog = () => {
    setEditingField(null);
    setEditingFieldDraftValue("");
  };

  const isEditingMicrochipField = editingField?.key === "microchip_id";
  const isEditingMicrochipInvalid = useMemo(() => {
    if (!isEditingMicrochipField) {
      return false;
    }
    const validation = validateFieldValue("microchip_id", editingFieldDraftValue);
    return !validation.ok;
  }, [isEditingMicrochipField, editingFieldDraftValue]);
  const isEditingWeightField = editingField?.key === "weight";
  const isEditingWeightInvalid = useMemo(() => {
    if (!isEditingWeightField) {
      return false;
    }
    const validation = validateFieldValue("weight", editingFieldDraftValue);
    return !validation.ok;
  }, [isEditingWeightField, editingFieldDraftValue]);
  const isEditingDateField = useMemo(() => {
    const fieldKey = editingField?.key;
    if (!fieldKey) {
      return false;
    }
    return (
      fieldKey === "document_date" ||
      fieldKey === "visit_date" ||
      fieldKey === "admission_date" ||
      fieldKey === "discharge_date" ||
      fieldKey === "dob" ||
      fieldKey.startsWith("fecha_")
    );
  }, [editingField?.key]);
  const isEditingDateInvalid = useMemo(() => {
    if (!isEditingDateField || !editingField?.key) {
      return false;
    }
    const validation = validateFieldValue(editingField.key, editingFieldDraftValue);
    return !validation.ok;
  }, [isEditingDateField, editingField?.key, editingFieldDraftValue]);
  const isEditingSexField = editingField?.key === "sex";
  const canonicalSexOptions = useMemo(
    () => new Set(getControlledVocabOptionValues("sex").map((value) => value.toLowerCase())),
    []
  );
  const isEditingSexInvalid = useMemo(() => {
    if (!isEditingSexField) {
      return false;
    }
    const trimmedValue = editingFieldDraftValue.trim().toLowerCase();
    if (!trimmedValue) {
      return true;
    }
    return !canonicalSexOptions.has(trimmedValue);
  }, [canonicalSexOptions, isEditingSexField, editingFieldDraftValue]);
  const isEditingSpeciesField = editingField?.key === "species";
  const canonicalSpeciesOptions = useMemo(
    () => new Set(getControlledVocabOptionValues("species").map((value) => value.toLowerCase())),
    []
  );
  const isEditingSpeciesInvalid = useMemo(() => {
    if (!isEditingSpeciesField) {
      return false;
    }
    const trimmedValue = editingFieldDraftValue.trim().toLowerCase();
    if (!trimmedValue) {
      return true;
    }
    return !canonicalSpeciesOptions.has(trimmedValue);
  }, [canonicalSpeciesOptions, isEditingSpeciesField, editingFieldDraftValue]);
  const editingFieldCandidateSections = useMemo(() => {
    if (!editingField?.key) {
      return {
        applicableSuggestions: [],
        detectedCandidates: [],
      };
    }
    return resolveCandidateSuggestionSections(
      editingField.key,
      editingField.rawField?.candidate_suggestions
    );
  }, [editingField?.key, editingField?.rawField?.candidate_suggestions]);

  const saveFieldEditDialog = () => {
    if (!editingField) {
      return;
    }
    if (editingField.key === "microchip_id") {
      const validation = validateFieldValue("microchip_id", editingFieldDraftValue);
      if (!validation.ok) {
        return;
      }
    }
    if (editingField.key === "weight") {
      const validation = validateFieldValue("weight", editingFieldDraftValue);
      if (!validation.ok) {
        return;
      }
    }
    if (
      editingField.key === "document_date" ||
      editingField.key === "visit_date" ||
      editingField.key === "admission_date" ||
      editingField.key === "discharge_date" ||
      editingField.key === "dob" ||
      editingField.key.startsWith("fecha_")
    ) {
      const validation = validateFieldValue(editingField.key, editingFieldDraftValue);
      if (!validation.ok) {
        return;
      }
    }
    if (editingField.key === "sex") {
      if (editingFieldDraftValue.trim().length === 0) {
        return;
      }
      const validation = validateFieldValue("sex", editingFieldDraftValue);
      if (!validation.ok) {
        return;
      }
    }
    if (editingField.key === "species") {
      const validation = validateFieldValue("species", editingFieldDraftValue);
      if (!validation.ok) {
        return;
      }
    }
    const nextValue = editingFieldDraftValue.trim();
    const nextPayloadValue = nextValue.length > 0 ? nextValue : null;
    const previousRawValue = editingField.rawField?.value;
    const previousValue =
      previousRawValue === null || previousRawValue === undefined
        ? null
        : String(previousRawValue).trim();
    const previousPayloadValue = previousValue && previousValue.length > 0 ? previousValue : null;
    const valueType = editingField.rawField?.value_type ?? editingField.valueType ?? "string";

    if (editingField.rawField && previousPayloadValue === nextPayloadValue) {
      setActionFeedback({
        kind: "info",
        message: "No se han realizado cambios.",
      });
      closeFieldEditDialog();
      return;
    }

    if (!editingField.rawField && nextPayloadValue === null) {
      setActionFeedback({
        kind: "info",
        message: "No se han realizado cambios.",
      });
      closeFieldEditDialog();
      return;
    }

    if (editingField.rawField) {
      submitInterpretationChanges(
        [
          {
            op: "UPDATE",
            field_id: editingField.rawField.field_id,
            value: nextPayloadValue,
            value_type: valueType,
          },
        ],
        "Valor actualizado correctamente."
      );
      closeFieldEditDialog();
      return;
    }

    submitInterpretationChanges(
      [
        {
          op: "ADD",
          key: editingField.key,
          value: nextPayloadValue,
          value_type: valueType,
        },
      ],
      "Valor actualizado correctamente."
    );
    closeFieldEditDialog();
  };

  const buildFieldTooltip = (
    item: ReviewSelectableField
  ): { content: ReactNode; ariaLabel: string } => {
    if (!activeConfidencePolicy) {
      return {
        content: "Configuración de confianza no disponible.",
        ariaLabel: "Configuración de confianza no disponible.",
      };
    }
    if (!item.hasMappingConfidence) {
      return {
        content: "Confianza de mapeo no disponible.",
        ariaLabel: "Confianza de mapeo no disponible.",
      };
    }
    const confidence = item.confidence;
    const percentage = Math.round(clampConfidence(confidence) * 100);
    const tone = getConfidenceTone(confidence, activeConfidencePolicy.band_cutoffs);
    const candidateConfidence = item.rawField?.field_candidate_confidence;
    const candidateConfidenceText =
      typeof candidateConfidence === "number" && Number.isFinite(candidateConfidence)
        ? `${Math.round(clampConfidence(candidateConfidence) * 100)}%`
        : "No disponible";
    const reviewHistoryAdjustmentRaw = item.rawField?.field_review_history_adjustment;
    const reviewHistoryAdjustment =
      typeof reviewHistoryAdjustmentRaw === "number" && Number.isFinite(reviewHistoryAdjustmentRaw)
        ? reviewHistoryAdjustmentRaw
        : 0;
    const reviewHistoryAdjustmentText = formatSignedPercent(reviewHistoryAdjustment);
    const reviewHistoryAdjustmentClass =
      reviewHistoryAdjustment > 0
        ? "text-[var(--status-success)]"
        : reviewHistoryAdjustment < 0
          ? "text-[var(--status-error)]"
          : "text-muted";
    const header = `Confianza: ${percentage}%`;
    const toneDotClass =
      tone === "high" ? "bg-confidenceHigh" : tone === "med" ? "bg-confidenceMed" : "bg-confidenceLow";
    const toneValueClass =
      tone === "high"
        ? "text-confidenceHigh"
        : tone === "med"
          ? "text-confidenceMed"
          : "text-confidenceLow";
    const evidencePageLabel = item.evidence?.page ? `Página ${item.evidence.page}` : null;
    const ariaLabelParts = [
      header,
      evidencePageLabel,
      "Indica la fiabilidad del valor detectado automáticamente.",
      "Desglose:",
      `Fiabilidad del candidato: ${candidateConfidenceText}`,
      `Ajuste por histórico de revisiones: ${reviewHistoryAdjustmentText}`,
    ].filter((part): part is string => Boolean(part));
    return {
      ariaLabel: ariaLabelParts.join(" · "),
      content: (
        <div className="min-w-[260px] space-y-1 text-[12px] leading-4">
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[14px] font-semibold leading-5 text-white">
              <span>Confianza:</span>
              <span className={toneValueClass}>{percentage}%</span>
              <span className={`inline-block h-2 w-2 rounded-full ring-1 ring-white/40 ${toneDotClass}`} aria-hidden="true" />
            </p>
            {evidencePageLabel ? (
              <span className="text-[11px] font-normal text-white/70">{evidencePageLabel}</span>
            ) : null}
          </div>
          <p className="text-[11px] leading-4 text-white/60">
            Indica la fiabilidad del valor detectado automáticamente.
          </p>
          <div className="!mt-4 space-y-0.5 text-[12px]">
            <p className="font-medium text-white/80">Desglose:</p>
            <p className="pl-3 text-white/70">
              - Fiabilidad del candidato:{" "}
              <span className={toneValueClass}>{candidateConfidenceText}</span>
            </p>
            <p className="pl-3 text-white/70">
              - Ajuste por histórico de revisiones:{" "}
              <span className={reviewHistoryAdjustmentClass}>{reviewHistoryAdjustmentText}</span>
            </p>
          </div>
        </div>
      ),
    };
  };

  const renderConfidenceIndicator = (item: ReviewSelectableField, ariaLabel: string) => {
    const tone = item.confidenceBand === "medium" ? "med" : item.confidenceBand;
    return (
      <span data-testid={`badge-group-${item.id}`} className="inline-flex shrink-0 items-center">
        {tone ? (
          <span
            data-testid={`confidence-indicator-${item.id}`}
            aria-label={ariaLabel}
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              tone === "high" ? "bg-confidenceHigh" : tone === "med" ? "bg-confidenceMed" : "bg-confidenceLow"
            }`}
          />
        ) : (
          <span
            data-testid={`confidence-indicator-${item.id}`}
            aria-label={ariaLabel}
            className="inline-block h-2.5 w-2.5 rounded-full bg-missing"
          />
        )}
      </span>
    );
  };

  const renderEditableFieldValue = (options: {
    item: ReviewSelectableField;
    value: string;
    isLongText: boolean;
    longTextTestId?: string;
    shortTextTestId?: string;
  }) => {
    const { item, value, isLongText, longTextTestId, shortTextTestId } = options;
    const isFieldModified = item.rawField?.origin === "human";
    const modifiedValueClass = isFieldModified
      ? "!bg-amber-50 ring-1 ring-amber-300/70"
      : "";

    return (
      <div className="relative rounded-control">
        {isLongText ? (
          renderLongTextValue({
            value,
            isMissing: item.isMissing,
            missingClassName: isDocumentReviewed
              ? `text-missing ${modifiedValueClass}`
              : `text-missing pr-9 ${modifiedValueClass}`,
            valueClassName: isDocumentReviewed
              ? `text-text ${modifiedValueClass}`
              : `text-text pr-9 ${modifiedValueClass}`,
            testId: longTextTestId,
          })
        ) : (
          <ValueSurface
            testId={shortTextTestId}
            variant="short"
            className={
              item.isMissing
                ? isDocumentReviewed
                  ? `relative italic text-missing ${modifiedValueClass}`
                  : `relative pr-9 italic text-missing ${modifiedValueClass}`
                : isDocumentReviewed
                  ? `relative text-text ${modifiedValueClass}`
                  : `relative pr-9 text-text ${modifiedValueClass}`
            }
          >
            {value}
          </ValueSurface>
        )}
        {!isDocumentReviewed && (
          <IconButton
            label="Editar"
            tooltip="Editar"
            type="button"
            className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md border border-transparent bg-transparent p-0 text-text opacity-55 hover:border-borderSubtle hover:bg-surface hover:opacity-100 focus-visible:border-borderSubtle focus-visible:opacity-100"
            disabled={interpretationEditMutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openFieldEditDialog(item);
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        )}
      </div>
    );
  };

  const renderRepeatableReviewField = (field: ReviewDisplayField) => {
    const countLabel = field.items.length === 1 ? "1 elemento" : `${field.items.length} elementos`;
    return (
      <FieldBlock key={field.id} className="px-1 py-1">
        <div className="flex items-center justify-between gap-2 pb-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-text">{field.label}</p>
            {field.isCritical && (
              <CriticalBadge testId={`critical-indicator-${field.key}`} />
            )}
          </div>
          {field.items.length > 0 && (
            <span className="rounded-full bg-surfaceMuted px-2 py-0.5 text-[10px] font-semibold text-textSecondary">
              {countLabel}
            </span>
          )}
        </div>
        <RepeatableList>
          {field.isEmptyList && (
            <p className="py-0.5 text-sm italic text-missing">{EMPTY_LIST_PLACEHOLDER}</p>
          )}
          {field.items.map((item) => {
            const isSelected = selectedFieldId === item.id;
            const isLongText = shouldRenderLongTextValue(field.key, item.displayValue);
            const tooltip = buildFieldTooltip(item);
            return (
              <div
                key={item.id}
                className={`px-1 py-1 ${
                  isSelected ? "rounded-md bg-accentSoft/50" : ""
                }`}
              >
                <Tooltip
                  content={tooltip.content}
                  open={
                    hoveredFieldTriggerId === item.id &&
                    hoveredCriticalTriggerId !== item.id
                  }
                >
                  <div
                    role="button"
                    tabIndex={0}
                    data-testid={`field-trigger-${item.id}`}
                    aria-disabled={isDocumentReviewed}
                    className={`w-full rounded-md border border-transparent px-1 py-0.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      isDocumentReviewed ? "cursor-default" : "cursor-pointer hover:border-borderSubtle hover:bg-surface"
                    }`}
                    onClick={() => {
                      if (isDocumentReviewed) {
                        return;
                      }
                      handleSelectReviewItem(item);
                    }}
                    onMouseEnter={() => {
                      setHoveredFieldTriggerId(item.id);
                    }}
                    onMouseLeave={() => {
                      setHoveredFieldTriggerId((current) => (current === item.id ? null : current));
                      setHoveredCriticalTriggerId((current) => (current === item.id ? null : current));
                    }}
                    onMouseUp={handleReviewedEditAttempt}
                    onFocus={() => {
                      setHoveredFieldTriggerId(item.id);
                    }}
                    onBlur={(event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        return;
                      }
                      setHoveredFieldTriggerId((current) => (current === item.id ? null : current));
                      setHoveredCriticalTriggerId((current) => (current === item.id ? null : current));
                    }}
                    onKeyDown={(event) => {
                      handleReviewedKeyboardEditAttempt(event);
                      if (isDocumentReviewed) {
                        return;
                      }
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleSelectReviewItem(item);
                      }
                    }}
                  >
                    <FieldRow
                      indicator={renderConfidenceIndicator(item, tooltip.ariaLabel)}
                      label={<p className={`${STRUCTURED_FIELD_LABEL_CLASS} text-text`}>{field.label}</p>}
                      labelMeta={null}
                      className={STRUCTURED_FIELD_ROW_CLASS}
                      valuePlacement={isLongText ? "below-label" : "inline"}
                      value={renderEditableFieldValue({
                        item,
                        value: item.displayValue,
                        isLongText,
                      })}
                    />
                  </div>
                </Tooltip>
              </div>
            );
          })}
        </RepeatableList>
      </FieldBlock>
    );
  };

  const renderScalarReviewField = (field: ReviewDisplayField) => {
    const item = field.items[0];
    if (!item) {
      return null;
    }
    const isSelected = selectedFieldId === item.id;
    const isExpanded = Boolean(expandedFieldValues[item.id]);
    const shouldUseLongText = shouldRenderLongTextValue(field.key, item.displayValue);
    const tooltip = buildFieldTooltip(item);
    const shouldSpanFullSectionWidth = shouldUseLongText;
    const valueText = shouldUseLongText
      ? item.displayValue
      : isExpanded
        ? item.displayValue
        : truncateText(item.displayValue, 140);
    const canExpand = !shouldUseLongText && item.displayValue.length > 140;
    const styledPrefix = getStructuredFieldPrefix(field.key);
    const isFieldHovered = hoveredFieldTriggerId === item.id;
    const isCriticalHovered = hoveredCriticalTriggerId === item.id;
    const isFieldTooltipOpen = isFieldHovered && !isCriticalHovered;
    const isCriticalTooltipOpen = isCriticalHovered;

    return (
      <FieldBlock
        key={field.id}
        className={`px-1 py-1.5 ${shouldSpanFullSectionWidth ? "lg:col-span-2" : ""} ${
          isSelected ? "bg-accentSoft/50" : ""
        }`}
      >
        <Tooltip content={tooltip.content} open={isFieldTooltipOpen}>
          <div
            role="button"
            tabIndex={0}
            data-testid={`field-trigger-${item.id}`}
            aria-disabled={isDocumentReviewed}
            className={`w-full rounded-md border border-transparent px-1 py-0.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              isDocumentReviewed ? "cursor-default" : "cursor-pointer hover:border-borderSubtle hover:bg-surface"
            }`}
            onClick={() => {
              if (isDocumentReviewed) {
                return;
              }
              handleSelectReviewItem(item);
            }}
            onMouseEnter={() => {
              setHoveredFieldTriggerId(item.id);
            }}
            onMouseLeave={() => {
              setHoveredFieldTriggerId((current) => (current === item.id ? null : current));
              setHoveredCriticalTriggerId((current) => (current === item.id ? null : current));
            }}
            onMouseUp={handleReviewedEditAttempt}
            onFocus={() => {
              setHoveredFieldTriggerId(item.id);
            }}
            onBlur={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                return;
              }
              setHoveredFieldTriggerId((current) => (current === item.id ? null : current));
              setHoveredCriticalTriggerId((current) => (current === item.id ? null : current));
            }}
            onKeyDown={(event) => {
              handleReviewedKeyboardEditAttempt(event);
              if (isDocumentReviewed) {
                return;
              }
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleSelectReviewItem(item);
              }
            }}
          >
            <FieldRow
              leftTestId={`${styledPrefix}-row-${field.key}`}
              labelTestId={`${styledPrefix}-label-${field.key}`}
              indicatorTestId={`${styledPrefix}-dot-${field.key}`}
              valueWrapperTestId={shouldUseLongText ? `field-value-${field.key}-wrapper` : undefined}
              indicator={renderConfidenceIndicator(item, tooltip.ariaLabel)}
              label={<p className={`${STRUCTURED_FIELD_LABEL_CLASS} text-text`}>{field.label}</p>}
              labelMeta={
                field.isCritical ? (
                  <CriticalBadge
                    testId={`critical-indicator-${field.key}`}
                    tooltipOpen={isCriticalTooltipOpen}
                    onMouseEnter={() => {
                      setHoveredCriticalTriggerId(item.id);
                    }}
                    onMouseLeave={() => {
                      setHoveredCriticalTriggerId((current) => (current === item.id ? null : current));
                    }}
                  />
                ) : null
              }
              className={STRUCTURED_FIELD_ROW_CLASS}
              valuePlacement={shouldUseLongText ? "below-label" : "inline"}
              value={renderEditableFieldValue({
                item,
                value: valueText,
                isLongText: shouldUseLongText,
                longTextTestId: `field-value-${field.key}`,
                shortTextTestId: `${styledPrefix}-value-${field.key}`,
              })}
            />
          </div>
        </Tooltip>
        {canExpand && (
          <button
            type="button"
            className="mt-1 text-xs font-semibold text-muted underline underline-offset-2"
            onClick={() =>
              setExpandedFieldValues((current) => ({
                ...current,
                [item.id]: !current[item.id],
              }))
            }
          >
            {isExpanded ? "Ver menos" : "Ver más"}
          </button>
        )}
      </FieldBlock>
    );
  };

  const renderRepeatableTileField = (field: ReviewDisplayField) => {
    return renderRepeatableReviewField(field);
  };

  const renderScalarTileField = (field: ReviewDisplayField) => {
    return renderScalarReviewField(field);
  };

  const renderSectionLayout2 = (section: { id: string; title: string; fields: ReviewDisplayField[] }) => {
    const scalarFields = section.fields.filter((field) => !field.repeatable);
    const repeatableFields = section.fields.filter((field) => field.repeatable);
    const isExtraSection = section.id === "extra:section";
    const isEmptyExtraSection = isExtraSection && section.fields.length === 0;
    const isOwnerSection = section.title === "Propietario";
    const shouldUseSingleColumn = isOwnerSection;

    return (
      <SectionBlock
        key={section.id}
        testId={isExtraSection ? "other-extracted-fields-section" : undefined}
      >
        <SectionHeader title={section.title} />
        <div className="mt-2">
          {isEmptyExtraSection && (
            <p className="rounded-control bg-surface px-3 py-2 text-xs text-textSecondary">
              {OTHER_EXTRACTED_FIELDS_EMPTY_STATE}
            </p>
          )}
          {!isEmptyExtraSection && (
            <div
              className={
                shouldUseSingleColumn
                  ? `grid grid-cols-1 gap-x-5 ${STRUCTURED_FIELD_STACK_CLASS}`
                  : `grid gap-x-5 ${STRUCTURED_FIELD_STACK_CLASS} lg:grid-cols-2`
              }
            >
              {scalarFields.map(renderScalarReviewField)}
            </div>
          )}
          {repeatableFields.length > 0 && (
            <div className={`mt-2 ${STRUCTURED_FIELD_STACK_CLASS}`}>{repeatableFields.map(renderRepeatableReviewField)}</div>
          )}
        </div>
      </SectionBlock>
    );
  };

  const renderSectionLayout1 = (section: { id: string; title: string; fields: ReviewDisplayField[] }) => {
    const scalarFields = section.fields.filter((field) => !field.repeatable);
    const repeatableFields = section.fields.filter((field) => field.repeatable);
    const isExtraSection = section.id === "extra:section";
    const isEmptyExtraSection = isExtraSection && section.fields.length === 0;
    const isOwnerSection = section.title === "Propietario";
    const shouldUseSingleColumn = isOwnerSection;

    return (
      <SectionBlock
        key={section.id}
        testId={isExtraSection ? "other-extracted-fields-section" : undefined}
      >
        <SectionHeader title={section.title} />
        <div className={`mt-2 ${STRUCTURED_FIELD_STACK_CLASS}`}>
          {isEmptyExtraSection && (
            <p className="rounded-control bg-surface px-3 py-2 text-xs text-muted">
              {OTHER_EXTRACTED_FIELDS_EMPTY_STATE}
            </p>
          )}
          {scalarFields.length > 0 && (
            <div
              className={
                shouldUseSingleColumn
                  ? `grid grid-cols-1 gap-x-5 ${STRUCTURED_FIELD_STACK_CLASS}`
                  : `grid gap-x-5 ${STRUCTURED_FIELD_STACK_CLASS} lg:grid-cols-2`
              }
            >
              {scalarFields.map(renderScalarTileField)}
            </div>
          )}
          {repeatableFields.length > 0 && (
            <div className={STRUCTURED_FIELD_STACK_CLASS}>{repeatableFields.map(renderRepeatableTileField)}</div>
          )}
        </div>
      </SectionBlock>
    );
  };

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
            documentId={activeId}
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
    <div className="min-h-screen bg-page px-4 py-3 md:px-6 lg:px-8 xl:px-10">
      <AddFieldDialog
        open={isAddFieldDialogOpen}
        isSaving={interpretationEditMutation.isPending}
        fieldKey={addFieldKeyDraft}
        fieldValue={addFieldValueDraft}
        onFieldKeyChange={setAddFieldKeyDraft}
        onFieldValueChange={setAddFieldValueDraft}
        onOpenChange={(open) => {
          if (!open) {
            closeAddFieldDialog();
          }
        }}
        onSave={saveAddFieldDialog}
      />
      <FieldEditDialog
        open={editingField !== null}
        fieldKey={editingField?.key ?? null}
        fieldLabel={editingField?.label ?? ""}
        value={editingFieldDraftValue}
        candidateSuggestions={editingFieldCandidateSections.applicableSuggestions}
        detectedCandidates={editingFieldCandidateSections.detectedCandidates}
        isSaving={interpretationEditMutation.isPending}
        isSaveDisabled={
          isEditingMicrochipInvalid ||
          isEditingWeightInvalid ||
          isEditingDateInvalid ||
          isEditingSexInvalid ||
          isEditingSpeciesInvalid
        }
        microchipErrorMessage={
          isEditingMicrochipField && isEditingMicrochipInvalid
            ? "Introduce entre 9 y 15 dígitos."
            : null
        }
        weightErrorMessage={
          isEditingWeightField && isEditingWeightInvalid
            ? "Introduce un peso entre 0,5 y 120 kg."
            : null
        }
        dateErrorMessage={
          isEditingDateField && isEditingDateInvalid
            ? "Formato no válido. Usa dd/mm/aaaa o aaaa-mm-dd."
            : null
        }
        sexErrorMessage={
          isEditingSexField && editingFieldDraftValue.trim().length > 0 && isEditingSexInvalid
            ? "Valor no válido. Usa “macho” o “hembra”."
            : null
        }
        speciesErrorMessage={
          isEditingSpeciesField && editingFieldDraftValue.trim().length > 0 && isEditingSpeciesInvalid
            ? "Valor no válido. Usa “canino” o “felino”."
            : null
        }
        onValueChange={setEditingFieldDraftValue}
        onOpenChange={(open) => {
          if (!open) {
            closeFieldEditDialog();
          }
        }}
        onSave={saveFieldEditDialog}
      />
      <div
        className="mx-auto w-full max-w-[1640px] rounded-frame bg-canvas p-[var(--canvas-gap)]"
        data-testid="canvas-wrapper"
      >
      <main className="relative w-full">
        <div className="relative z-20 flex gap-[var(--canvas-gap)]" data-testid="main-canvas-layout">
          <DocumentsSidebar
            panelHeightClass={panelHeightClass}
            shouldUseHoverDocsSidebar={shouldUseHoverDocsSidebar}
            isDocsSidebarExpanded={isDocsSidebarExpanded}
            isDocsSidebarPinned={isDocsSidebarPinned}
            isRefreshingDocuments={documentList.isFetching || showRefreshFeedback}
            isUploadPending={uploadMutation.isPending}
            isDragOverSidebarUpload={isDragOverSidebarUpload}
            isDocumentListLoading={documentList.isLoading}
            isDocumentListError={documentList.isError && !isDocumentListConnectivityError}
            isListRefreshing={isListRefreshing}
            documentListErrorMessage={
              documentList.isError && !isDocumentListConnectivityError
                ? getUserErrorMessage(documentList.error, "No se pudieron cargar los documentos.")
                : null
            }
            documents={sortedDocuments}
            activeId={activeId}
            uploadPanelRef={uploadPanelRef}
            fileInputRef={fileInputRef}
            formatTimestamp={formatTimestamp}
            isProcessingTooLong={isProcessingTooLong}
            mapDocumentStatus={mapDocumentStatus}
            onSidebarMouseEnter={handleDocsSidebarMouseEnter}
            onSidebarMouseLeave={handleDocsSidebarMouseLeave}
            onTogglePin={handleToggleDocsSidebarPin}
            onRefresh={handleRefresh}
            onOpenUploadArea={handleOpenUploadArea}
            onSidebarUploadDragEnter={handleSidebarUploadDragEnter}
            onSidebarUploadDragOver={handleSidebarUploadDragOver}
            onSidebarUploadDragLeave={handleSidebarUploadDragLeave}
            onSidebarUploadDrop={handleSidebarUploadDrop}
            onSidebarFileInputChange={handleSidebarFileInputChange}
            onSelectDocument={handleSelectDocument}
          />
          <section className={`flex min-w-0 flex-1 flex-col ${panelHeightClass}`}>
            {shouldShowLoadPdfErrorBanner && (
              <div className="rounded-card border border-statusError bg-surface px-4 py-3 text-sm text-text">
                {getUserErrorMessage(loadPdf.error, "No se pudo cargar la vista previa del documento.")}
              </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1">
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
                        <div className="flex h-full flex-col rounded-card bg-surface p-6">
                          <div className="flex flex-1 items-center justify-center text-center">
                            <p className="text-sm text-muted">
                              Revisa la lista lateral para reintentar la carga de documentos.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div
                          data-testid="viewer-empty-state"
                          className="relative flex h-full flex-col rounded-card bg-surfaceMuted p-6"
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
                      <div className="h-full min-h-0">
                        <div
                          data-testid="document-layout-grid"
                          className={`h-full min-h-0 overflow-x-auto ${
                            isPinnedSourcePanelVisible
                              ? "grid grid-cols-[minmax(0,1fr)_minmax(360px,420px)] gap-4"
                              : ""
                          }`}
                        >
                        <div
                          ref={handleReviewSplitGridRef}
                          data-testid="review-split-grid"
                          className="grid h-full min-h-0 overflow-x-auto"
                          style={reviewSplitLayoutStyle}
                        >
                          <aside
                            data-testid="center-panel-scroll"
                            className="panel-shell-muted flex h-full min-h-0 min-w-[560px] flex-col gap-[var(--canvas-gap)] p-[var(--canvas-gap)]"
                          >
                            <div>
                              <h3 className="text-lg font-semibold text-textSecondary">Informe</h3>
                            </div>
                            {fileUrl ? (
                              <PdfViewer
                                key={`${effectiveViewMode}-${activeId ?? "empty"}`}
                                documentId={activeId}
                                fileUrl={fileUrl}
                                filename={filename}
                                isDragOver={isDragOverViewer}
                                focusPage={selectedReviewField?.evidence?.page ?? null}
                                highlightSnippet={selectedReviewField?.evidence?.snippet ?? null}
                                focusRequestId={fieldNavigationRequestId}
                                toolbarLeftContent={viewerModeToolbarIcons}
                                toolbarRightExtra={viewerDownloadIcon}
                              />
                            ) : (
                              <div className="flex h-full min-h-0 flex-col">
                                <div className="relative z-20 flex items-center justify-between gap-4 pb-3">
                                  <div className="flex items-center gap-1">{viewerModeToolbarIcons}</div>
                                  <div className="flex items-center gap-1">{viewerDownloadIcon}</div>
                                </div>
                                <div className="flex flex-1 items-center justify-center text-sm text-muted">
                                  No hay PDF disponible para este documento.
                                </div>
                              </div>
                            )}
                          </aside>

                          <div className="relative flex h-full min-h-0 items-stretch justify-center">
                            <button
                              type="button"
                              data-testid="review-split-handle"
                              aria-label="Redimensionar paneles de revisión"
                              title="Redimensionar paneles de revisión"
                              onMouseDown={startReviewSplitDragging}
                              onDoubleClick={resetReviewSplitRatio}
                              onKeyDown={handleReviewSplitKeyboard}
                              className="group flex h-full w-full cursor-col-resize items-center justify-center rounded-full bg-transparent transition hover:bg-surfaceMuted focus-visible:bg-surfaceMuted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
                            >
                              <span
                                aria-hidden="true"
                                className="h-24 w-[2px] rounded-full bg-borderSubtle transition group-hover:bg-border"
                              />
                            </button>
                          </div>

                          <aside
                            data-testid="structured-column-stack"
                            className="panel-shell-muted flex h-full w-full min-h-0 min-w-[420px] flex-1 flex-col gap-[var(--canvas-gap)] p-[var(--canvas-gap)]"
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <h3 className="text-lg font-semibold text-textSecondary">Datos extraídos</h3>
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="toolbar"
                                  disabled={
                                    reviewPanelState !== "ready" ||
                                    isDocumentReviewed ||
                                    interpretationEditMutation.isPending
                                  }
                                  onClick={handleAddField}
                                >
                                  Añadir campo
                                </Button>
                                <Button
                                  type="button"
                                  variant={isDocumentReviewed ? "outline" : "primary"}
                                  size="toolbar"
                                  className="min-w-[168px]"
                                  disabled={
                                    !activeId ||
                                    isActiveDocumentProcessing ||
                                    reviewToggleMutation.isPending
                                  }
                                  onClick={() => {
                                    if (!activeId) {
                                      return;
                                    }
                                    reviewToggleMutation.mutate({
                                      docId: activeId,
                                      target: isDocumentReviewed ? "in_review" : "reviewed",
                                    });
                                  }}
                                >
                                  {reviewToggleMutation.isPending ? (
                                    <>
                                      <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                                      {isDocumentReviewed ? "Reabriendo..." : "Marcando..."}
                                    </>
                                  ) : isDocumentReviewed ? (
                                    <>
                                      <RefreshCw size={14} aria-hidden="true" />
                                      Reabrir
                                    </>
                                  ) : (
                                    "Marcar revisado"
                                  )}
                                </Button>
                                <div className="flex items-center justify-end gap-1 text-xs leading-tight text-textSecondary">
                                <span className="text-muted">Campos detectados:</span>
                                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                  <span className="font-semibold text-text tabular-nums">
                                    {detectedFieldsSummary.detected}/{detectedFieldsSummary.total}
                                  </span>
                                  <span>(</span>
                                  <span className="inline-flex items-center gap-1">
                                    <ConfidenceDot tone="low" tooltip="Low" ariaLabel="Low" />
                                    <span className="tabular-nums">{detectedFieldsSummary.low}</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <ConfidenceDot tone="med" tooltip="Medium" ariaLabel="Medium" />
                                    <span className="tabular-nums">{detectedFieldsSummary.medium}</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <ConfidenceDot tone="high" tooltip="High" ariaLabel="High" />
                                    <span className="tabular-nums">{detectedFieldsSummary.high}</span>
                                  </span>
                                  <span>)</span>
                                </span>
                                </div>
                              </div>
                            </div>

                            {reviewPanelState === "ready" && !activeConfidencePolicy && (
                              <p
                                data-testid="confidence-policy-degraded"
                                className="rounded-control border border-border bg-surface px-3 py-2 text-xs text-textSecondary"
                              >
                                Configuración de confianza no disponible para este documento. La
                                señal visual de confianza está en modo degradado.
                              </p>
                            )}

                            <div data-testid="structured-search-shell" className="panel-shell px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="relative min-w-[220px] flex-1">
                                  <Search
                                    size={14}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                                    aria-hidden="true"
                                  />
                                  <Input
                                    ref={structuredSearchInputRef}
                                    type="text"
                                    aria-label="Buscar en datos extraídos"
                                    value={structuredSearchInput}
                                    disabled={reviewPanelState !== "ready"}
                                    onChange={(event) => setStructuredSearchInput(event.target.value)}
                                    placeholder="Buscar campo, clave o valor"
                                    className="w-full rounded-control border border-borderSubtle bg-surface py-1.5 pl-9 pr-9 text-xs"
                                  />
                                  {structuredSearchInput.trim().length > 0 && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                      <IconButton
                                        label="Limpiar búsqueda"
                                        tooltip="Limpiar búsqueda"
                                        onClick={() => {
                                          setStructuredSearchInput("");
                                          structuredSearchInputRef.current?.focus();
                                        }}
                                      >
                                        <X size={12} aria-hidden="true" />
                                      </IconButton>
                                    </div>
                                  )}
                                </label>

                                <Separator orientation="vertical" className="hidden h-6 sm:block" />

                                <ToggleGroup
                                  type="multiple"
                                  value={selectedConfidenceBuckets}
                                  disabled={reviewPanelState !== "ready" || !activeConfidencePolicy}
                                  onValueChange={(values) =>
                                    setSelectedConfidenceBuckets(
                                      values.filter(
                                        (value): value is ConfidenceBucket =>
                                          value === "low" || value === "medium" || value === "high"
                                      )
                                    )
                                  }
                                  aria-label="Filtros de confianza"
                                >
                                  <Tooltip content="Baja">
                                    <ToggleGroupItem
                                      value="low"
                                      aria-label="Baja"
                                      className={`h-7 w-7 rounded-full border-0 bg-transparent p-0 data-[state=on]:border-0 ${
                                        selectedConfidenceBuckets.includes("low")
                                          ? "bg-accentSoft/35"
                                          : ""
                                      }`}
                                    >
                                      <span
                                        aria-hidden="true"
                                        className="inline-block h-3 w-3 shrink-0 rounded-full bg-confidenceLow"
                                      />
                                    </ToggleGroupItem>
                                  </Tooltip>
                                  <Tooltip content="Media">
                                    <ToggleGroupItem
                                      value="medium"
                                      aria-label="Media"
                                      className={`h-7 w-7 rounded-full border-0 bg-transparent p-0 data-[state=on]:border-0 ${
                                        selectedConfidenceBuckets.includes("medium")
                                          ? "bg-accentSoft/35"
                                          : ""
                                      }`}
                                    >
                                      <span
                                        aria-hidden="true"
                                        className="inline-block h-3 w-3 shrink-0 rounded-full bg-confidenceMed"
                                      />
                                    </ToggleGroupItem>
                                  </Tooltip>
                                  <Tooltip content="Alta">
                                    <ToggleGroupItem
                                      value="high"
                                      aria-label="Alta"
                                      className={`h-7 w-7 rounded-full border-0 bg-transparent p-0 data-[state=on]:border-0 ${
                                        selectedConfidenceBuckets.includes("high")
                                          ? "bg-accentSoft/35"
                                          : ""
                                      }`}
                                    >
                                      <span
                                        aria-hidden="true"
                                        className="inline-block h-3 w-3 shrink-0 rounded-full bg-confidenceHigh"
                                      />
                                    </ToggleGroupItem>
                                  </Tooltip>
                                </ToggleGroup>

                                <span aria-hidden="true" className="mx-1 h-6 w-px bg-borderSubtle" />

                                <ToggleGroup
                                  type="multiple"
                                  value={[
                                    ...(showOnlyCritical ? ["critical"] : []),
                                    ...(showOnlyWithValue ? ["nonEmpty"] : []),
                                    ...(showOnlyEmpty ? ["empty"] : []),
                                  ]}
                                  disabled={reviewPanelState !== "ready"}
                                  onValueChange={(values) => {
                                    setShowOnlyCritical(values.includes("critical"));
                                    setShowOnlyWithValue(values.includes("nonEmpty"));
                                    setShowOnlyEmpty(values.includes("empty"));
                                  }}
                                  aria-label="Filtros adicionales"
                                >
                                  <Tooltip content="Críticos: muestra únicamente campos marcados como críticos.">
                                    <ToggleGroupItem
                                      value="critical"
                                      aria-label="Mostrar solo campos críticos"
                                      className={`h-7 w-7 rounded-full border-0 bg-transparent p-0 data-[state=on]:border-0 ${
                                        showOnlyCritical
                                          ? "bg-accentSoft/35"
                                          : ""
                                      }`}
                                    >
                                      <CriticalIcon compact />
                                    </ToggleGroupItem>
                                  </Tooltip>
                                  <Tooltip content="No vacíos: muestra solo campos con valor.">
                                    <ToggleGroupItem
                                      value="nonEmpty"
                                      aria-label="Mostrar solo campos no vacíos"
                                      className={`h-7 w-7 rounded-full border-0 bg-transparent p-0 data-[state=on]:border-0 ${
                                        showOnlyWithValue
                                          ? "bg-accentSoft/35"
                                          : ""
                                      }`}
                                    >
                                      <span
                                        aria-hidden="true"
                                        className="inline-block h-3 w-3 shrink-0 rounded-full bg-text"
                                      />
                                    </ToggleGroupItem>
                                  </Tooltip>
                                  <Tooltip content="Vacíos: muestra solo campos sin dato.">
                                    <ToggleGroupItem
                                      value="empty"
                                      aria-label="Mostrar solo campos vacíos"
                                      className={`h-7 w-7 rounded-full border-0 bg-transparent p-0 data-[state=on]:border-0 ${
                                        showOnlyEmpty
                                          ? "bg-accentSoft/35"
                                          : ""
                                      }`}
                                    >
                                      <span
                                        aria-hidden="true"
                                        className="inline-block h-3 w-3 shrink-0 rounded-full border border-muted bg-surface"
                                      />
                                    </ToggleGroupItem>
                                  </Tooltip>
                                </ToggleGroup>

                              </div>
                            </div>

                            <div className="flex-1 min-h-0">
                              {reviewPanelState === "loading" && (
                                <div
                                  data-testid="right-panel-scroll"
                                  aria-live="polite"
                                  className="h-full min-h-0 overflow-y-auto pr-1 space-y-2"
                                >
                                  <p className="rounded-control border border-borderSubtle bg-surfaceMuted px-3 py-2 text-xs text-textSecondary">
                                    {reviewPanelMessage}
                                  </p>
                                  <div data-testid="review-core-skeleton" className="space-y-2">
                                    {Array.from({ length: 6 }).map((_, index) => (
                                      <div
                                        key={`review-skeleton-${index}`}
                                        className="animate-pulse rounded-card bg-surface p-3"
                                      >
                                        <div className="h-3 w-1/2 rounded bg-borderSubtle" />
                                        <div className="mt-2 h-2.5 w-5/6 rounded bg-borderSubtle" />
                                        <div className="mt-3 h-2 w-1/3 rounded bg-borderSubtle" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {shouldShowReviewEmptyState && (
                                <div
                                  data-testid="right-panel-scroll"
                                  className="h-full min-h-0 flex items-center justify-center"
                                >
                                  <div className="mx-auto w-full max-w-md px-4">
                                    <div className="mx-auto max-w-sm text-center">
                                      <p className="text-base font-semibold text-ink">
                                        Interpretación no disponible
                                      </p>
                                      <p className="mt-2 text-xs text-muted">
                                        No se pudo cargar la interpretación. Comprueba tu conexión y vuelve
                                        a intentarlo.
                                      </p>
                                      <div className="mt-4 flex justify-center">
                                        <Button
                                          type="button"
                                          disabled={!activeId || isRetryingInterpretation}
                                          onClick={async () => {
                                            const retryStartedAt = Date.now();
                                            setIsRetryingInterpretation(true);
                                            await documentReview.refetch();
                                            const minVisibleMs = 250;
                                            const elapsedMs = Date.now() - retryStartedAt;
                                            const remainingMs = Math.max(0, minVisibleMs - elapsedMs);
                                            if (remainingMs === 0) {
                                              setIsRetryingInterpretation(false);
                                              return;
                                            }
                                            if (interpretationRetryMinTimerRef.current) {
                                              window.clearTimeout(interpretationRetryMinTimerRef.current);
                                            }
                                            interpretationRetryMinTimerRef.current = window.setTimeout(() => {
                                              interpretationRetryMinTimerRef.current = null;
                                              setIsRetryingInterpretation(false);
                                            }, remainingMs);
                                          }}
                                        >
                                          {isRetryingInterpretation ? "Reintentando..." : "Reintentar"}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {reviewPanelState === "ready" && (
                                <ScrollArea
                                  data-testid="right-panel-scroll"
                                  className={`h-full min-h-0 pr-1 ${isDocumentReviewed ? "opacity-80" : ""}`}
                                >
                                  <div className="space-y-3">
                                    {isDocumentReviewed && (
                                      <p className="rounded-control border border-statusWarn bg-surface px-3 py-2 text-xs text-text">
                                        Documento marcado como revisado. Los datos están en modo de solo lectura.
                                      </p>
                                    )}
                                    {hasNoStructuredFilterResults && (
                                      <p className="rounded-control bg-surface px-3 py-2 text-xs text-muted">
                                        No hay resultados con los filtros actuales.
                                      </p>
                                    )}
                                    {reportSections.map((section) =>
                                      reportLayout === 1
                                        ? renderSectionLayout1(section)
                                        : renderSectionLayout2(section)
                                    )}
                                  </div>
                                </ScrollArea>
                              )}
                            </div>

                            {evidenceNotice && (
                              <p className="rounded-control bg-surface px-3 py-2 text-xs text-muted">
                                {evidenceNotice}
                              </p>
                            )}
                          </aside>
                        </div>

                        {isPinnedSourcePanelVisible && (
                          <aside data-testid="source-pinned-panel" className="min-h-0">
                            {sourcePanelContent}
                          </aside>
                        )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeViewerTab === "document" &&
                  sourcePanel.isSourceOpen &&
                  (isReviewMode || !sourcePanel.isSourcePinned || !isDesktopForPin) && (
                  <>
                    <button
                      type="button"
                      data-testid="source-drawer-backdrop"
                      className="fixed inset-0 z-40 bg-text/20"
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
                  <div className="flex h-full flex-col rounded-card bg-surface p-4">
                    <div className="rounded-control bg-surface px-2 py-2">
                      <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-1">{viewerModeToolbarIcons}</div>
                      <div className="flex items-center gap-1">{viewerDownloadIcon}</div>
                    </div>
                    </div>
                    <div className="rounded-card bg-surface p-3">
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
                        className="w-full rounded-control bg-surface px-3 py-2 text-xs text-muted outline-none sm:w-64"
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
                      <p className="mt-2 text-xs text-statusError">
                        {rawTextErrorMessage}
                      </p>
                    )}
                    <div className="mt-3 flex-1 overflow-y-auto rounded-card bg-surface p-3 font-mono text-xs text-muted">
                      {rawTextContent ? (
                        <pre>{rawTextContent}</pre>
                      ) : (
                        "Sin texto extraido."
                      )}
                    </div>
                  </div>
                )}
                {activeViewerTab === "technical" && (
                  <div className="h-full overflow-y-auto rounded-card bg-surface p-3">
                    <div className="rounded-control bg-surface px-2 py-2">
                      <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-1">{viewerModeToolbarIcons}</div>
                      <div className="flex items-center gap-1">{viewerDownloadIcon}</div>
                    </div>
                    </div>
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
                      <p className="mt-2 text-xs text-statusError">
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
                              className="rounded-card bg-surface p-2"
                            >
                              <div className="text-xs font-semibold text-ink">
                                {formatRunHeader(run)}
                              </div>
                              {run.failure_type && (
                                <p className="mt-1 text-xs text-statusError">
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
                                        className="rounded-control bg-surface p-2"
                                      >
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                          <span
                                            className={
                                              step.status === "FAILED"
                                                ? "text-statusError"
                                                : step.status === "COMPLETED"
                                                ? "text-statusSuccess"
                                                : "text-statusWarn"
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
                                          <p className="mt-1 text-xs text-statusError">
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
                                          <div className="mt-2 space-y-1 rounded-control bg-surface p-2">
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
                                                  <span className="text-statusError">
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
      <Dialog open={showRetryModal} onOpenChange={setShowRetryModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reprocesar documento</DialogTitle>
            <DialogDescription className="text-xs">
              Esto volvera a ejecutar extraccion e interpretacion y puede cambiar los resultados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={reprocessMutation.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleConfirmRetry}
              disabled={reprocessMutation.isPending}
            >
              {reprocessMutation.isPending ? "Reprocesando..." : "Reprocesar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ToastHost
        connectivityToast={connectivityToast}
        uploadFeedback={uploadFeedback}
        actionFeedback={actionFeedback}
        onCloseConnectivityToast={() => setConnectivityToast(null)}
        onCloseUploadFeedback={() => setUploadFeedback(null)}
        onCloseActionFeedback={() => setActionFeedback(null)}
        onOpenUploadedDocument={(documentId) => {
          setActiveViewerTab("document");
          requestPdfLoad(documentId);
          setUploadFeedback(null);
        }}
      />
      </div>
    </div>
  );
}









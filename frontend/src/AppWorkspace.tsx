import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterX, RefreshCw, Search, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CriticalIcon } from "./components/app/CriticalBadge";
import { IconButton } from "./components/app/IconButton";
import { DocumentsSidebar } from "./components/DocumentsSidebar";
import { PdfViewer } from "./components/PdfViewer";
import { buildViewerToolbarContent } from "./components/viewer/viewerToolbarContent";
import { UploadDropzone } from "./components/UploadDropzone";
import { ToastHost } from "./components/toast/ToastHost";
import { createReviewFieldRenderers } from "./components/review/ReviewFieldRenderers";
import { createReviewSectionLayoutRenderer } from "./components/review/ReviewSectionLayout";
import { SourcePanelContent } from "./components/review/SourcePanelContent";
import { WorkspaceDialogs } from "./components/review/WorkspaceDialogs";
import {
  type ActionFeedback,
  type ConnectivityToast,
  type UploadFeedback,
} from "./components/toast/toast-types";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { ScrollArea } from "./components/ui/scroll-area";
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
import { useFieldEditing } from "./hooks/useFieldEditing";
import { useDocumentsSidebar } from "./hooks/useDocumentsSidebar";
import { useReviewSplitPanel } from "./hooks/useReviewSplitPanel";
import { useStructuredDataFilters } from "./hooks/useStructuredDataFilters";
import { useSourcePanelState } from "./hooks/useSourcePanelState";
import { useUploadState } from "./hooks/useUploadState";
import { useRawTextActions } from "./hooks/useRawTextActions";
import { useReviewedEditBlocker } from "./hooks/useReviewedEditBlocker";
import { logExtractionDebugEvent, type ExtractionDebugEvent } from "./extraction/extractionDebug";
import { validateFieldValue } from "./extraction/fieldValidators";
import {
  API_BASE_URL,
  BILLING_REVIEW_FIELDS,
  CANONICAL_DOCUMENT_CONCEPTS,
  CANONICAL_VISIT_METADATA_KEYS,
  CANONICAL_VISIT_SCOPED_FIELD_KEYS,
  CRITICAL_GLOBAL_SCHEMA_KEYS,
  DEBUG_CONFIDENCE_POLICY,
  FIELD_LABELS,
  HIDDEN_REVIEW_FIELDS,
  MAX_UPLOAD_SIZE_BYTES,
  MEDICAL_RECORD_SECTION_ID_ORDER,
  MEDICAL_RECORD_SECTION_ORDER,
  MISSING_VALUE_PLACEHOLDER,
  OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
  REPORT_INFO_SECTION_TITLE,
  REVIEW_MESSAGE_INFO_CLASS,
  REVIEW_MESSAGE_MUTED_CLASS,
  REVIEW_MESSAGE_WARNING_CLASS,
} from "./constants/appWorkspace";
import {
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
} from "./api/documentApi";
import { groupProcessingSteps } from "./lib/processingHistory";
import { GLOBAL_SCHEMA } from "./lib/globalSchema";
import {
  clampConfidence,
  emitConfidencePolicyDiagnosticEvent,
  explainFailure,
  formatFieldValue,
  formatReviewKeyLabel,
  formatRunHeader,
  formatTimestamp,
  getConfidenceTone,
  getLabelTooltipText,
  getNormalizedVisitId,
  getReviewPanelMessage,
  getTechnicalDetails,
  getUiSectionLabelFromSectionId,
  getUserErrorMessage,
  isConnectivityOrServerError,
  isDocumentProcessing,
  isFieldValueEmpty,
  isProcessingTooLong,
  resolveConfidencePolicy,
  resolveMappingConfidence,
  resolveUiSection,
  shouldHideExtractedField,
} from "./lib/appWorkspaceUtils";
import {
  formatDuration,
  formatTime,
  shouldShowDetails,
  statusIcon,
} from "./lib/processingHistoryView";
import { type ConfidenceBucket, matchesStructuredDataFilters } from "./lib/structuredDataFilters";
import { mapDocumentStatus } from "./lib/documentStatus";
import {
  buildVisitGroupingDiagnostics,
  shouldEmitVisitGroupingDiagnostics,
} from "./lib/visitGroupingObservability";
import {
  ApiResponseError,
  type DocumentDetailResponse,
  type DocumentListResponse,
  type DocumentReviewResponse,
  type InterpretationChangePayload,
  type ReviewDisplayField,
  type ReviewField,
  type ReviewPanelState,
  type ReviewSelectableField,
  type ReviewVisitGroup,
} from "./types/appWorkspace";
export {
  MIN_PDF_PANEL_WIDTH_PX,
  REVIEW_SPLIT_MIN_WIDTH_PX,
  SPLITTER_COLUMN_WIDTH_PX,
} from "./constants/appWorkspace";
export function App() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [activeViewerTab, setActiveViewerTab] = useState<"document" | "raw_text" | "technical">(
    "document",
  );
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
  const [showRefreshFeedback, setShowRefreshFeedback] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [evidenceNotice, setEvidenceNotice] = useState<string | null>(null);
  const [expandedFieldValues, setExpandedFieldValues] = useState<Record<string, boolean>>({});
  const [reviewLoadingDocId, setReviewLoadingDocId] = useState<string | null>(null);
  const [reviewLoadingSinceMs, setReviewLoadingSinceMs] = useState<number | null>(null);
  const [isRetryingInterpretation, setIsRetryingInterpretation] = useState(false);
  const [fieldNavigationRequestId, setFieldNavigationRequestId] = useState(0);
  const [hoveredFieldTriggerId, setHoveredFieldTriggerId] = useState<string | null>(null);
  const [hoveredCriticalTriggerId, setHoveredCriticalTriggerId] = useState<string | null>(null);
  const lastExtractionDebugDocIdRef = useRef<string | null>(null);
  const lastConfidencePolicyDocIdRef = useRef<string | null>(null);
  const loggedExtractionDebugEventKeysRef = useRef<Set<string>>(new Set());
  const loggedConfidencePolicyDiagnosticsRef = useRef<Set<string>>(new Set());
  const loggedConfidencePolicyDebugRef = useRef<Set<string>>(new Set());
  const pendingAutoOpenDocumentIdRef = useRef<string | null>(null);
  const autoOpenRetryCountRef = useRef<Record<string, number>>({});
  const autoOpenRetryTimerRef = useRef<number | null>(null);
  const refreshFeedbackTimerRef = useRef<number | null>(null);
  const latestLoadRequestIdRef = useRef<string | null>(null);
  const latestRawTextRefreshRef = useRef<string | null>(null);
  const listPollingStartedAtRef = useRef<number | null>(null);
  const interpretationRetryMinTimerRef = useRef<number | null>(null);
  const lastConnectivityToastAtRef = useRef(0);
  const queryClient = useQueryClient();
  const effectiveViewMode = "browse";
  const isReviewMode = false;
  const isBrowseMode = true;
  const downloadUrl = useMemo(() => {
    if (!activeId) {
      return null;
    }
    return `${API_BASE_URL}/documents/${activeId}/download?download=true`;
  }, [activeId]);
  useEffect(() => {
    return () => {
      if (autoOpenRetryTimerRef.current) {
        window.clearTimeout(autoOpenRetryTimerRef.current);
      }
      if (refreshFeedbackTimerRef.current) {
        window.clearTimeout(refreshFeedbackTimerRef.current);
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
      queryClient.setQueryData<DocumentListResponse | undefined>(
        ["documents", "list"],
        (current) => {
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
        },
      );
      setActiveViewerTab("document");
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
  const {
    fileInputRef,
    uploadPanelRef,
    isDragOverViewer,
    isDragOverSidebarUpload,
    sidebarUploadDragDepthRef,
    handleViewerDragEnter,
    handleViewerDragOver,
    handleViewerDragLeave,
    handleViewerDrop,
    handleSidebarUploadDragEnter,
    handleSidebarUploadDragOver,
    handleSidebarUploadDragLeave,
    handleSidebarUploadDrop: handleSidebarUploadDropInternal,
    handleOpenUploadArea,
    handleSidebarFileInputChange,
  } = useUploadState({
    isUploadPending: uploadMutation.isPending,
    maxUploadSizeBytes: MAX_UPLOAD_SIZE_BYTES,
    onQueueUpload: (file) => uploadMutation.mutate(file),
    onSetUploadFeedback: setUploadFeedback,
  });
  const {
    isDesktopForPin,
    isDocsSidebarPinned,
    shouldUseHoverDocsSidebar,
    shouldAutoCollapseDocsSidebar,
    isDocsSidebarExpanded,
    setIsDocsSidebarHovered,
    handleDocsSidebarMouseEnter,
    handleDocsSidebarMouseLeave,
    handleToggleDocsSidebarPin,
    notifySidebarUploadDrop,
  } = useDocumentsSidebar({
    activeId,
    isDragOverSidebarUpload,
    sidebarUploadDragDepthRef,
  });
  const handleSidebarUploadDrop = useCallback(
    (event: Parameters<typeof handleSidebarUploadDropInternal>[0]) => {
      notifySidebarUploadDrop();
      handleSidebarUploadDropInternal(event);
    },
    [handleSidebarUploadDropInternal, notifySidebarUploadDrop],
  );
  const {
    reviewSplitLayoutStyle,
    handleReviewSplitGridRef,
    resetReviewSplitRatio,
    startReviewSplitDragging,
    handleReviewSplitKeyboard,
  } = useReviewSplitPanel({
    isDocsSidebarExpanded,
    isDocsSidebarPinned,
    shouldAutoCollapseDocsSidebar,
  });
  const sourcePanel = useSourcePanelState({
    isDesktopForPin,
    onNotice: setEvidenceNotice,
  });
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
  const resetSourcePanel = sourcePanel.reset;
  useEffect(() => {
    setSelectedFieldId(null);
    setFieldNavigationRequestId(0);
    setEvidenceNotice(null);
    setExpandedFieldValues({});
    resetSourcePanel();
  }, [activeId, resetSourcePanel]);
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
  const documentListItems = useMemo(
    () => documentList.data?.items ?? [],
    [documentList.data?.items],
  );
  const refetchDocumentList = documentList.refetch;
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
      refetchDocumentList();
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [refetchDocumentList, documentListItems]);
  useEffect(() => {
    if (documentList.status !== "success") {
      return;
    }
    if (sortedDocuments.length === 0) {
      setIsDocsSidebarHovered(false);
    }
  }, [documentList.status, setIsDocsSidebarHovered, sortedDocuments.length]);
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
      queryClient.setQueryData<DocumentListResponse | undefined>(
        ["documents", "list"],
        (current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            items: current.items.map((item) =>
              item.document_id === docId ? { ...item, status: "PROCESSING" } : item,
            ),
          };
        },
      );
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
        },
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
        },
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
      queryClient.setQueryData<DocumentListResponse | undefined>(
        ["documents", "list"],
        (current) => {
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
                : item,
            ),
          };
        },
      );
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
        },
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
        },
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
        },
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
  const panelHeightClass = "h-[clamp(720px,88vh,980px)]";
  const toggleStepDetails = (key: string) => {
    setExpandedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const latestState = documentDetails.data?.latest_run?.state;
  const latestRunId = documentDetails.data?.latest_run?.run_id;
  const activeListDocument = useMemo(
    () =>
      activeId
        ? (documentList.data?.items ?? []).find((item) => item.document_id === activeId)
        : null,
    [activeId, documentList.data?.items],
  );
  const activeReviewStatus =
    documentDetails.data?.review_status ?? activeListDocument?.review_status ?? "IN_REVIEW";
  const isDocumentReviewed = activeReviewStatus === "REVIEWED";
  const isActiveListProcessing = Boolean(
    activeListDocument && isDocumentProcessing(activeListDocument.status),
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
    if (
      !activeId ||
      !documentReview.isError ||
      !isConnectivityOrServerError(documentReview.error)
    ) {
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
    return getUserErrorMessage(rawTextQuery.error, "No se pudo cargar el texto extraído.");
  })();
  const interpretationData = documentReview.data?.active_interpretation.data;
  const schemaContract =
    typeof interpretationData?.schema_contract === "string"
      ? interpretationData.schema_contract.trim().toLowerCase()
      : null;
  const hasCanonicalContractSignal = schemaContract === "visit-grouped-canonical";
  const isCanonicalContract = hasCanonicalContractSignal;
  const hasMalformedCanonicalFieldSlots = useMemo(() => {
    if (!isCanonicalContract) {
      return false;
    }
    return !Array.isArray(interpretationData?.medical_record_view?.field_slots);
  }, [interpretationData?.medical_record_view?.field_slots, isCanonicalContract]);
  const reviewVisits = useMemo(
    () =>
      isCanonicalContract
        ? (interpretationData?.visits ?? []).filter((visit): visit is ReviewVisitGroup =>
            Boolean(visit && typeof visit === "object"),
          )
        : [],
    [interpretationData?.visits, isCanonicalContract],
  );
  const hasVisitGroups = reviewVisits.length > 0;
  const hasUnassignedVisitGroup = reviewVisits.some(
    (visit) => visit.visit_id.trim().toLowerCase() === "unassigned",
  );
  const extractedReviewFields = useMemo(() => {
    const baseFields = interpretationData?.fields ?? [];
    if (!isCanonicalContract) {
      return baseFields;
    }
    const flattenedVisitFields = reviewVisits.flatMap((visit, visitIndex) => {
      const normalizedVisitId = getNormalizedVisitId(visit, visitIndex);
      const metadataFields: ReviewField[] = [
        {
          field_id: `visit-meta-date:${normalizedVisitId}`,
          key: "visit_date",
          value: visit.visit_date,
          value_type: "date",
          visit_group_id: normalizedVisitId,
          scope: "visit",
          section: "visits",
          classification: "medical_record",
          domain: "clinical",
          is_critical: true,
          origin: "machine",
        },
        {
          field_id: `visit-meta-admission:${normalizedVisitId}`,
          key: "admission_date",
          value: visit.admission_date ?? null,
          value_type: "date",
          visit_group_id: normalizedVisitId,
          scope: "visit",
          section: "visits",
          classification: "medical_record",
          domain: "clinical",
          is_critical: false,
          origin: "machine",
        },
        {
          field_id: `visit-meta-discharge:${normalizedVisitId}`,
          key: "discharge_date",
          value: visit.discharge_date ?? null,
          value_type: "date",
          visit_group_id: normalizedVisitId,
          scope: "visit",
          section: "visits",
          classification: "medical_record",
          domain: "clinical",
          is_critical: false,
          origin: "machine",
        },
        {
          field_id: `visit-meta-reason:${normalizedVisitId}`,
          key: "reason_for_visit",
          value: visit.reason_for_visit ?? null,
          value_type: "string",
          visit_group_id: normalizedVisitId,
          scope: "visit",
          section: "visits",
          classification: "medical_record",
          domain: "clinical",
          is_critical: false,
          origin: "machine",
        },
      ];
      const scopedFields = (visit.fields ?? []).map((field, fieldIndex) => ({
        ...field,
        field_id: field.field_id || `visit-field:${normalizedVisitId}:${field.key}:${fieldIndex}`,
        visit_group_id: normalizedVisitId,
        scope: "visit" as const,
        section: field.section ?? "visits",
      }));
      return [...metadataFields, ...scopedFields];
    });
    return [...baseFields, ...flattenedVisitFields];
  }, [interpretationData?.fields, isCanonicalContract, reviewVisits]);
  const explicitOtherReviewFields = useMemo(() => {
    if (!isCanonicalContract) {
      return [] as ReviewField[];
    }
    return (interpretationData?.other_fields ?? [])
      .filter((field) => !BILLING_REVIEW_FIELDS.has(field.key))
      .map((field, index) => ({
        ...field,
        field_id: field.field_id || `other-field:${field.key}:${index}`,
        classification: field.classification ?? "other",
        section: field.section ?? "other",
      }));
  }, [interpretationData, isCanonicalContract]);
  const documentConfidencePolicy = useMemo(
    () =>
      resolveConfidencePolicy(documentReview.data?.active_interpretation.data.confidence_policy),
    [documentReview.data?.active_interpretation.data.confidence_policy],
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
    GLOBAL_SCHEMA.forEach((definition) => {
      if ((fieldsByKey.get(definition.key) ?? 0) > 0) {
        return;
      }
      if (HIDDEN_REVIEW_FIELDS.has(definition.key)) {
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
  }, [confidencePolicyDegradedReason, documentReview.data?.active_interpretation.data.document_id]);
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
  }, [confidencePolicyDegradedReason, documentReview.data?.active_interpretation.data]);
  useEffect(() => {
    if (!isCanonicalContract || !shouldEmitVisitGroupingDiagnostics(import.meta.env)) {
      return;
    }
    const diagnostics = buildVisitGroupingDiagnostics(reviewVisits);
    console.info("[visit-grouping][diagnostic]", {
      document_id: interpretationData?.document_id ?? null,
      ...diagnostics,
    });
  }, [interpretationData?.document_id, isCanonicalContract, reviewVisits]);
  const validatedReviewFields = validationResult.acceptedFields.filter((field) => {
    if (isCanonicalContract) {
      return !BILLING_REVIEW_FIELDS.has(field.key);
    }
    return !HIDDEN_REVIEW_FIELDS.has(field.key);
  });
  const buildSelectableField = useCallback(
    (
      base: Omit<
        ReviewSelectableField,
        "hasMappingConfidence" | "confidence" | "confidenceBand" | "isMissing" | "rawField"
      >,
      rawField: ReviewField | undefined,
      isMissing: boolean,
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
        visitGroupId: rawField?.visit_group_id,
      };
    },
    [activeConfidencePolicy],
  );
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
    let coreDefinitions: Array<{
      key: string;
      label: string;
      section: string;
      order: number;
      value_type: string;
      repeatable: boolean;
      critical: boolean;
      aliases?: string[];
    }> = [];
    if (isCanonicalContract) {
      if (hasMalformedCanonicalFieldSlots) {
        return [];
      }
      const rawFieldSlots = interpretationData?.medical_record_view?.field_slots;
      const fieldSlots = Array.isArray(rawFieldSlots) ? rawFieldSlots : [];
      const documentSlots = fieldSlots.filter(
        (slot) => slot.scope === "document" && !BILLING_REVIEW_FIELDS.has(slot.canonical_key),
      );
      const schemaCriticalByKey = new Map(
        GLOBAL_SCHEMA.map((definition) => [definition.key, Boolean(definition.critical)]),
      );
      const sectionOrderIndex = new Map<string, number>(
        MEDICAL_RECORD_SECTION_ID_ORDER.map((sectionId, index) => [sectionId, index]),
      );
      const slotDefinitions = documentSlots.map((slot, index) => {
        const sectionLabel =
          getUiSectionLabelFromSectionId(slot.section) ?? REPORT_INFO_SECTION_TITLE;
        const sectionIndex =
          sectionOrderIndex.get(slot.section) ?? MEDICAL_RECORD_SECTION_ID_ORDER.length;
        const slotKeys = [slot.canonical_key, ...(slot.aliases ?? [])];
        const criticalFromSchema = slotKeys.some((key) => schemaCriticalByKey.get(key));
        const criticalFromFields = validatedReviewFields.some(
          (field) => slotKeys.includes(field.key) && Boolean(field.is_critical),
        );
        const isCriticalSlot =
          CRITICAL_GLOBAL_SCHEMA_KEYS.has(slot.canonical_key) ||
          Boolean(slot.aliases?.some((alias) => CRITICAL_GLOBAL_SCHEMA_KEYS.has(alias)));
        return {
          key: slot.canonical_key,
          label: formatReviewKeyLabel(slot.canonical_key),
          section: sectionLabel,
          order: sectionIndex * 1000 + index,
          value_type: "string",
          repeatable: false,
          critical: criticalFromSchema || criticalFromFields || isCriticalSlot,
          aliases: slot.aliases,
        };
      });
      const visitDefinitions: Array<{
        key: string;
        label: string;
        section: string;
        order: number;
        value_type: string;
        repeatable: boolean;
        critical: boolean;
      }> = [];
      const seenVisitKeys = new Set<string>();
      validatedReviewFields
        .filter((field) => field.scope === "visit" && field.classification !== "other")
        .forEach((field) => {
          if (seenVisitKeys.has(field.key)) {
            return;
          }
          seenVisitKeys.add(field.key);
          visitDefinitions.push({
            key: field.key,
            label: formatReviewKeyLabel(field.key),
            section: "Visitas",
            order: 3000 + visitDefinitions.length,
            value_type: field.value_type,
            repeatable: true,
            critical: Boolean(field.is_critical),
          });
        });
      coreDefinitions = [...slotDefinitions, ...visitDefinitions];
    } else {
      const templateDefinitions = GLOBAL_SCHEMA.filter(
        (definition) => !HIDDEN_REVIEW_FIELDS.has(definition.key),
      );
      const dynamicMedicalRecordDefinitions = validatedReviewFields
        .filter((field) => {
          if (field.classification === "other") {
            return false;
          }
          if (HIDDEN_REVIEW_FIELDS.has(field.key)) {
            return false;
          }
          return !templateDefinitions.some((definition) => definition.key === field.key);
        })
        .map((field, index) => ({
          key: field.key,
          label: formatReviewKeyLabel(field.key),
          section: resolveUiSection(field, REPORT_INFO_SECTION_TITLE),
          order: 10_000 + index,
          value_type: field.value_type,
          repeatable: false,
          critical: Boolean(field.is_critical),
        }));
      coreDefinitions = [...templateDefinitions, ...dynamicMedicalRecordDefinitions];
    }
    return coreDefinitions
      .map((definition): ReviewDisplayField => {
        const uiSection =
          "section" in definition && typeof definition.section === "string"
            ? resolveUiSection(
                { key: definition.key, section: definition.section },
                definition.section,
              )
            : REPORT_INFO_SECTION_TITLE;
        const uiLabel = FIELD_LABELS[definition.key] ?? definition.label;
        const labelTooltip = getLabelTooltipText(definition.key);
        let candidates = matchesByKey.get(definition.key) ?? [];
        if (isCanonicalContract && definition.aliases && definition.aliases.length > 0) {
          const aliasCandidates = definition.aliases.flatMap(
            (alias) => matchesByKey.get(alias) ?? [],
          );
          candidates = [...candidates, ...aliasCandidates];
        }
        if (definition.repeatable) {
          const items = candidates
            .filter((candidate) => !isFieldValueEmpty(candidate.value))
            .map(
              (candidate, index): ReviewSelectableField =>
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
                  false,
                ),
            );
          return {
            id: `core:${definition.key}`,
            key: definition.key,
            label: uiLabel,
            labelTooltip,
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
              clampConfidence(resolveMappingConfidence(a) ?? -1),
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
          !bestCandidate,
        );
        return {
          id: `core:${definition.key}`,
          key: definition.key,
          label: uiLabel,
          labelTooltip,
          section: uiSection,
          order: definition.order,
          isCritical: definition.critical,
          valueType: definition.value_type,
          repeatable: false,
          items: [item],
          isEmptyList: false,
          source: "core",
        };
      })
      .sort((a, b) => a.order - b.order);
  }, [
    buildSelectableField,
    hasMalformedCanonicalFieldSlots,
    interpretationData?.medical_record_view?.field_slots,
    isCanonicalContract,
    matchesByKey,
    validatedReviewFields,
  ]);
  const otherDisplayFields = useMemo(() => {
    const coreKeys = new Set(GLOBAL_SCHEMA.map((field) => field.key));
    const grouped = new Map<string, ReviewField[]>();
    const orderedKeys: string[] = [];
    const sourceFields = isCanonicalContract ? explicitOtherReviewFields : validatedReviewFields;
    sourceFields.forEach((field) => {
      if (!isCanonicalContract && coreKeys.has(field.key)) {
        return;
      }
      if (isCanonicalContract && field.classification !== "other") {
        return;
      }
      if (!isCanonicalContract && shouldHideExtractedField(field.key)) {
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
          .map(
            (field, itemIndex): ReviewSelectableField =>
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
                false,
              ),
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
        !hasValue,
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
  }, [buildSelectableField, explicitOtherReviewFields, isCanonicalContract, validatedReviewFields]);
  const groupedCoreFields = useMemo(() => {
    const groups = new Map<string, ReviewDisplayField[]>();
    coreDisplayFields.forEach((field) => {
      const current = groups.get(field.section) ?? [];
      current.push(field);
      groups.set(field.section, current);
    });
    return MEDICAL_RECORD_SECTION_ORDER.filter(
      (section) => section !== OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
    ).map((section) => ({
      section,
      fields: (groups.get(section) ?? []).sort((a, b) => a.order - b.order),
    }));
  }, [coreDisplayFields]);
  const canonicalVisitFieldOrder = useMemo(() => {
    const fallbackOrder = [...CANONICAL_VISIT_METADATA_KEYS, ...CANONICAL_VISIT_SCOPED_FIELD_KEYS];
    if (!isCanonicalContract || hasMalformedCanonicalFieldSlots) {
      return fallbackOrder;
    }
    const rawSlots = interpretationData?.medical_record_view?.field_slots;
    const slots = Array.isArray(rawSlots) ? rawSlots : [];
    const orderedKeys: string[] = [];
    slots.forEach((slot) => {
      if (slot.scope !== "visit") {
        return;
      }
      const canonicalKey = slot.canonical_key;
      if (!canonicalKey || BILLING_REVIEW_FIELDS.has(canonicalKey)) {
        return;
      }
      if (!orderedKeys.includes(canonicalKey)) {
        orderedKeys.push(canonicalKey);
      }
    });
    fallbackOrder.forEach((key) => {
      if (!orderedKeys.includes(key)) {
        orderedKeys.push(key);
      }
    });
    return orderedKeys;
  }, [
    hasMalformedCanonicalFieldSlots,
    interpretationData?.medical_record_view?.field_slots,
    isCanonicalContract,
  ]);
  const {
    structuredSearchInput,
    setStructuredSearchInput,
    selectedConfidenceBuckets,
    setSelectedConfidenceBuckets,
    showOnlyCritical,
    setShowOnlyCritical,
    showOnlyWithValue,
    setShowOnlyWithValue,
    showOnlyEmpty,
    setShowOnlyEmpty,
    structuredSearchInputRef,
    structuredDataFilters,
    hasActiveStructuredFilters,
    resetStructuredFilters,
    getFilterToggleItemClass,
  } = useStructuredDataFilters({ activeConfidencePolicy });
  const visibleCoreGroups = useMemo(() => {
    if (!hasActiveStructuredFilters) {
      return groupedCoreFields;
    }
    return groupedCoreFields
      .map((group) => ({
        section: group.section,
        fields: group.fields.filter((field) =>
          matchesStructuredDataFilters(field, structuredDataFilters),
        ),
      }))
      .filter((group) => group.fields.length > 0);
  }, [groupedCoreFields, hasActiveStructuredFilters, structuredDataFilters]);
  const visibleOtherDisplayFields = useMemo(
    () => (hasActiveStructuredFilters ? [] : otherDisplayFields),
    [hasActiveStructuredFilters, otherDisplayFields],
  );
  const visibleCoreFields = useMemo(
    () => visibleCoreGroups.flatMap((group) => group.fields),
    [visibleCoreGroups],
  );
  const reportSections = useMemo(() => {
    const coreSections = visibleCoreGroups.map((group) => ({
      id: `core:${group.section}`,
      title: group.section,
      fields: group.fields,
    }));
    if (hasActiveStructuredFilters) {
      return coreSections;
    }
    const extraSection = {
      id: "extra:section",
      title: OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
      fields: visibleOtherDisplayFields,
    };
    const infoIndex = coreSections.findIndex(
      (section) => section.title === REPORT_INFO_SECTION_TITLE,
    );
    if (infoIndex < 0) {
      return [...coreSections, extraSection];
    }
    return [...coreSections.slice(0, infoIndex), extraSection, ...coreSections.slice(infoIndex)];
  }, [hasActiveStructuredFilters, visibleCoreGroups, visibleOtherDisplayFields]);
  const selectableReviewItems = useMemo(
    () => [...visibleCoreFields, ...visibleOtherDisplayFields].flatMap((field) => field.items),
    [visibleCoreFields, visibleOtherDisplayFields],
  );
  const selectedReviewField = useMemo(() => {
    if (!selectedFieldId) {
      return null;
    }
    return selectableReviewItems.find((field) => field.id === selectedFieldId) ?? null;
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
  const reviewPanelMessage = getReviewPanelMessage(reviewPanelState);
  const shouldShowReviewEmptyState =
    reviewPanelState !== "loading" && reviewPanelState !== "ready" && Boolean(reviewPanelMessage);
  const hasNoStructuredFilterResults =
    reviewPanelState === "ready" && hasActiveStructuredFilters && visibleCoreGroups.length === 0;
  const reviewMessageInfoClass = REVIEW_MESSAGE_INFO_CLASS;
  const reviewMessageMutedClass = REVIEW_MESSAGE_MUTED_CLASS;
  const reviewMessageWarningClass = REVIEW_MESSAGE_WARNING_CLASS;
  const detectedFieldsSummary = useMemo(() => {
    const summarizeConfidenceBands = () => {
      let low = 0;
      let medium = 0;
      let high = 0;
      let unknown = 0;
      if (!activeConfidencePolicy) {
        return { low, medium, high, unknown: 0 };
      }
      coreDisplayFields.forEach((field) => {
        const presentItems = field.items.filter((item) => !item.isMissing);
        if (presentItems.length === 0) {
          return;
        }
        if (presentItems.some((item) => item.confidenceBand === "low")) {
          low += 1;
          return;
        }
        if (presentItems.some((item) => item.confidenceBand === "medium")) {
          medium += 1;
          return;
        }
        if (presentItems.some((item) => item.confidenceBand === "high")) {
          high += 1;
          return;
        }
        unknown += 1;
      });
      return { low, medium, high, unknown };
    };
    if (isCanonicalContract) {
      const topLevelFields = (interpretationData?.fields ?? []).filter(
        (field): field is ReviewField => Boolean(field && typeof field === "object"),
      );
      const visits = reviewVisits;
      const confidenceCutoffs = activeConfidencePolicy?.band_cutoffs;
      let detected = 0;
      let low = 0;
      let medium = 0;
      let high = 0;
      let unknown = 0;
      const addDetectedConceptFromFields = (
        fields: ReviewField[],
        candidateKeys: readonly string[],
      ) => {
        const matchingWithValue = fields.filter(
          (field) => candidateKeys.includes(field.key) && !isFieldValueEmpty(field.value),
        );
        if (matchingWithValue.length === 0) {
          return;
        }
        detected += 1;
        if (!confidenceCutoffs) {
          unknown += 1;
          return;
        }
        const bestConfidence = matchingWithValue.reduce<number | null>((currentBest, field) => {
          const confidence = resolveMappingConfidence(field);
          if (confidence === null) {
            return currentBest;
          }
          if (currentBest === null || confidence > currentBest) {
            return confidence;
          }
          return currentBest;
        }, null);
        if (bestConfidence === null) {
          unknown += 1;
          return;
        }
        const tone = getConfidenceTone(bestConfidence, confidenceCutoffs);
        if (tone === "low") {
          low += 1;
          return;
        }
        if (tone === "med") {
          medium += 1;
          return;
        }
        high += 1;
      };
      CANONICAL_DOCUMENT_CONCEPTS.forEach((concept) => {
        const aliases = "aliases" in concept ? (concept.aliases ?? []) : [];
        addDetectedConceptFromFields(
          topLevelFields.filter(
            (field) => field.scope !== "visit" && !BILLING_REVIEW_FIELDS.has(field.key),
          ),
          [concept.canonicalKey, ...aliases],
        );
      });
      CANONICAL_VISIT_SCOPED_FIELD_KEYS.forEach((key) => {
        const visitFieldsForKey = visits.flatMap((visit) =>
          (visit.fields ?? []).filter(
            (field): field is ReviewField =>
              Boolean(field && typeof field === "object") && !BILLING_REVIEW_FIELDS.has(field.key),
          ),
        );
        addDetectedConceptFromFields(visitFieldsForKey, [key]);
      });
      CANONICAL_VISIT_METADATA_KEYS.forEach((key) => {
        const hasValue = visits.some((visit) => !isFieldValueEmpty(visit[key]));
        if (!hasValue) {
          return;
        }
        detected += 1;
        unknown += 1;
      });
      return {
        detected,
        total:
          CANONICAL_DOCUMENT_CONCEPTS.length +
          CANONICAL_VISIT_SCOPED_FIELD_KEYS.length +
          CANONICAL_VISIT_METADATA_KEYS.length,
        low,
        medium,
        high,
        unknown,
      };
    }
    let detected = 0;
    const total = GLOBAL_SCHEMA.length;
    const confidenceBands = summarizeConfidenceBands();
    if (!activeConfidencePolicy) {
      return {
        detected,
        total,
        low: confidenceBands.low,
        medium: confidenceBands.medium,
        high: confidenceBands.high,
        unknown: 0,
      };
    }
    coreDisplayFields.forEach((field) => {
      const presentItems = field.items.filter(
        (item) => !item.isMissing && item.confidenceBand !== null,
      );
      if (presentItems.length === 0) {
        return;
      }
      detected += 1;
      if (presentItems.some((item) => item.confidenceBand === "low")) {
        return;
      }
      if (presentItems.some((item) => item.confidenceBand === "medium")) {
        return;
      }
    });
    return {
      detected,
      total,
      low: confidenceBands.low,
      medium: confidenceBands.medium,
      high: confidenceBands.high,
      unknown: 0,
    };
  }, [
    activeConfidencePolicy,
    coreDisplayFields,
    interpretationData?.fields,
    isCanonicalContract,
    reviewVisits,
  ]);
  const shouldShowLoadPdfErrorBanner =
    loadPdf.isError && !isConnectivityOrServerError(loadPdf.error);
  const isPinnedSourcePanelVisible =
    isBrowseMode && sourcePanel.isSourceOpen && sourcePanel.isSourcePinned && isDesktopForPin;
  const isDocumentListConnectivityError =
    documentList.isError && isConnectivityOrServerError(documentList.error);
  const handleSelectReviewItem = useCallback((field: ReviewSelectableField) => {
    setSelectedFieldId(field.id);
    setFieldNavigationRequestId((current) => current + 1);
  }, []);
  const { handleReviewedEditAttempt, handleReviewedKeyboardEditAttempt } = useReviewedEditBlocker({
    isDocumentReviewed,
    onActionFeedback: setActionFeedback,
  });
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
  const { copyFeedback, isCopyingRawText, handleDownloadRawText, handleCopyRawText } =
    useRawTextActions({ rawTextContent: rawTextContent ?? undefined, getUserErrorMessage });
  const { toolbarLeftContent: viewerModeToolbarIcons, toolbarRightExtra: viewerDownloadIcon } =
    buildViewerToolbarContent({
      activeViewerTab,
      onChangeTab: setActiveViewerTab,
      downloadUrl,
    });
  const submitInterpretationChanges = (
    changes: InterpretationChangePayload[],
    successMessage: string,
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
  const {
    editingField,
    editingFieldDraftValue,
    setEditingFieldDraftValue,
    isAddFieldDialogOpen,
    addFieldKeyDraft,
    setAddFieldKeyDraft,
    addFieldValueDraft,
    setAddFieldValueDraft,
    openFieldEditDialog,
    closeFieldEditDialog,
    saveFieldEditDialog,
    closeAddFieldDialog,
    saveAddFieldDialog,
    editingFieldCandidateSections,
    isEditingMicrochipField,
    isEditingMicrochipInvalid,
    isEditingWeightField,
    isEditingWeightInvalid,
    isEditingAgeField,
    isEditingAgeInvalid,
    isEditingDateField,
    isEditingDateInvalid,
    isEditingSexField,
    isEditingSexInvalid,
    isEditingSpeciesField,
    isEditingSpeciesInvalid,
  } = useFieldEditing({
    onSubmitInterpretationChanges: submitInterpretationChanges,
    onActionFeedback: setActionFeedback,
  });
  const { renderScalarReviewField, renderRepeatableReviewField } = useMemo(
    () =>
      createReviewFieldRenderers({
        activeConfidencePolicy,
        isDocumentReviewed,
        isInterpretationEditPending: interpretationEditMutation.isPending,
        selectedFieldId,
        expandedFieldValues,
        hoveredFieldTriggerId,
        hoveredCriticalTriggerId,
        hasUnassignedVisitGroup,
        onOpenFieldEditDialog: openFieldEditDialog,
        onSelectReviewItem: handleSelectReviewItem,
        onReviewedEditAttempt: handleReviewedEditAttempt,
        onReviewedKeyboardEditAttempt: handleReviewedKeyboardEditAttempt,
        onSetExpandedFieldValues: setExpandedFieldValues,
        onSetHoveredFieldTriggerId: setHoveredFieldTriggerId,
        onSetHoveredCriticalTriggerId: setHoveredCriticalTriggerId,
      }),
    [
      activeConfidencePolicy,
      isDocumentReviewed,
      interpretationEditMutation.isPending,
      selectedFieldId,
      expandedFieldValues,
      hoveredFieldTriggerId,
      hoveredCriticalTriggerId,
      hasUnassignedVisitGroup,
      openFieldEditDialog,
      handleSelectReviewItem,
      handleReviewedEditAttempt,
      handleReviewedKeyboardEditAttempt,
    ],
  );
  const renderSectionLayout = useMemo(
    () =>
      createReviewSectionLayoutRenderer({
        isCanonicalContract,
        hasVisitGroups,
        validatedReviewFields,
        reviewVisits,
        canonicalVisitFieldOrder,
        buildSelectableField,
        renderScalarReviewField,
        renderRepeatableReviewField,
      }),
    [
      isCanonicalContract,
      hasVisitGroups,
      validatedReviewFields,
      reviewVisits,
      canonicalVisitFieldOrder,
      buildSelectableField,
      renderScalarReviewField,
      renderRepeatableReviewField,
    ],
  );
  const sourcePanelContent = (
    <SourcePanelContent
      sourcePage={sourcePanel.sourcePage}
      sourceSnippet={sourcePanel.sourceSnippet}
      isSourcePinned={sourcePanel.isSourcePinned}
      isDesktopForPin={isDesktopForPin}
      onTogglePin={sourcePanel.togglePin}
      onClose={sourcePanel.closeOverlay}
      fileUrl={fileUrl}
      activeId={activeId}
      filename={filename}
      focusRequestId={sourcePanel.focusRequestId}
    />
  );
  return (
    <div className="min-h-screen bg-page px-4 py-3 md:px-6 lg:px-8 xl:px-10">
      <WorkspaceDialogs
        isInterpretationEditPending={interpretationEditMutation.isPending}
        isAddFieldDialogOpen={isAddFieldDialogOpen}
        addFieldKeyDraft={addFieldKeyDraft}
        addFieldValueDraft={addFieldValueDraft}
        onFieldKeyChange={setAddFieldKeyDraft}
        onFieldValueChange={setAddFieldValueDraft}
        onCloseAddFieldDialog={closeAddFieldDialog}
        onSaveAddFieldDialog={saveAddFieldDialog}
        editingField={editingField}
        editingFieldDraftValue={editingFieldDraftValue}
        onEditingFieldDraftValueChange={setEditingFieldDraftValue}
        editingFieldCandidateSections={editingFieldCandidateSections}
        isEditingMicrochipField={isEditingMicrochipField}
        isEditingMicrochipInvalid={isEditingMicrochipInvalid}
        isEditingWeightField={isEditingWeightField}
        isEditingWeightInvalid={isEditingWeightInvalid}
        isEditingAgeField={isEditingAgeField}
        isEditingAgeInvalid={isEditingAgeInvalid}
        isEditingDateField={isEditingDateField}
        isEditingDateInvalid={isEditingDateInvalid}
        isEditingSexField={isEditingSexField}
        isEditingSexInvalid={isEditingSexInvalid}
        isEditingSpeciesField={isEditingSpeciesField}
        isEditingSpeciesInvalid={isEditingSpeciesInvalid}
        onCloseFieldEditDialog={closeFieldEditDialog}
        onSaveFieldEditDialog={saveFieldEditDialog}
      />
      <div
        className="mx-auto w-full max-w-[1640px] rounded-frame bg-canvas p-[var(--canvas-gap)]"
        data-testid="canvas-wrapper"
      >
        <main className="relative w-full">
          <div
            className="relative z-20 flex gap-[var(--canvas-gap)]"
            data-testid="main-canvas-layout"
          >
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
                  {getUserErrorMessage(
                    loadPdf.error,
                    "No se pudo cargar la vista previa del documento.",
                  )}
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
                            className="relative flex h-full flex-col rounded-card bg-surfaceMuted p-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            role="button"
                            aria-label="Cargar documento"
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
                                ? "grid grid-cols-[minmax(0,1fr)_minmax(320px,400px)] gap-4"
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
                                  <h3 className="text-lg font-semibold text-textSecondary">
                                    Informe
                                  </h3>
                                  <p className="mt-0.5 text-xs text-textSecondary">
                                    Consulta el documento y navega por la evidencia asociada.
                                  </p>
                                </div>
                                {fileUrl ? (
                                  <PdfViewer
                                    key={`${effectiveViewMode}-${activeId ?? "empty"}`}
                                    documentId={activeId}
                                    fileUrl={fileUrl}
                                    filename={filename}
                                    isDragOver={isDragOverViewer}
                                    focusPage={selectedReviewField?.evidence?.page ?? null}
                                    highlightSnippet={
                                      selectedReviewField?.evidence?.snippet ?? null
                                    }
                                    focusRequestId={fieldNavigationRequestId}
                                    toolbarLeftContent={viewerModeToolbarIcons}
                                    toolbarRightExtra={viewerDownloadIcon}
                                  />
                                ) : (
                                  <div className="flex h-full min-h-0 flex-col">
                                    <div className="relative z-20 flex items-center justify-between gap-4 pb-3">
                                      <div className="flex items-center gap-1">
                                        {viewerModeToolbarIcons}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {viewerDownloadIcon}
                                      </div>
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
                                <div className="flex w-full flex-wrap items-center justify-between gap-3">
                                  <div className="min-w-[220px]">
                                    <h3 className="text-lg font-semibold text-textSecondary">
                                      Datos extraídos
                                    </h3>
                                    <p className="mt-0.5 text-xs text-textSecondary">
                                      Revisa y confirma los campos antes de marcar el documento como
                                      revisado.
                                    </p>
                                  </div>
                                  <Tooltip
                                    content={
                                      isDocumentReviewed
                                        ? "Reabre el documento para continuar la revisión. Puedes volver a marcarlo como revisado cuando termines."
                                        : "Marca este documento como revisado cuando confirmes los datos. Si lo necesitas, luego puedes reabrirlo sin problema."
                                    }
                                  >
                                    <span className="inline-flex">
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
                                            <RefreshCw
                                              size={14}
                                              className="animate-spin"
                                              aria-hidden="true"
                                            />
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
                                    </span>
                                  </Tooltip>
                                </div>
                                <div
                                  data-testid="structured-search-shell"
                                  className="panel-shell px-3 py-2"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <label className="relative min-w-[220px] flex-1">
                                      <Search
                                        size={14}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary"
                                        aria-hidden="true"
                                      />
                                      <Input
                                        ref={structuredSearchInputRef}
                                        type="text"
                                        aria-label="Buscar en datos extraídos"
                                        value={structuredSearchInput}
                                        disabled={reviewPanelState !== "ready"}
                                        onChange={(event) =>
                                          setStructuredSearchInput(event.target.value)
                                        }
                                        placeholder="Buscar campo, clave o valor"
                                        className="w-full rounded-control border border-borderSubtle bg-surface py-1.5 pl-9 pr-9 text-xs"
                                      />
                                      {structuredSearchInput.trim().length > 0 && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                          <IconButton
                                            label="Limpiar búsqueda"
                                            tooltip="Limpiar búsqueda"
                                            className="border-0 bg-transparent shadow-none hover:bg-transparent"
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
                                    <ToggleGroup
                                      type="multiple"
                                      value={selectedConfidenceBuckets}
                                      disabled={
                                        reviewPanelState !== "ready" || !activeConfidencePolicy
                                      }
                                      onValueChange={(values) =>
                                        setSelectedConfidenceBuckets(
                                          values.filter(
                                            (value): value is ConfidenceBucket =>
                                              value === "low" ||
                                              value === "medium" ||
                                              value === "high" ||
                                              value === "unknown",
                                          ),
                                        )
                                      }
                                      aria-label="Filtros de confianza"
                                      className="p-0"
                                    >
                                      <Tooltip content="Valor detectado con baja fiabilidad.">
                                        <ToggleGroupItem
                                          value="low"
                                          aria-label={`Baja (${detectedFieldsSummary.low})`}
                                          className={`h-7 rounded-control border-0 px-2.5 text-xs shadow-none ${
                                            selectedConfidenceBuckets.includes("low")
                                              ? "bg-surfaceMuted text-text ring-1 ring-borderSubtle"
                                              : "bg-surface text-textSecondary"
                                          }`}
                                        >
                                          <span className="inline-flex items-center gap-1.5">
                                            <span
                                              aria-hidden="true"
                                              className="inline-block h-3 w-3 shrink-0 rounded-full bg-confidenceLow"
                                            />
                                            <span className="tabular-nums">
                                              {detectedFieldsSummary.low}
                                            </span>
                                          </span>
                                        </ToggleGroupItem>
                                      </Tooltip>
                                      <Tooltip content="Valor detectado con fiabilidad media.">
                                        <ToggleGroupItem
                                          value="medium"
                                          aria-label={`Media (${detectedFieldsSummary.medium})`}
                                          className={`h-7 rounded-control border-0 px-2.5 text-xs shadow-none ${
                                            selectedConfidenceBuckets.includes("medium")
                                              ? "bg-surfaceMuted text-text ring-1 ring-borderSubtle"
                                              : "bg-surface text-textSecondary"
                                          }`}
                                        >
                                          <span className="inline-flex items-center gap-1.5">
                                            <span
                                              aria-hidden="true"
                                              className="inline-block h-3 w-3 shrink-0 rounded-full bg-confidenceMed"
                                            />
                                            <span className="tabular-nums">
                                              {detectedFieldsSummary.medium}
                                            </span>
                                          </span>
                                        </ToggleGroupItem>
                                      </Tooltip>
                                      <Tooltip content="Valor detectado con alta fiabilidad.">
                                        <ToggleGroupItem
                                          value="high"
                                          aria-label={`Alta (${detectedFieldsSummary.high})`}
                                          className={`h-7 rounded-control border-0 px-2.5 text-xs shadow-none ${
                                            selectedConfidenceBuckets.includes("high")
                                              ? "bg-surfaceMuted text-text ring-1 ring-borderSubtle"
                                              : "bg-surface text-textSecondary"
                                          }`}
                                        >
                                          <span className="inline-flex items-center gap-1.5">
                                            <span
                                              aria-hidden="true"
                                              className="inline-block h-3 w-3 shrink-0 rounded-full bg-confidenceHigh"
                                            />
                                            <span className="tabular-nums">
                                              {detectedFieldsSummary.high}
                                            </span>
                                          </span>
                                        </ToggleGroupItem>
                                      </Tooltip>
                                      <Tooltip content="Valor presente, sin confianza automática asignada.">
                                        <ToggleGroupItem
                                          value="unknown"
                                          aria-label={`Sin confianza (${detectedFieldsSummary.unknown})`}
                                          className={`h-7 rounded-control border-0 px-2.5 text-xs shadow-none ${
                                            selectedConfidenceBuckets.includes("unknown")
                                              ? "bg-surfaceMuted text-text ring-1 ring-borderSubtle"
                                              : "bg-surface text-textSecondary"
                                          }`}
                                        >
                                          <span className="inline-flex items-center gap-1.5">
                                            <span
                                              aria-hidden="true"
                                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-missing"
                                            />
                                            <span className="tabular-nums">
                                              {detectedFieldsSummary.unknown}
                                            </span>
                                          </span>
                                        </ToggleGroupItem>
                                      </Tooltip>
                                    </ToggleGroup>
                                    <div
                                      aria-hidden="true"
                                      className="mx-1 h-6 w-px shrink-0 self-center bg-border"
                                    />
                                    <ToggleGroup
                                      type="multiple"
                                      value={[
                                        ...(showOnlyCritical ? ["critical"] : []),
                                        ...(showOnlyWithValue ? ["nonEmpty"] : []),
                                        ...(showOnlyEmpty ? ["empty"] : []),
                                      ]}
                                      disabled={reviewPanelState !== "ready"}
                                      onValueChange={(values) => {
                                        const hasNonEmpty = values.includes("nonEmpty");
                                        const hasEmpty = values.includes("empty");
                                        setShowOnlyCritical(values.includes("critical"));
                                        setShowOnlyWithValue(hasNonEmpty && !hasEmpty);
                                        setShowOnlyEmpty(hasEmpty && !hasNonEmpty);
                                      }}
                                      aria-label="Filtros adicionales"
                                      className="p-0"
                                    >
                                      <Tooltip content="Mostrar campos marcados como críticos.">
                                        <ToggleGroupItem
                                          value="critical"
                                          aria-label="Mostrar solo campos críticos"
                                          className={getFilterToggleItemClass(showOnlyCritical)}
                                        >
                                          <CriticalIcon compact />
                                        </ToggleGroupItem>
                                      </Tooltip>
                                      <Tooltip content="Mostrar campos con algún valor.">
                                        <ToggleGroupItem
                                          value="nonEmpty"
                                          aria-label="Mostrar solo campos no vacíos"
                                          className={getFilterToggleItemClass(showOnlyWithValue)}
                                        >
                                          <span
                                            aria-hidden="true"
                                            className="inline-block h-3 w-3 shrink-0 rounded-full bg-text"
                                          />
                                        </ToggleGroupItem>
                                      </Tooltip>
                                      <Tooltip content="Mostrar campos vacíos.">
                                        <ToggleGroupItem
                                          value="empty"
                                          aria-label="Mostrar solo campos vacíos"
                                          className={getFilterToggleItemClass(showOnlyEmpty)}
                                        >
                                          <span
                                            aria-hidden="true"
                                            className="inline-block h-3 w-3 shrink-0 rounded-full border border-muted bg-surface"
                                          />
                                        </ToggleGroupItem>
                                      </Tooltip>
                                    </ToggleGroup>
                                    <div
                                      aria-hidden="true"
                                      className="mx-1 h-6 w-px shrink-0 self-center bg-border"
                                    />
                                    <IconButton
                                      label="Limpiar filtros"
                                      tooltip="Borrar filtros."
                                      className="border-0 bg-transparent shadow-none hover:bg-transparent"
                                      disabled={
                                        reviewPanelState !== "ready" ||
                                        (structuredSearchInput.trim().length === 0 &&
                                          selectedConfidenceBuckets.length === 0 &&
                                          !showOnlyCritical &&
                                          !showOnlyWithValue &&
                                          !showOnlyEmpty)
                                      }
                                      onClick={resetStructuredFilters}
                                    >
                                      <FilterX size={14} aria-hidden="true" />
                                    </IconButton>
                                  </div>
                                </div>
                                {reviewPanelState === "ready" && !activeConfidencePolicy && (
                                  <p
                                    data-testid="confidence-policy-degraded"
                                    className={reviewMessageInfoClass}
                                    role="status"
                                    aria-live="polite"
                                  >
                                    Configuración de confianza no disponible para este documento. La
                                    señal visual de confianza está en modo degradado.
                                  </p>
                                )}
                                <div className="flex-1 min-h-0">
                                  {reviewPanelState === "loading" && (
                                    <div
                                      data-testid="right-panel-scroll"
                                      aria-live="polite"
                                      className="h-full min-h-0 overflow-y-auto pr-1 space-y-2"
                                    >
                                      <p className={reviewMessageInfoClass}>{reviewPanelMessage}</p>
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
                                          <p className="mt-2 text-xs text-textSecondary">
                                            No se pudo cargar la interpretación. Comprueba tu
                                            conexión y vuelve a intentarlo.
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
                                                const remainingMs = Math.max(
                                                  0,
                                                  minVisibleMs - elapsedMs,
                                                );
                                                if (remainingMs === 0) {
                                                  setIsRetryingInterpretation(false);
                                                  return;
                                                }
                                                if (interpretationRetryMinTimerRef.current) {
                                                  window.clearTimeout(
                                                    interpretationRetryMinTimerRef.current,
                                                  );
                                                }
                                                interpretationRetryMinTimerRef.current =
                                                  window.setTimeout(() => {
                                                    interpretationRetryMinTimerRef.current = null;
                                                    setIsRetryingInterpretation(false);
                                                  }, remainingMs);
                                              }}
                                            >
                                              {isRetryingInterpretation
                                                ? "Reintentando..."
                                                : "Reintentar"}
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
                                          <p className={reviewMessageWarningClass}>
                                            Documento marcado como revisado. Los datos están en modo
                                            de solo lectura.
                                          </p>
                                        )}
                                        {hasMalformedCanonicalFieldSlots && (
                                          <p
                                            data-testid="canonical-contract-error"
                                            className="rounded-control border border-statusWarn bg-surface px-3 py-2 text-xs text-text"
                                          >
                                            No se puede renderizar la plantilla canónica:
                                            `medical_record_view.field_slots` es inválido.
                                          </p>
                                        )}
                                        {!hasMalformedCanonicalFieldSlots &&
                                          hasNoStructuredFilterResults && (
                                            <div
                                              className={reviewMessageMutedClass}
                                              role="status"
                                              aria-live="polite"
                                            >
                                              <p>No hay resultados con los filtros actuales.</p>
                                              <div className="mt-2">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="toolbar"
                                                  onClick={resetStructuredFilters}
                                                >
                                                  Limpiar filtros
                                                </Button>
                                              </div>
                                            </div>
                                          )}
                                        {!hasMalformedCanonicalFieldSlots &&
                                          reportSections.map((section) =>
                                            renderSectionLayout(section),
                                          )}
                                      </div>
                                    </ScrollArea>
                                  )}
                                </div>
                                {evidenceNotice && (
                                  <p className={reviewMessageMutedClass}>{evidenceNotice}</p>
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
                    <div className="flex h-full flex-col rounded-card border border-borderSubtle bg-surface p-4">
                      <div className="rounded-control border border-borderSubtle bg-surface px-2 py-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-1">{viewerModeToolbarIcons}</div>
                          <div className="flex items-center gap-1">{viewerDownloadIcon}</div>
                        </div>
                      </div>
                      <div className="rounded-card border border-borderSubtle bg-surface p-3">
                        <div className="flex flex-col gap-2 text-xs text-ink">
                          <span className="text-textSecondary">
                            ¿El texto no es correcto? Puedes reprocesarlo para regenerar la
                            extracción.
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              disabled={
                                !activeId ||
                                isActiveDocumentProcessing ||
                                reprocessMutation.isPending
                              }
                              onClick={() => setShowRetryModal(true)}
                            >
                              {reprocessMutation.isPending ||
                              (Boolean(activeId) &&
                                reprocessingDocumentId === activeId &&
                                (!hasObservedProcessingAfterReprocess ||
                                  isActiveDocumentProcessing))
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
                          className="w-full rounded-control border border-borderSubtle bg-surface px-3 py-2 text-xs text-text outline-none placeholder:text-textSecondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-64"
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
                        <Button
                          type="button"
                          disabled={!canSearchRawText}
                          onClick={handleRawSearch}
                        >
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
                        <Button
                          type="button"
                          disabled={!rawTextContent}
                          onClick={handleDownloadRawText}
                        >
                          Descargar texto (.txt)
                        </Button>
                      </div>
                      {copyFeedback && (
                        <p
                          className="mt-2 text-xs text-textSecondary"
                          role="status"
                          aria-live="polite"
                        >
                          {copyFeedback}
                        </p>
                      )}
                      {hasRawText && rawSearchNotice && (
                        <p className="mt-2 text-xs text-textSecondary">{rawSearchNotice}</p>
                      )}
                      {isRawTextLoading && (
                        <p className="mt-2 text-xs text-textSecondary">
                          Cargando texto extraído...
                        </p>
                      )}
                      {rawTextErrorMessage && (
                        <p className="mt-2 text-xs text-statusError">{rawTextErrorMessage}</p>
                      )}
                      <div className="mt-3 flex-1 overflow-y-auto rounded-card border border-borderSubtle bg-surface p-3 font-mono text-xs text-textSecondary">
                        {rawTextContent ? <pre>{rawTextContent}</pre> : "Sin texto extraído."}
                      </div>
                    </div>
                  )}
                  {activeViewerTab === "technical" && (
                    <div className="h-full overflow-y-auto rounded-card border border-borderSubtle bg-surface p-3">
                      <div className="rounded-control border border-borderSubtle bg-surface px-2 py-2">
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
                          disabled={
                            !activeId || isActiveDocumentProcessing || reprocessMutation.isPending
                          }
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
                          Selecciona un documento para ver los detalles técnicos.
                        </p>
                      )}
                      {activeId && processingHistory.isLoading && (
                        <p className="mt-2 text-xs text-muted">Cargando historial...</p>
                      )}
                      {activeId && processingHistory.isError && (
                        <p className="mt-2 text-xs text-statusError">
                          {getUserErrorMessage(
                            processingHistory.error,
                            "No se pudo cargar el historial de procesamiento.",
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
                                className="rounded-card border border-borderSubtle bg-surface p-2"
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
                                    <p className="text-xs text-muted">Sin pasos registrados.</p>
                                  )}
                                  {run.steps.length > 0 &&
                                    groupProcessingSteps(run.steps).map((step, index) => {
                                      const stepKey = `${run.run_id}-${step.step_name}-${step.attempt}-${index}`;
                                      const duration = formatDuration(
                                        step.start_time,
                                        step.end_time,
                                      );
                                      const startTime = formatTime(step.start_time);
                                      const endTime = formatTime(step.end_time);
                                      const timeRange =
                                        startTime && endTime
                                          ? `${startTime} \u2192 ${endTime}`
                                          : (startTime ?? "--:--");
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
                                                  (event) => event.step_status === "FAILED",
                                                )?.error_code,
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
                Esto volverá a ejecutar extracción e interpretación y puede cambiar los resultados.
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

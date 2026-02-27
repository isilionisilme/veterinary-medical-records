import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DocumentsSidebar } from "./components/DocumentsSidebar";
import { buildViewerToolbarContent } from "./components/viewer/viewerToolbarContent";
import { PdfViewerPanel } from "./components/workspace/PdfViewerPanel";
import { StructuredDataPanel } from "./components/workspace/StructuredDataPanel";
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
import { GLOBAL_SCHEMA } from "./lib/globalSchema";
import {
  clampConfidence,
  emitConfidencePolicyDiagnosticEvent,
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
  const [fileUrl, setFileUrl] = useState<string | ArrayBuffer | null>(null);
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
    };
  }, []);
  const loadPdf = useMutation({
    mutationFn: async (docId: string) => fetchOriginalPdf(docId),
    onSuccess: (result, docId) => {
      if (latestLoadRequestIdRef.current !== docId) {
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
      setFileUrl(result.data);
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
  const handleRetryInterpretation = useCallback(async () => {
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
  }, [documentReview]);
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
  const loadPdfErrorMessage = getUserErrorMessage(
    loadPdf.error,
    "No se pudo cargar la vista previa del documento.",
  );
  const processingHistoryErrorMessage = getUserErrorMessage(
    processingHistory.error,
    "No se pudo cargar el historial de procesamiento.",
  );
  const structuredDataPanel = (
    <StructuredDataPanel
      activeId={activeId}
      isActiveDocumentProcessing={isActiveDocumentProcessing}
      isDocumentReviewed={isDocumentReviewed}
      reviewTogglePending={reviewToggleMutation.isPending}
      onToggleReviewStatus={() => {
        if (!activeId) {
          return;
        }
        reviewToggleMutation.mutate({
          docId: activeId,
          target: isDocumentReviewed ? "in_review" : "reviewed",
        });
      }}
      reviewPanelState={reviewPanelState}
      structuredSearchInput={structuredSearchInput}
      structuredSearchInputRef={
        structuredSearchInputRef as import("react").RefObject<HTMLInputElement>
      }
      setStructuredSearchInput={setStructuredSearchInput}
      selectedConfidenceBuckets={selectedConfidenceBuckets}
      setSelectedConfidenceBuckets={setSelectedConfidenceBuckets}
      activeConfidencePolicy={activeConfidencePolicy}
      detectedFieldsSummary={detectedFieldsSummary}
      showOnlyCritical={showOnlyCritical}
      showOnlyWithValue={showOnlyWithValue}
      showOnlyEmpty={showOnlyEmpty}
      setShowOnlyCritical={setShowOnlyCritical}
      setShowOnlyWithValue={setShowOnlyWithValue}
      setShowOnlyEmpty={setShowOnlyEmpty}
      getFilterToggleItemClass={getFilterToggleItemClass}
      resetStructuredFilters={resetStructuredFilters}
      reviewMessageInfoClass={reviewMessageInfoClass}
      reviewMessageMutedClass={reviewMessageMutedClass}
      reviewMessageWarningClass={reviewMessageWarningClass}
      reviewPanelMessage={reviewPanelMessage}
      shouldShowReviewEmptyState={shouldShowReviewEmptyState}
      isRetryingInterpretation={isRetryingInterpretation}
      onRetryInterpretation={handleRetryInterpretation}
      hasMalformedCanonicalFieldSlots={hasMalformedCanonicalFieldSlots}
      hasNoStructuredFilterResults={hasNoStructuredFilterResults}
      reportSections={reportSections}
      renderSectionLayout={renderSectionLayout}
      evidenceNotice={evidenceNotice}
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
              <PdfViewerPanel
                activeViewerTab={activeViewerTab}
                activeId={activeId}
                fileUrl={fileUrl}
                filename={filename}
                isDragOverViewer={isDragOverViewer}
                onViewerDragEnter={handleViewerDragEnter}
                onViewerDragOver={handleViewerDragOver}
                onViewerDragLeave={handleViewerDragLeave}
                onViewerDrop={handleViewerDrop}
                onOpenUploadArea={handleOpenUploadArea}
                isDocumentListError={documentList.isError}
                shouldShowLoadPdfErrorBanner={shouldShowLoadPdfErrorBanner}
                loadPdfErrorMessage={loadPdfErrorMessage}
                reviewSplitLayoutStyle={reviewSplitLayoutStyle}
                onReviewSplitGridRef={handleReviewSplitGridRef}
                onStartReviewSplitDragging={startReviewSplitDragging}
                onResetReviewSplitRatio={resetReviewSplitRatio}
                onHandleReviewSplitKeyboard={handleReviewSplitKeyboard}
                effectiveViewMode={effectiveViewMode}
                selectedReviewFieldEvidencePage={selectedReviewField?.evidence?.page ?? null}
                selectedReviewFieldEvidenceSnippet={selectedReviewField?.evidence?.snippet ?? null}
                fieldNavigationRequestId={fieldNavigationRequestId}
                viewerModeToolbarIcons={viewerModeToolbarIcons}
                viewerDownloadIcon={viewerDownloadIcon}
                structuredDataPanel={structuredDataPanel}
                isPinnedSourcePanelVisible={isPinnedSourcePanelVisible}
                sourcePanelContent={sourcePanelContent}
                isSourceOpen={sourcePanel.isSourceOpen}
                isSourcePinned={sourcePanel.isSourcePinned}
                isDesktopForPin={isDesktopForPin}
                isReviewMode={isReviewMode}
                onCloseSourceOverlay={sourcePanel.closeOverlay}
                rawSearch={rawSearch}
                setRawSearch={setRawSearch}
                canSearchRawText={canSearchRawText}
                hasRawText={hasRawText}
                rawSearchNotice={rawSearchNotice}
                isRawTextLoading={isRawTextLoading}
                rawTextErrorMessage={rawTextErrorMessage}
                rawTextContent={rawTextContent ?? ""}
                onRawSearch={handleRawSearch}
                canCopyRawText={canCopyRawText}
                isCopyingRawText={isCopyingRawText}
                copyFeedback={copyFeedback}
                onCopyRawText={handleCopyRawText}
                onDownloadRawText={handleDownloadRawText}
                isActiveDocumentProcessing={isActiveDocumentProcessing}
                reprocessPending={reprocessMutation.isPending}
                reprocessingDocumentId={reprocessingDocumentId}
                hasObservedProcessingAfterReprocess={hasObservedProcessingAfterReprocess}
                onOpenRetryModal={() => setShowRetryModal(true)}
                showRetryModal={showRetryModal}
                onShowRetryModalChange={setShowRetryModal}
                onConfirmRetry={handleConfirmRetry}
                processingHistoryIsLoading={processingHistory.isLoading}
                processingHistoryIsError={processingHistory.isError}
                processingHistoryErrorMessage={processingHistoryErrorMessage}
                processingHistoryRuns={processingHistory.data?.runs ?? []}
                expandedSteps={expandedSteps}
                onToggleStepDetails={toggleStepDetails}
                formatRunHeader={formatRunHeader}
              />
            </section>
          </div>
        </main>
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

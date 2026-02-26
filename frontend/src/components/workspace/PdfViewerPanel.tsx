import { type CSSProperties, type DragEventHandler, type ReactNode } from "react";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { PdfViewer } from "../PdfViewer";
import { type ProcessingHistoryRun } from "../../types/appWorkspace";
import { groupProcessingSteps } from "../../lib/processingHistory";
import {
  formatDuration,
  formatTime,
  shouldShowDetails,
  statusIcon,
} from "../../lib/processingHistoryView";
import { explainFailure } from "../../lib/appWorkspaceUtils";
import { UploadPanel } from "./UploadPanel";

type PdfViewerPanelProps = {
  activeViewerTab: "document" | "raw_text" | "technical";
  activeId: string | null;
  fileUrl: string | ArrayBuffer | null;
  filename: string | null;
  isDragOverViewer: boolean;
  onViewerDragEnter: DragEventHandler<HTMLDivElement>;
  onViewerDragOver: DragEventHandler<HTMLDivElement>;
  onViewerDragLeave: DragEventHandler<HTMLDivElement>;
  onViewerDrop: DragEventHandler<HTMLDivElement>;
  onOpenUploadArea: () => void;
  isDocumentListError: boolean;
  shouldShowLoadPdfErrorBanner: boolean;
  loadPdfErrorMessage: string;
  reviewSplitLayoutStyle: CSSProperties;
  onReviewSplitGridRef: (node: HTMLDivElement | null) => void;
  onStartReviewSplitDragging: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onResetReviewSplitRatio: () => void;
  onHandleReviewSplitKeyboard: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  effectiveViewMode: string;
  selectedReviewFieldEvidencePage: number | null;
  selectedReviewFieldEvidenceSnippet: string | null;
  fieldNavigationRequestId: number;
  viewerModeToolbarIcons: ReactNode;
  viewerDownloadIcon: ReactNode;
  structuredDataPanel: ReactNode;
  isPinnedSourcePanelVisible: boolean;
  sourcePanelContent: ReactNode;
  isSourceOpen: boolean;
  isSourcePinned: boolean;
  isDesktopForPin: boolean;
  isReviewMode: boolean;
  onCloseSourceOverlay: () => void;
  rawSearch: string;
  setRawSearch: (value: string) => void;
  canSearchRawText: boolean;
  hasRawText: boolean;
  rawSearchNotice: string | null;
  isRawTextLoading: boolean;
  rawTextErrorMessage: string | null;
  rawTextContent: string;
  onRawSearch: () => void;
  canCopyRawText: boolean;
  isCopyingRawText: boolean;
  copyFeedback: string | null;
  onCopyRawText: () => Promise<void>;
  onDownloadRawText: () => void;
  isActiveDocumentProcessing: boolean;
  reprocessPending: boolean;
  reprocessingDocumentId: string | null;
  hasObservedProcessingAfterReprocess: boolean;
  onOpenRetryModal: () => void;
  showRetryModal: boolean;
  onShowRetryModalChange: (open: boolean) => void;
  onConfirmRetry: () => void;
  processingHistoryIsLoading: boolean;
  processingHistoryIsError: boolean;
  processingHistoryErrorMessage: string;
  processingHistoryRuns: ProcessingHistoryRun[];
  expandedSteps: Record<string, boolean>;
  onToggleStepDetails: (stepKey: string) => void;
  formatRunHeader: (run: ProcessingHistoryRun) => string;
};

export function PdfViewerPanel({
  activeViewerTab,
  activeId,
  fileUrl,
  filename,
  isDragOverViewer,
  onViewerDragEnter,
  onViewerDragOver,
  onViewerDragLeave,
  onViewerDrop,
  onOpenUploadArea,
  isDocumentListError,
  shouldShowLoadPdfErrorBanner,
  loadPdfErrorMessage,
  reviewSplitLayoutStyle,
  onReviewSplitGridRef,
  onStartReviewSplitDragging,
  onResetReviewSplitRatio,
  onHandleReviewSplitKeyboard,
  effectiveViewMode,
  selectedReviewFieldEvidencePage,
  selectedReviewFieldEvidenceSnippet,
  fieldNavigationRequestId,
  viewerModeToolbarIcons,
  viewerDownloadIcon,
  structuredDataPanel,
  isPinnedSourcePanelVisible,
  sourcePanelContent,
  isSourceOpen,
  isSourcePinned,
  isDesktopForPin,
  isReviewMode,
  onCloseSourceOverlay,
  rawSearch,
  setRawSearch,
  canSearchRawText,
  hasRawText,
  rawSearchNotice,
  isRawTextLoading,
  rawTextErrorMessage,
  rawTextContent,
  onRawSearch,
  canCopyRawText,
  isCopyingRawText,
  copyFeedback,
  onCopyRawText,
  onDownloadRawText,
  isActiveDocumentProcessing,
  reprocessPending,
  reprocessingDocumentId,
  hasObservedProcessingAfterReprocess,
  onOpenRetryModal,
  showRetryModal,
  onShowRetryModalChange,
  onConfirmRetry,
  processingHistoryIsLoading,
  processingHistoryIsError,
  processingHistoryErrorMessage,
  processingHistoryRuns,
  expandedSteps,
  onToggleStepDetails,
  formatRunHeader,
}: PdfViewerPanelProps) {
  return (
    <>
      {shouldShowLoadPdfErrorBanner && (
        <div className="rounded-card border border-statusError bg-surface px-4 py-3 text-sm text-text">
          {loadPdfErrorMessage}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          {activeViewerTab === "document" && (
            <div
              data-testid="viewer-dropzone"
              className="h-full min-h-0"
              onDragEnter={onViewerDragEnter}
              onDragOver={onViewerDragOver}
              onDragLeave={onViewerDragLeave}
              onDrop={onViewerDrop}
            >
              {!activeId ? (
                <UploadPanel
                  isDocumentListError={isDocumentListError}
                  isDragOverViewer={isDragOverViewer}
                  onOpenUploadArea={onOpenUploadArea}
                  onViewerDragEnter={onViewerDragEnter}
                  onViewerDragOver={onViewerDragOver}
                  onViewerDragLeave={onViewerDragLeave}
                  onViewerDrop={onViewerDrop}
                />
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
                      ref={onReviewSplitGridRef}
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
                            focusPage={selectedReviewFieldEvidencePage}
                            highlightSnippet={selectedReviewFieldEvidenceSnippet}
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
                          onMouseDown={onStartReviewSplitDragging}
                          onDoubleClick={onResetReviewSplitRatio}
                          onKeyDown={onHandleReviewSplitKeyboard}
                          className="group flex h-full w-full cursor-col-resize items-center justify-center rounded-full bg-transparent transition hover:bg-surfaceMuted focus-visible:bg-surfaceMuted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
                        >
                          <span
                            aria-hidden="true"
                            className="h-24 w-[2px] rounded-full bg-borderSubtle transition group-hover:bg-border"
                          />
                        </button>
                      </div>
                      {structuredDataPanel}
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
            isSourceOpen &&
            (isReviewMode || !isSourcePinned || !isDesktopForPin) && (
              <>
                <button
                  type="button"
                  data-testid="source-drawer-backdrop"
                  className="fixed inset-0 z-40 bg-text/20"
                  aria-label="Cerrar fuente"
                  onClick={onCloseSourceOverlay}
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
                    ¿El texto no es correcto? Puedes reprocesarlo para regenerar la extracción.
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      disabled={!activeId || isActiveDocumentProcessing || reprocessPending}
                      onClick={onOpenRetryModal}
                    >
                      {reprocessPending ||
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
                  className="w-full rounded-control border border-borderSubtle bg-surface px-3 py-2 text-xs text-text outline-none placeholder:text-textSecondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-64"
                  placeholder="Buscar en el texto"
                  value={rawSearch}
                  disabled={!canSearchRawText}
                  onChange={(event) => setRawSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onRawSearch();
                    }
                  }}
                />
                <Button type="button" disabled={!canSearchRawText} onClick={onRawSearch}>
                  Buscar
                </Button>
                <Button
                  type="button"
                  disabled={!canCopyRawText || isCopyingRawText}
                  onClick={() => {
                    void onCopyRawText();
                  }}
                >
                  {isCopyingRawText
                    ? "Copiando..."
                    : copyFeedback === "Texto copiado."
                      ? "Copiado"
                      : "Copiar todo"}
                </Button>
                <Button type="button" disabled={!rawTextContent} onClick={onDownloadRawText}>
                  Descargar texto (.txt)
                </Button>
              </div>
              {copyFeedback && (
                <p className="mt-2 text-xs text-textSecondary" role="status" aria-live="polite">
                  {copyFeedback}
                </p>
              )}
              {hasRawText && rawSearchNotice && (
                <p className="mt-2 text-xs text-textSecondary">{rawSearchNotice}</p>
              )}
              {isRawTextLoading && (
                <p className="mt-2 text-xs text-textSecondary">Cargando texto extraído...</p>
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
                  disabled={!activeId || isActiveDocumentProcessing || reprocessPending}
                  onClick={onOpenRetryModal}
                >
                  {isActiveDocumentProcessing
                    ? "Procesando..."
                    : reprocessPending
                      ? "Reprocesando..."
                      : "Reprocesar"}
                </Button>
              </div>
              {!activeId && (
                <p className="mt-2 text-xs text-muted">
                  Selecciona un documento para ver los detalles técnicos.
                </p>
              )}
              {activeId && processingHistoryIsLoading && (
                <p className="mt-2 text-xs text-muted">Cargando historial...</p>
              )}
              {activeId && processingHistoryIsError && (
                <p className="mt-2 text-xs text-statusError">{processingHistoryErrorMessage}</p>
              )}
              {activeId && processingHistoryRuns.length === 0 && (
                <p className="mt-2 text-xs text-muted">
                  No hay ejecuciones registradas para este documento.
                </p>
              )}
              {activeId && processingHistoryRuns.length > 0 && (
                <div className="mt-2 space-y-2">
                  {processingHistoryRuns.map((run) => (
                    <div
                      key={run.run_id}
                      className="rounded-card border border-borderSubtle bg-surface p-2"
                    >
                      <div className="text-xs font-semibold text-ink">{formatRunHeader(run)}</div>
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
                            const duration = formatDuration(step.start_time, step.end_time);
                            const startTime = formatTime(step.start_time);
                            const endTime = formatTime(step.end_time);
                            const timeRange =
                              startTime && endTime
                                ? `${startTime} → ${endTime}`
                                : (startTime ?? "--:--");
                            return (
                              <div key={stepKey} className="rounded-control bg-surface p-2">
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
                                  <span className="font-semibold text-ink">{step.step_name}</span>
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
                                      onClick={() => onToggleStepDetails(stepKey)}
                                    >
                                      {expandedSteps[stepKey] ? "Ocultar detalles" : "Ver detalles"}
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
      <Dialog open={showRetryModal} onOpenChange={onShowRetryModalChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reprocesar documento</DialogTitle>
            <DialogDescription className="text-xs">
              Esto volverá a ejecutar extracción e interpretación y puede cambiar los resultados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={reprocessPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="button" onClick={onConfirmRetry} disabled={reprocessPending}>
              {reprocessPending ? "Reprocesando..." : "Reprocesar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

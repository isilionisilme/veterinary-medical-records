import { type ChangeEvent, type DragEvent, type MouseEvent, type RefObject } from "react";
import { CircleHelp, FileText, Pin, PinOff, RefreshCw } from "lucide-react";

import { DocumentStatusChip } from "./app/DocumentStatusCluster";
import { IconButton } from "./app/IconButton";
import { UploadDropzone } from "./UploadDropzone";
import { Tooltip } from "./ui/tooltip";
import { type DocumentStatusClusterModel } from "../lib/documentStatus";

type DocumentsSidebarItem = {
  document_id: string;
  original_filename: string;
  created_at: string;
  status: string;
  failure_type: string | null;
  review_status?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
};

type DocumentsSidebarProps = {
  panelHeightClass: string;
  shouldUseHoverDocsSidebar: boolean;
  isDocsSidebarExpanded: boolean;
  isDocsSidebarPinned: boolean;
  isRefreshingDocuments: boolean;
  isUploadPending: boolean;
  isDragOverSidebarUpload: boolean;
  isDocumentListLoading: boolean;
  isDocumentListError: boolean;
  isListRefreshing: boolean;
  documentListErrorMessage: string | null;
  documents: DocumentsSidebarItem[];
  activeId: string | null;
  uploadPanelRef: RefObject<HTMLDivElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  formatTimestamp: (value: string | null | undefined) => string;
  isProcessingTooLong: (createdAt: string, status: string) => boolean;
  mapDocumentStatus: (item: DocumentsSidebarItem) => DocumentStatusClusterModel;
  onSidebarMouseEnter: (event: MouseEvent<HTMLElement>) => void;
  onSidebarMouseLeave: () => void;
  onTogglePin: () => void;
  onRefresh: () => void;
  onOpenUploadArea: (event?: { preventDefault?: () => void; stopPropagation?: () => void }) => void;
  onSidebarUploadDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onSidebarUploadDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onSidebarUploadDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onSidebarUploadDrop: (event: DragEvent<HTMLDivElement>) => void;
  onSidebarFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelectDocument: (documentId: string) => void;
};

export function DocumentsSidebar({
  panelHeightClass,
  shouldUseHoverDocsSidebar,
  isDocsSidebarExpanded,
  isDocsSidebarPinned,
  isRefreshingDocuments,
  isUploadPending,
  isDragOverSidebarUpload,
  isDocumentListLoading,
  isDocumentListError,
  isListRefreshing,
  documentListErrorMessage,
  documents,
  activeId,
  uploadPanelRef,
  fileInputRef,
  formatTimestamp,
  isProcessingTooLong,
  mapDocumentStatus,
  onSidebarMouseEnter,
  onSidebarMouseLeave,
  onTogglePin,
  onRefresh,
  onOpenUploadArea,
  onSidebarUploadDragEnter,
  onSidebarUploadDragOver,
  onSidebarUploadDragLeave,
  onSidebarUploadDrop,
  onSidebarFileInputChange,
  onSelectDocument,
}: DocumentsSidebarProps) {
  const toReviewDocuments = documents.filter((item) => item.review_status !== "REVIEWED");
  const reviewedDocuments = documents.filter((item) => item.review_status === "REVIEWED");
  const groupedDocuments = [
    { key: "to-review", title: "Para revisar", items: toReviewDocuments, reviewed: false },
    { key: "reviewed", title: "Revisados", items: reviewedDocuments, reviewed: true },
  ] as const;

  return (
    <aside
      data-testid="documents-sidebar"
      data-expanded={isDocsSidebarExpanded ? "true" : "false"}
      className={`${
        shouldUseHoverDocsSidebar
          ? `${isDocsSidebarExpanded ? "w-80" : "w-16"} transition-[width] duration-200 ease-in-out`
          : "w-80"
      } flex-shrink-0`}
      onMouseEnter={onSidebarMouseEnter}
      onMouseLeave={onSidebarMouseLeave}
    >
      <div className="panel-shell-muted overflow-hidden">
        <section
          data-testid="docs-column-stack"
          className={`flex flex-col gap-[var(--canvas-gap)] p-[var(--canvas-gap)] ${panelHeightClass}`}
        >
          {isDocsSidebarExpanded ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-accent text-sm font-semibold text-accentForeground"
                >
                  B
                </span>
                <div>
                  <p className="font-display text-lg font-semibold leading-none text-accent">Barkibu</p>
                  <p className="mt-1 text-xs text-textMuted">Revisión de reembolsos</p>
                </div>
              </div>
              <div className="flex items-center gap-2" data-testid="sidebar-actions-cluster">
                <IconButton
                  label={isDocsSidebarPinned ? "Fijada" : "Fijar"}
                  tooltip={isDocsSidebarPinned ? "Fijada" : "Fijar"}
                  pressed={isDocsSidebarPinned}
                  onClick={onTogglePin}
                >
                  {isDocsSidebarPinned ? <PinOff size={16} aria-hidden="true" /> : <Pin size={16} aria-hidden="true" />}
                </IconButton>
                <IconButton
                  label="Actualizar"
                  tooltip="Actualizar"
                  onClick={onRefresh}
                  disabled={isRefreshingDocuments}
                >
                  <RefreshCw size={16} aria-hidden="true" className={isRefreshingDocuments ? "animate-spin" : ""} />
                </IconButton>
              </div>
            </div>
          ) : (
            <div className="flex justify-center" data-testid="sidebar-collapsed-brand-mark">
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 items-center justify-center rounded-control bg-accent text-xs font-semibold text-accentForeground"
              >
                B
              </span>
            </div>
          )}

          <div className="flex min-h-[168px] items-center">
            {isDocsSidebarExpanded ? (
              <div
                ref={uploadPanelRef}
                className="panel-shell w-full p-[var(--canvas-gap)] transition-opacity duration-150 ease-in-out"
              >
                <div className="flex items-center gap-[var(--canvas-gap)]">
                  <h3 className="text-base font-semibold text-ink">Cargar documento</h3>
                  <IconButton
                    label="Informacion de formatos y tamano"
                    tooltip="Formatos permitidos: PDF. Tamaño máximo: 20 MB."
                    className="h-7 w-7 border-0"
                  >
                    <CircleHelp size={14} />
                  </IconButton>
                </div>
                <UploadDropzone
                  className=""
                  isDragOver={isDragOverSidebarUpload}
                  onActivate={onOpenUploadArea}
                  onDragEnter={onSidebarUploadDragEnter}
                  onDragOver={onSidebarUploadDragOver}
                  onDragLeave={onSidebarUploadDragLeave}
                  onDrop={onSidebarUploadDrop}
                />
                <div className="flex items-center gap-[var(--canvas-gap)]">
                  <input
                    id="upload-document-input"
                    ref={fileInputRef}
                    type="file"
                    aria-label="Archivo PDF"
                    accept=".pdf,application/pdf"
                    className="sr-only"
                    disabled={isUploadPending}
                    onChange={onSidebarFileInputChange}
                  />
                  {isUploadPending && (
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Subiendo...</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div data-testid="sidebar-collapsed-dropzone" className="flex w-full items-center justify-center py-1">
                <UploadDropzone
                  compact
                  ariaLabel="Cargar documento"
                  title=""
                  subtitle=""
                  isDragOver={isDragOverSidebarUpload}
                  onActivate={onOpenUploadArea}
                  onDragEnter={onSidebarUploadDragEnter}
                  onDragOver={onSidebarUploadDragOver}
                  onDragLeave={onSidebarUploadDragLeave}
                  onDrop={onSidebarUploadDrop}
                />
              </div>
            )}
          </div>

          <div
            data-testid="left-panel-scroll"
            className={`relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${
              isDocsSidebarExpanded
                ? "pr-0"
                : "pr-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0"
            }`}
          >
            {isDocumentListLoading && (
              <div className="panel-shell flex flex-col gap-[var(--canvas-gap)] p-[var(--canvas-gap)]">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`skeleton-initial-${index}`}
                    className="animate-pulse rounded-card bg-surfaceMuted p-[var(--canvas-gap)]"
                  >
                    <div className="h-3 w-2/3 rounded bg-black/10" />
                    <div className="mt-2 h-2.5 w-1/2 rounded bg-black/10" />
                  </div>
                ))}
              </div>
            )}

            {isDocumentListError && documentListErrorMessage && (
              <div className="panel-shell p-[var(--canvas-gap)] text-sm text-ink">
                <p>{documentListErrorMessage}</p>
              </div>
            )}

            {!isDocumentListLoading && !isDocumentListError &&
              (isListRefreshing ? (
                <div className="panel-shell flex flex-col gap-[var(--canvas-gap)] p-[var(--canvas-gap)]">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={`skeleton-refresh-${index}`}
                      className="animate-pulse rounded-card bg-surfaceMuted p-[var(--canvas-gap)]"
                    >
                      <div className="h-3 w-2/3 rounded bg-black/10" />
                      <div className="mt-2 h-2.5 w-1/2 rounded bg-black/10" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`panel-shell flex flex-col gap-[var(--canvas-gap)] p-[var(--canvas-gap)] ${isDocsSidebarExpanded ? "pr-3" : ""}`}>
                  {documents.length === 0 ? (
                    isDocsSidebarExpanded ? (
                      <p className="px-1 py-2 text-sm text-muted">Aun no hay documentos cargados.</p>
                    ) : null
                  ) : (
                    groupedDocuments.flatMap((group) => {
                      if (group.items.length === 0) {
                        return [];
                      }

                      const sectionItems = group.items.map((item) => {
                      const isActive = activeId === item.document_id;
                      const status = mapDocumentStatus(item);
                      const expandedRowClass = isActive
                        ? "rounded-card border border-transparent bg-surface text-ink ring-1 ring-borderSubtle shadow-subtle"
                        : `rounded-card border border-transparent bg-surface text-ink hover:border-borderSubtle hover:bg-surfaceMuted ${group.reviewed ? "opacity-70" : ""}`;
                      const collapsedRowClass = isActive
                        ? "rounded-lg border border-transparent bg-transparent text-ink"
                        : `rounded-lg border border-transparent bg-transparent text-ink hover:border-borderSubtle hover:bg-surface ${
                            group.reviewed ? "opacity-70" : ""
                          }`;
                      const collapsedIconClass = isActive
                        ? "relative flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-surface text-ink ring-1 ring-borderSubtle transition"
                        : "relative flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent transition hover:border-borderSubtle hover:bg-surface";
                      const button = (
                        <button
                          key={item.document_id}
                          data-testid={`doc-row-${item.document_id}`}
                          type="button"
                          onClick={() => onSelectDocument(item.document_id)}
                          aria-pressed={isActive}
                          aria-label={`${item.original_filename} (${status.label})`}
                          className={`w-full overflow-visible text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                            isDocsSidebarExpanded
                              ? expandedRowClass
                              : collapsedRowClass
                          } ${isDocsSidebarExpanded ? "px-3 py-2" : "px-0 py-1"} ${
                            !isDocsSidebarExpanded ? "shadow-none" : ""
                          }`}
                        >
                          <div
                            className={`flex items-center ${
                              isDocsSidebarExpanded
                                ? "justify-between gap-3"
                                : "mx-auto w-full justify-center"
                            }`}
                          >
                            <div
                              className={
                                isDocsSidebarExpanded
                                  ? "min-w-0"
                                  : collapsedIconClass
                              }
                            >
                              {isDocsSidebarExpanded ? (
                                <>
                                  <p className="truncate text-sm font-semibold text-textBody">{item.original_filename}</p>
                                  <p className="mt-0.5 text-xs text-textMuted">Subido: {formatTimestamp(item.created_at)}</p>
                                </>
                              ) : (
                                <FileText size={15} aria-hidden="true" />
                              )}
                              {!isDocsSidebarExpanded && (
                                <DocumentStatusChip
                                  status={status}
                                  compact
                                  className="absolute right-0.5 top-0.5"
                                />
                              )}
                            </div>
                            {isDocsSidebarExpanded ? (
                              <DocumentStatusChip status={status} />
                            ) : null}
                          </div>
                          {isDocsSidebarExpanded && isProcessingTooLong(item.created_at, item.status) && (
                            <p className="mt-2 text-xs text-muted">Tardando mas de lo esperado</p>
                          )}
                          {isDocsSidebarExpanded && item.failure_type && (
                            <p className="mt-2 text-xs text-red-600">Error: {item.failure_type}</p>
                          )}
                        </button>
                      );

                      if (isDocsSidebarExpanded) {
                        return button;
                      }

                      return (
                        <Tooltip
                          key={`${item.document_id}-tooltip`}
                          content={`${item.original_filename} · ${status.label}`}
                          triggerClassName="flex w-full"
                        >
                          {button}
                        </Tooltip>
                      );
                    });

                      if (!isDocsSidebarExpanded) {
                        return sectionItems;
                      }

                      return [
                        <p
                          key={`${group.key}-header`}
                          className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-textMuted"
                        >
                          {group.title}
                        </p>,
                        ...sectionItems,
                      ];
                    })
                  )}
                </div>
              ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

import { type ChangeEvent, type DragEvent, type MouseEvent, type RefObject } from "react";
import { CircleHelp, FileText, RefreshCw } from "lucide-react";

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
};

type DocumentsSidebarProps = {
  panelHeightClass: string;
  shouldUseHoverDocsSidebar: boolean;
  isDocsSidebarExpanded: boolean;
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
  onOpenUploadArea,
  onSidebarUploadDragEnter,
  onSidebarUploadDragOver,
  onSidebarUploadDragLeave,
  onSidebarUploadDrop,
  onSidebarFileInputChange,
  onSelectDocument,
}: DocumentsSidebarProps) {
  return (
    <aside
      data-testid="documents-sidebar"
      data-expanded={isDocsSidebarExpanded ? "true" : "false"}
      className={`${
        shouldUseHoverDocsSidebar
          ? `${isDocsSidebarExpanded ? "w-80" : "w-14"} transition-[width] duration-200 ease-in-out`
          : "w-80"
      } flex-shrink-0`}
      onMouseEnter={onSidebarMouseEnter}
      onMouseLeave={onSidebarMouseLeave}
    >
      <div className="overflow-hidden rounded-card border border-borderSubtle bg-surface shadow-soft">
        <section className={`flex flex-col ${isDocsSidebarExpanded ? "p-6" : "px-1.5 py-3.5"} ${panelHeightClass}`}>
          <span className="sr-only">Lista de documentos</span>

          <div className="mt-4 flex min-h-[168px] items-center">
            {isDocsSidebarExpanded ? (
              <div
                ref={uploadPanelRef}
                className="w-full rounded-card border border-borderSubtle bg-surfaceMuted p-4 transition-opacity duration-150 ease-in-out"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">Cargar documento</h3>
                  <IconButton
                    label="Informacion de formatos y tamano"
                    tooltip="Formatos permitidos: PDF. Tamaño máximo: 20 MB."
                    className="h-7 w-7"
                  >
                    <CircleHelp size={14} />
                  </IconButton>
                </div>
                <UploadDropzone
                  className="mt-3"
                  isDragOver={isDragOverSidebarUpload}
                  onActivate={onOpenUploadArea}
                  onDragEnter={onSidebarUploadDragEnter}
                  onDragOver={onSidebarUploadDragOver}
                  onDragLeave={onSidebarUploadDragLeave}
                  onDrop={onSidebarUploadDrop}
                />
                <div className="mt-2 flex items-center gap-2">
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
              <div data-testid="sidebar-collapsed-dropzone" className="flex w-full items-center justify-center py-2">
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
            className={`relative mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${
              isDocsSidebarExpanded
                ? "pr-0"
                : "pr-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0"
            }`}
          >
            {isDocumentListLoading && (
              <div className="space-y-2 rounded-card border border-borderSubtle bg-surfaceMuted p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`skeleton-initial-${index}`}
                    className="animate-pulse rounded-card border border-borderSubtle bg-surface p-3"
                  >
                    <div className="h-3 w-2/3 rounded bg-black/10" />
                    <div className="mt-2 h-2.5 w-1/2 rounded bg-black/10" />
                  </div>
                ))}
              </div>
            )}

            {isDocumentListError && documentListErrorMessage && (
              <div className="rounded-card border border-borderSubtle bg-surface p-4 text-sm text-ink">
                <p>{documentListErrorMessage}</p>
              </div>
            )}

            {!isDocumentListLoading && !isDocumentListError &&
              (isListRefreshing ? (
                <div className="space-y-2 rounded-card border border-borderSubtle bg-surfaceMuted p-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={`skeleton-refresh-${index}`}
                      className="animate-pulse rounded-card border border-borderSubtle bg-surface p-3"
                    >
                      <div className="h-3 w-2/3 rounded bg-black/10" />
                      <div className="mt-2 h-2.5 w-1/2 rounded bg-black/10" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`space-y-2 ${isDocsSidebarExpanded ? "pr-3" : ""}`}>
                  {documents.length === 0 ? (
                    isDocsSidebarExpanded ? (
                      <p className="px-1 py-2 text-sm text-muted">Aun no hay documentos cargados.</p>
                    ) : null
                  ) : (
                    documents.map((item) => {
                      const isActive = activeId === item.document_id;
                      const status = mapDocumentStatus(item);
                      const button = (
                        <button
                          key={item.document_id}
                          type="button"
                          onClick={() => onSelectDocument(item.document_id)}
                          aria-pressed={isActive}
                          aria-label={`${item.original_filename} (${status.label})`}
                          className={`w-full overflow-visible text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                            isDocsSidebarExpanded
                              ? isActive
                                ? "rounded-card border border-border bg-surfaceMuted text-ink shadow-subtle ring-1 ring-border"
                                : "rounded-card border border-borderSubtle bg-surface text-ink hover:bg-surfaceMuted"
                              : "rounded-lg border border-transparent bg-transparent text-ink"
                          } ${isDocsSidebarExpanded ? "px-3 py-2" : "px-0 py-1"}`}
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
                                  : `relative flex h-10 w-10 items-center justify-center rounded-full transition ${
                                      isActive
                                        ? "bg-black/[0.10]"
                                        : "bg-transparent hover:bg-black/[0.06]"
                                    }`
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
                                  className="absolute right-1 top-1"
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
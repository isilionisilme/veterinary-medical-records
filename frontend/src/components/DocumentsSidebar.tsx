import { type ChangeEvent, type DragEvent, type MouseEvent, type RefObject } from "react";
import { FileText, Pin, PinOff, RefreshCw } from "lucide-react";

import { IconButton } from "./app/IconButton";
import { UploadDropzone } from "./UploadDropzone";
import { Tooltip } from "./ui/tooltip";

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
  isDocsSidebarPinned: boolean;
  isRefreshingDocuments: boolean;
  isUploadPending: boolean;
  isHoverDevice: boolean;
  showUploadInfo: boolean;
  isDragOverSidebarUpload: boolean;
  isDocumentListLoading: boolean;
  isDocumentListError: boolean;
  isListRefreshing: boolean;
  documentListErrorMessage: string | null;
  documents: DocumentsSidebarItem[];
  activeId: string | null;
  uploadPanelRef: RefObject<HTMLDivElement>;
  uploadInfoTriggerRef: RefObject<HTMLButtonElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  formatTimestamp: (value: string | null | undefined) => string;
  isProcessingTooLong: (createdAt: string, status: string) => boolean;
  mapDocumentStatus: (item: DocumentsSidebarItem) => { label: string; tone: "ok" | "warn" | "error" };
  onSidebarMouseEnter: (event: MouseEvent<HTMLElement>) => void;
  onSidebarMouseLeave: () => void;
  onTogglePin: () => void;
  onRefresh: () => void;
  onOpenUploadInfo: () => void;
  onCloseUploadInfo: (withDelay: boolean) => void;
  onToggleUploadInfo: () => void;
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
  isHoverDevice,
  showUploadInfo,
  isDragOverSidebarUpload,
  isDocumentListLoading,
  isDocumentListError,
  isListRefreshing,
  documentListErrorMessage,
  documents,
  activeId,
  uploadPanelRef,
  uploadInfoTriggerRef,
  fileInputRef,
  formatTimestamp,
  isProcessingTooLong,
  mapDocumentStatus,
  onSidebarMouseEnter,
  onSidebarMouseLeave,
  onTogglePin,
  onRefresh,
  onOpenUploadInfo,
  onCloseUploadInfo,
  onToggleUploadInfo,
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
          ? `${isDocsSidebarExpanded ? "w-80" : "w-16"} transition-[width] duration-200 ease-in-out`
          : "w-80"
      } flex-shrink-0`}
      onMouseEnter={onSidebarMouseEnter}
      onMouseLeave={onSidebarMouseLeave}
    >
      <div className="overflow-hidden rounded-3xl border border-black/10 bg-white/80 shadow-xl">
        <section className={`flex flex-col p-6 ${panelHeightClass}`}>
          <div className="flex items-center justify-between gap-3">
            <div
              className={`min-w-0 transition-opacity duration-150 ${
                isDocsSidebarExpanded ? "opacity-100" : "pointer-events-none w-0 opacity-0"
              }`}
            >
              <h2 className="font-display text-xl font-semibold">Documentos</h2>
            </div>
            {isDocsSidebarExpanded && (
              <div className="flex items-center gap-2">
                <IconButton
                  label={isDocsSidebarPinned ? "Desfijar barra" : "Fijar barra"}
                  tooltip={isDocsSidebarPinned ? "Desfijar barra" : "Fijar barra"}
                  onClick={onTogglePin}
                  className={`rounded-full border p-2 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    isDocsSidebarPinned
                      ? "border-ink/30 bg-black/[0.06] text-ink"
                      : "border-black/15 bg-white text-ink hover:bg-accentSoft"
                  }`}
                >
                  {isDocsSidebarPinned ? <PinOff size={16} /> : <Pin size={16} />}
                </IconButton>
                <IconButton
                  label="Actualizar"
                  tooltip="Actualizar"
                  onClick={onRefresh}
                  disabled={isRefreshingDocuments}
                  className="rounded-full border border-black/15 bg-white p-2 text-ink shadow-sm hover:bg-accentSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <RefreshCw size={16} className={isRefreshingDocuments ? "animate-spin" : ""} />
                </IconButton>
              </div>
            )}
          </div>

          <div className="mt-4 flex min-h-[168px] items-center">
            {isDocsSidebarExpanded ? (
              <div
                ref={uploadPanelRef}
                className="w-full rounded-2xl border border-black/10 bg-white/70 p-4 transition-opacity duration-150 ease-in-out"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">Cargar documento</h3>
                  <IconButton
                    ref={uploadInfoTriggerRef}
                    label="Informacion de formatos y tamano"
                    tooltip="Informacion de formatos y tamano"
                    aria-expanded={showUploadInfo}
                    onFocus={onOpenUploadInfo}
                    onBlur={() => onCloseUploadInfo(false)}
                    onMouseEnter={() => {
                      if (isHoverDevice) {
                        onOpenUploadInfo();
                      }
                    }}
                    onMouseLeave={() => {
                      if (isHoverDevice) {
                        onCloseUploadInfo(true);
                      }
                    }}
                    onClick={(event) => {
                      if (isHoverDevice) {
                        return;
                      }
                      event.stopPropagation();
                      onToggleUploadInfo();
                    }}
                    className="text-sm text-muted"
                  >
                    ⓘ
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
                ? "pr-1"
                : "pr-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0"
            }`}
          >
            {isDocumentListLoading && (
              <div className="space-y-2 rounded-2xl border border-black/10 bg-white/70 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`skeleton-initial-${index}`}
                    className="animate-pulse rounded-xl border border-black/10 bg-white/80 p-3"
                  >
                    <div className="h-3 w-2/3 rounded bg-black/10" />
                    <div className="mt-2 h-2.5 w-1/2 rounded bg-black/10" />
                  </div>
                ))}
              </div>
            )}

            {isDocumentListError && documentListErrorMessage && (
              <div className="rounded-2xl border border-black/10 bg-white/80 p-4 text-sm text-ink">
                <p>{documentListErrorMessage}</p>
              </div>
            )}

            {!isDocumentListLoading && !isDocumentListError &&
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
                  {documents.length === 0 ? (
                    isDocsSidebarExpanded ? (
                      <p className="px-1 py-2 text-sm text-muted">Aun no hay documentos cargados.</p>
                    ) : null
                  ) : (
                    documents.map((item) => {
                      const isActive = activeId === item.document_id;
                      const status = mapDocumentStatus(item);
                      const collapsedStatusToneClass =
                        status.tone === "ok"
                          ? "bg-emerald-500"
                          : status.tone === "error"
                          ? "bg-red-500"
                          : "bg-amber-500";
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
                                ? "rounded-xl border border-ink/30 bg-black/[0.04] text-ink shadow-sm ring-1 ring-ink/25"
                                : "rounded-xl border border-black/10 bg-white/80 text-ink hover:bg-white"
                              : "rounded-lg border border-transparent bg-transparent text-ink"
                          } ${isDocsSidebarExpanded ? "px-3 py-2" : "px-1 py-1.5"}`}
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
                                  : `relative flex h-8 w-8 items-center justify-center rounded-full transition ${
                                      isActive
                                        ? "bg-black/[0.10]"
                                        : "bg-transparent hover:bg-black/[0.06]"
                                    }`
                              }
                            >
                              {isDocsSidebarExpanded ? (
                                <>
                                  <p className="truncate text-sm font-medium">{item.original_filename}</p>
                                  <p className="mt-0.5 text-xs text-muted">Subido: {formatTimestamp(item.created_at)}</p>
                                </>
                              ) : (
                                <FileText size={15} aria-hidden="true" />
                              )}
                              {!isDocsSidebarExpanded && (
                                <span
                                  aria-hidden="true"
                                  className={`absolute right-0 top-0 inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white ${collapsedStatusToneClass}`}
                                />
                              )}
                            </div>
                            {isDocsSidebarExpanded ? (
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
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ScanLine, ZoomIn, ZoomOut } from "lucide-react";
import { motion } from "framer-motion";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min?url";
import { Tooltip } from "./ui/tooltip";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const PDF_ZOOM_STORAGE_KEY = "pdfViewerZoomLevel";
const MIN_ZOOM_LEVEL = 0.5;
const MAX_ZOOM_LEVEL = 2;
const ZOOM_STEP = 0.1;

function clampZoomLevel(value: number): number {
  return Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, value));
}

type IconButtonWithTooltipProps = {
  ariaLabel: string;
  tooltip: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function IconButtonWithTooltip({
  ariaLabel,
  tooltip,
  disabled = false,
  onClick,
  children,
}: IconButtonWithTooltipProps) {
  return (
    <Tooltip content={tooltip} disabled={disabled}>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-transparent p-0 text-ink transition hover:bg-black/[0.06] focus-visible:bg-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45"
      >
        {children}
      </button>
    </Tooltip>
  );
}

type PdfViewerProps = {
  fileUrl: string | null;
  filename?: string | null;
  isDragOver?: boolean;
  focusPage?: number | null;
  highlightSnippet?: string | null;
  focusRequestId?: number;
  toolbarLeftContent?: ReactNode;
  toolbarRightExtra?: ReactNode;
};

export function PdfViewer({
  fileUrl,
  filename,
  isDragOver = false,
  focusPage = null,
  highlightSnippet = null,
  focusRequestId = 0,
  toolbarLeftContent,
  toolbarRightExtra,
}: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const renderedPages = useRef<Set<number>>(new Set());
  const renderingPages = useRef<Set<number>>(new Set());
  const [totalPages, setTotalPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageTextByIndex, setPageTextByIndex] = useState<Record<number, string>>({});
  const [zoomLevel, setZoomLevel] = useState(() => {
    if (typeof window === "undefined") {
      return 1;
    }
    const rawStored = window.localStorage.getItem(PDF_ZOOM_STORAGE_KEY);
    if (rawStored === null) {
      return 1;
    }
    const stored = Number(rawStored);
    if (!Number.isFinite(stored)) {
      return 1;
    }
    return clampZoomLevel(stored);
  });

  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    async function loadPdf() {
      if (!fileUrl) {
        setPdfDoc(null);
        setTotalPages(0);
        setPageNumber(1);
        setError(null);
        return;
      }

      pageRefs.current = [];
      canvasRefs.current = [];
      renderedPages.current = new Set();
      renderingPages.current = new Set();
      setPdfDoc(null);
      setTotalPages(0);
      setPageTextByIndex({});

      setLoading(true);
      setError(null);
      try {
        loadingTask = pdfjsLib.getDocument(fileUrl);
        const doc = await loadingTask.promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setPageNumber(1);
      } catch (err) {
        if (!cancelled) {
          setError("No pudimos cargar el PDF.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (loadingTask && typeof (loadingTask as { destroy?: unknown }).destroy === "function") {
        void (loadingTask as { destroy: () => Promise<void> | void }).destroy();
      }
    };
  }, [fileUrl]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    if (typeof container.scrollTo === "function") {
      container.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    container.scrollTop = 0;
  }, [fileUrl]);

  useEffect(() => {
    if (!pdfDoc) {
      return undefined;
    }

    return () => {
      if (typeof (pdfDoc as { destroy?: unknown }).destroy === "function") {
        void (pdfDoc as { destroy: () => Promise<void> | void }).destroy();
      }
    };
  }, [pdfDoc]);

  useEffect(() => {
    if (!contentRef.current) {
      return undefined;
    }

    const updateWidth = () => {
      setContainerWidth(contentRef.current?.clientWidth ?? 0);
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(contentRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();
      setZoomLevel((current) => {
        const direction = event.deltaY < 0 ? 1 : -1;
        return clampZoomLevel(current + direction * ZOOM_STEP);
      });
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(PDF_ZOOM_STORAGE_KEY, String(zoomLevel));
  }, [zoomLevel]);

  useEffect(() => {
    renderedPages.current = new Set();
    renderingPages.current = new Set();
  }, [zoomLevel, containerWidth, pdfDoc]);

  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    let retryTimer: number | null = null;
    const MAX_CANVAS_RETRIES = 30;

    async function renderAllPages() {
      if (!pdfDoc || containerWidth <= 0 || totalPages <= 0) {
        return;
      }

      let missingCanvas = false;
      for (let pageIndex = 1; pageIndex <= pdfDoc.numPages; pageIndex += 1) {
        if (cancelled) {
          return;
        }

        const canvas = canvasRefs.current[pageIndex - 1];
        if (!canvas) {
          missingCanvas = true;
          continue;
        }
        if (renderedPages.current.has(pageIndex) || renderingPages.current.has(pageIndex)) {
          continue;
        }

        renderingPages.current.add(pageIndex);
        try {
          const page = await pdfDoc.getPage(pageIndex);
          if (cancelled) {
            return;
          }

          const viewport = page.getViewport({ scale: 1 });
          const fitWidthScale = containerWidth / viewport.width;
          const scale = Math.max(0.1, fitWidthScale * zoomLevel);
          const scaledViewport = page.getViewport({ scale });
          const context = canvas.getContext("2d");
          if (!context) {
            continue;
          }

          canvas.width = Math.max(1, Math.floor(scaledViewport.width));
          canvas.height = Math.max(1, Math.floor(scaledViewport.height));

          await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => {
              if (typeof item !== "object" || !("str" in item)) {
                return "";
              }
              const value = item.str;
              return typeof value === "string" ? value : "";
            })
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          setPageTextByIndex((current) => ({ ...current, [pageIndex]: pageText }));
          renderedPages.current.add(pageIndex);
        } catch {
          // Keep rendering other pages even if one page fails.
          continue;
        } finally {
          renderingPages.current.delete(pageIndex);
        }
      }

      const allPagesRendered = renderedPages.current.size >= pdfDoc.numPages;
      if (!allPagesRendered && missingCanvas && retryCount < MAX_CANVAS_RETRIES && !cancelled) {
        retryCount += 1;
        retryTimer = window.setTimeout(() => {
          void renderAllPages();
        }, 50);
      }
    }

    renderAllPages();

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [pdfDoc, containerWidth, totalPages, zoomLevel]);

  useEffect(() => {
    if (!focusPage || !pdfDoc || focusPage < 1 || focusPage > pdfDoc.numPages) {
      return;
    }
    scrollToPage(focusPage);
    // We intentionally react only to incoming evidence targeting info.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPage, pdfDoc, focusRequestId]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || totalPages === 0) {
      return undefined;
    }

    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageIndex = Number(
            (entry.target as HTMLElement).dataset.pageIndex || "0"
          );
          ratios.set(pageIndex, entry.intersectionRatio);
        });

        let nextPage = 0;
        let maxRatio = 0;
        ratios.forEach((ratio, index) => {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            nextPage = index;
          }
        });

        if (nextPage > 0) {
          setPageNumber((current) => (current === nextPage ? current : nextPage));
        }
      },
      {
        root,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    pageRefs.current.forEach((page) => {
      if (page) {
        observer.observe(page);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [totalPages]);

  const pages = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages]
  );

  const scrollToPage = (targetPage: number, event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    const container = scrollRef.current;
    const page = pageRefs.current[targetPage - 1];
    if (!page || !container) {
      return;
    }
    if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_PDF_VIEWER === "true") {
      console.debug("[PdfViewer] navigate", {
        currentPage: pageNumber,
        targetPage,
        totalPages,
        renderedPages: renderedPages.current.size,
      });
    }
    setPageNumber(targetPage);
    const containerRect = container.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();
    const targetTop = pageRect.top - containerRect.top + container.scrollTop;
    container.scrollTo({ top: targetTop, behavior: "smooth" });
  };

  const canGoBack = pageNumber > 1;
  const canGoForward = pageNumber < totalPages;
  const canZoomOut = zoomLevel > MIN_ZOOM_LEVEL;
  const canZoomIn = zoomLevel < MAX_ZOOM_LEVEL;
  const zoomPercent = Math.round(zoomLevel * 100);
  const navDisabled = loading || !pdfDoc;
  const showPageNavigation = Boolean(fileUrl) && !loading && !error && totalPages > 0;
  const normalizedSnippet = (highlightSnippet ?? "").trim().toLowerCase();
  const normalizedFocusedPageText = focusPage
    ? (pageTextByIndex[focusPage] ?? "").toLowerCase()
    : "";
  const isSnippetLocated =
    Boolean(normalizedSnippet) &&
    Boolean(focusPage) &&
    normalizedFocusedPageText.includes(normalizedSnippet);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showPageNavigation && (
        <div className="relative z-20 flex items-center justify-between gap-4 border-b border-black/10 pb-3">
          <div className="flex min-w-0 items-center gap-1">{toolbarLeftContent}</div>

          <div className="flex items-center gap-1">
            <IconButtonWithTooltip
              ariaLabel="Alejar"
              tooltip="Alejar"
              disabled={!canZoomOut}
              onClick={() => setZoomLevel((current) => clampZoomLevel(current - ZOOM_STEP))}
            >
              <ZoomOut size={17} className="h-[17px] w-[17px] shrink-0 text-ink" />
            </IconButtonWithTooltip>

            <Tooltip content="Nivel de zoom">
              <p
                className="min-w-14 text-center text-sm font-semibold text-muted"
                aria-label="Nivel de zoom"
                data-testid="pdf-zoom-indicator"
              >
                {zoomPercent}%
              </p>
            </Tooltip>

            <IconButtonWithTooltip
              ariaLabel="Acercar"
              tooltip="Acercar"
              disabled={!canZoomIn}
              onClick={() => setZoomLevel((current) => clampZoomLevel(current + ZOOM_STEP))}
            >
              <ZoomIn size={17} className="h-[17px] w-[17px] shrink-0 text-ink" />
            </IconButtonWithTooltip>

            <IconButtonWithTooltip
              ariaLabel="Ajustar al ancho"
              tooltip="Ajustar al ancho"
              onClick={() => setZoomLevel(1)}
            >
              <ScanLine size={17} className="h-[17px] w-[17px] shrink-0 text-ink" />
            </IconButtonWithTooltip>
          </div>

          <span aria-hidden="true" className="h-5 w-px bg-black/15" />

          <div className="flex items-center gap-1">
            <IconButtonWithTooltip
              ariaLabel="Página anterior"
              tooltip="Página anterior"
              disabled={navDisabled || !canGoBack}
              onClick={() => scrollToPage(Math.max(1, pageNumber - 1))}
            >
              <ChevronLeft size={18} className="h-[18px] w-[18px] shrink-0 text-ink" />
            </IconButtonWithTooltip>
            <p className="min-w-12 text-center text-sm font-semibold text-muted">
              {pageNumber}/{totalPages}
            </p>
            <IconButtonWithTooltip
              ariaLabel="Página siguiente"
              tooltip="Página siguiente"
              disabled={navDisabled || !canGoForward}
              onClick={() => scrollToPage(Math.min(totalPages, pageNumber + 1))}
            >
              <ChevronRight size={18} className="h-[18px] w-[18px] shrink-0 text-ink" />
            </IconButtonWithTooltip>
          </div>

          {toolbarRightExtra ? (
            <>
              <span aria-hidden="true" className="h-5 w-px bg-black/15" />
              <div className="flex items-center gap-1">{toolbarRightExtra}</div>
            </>
          ) : null}
        </div>
      )}
      <div className="relative mt-4 min-h-0 flex-1">
        <div
          ref={scrollRef}
          data-testid="pdf-scroll-container"
          className="h-full min-h-0 overflow-y-auto rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm"
        >
        <div ref={contentRef} className="mx-auto w-full">
          {loading && (
            <motion.div
              className="flex h-72 items-center justify-center text-sm text-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Cargando PDF...
            </motion.div>
          )}
          {error && (
            <div className="flex h-72 items-center justify-center text-sm text-red-600">
              {error}
            </div>
          )}
          {!loading &&
            !error &&
            fileUrl &&
            pages.map((page) => (
              <div
                key={page}
                ref={(node) => {
                  pageRefs.current[page - 1] = node;
                }}
                data-page-index={page}
                data-testid="pdf-page"
                className={`mb-6 last:mb-0 ${
                  focusPage === page && isSnippetLocated
                    ? "rounded-xl border-2 border-accent p-1"
                    : ""
                }`}
              >
                  <motion.canvas
                    ref={(node) => {
                      canvasRefs.current[page - 1] = node;
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mx-auto rounded-xl bg-white shadow"
                  />
              </div>
            ))}
          {!fileUrl && !loading && (
            <div className="flex h-72 items-center justify-center text-sm text-muted">
              Selecciona un documento para iniciar la vista previa.
            </div>
          )}
        </div>
        </div>
        {isDragOver && (
          <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-white/75 ring-2 ring-accent/40">
            <p className="text-sm font-semibold text-ink">Suelta el PDF para subirlo</p>
          </div>
        )}
      </div>
    </div>
  );
}

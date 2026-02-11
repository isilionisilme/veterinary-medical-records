import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

type PdfViewerProps = {
  fileUrl: string | null;
  filename?: string | null;
  isDragOver?: boolean;
};

export function PdfViewer({ fileUrl, filename, isDragOver = false }: PdfViewerProps) {
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
          const scale = containerWidth / viewport.width;
          const scaledViewport = page.getViewport({ scale });
          const context = canvas.getContext("2d");
          if (!context) {
            continue;
          }

          canvas.width = Math.max(1, Math.floor(scaledViewport.width));
          canvas.height = Math.max(1, Math.floor(scaledViewport.height));

          await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
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
  }, [pdfDoc, containerWidth, totalPages]);

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
  const navDisabled = loading || !pdfDoc;
  const showPageNavigation = Boolean(fileUrl) && !loading && !error && totalPages > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showPageNavigation && (
        <div className="relative z-20 flex items-center justify-center gap-2 border-b border-black/10 pb-3">
          <button
            type="button"
            aria-label="Página anterior"
            onClick={(event) => scrollToPage(Math.max(1, pageNumber - 1), event)}
            disabled={navDisabled || !canGoBack}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-white/90 p-0 leading-none text-ink shadow-sm transition hover:bg-accentSoft disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} className="h-[18px] w-[18px] shrink-0 text-ink" />
          </button>
          <p className="min-w-12 text-center text-sm font-semibold text-muted">
            {pageNumber}/{totalPages}
          </p>
          <button
            type="button"
            aria-label="Página siguiente"
            onClick={(event) => scrollToPage(Math.min(totalPages, pageNumber + 1), event)}
            disabled={navDisabled || !canGoForward}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-white/90 p-0 leading-none text-ink shadow-sm transition hover:bg-accentSoft disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} className="h-[18px] w-[18px] shrink-0 text-ink" />
          </button>
        </div>
      )}
      <div className="relative mt-4 min-h-0 flex-1">
        <div
          ref={scrollRef}
          data-testid="pdf-scroll-container"
          className="h-full min-h-0 overflow-y-auto rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm"
        >
        <div ref={contentRef} className="mx-auto w-full max-w-3xl">
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
                className="mb-6 last:mb-0"
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

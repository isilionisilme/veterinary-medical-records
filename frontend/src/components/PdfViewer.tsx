import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min?url";

import { Button } from "./ui/button";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

type PdfViewerProps = {
  fileUrl: string | null;
  filename?: string | null;
};

export function PdfViewer({ fileUrl, filename }: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const renderedPages = useRef<Set<number>>(new Set());
  const [totalPages, setTotalPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [canvasesReady, setCanvasesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      if (!fileUrl) {
        setPdfDoc(null);
        setTotalPages(0);
        setPageNumber(1);
        setError(null);
        setCanvasesReady(false);
        return;
      }

      pageRefs.current = [];
      canvasRefs.current = [];
      renderedPages.current = new Set();
      setCanvasesReady(false);

      setLoading(true);
      setError(null);
      try {
        const task = pdfjsLib.getDocument(fileUrl);
        const doc = await task.promise;
        if (cancelled) {
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
    };
  }, [fileUrl]);

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

    async function renderAllPages() {
      if (!pdfDoc || containerWidth <= 0 || !canvasesReady) {
        return;
      }

      for (let pageIndex = 1; pageIndex <= pdfDoc.numPages; pageIndex += 1) {
        const canvas = canvasRefs.current[pageIndex - 1];
        if (!canvas) {
          continue;
        }

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

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
        renderedPages.current.add(pageIndex);
      }
    }

    renderAllPages();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, containerWidth, canvasesReady]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || totalPages === 0 || !canvasesReady) {
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

        let nextPage = pageNumber;
        let maxRatio = 0;
        ratios.forEach((ratio, index) => {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            nextPage = index;
          }
        });

        if (nextPage && nextPage !== pageNumber) {
          setPageNumber(nextPage);
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
  }, [pageNumber, totalPages, canvasesReady]);

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
  const navDisabled = loading || !pdfDoc || !canvasesReady;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b border-black/10 pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            type="button"
            onClick={(event) => scrollToPage(Math.max(1, pageNumber - 1), event)}
            disabled={navDisabled || !canGoBack}
          >
            <ChevronLeft size={16} />
            Anterior
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={(event) => scrollToPage(Math.min(totalPages, pageNumber + 1), event)}
            disabled={navDisabled || !canGoForward}
          >
            Siguiente
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        data-testid="pdf-scroll-container"
        className="mt-4 flex-1 overflow-auto rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm"
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
                    if (
                      !canvasesReady &&
                      totalPages > 0 &&
                      canvasRefs.current.slice(0, totalPages).every(Boolean)
                    ) {
                      // Ensures we don't start rendering until all canvases exist.
                      setCanvasesReady(true);
                    }
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
      {totalPages > 0 && (
        <div className="mt-3 text-sm text-muted">
          Pagina {pageNumber} de {totalPages}
        </div>
      )}
    </div>
  );
}

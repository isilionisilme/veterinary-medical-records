import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ScanLine, Upload, ZoomIn, ZoomOut } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min?url";
import { IconButton } from "./app/IconButton";
import { Tooltip } from "./ui/tooltip";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const PDF_ZOOM_STORAGE_KEY = "pdfViewerZoomLevel";
const MIN_ZOOM_LEVEL = 0.5;
const MAX_ZOOM_LEVEL = 2;
const ZOOM_STEP = 0.1;

function clampZoomLevel(value: number): number {
  return Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, value));
}

type PdfViewerProps = {
  documentId?: string | null;
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
  documentId = null,
  fileUrl,
  filename,
  isDragOver = false,
  focusPage = null,
  highlightSnippet = null,
  focusRequestId = 0,
  toolbarLeftContent,
  toolbarRightExtra,
}: PdfViewerProps) {
  const debugFlags = useMemo(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") {
      return {
        enabled: false,
        noTransformSubtree: false,
        noMotion: false,
        hardRemountCanvas: false,
      };
    }

    const params = new URLSearchParams(window.location.search);
    const enabled =
      params.get("pdfDebug") === "1" || window.localStorage.getItem("pdfDebug") === "1";

    return {
      enabled,
      noTransformSubtree: enabled && params.get("pdfDebugNoTransform") === "1",
      noMotion: enabled && params.get("pdfDebugNoMotion") === "1",
      hardRemountCanvas: enabled && params.get("pdfDebugHardRemount") === "1",
    };
  }, []);

  const nodeIdentityMapRef = useRef<WeakMap<Element, string>>(new WeakMap());
  const nodeIdentityCounterRef = useRef(0);
  const lastCanvasNodeByPageRef = useRef<Map<number, string>>(new Map());
  const renderTaskStatusRef = useRef<Map<number, string>>(new Map());
  const renderTasksByPageRef = useRef<Map<number, pdfjsLib.RenderTask>>(new Map());
  const currentDocumentIdRef = useRef<string | null>(documentId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const renderedPages = useRef<Set<number>>(new Set());
  const renderingPages = useRef<Set<number>>(new Set());
  const renderSessionRef = useRef(0);
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

  function cancelAllRenderTasks() {
    for (const task of renderTasksByPageRef.current.values()) {
      try {
        task.cancel();
      } catch {
        // ignore cancellation errors
      }
    }
    renderTasksByPageRef.current.clear();
  }

  function getNodeId(element: Element | null): string | null {
    if (!element) {
      return null;
    }
    let existing = nodeIdentityMapRef.current.get(element);
    if (!existing) {
      nodeIdentityCounterRef.current += 1;
      existing = `node-${nodeIdentityCounterRef.current}`;
      nodeIdentityMapRef.current.set(element, existing);
    }
    return existing;
  }

  function analyzeTransform(rawTransform: string): {
    determinant: number | null;
    negativeDeterminant: boolean;
    hasMirrorScale: boolean;
  } {
    const transform = rawTransform.trim();
    if (transform === "none") {
      return {
        determinant: null,
        negativeDeterminant: false,
        hasMirrorScale: false,
      };
    }

    const scaleMirrorPattern = /scaleX\(\s*-|scale\(\s*-|matrix\(\s*-|matrix3d\(\s*-/i;
    const hasMirrorScale = scaleMirrorPattern.test(transform);

    const matrixMatch = transform.match(/^matrix\(([^)]+)\)$/i);
    if (matrixMatch) {
      const values = matrixMatch[1].split(",").map((value) => Number(value.trim()));
      if (values.length === 6 && values.every((value) => Number.isFinite(value))) {
        const [a, b, c, d] = values;
        const determinant = a * d - b * c;
        return {
          determinant,
          negativeDeterminant: determinant < 0,
          hasMirrorScale,
        };
      }
    }

    const matrix3dMatch = transform.match(/^matrix3d\(([^)]+)\)$/i);
    if (matrix3dMatch) {
      const values = matrix3dMatch[1].split(",").map((value) => Number(value.trim()));
      if (values.length === 16 && values.every((value) => Number.isFinite(value))) {
        const a = values[0];
        const b = values[1];
        const c = values[4];
        const d = values[5];
        const determinant = a * d - b * c;
        return {
          determinant,
          negativeDeterminant: determinant < 0,
          hasMirrorScale,
        };
      }
    }

    return {
      determinant: null,
      negativeDeterminant: false,
      hasMirrorScale,
    };
  }

  function captureDebugSnapshot(params: {
    reason: string;
    pageIndex: number;
    canvas: HTMLCanvasElement;
    viewportScale: number;
    viewportRotation: number;
    renderTaskStatus: string;
    textLayerNodeId?: string | null;
  }) {
    if (!debugFlags.enabled || typeof window === "undefined") {
      return;
    }

    const chain: Array<Record<string, unknown>> = [];
    let current: HTMLElement | null = params.canvas;
    for (let depth = 0; depth <= 6 && current; depth += 1) {
      const style = window.getComputedStyle(current);
      const transform = style.transform;
      const analysis = analyzeTransform(transform);
      chain.push({
        depth,
        nodeId: getNodeId(current),
        tag: current.tagName,
        id: current.id || null,
        className: current.className || null,
        transform,
        transformOrigin: style.transformOrigin,
        direction: style.direction,
        writingMode: style.writingMode,
        scale: (style as CSSStyleDeclaration & { scale?: string }).scale ?? null,
        determinant: analysis.determinant,
        negativeDeterminant: analysis.negativeDeterminant,
        hasMirrorScale: analysis.hasMirrorScale,
        dirAttr: current.getAttribute("dir"),
      });
      current = current.parentElement;
    }

    const rect = params.canvas.getBoundingClientRect();
    const canvasNodeId = getNodeId(params.canvas);
    const previousCanvasNodeId = lastCanvasNodeByPageRef.current.get(params.pageIndex) ?? null;
    const canvasReused = previousCanvasNodeId === canvasNodeId;
    if (canvasNodeId) {
      lastCanvasNodeByPageRef.current.set(params.pageIndex, canvasNodeId);
    }

    const chainHasFlip = chain.some((entry) => {
      const negativeDeterminant = Boolean(entry.negativeDeterminant);
      const hasMirrorScale = Boolean(entry.hasMirrorScale);
      return negativeDeterminant || hasMirrorScale;
    });

    const snapshot = {
      timestamp: new Date().toISOString(),
      reason: params.reason,
      chainHasFlip,
      viewer: {
        documentId,
        fileUrl,
        filename,
        pageNumber,
        renderedPageIndex: params.pageIndex,
        zoomLevel,
        viewportScale: params.viewportScale,
        viewportRotation: params.viewportRotation,
        appliedRotationState: 0,
        renderTaskStatus: params.renderTaskStatus,
        renderSession: renderSessionRef.current,
      },
      runtime: {
        devicePixelRatio: window.devicePixelRatio,
      },
      canvas: {
        nodeId: canvasNodeId,
        reused: canvasReused,
        previousNodeId: previousCanvasNodeId,
        attrWidth: params.canvas.width,
        attrHeight: params.canvas.height,
        styleWidth: params.canvas.style.width || null,
        styleHeight: params.canvas.style.height || null,
        computedTransform: window.getComputedStyle(params.canvas).transform,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
      },
      layers: {
        textLayerNodeId: params.textLayerNodeId ?? null,
        textLayerReused: false,
      },
      chain,
    };

    const debugWindow = window as Window & {
      __pdfBugSnapshots?: Array<Record<string, unknown>>;
    };
    const store = debugWindow.__pdfBugSnapshots ?? [];
    store.push(snapshot as unknown as Record<string, unknown>);
    if (store.length > 200) {
      store.shift();
    }
    debugWindow.__pdfBugSnapshots = store;

    console.groupCollapsed(
      `[PdfBugSnapshot] ${params.reason} | doc=${documentId ?? "unknown"} page=${params.pageIndex}`,
    );
    console.log(snapshot);
    console.groupEnd();
  }

  useEffect(() => {
    if (!debugFlags.enabled || !debugFlags.noMotion || typeof document === "undefined") {
      return;
    }
    document.body.classList.add("pdf-debug-no-motion");
    return () => {
      document.body.classList.remove("pdf-debug-no-motion");
    };
  }, [debugFlags.enabled, debugFlags.noMotion]);

  useEffect(() => {
    currentDocumentIdRef.current = documentId;
  }, [documentId]);

  useEffect(() => {
    renderSessionRef.current += 1;
    cancelAllRenderTasks();
    renderedPages.current = new Set();
    renderingPages.current = new Set();
    pageRefs.current = [];
    canvasRefs.current = [];
    lastCanvasNodeByPageRef.current = new Map();
    renderTaskStatusRef.current = new Map();
    setPageTextByIndex({});
  }, [documentId]);

  useEffect(() => {
    renderSessionRef.current += 1;
    cancelAllRenderTasks();
  }, [zoomLevel]);

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
      renderSessionRef.current += 1;
      cancelAllRenderTasks();
      renderTaskStatusRef.current = new Map();
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
      } catch (_err) {
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
      cancelAllRenderTasks();
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
      cancelAllRenderTasks();
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
    const renderSession = ++renderSessionRef.current;
    const sessionDocumentId = documentId;
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
        if (cancelled || renderSession !== renderSessionRef.current) {
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
          if (cancelled || renderSession !== renderSessionRef.current) {
            return;
          }

          const viewport = page.getViewport({ scale: 1 });
          const fitWidthScale = containerWidth / viewport.width;
          const scale = Math.max(0.1, fitWidthScale * zoomLevel);
          const scaledViewport = page.getViewport({ scale });
          const expectedPage = pageIndex;
          const context = canvas.getContext("2d");
          if (!context) {
            continue;
          }

          const preRenderTransform =
            typeof context.getTransform === "function"
              ? context.getTransform().toString()
              : "unavailable";

          canvas.width = Math.max(1, Math.floor(scaledViewport.width));
          canvas.height = Math.max(1, Math.floor(scaledViewport.height));
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, canvas.width, canvas.height);

          const existingTask = renderTasksByPageRef.current.get(pageIndex);
          if (existingTask) {
            try {
              existingTask.cancel();
            } catch {
              // ignore cancellation errors
            }
          }

          const renderTask = page.render({ canvasContext: context, viewport: scaledViewport });
          renderTasksByPageRef.current.set(pageIndex, renderTask);
          renderTaskStatusRef.current.set(pageIndex, "started");
          await renderTask.promise;
          renderTasksByPageRef.current.delete(pageIndex);
          renderTaskStatusRef.current.set(pageIndex, "completed");
          if (cancelled || renderSession !== renderSessionRef.current) {
            if (debugFlags.enabled) {
              console.debug("[PdfViewerDebug] stale-render-ignored", {
                reason: "session-mismatch",
                sessionAtStart: renderSession,
                sessionCurrent: renderSessionRef.current,
                documentIdAtStart: sessionDocumentId,
                documentIdCurrent: currentDocumentIdRef.current,
                pageIndex,
              });
            }
            return;
          }

          if (sessionDocumentId !== currentDocumentIdRef.current) {
            if (debugFlags.enabled) {
              console.debug("[PdfViewerDebug] stale-render-ignored", {
                reason: "document-mismatch",
                sessionAtStart: renderSession,
                sessionCurrent: renderSessionRef.current,
                documentIdAtStart: sessionDocumentId,
                documentIdCurrent: currentDocumentIdRef.current,
                pageIndex,
              });
            }
            return;
          }

          if (expectedPage !== pageIndex) {
            if (debugFlags.enabled) {
              console.debug("[PdfViewerDebug] stale-render-ignored", {
                reason: "page-mismatch",
                expectedPage,
                pageIndex,
                sessionAtStart: renderSession,
                sessionCurrent: renderSessionRef.current,
                documentIdAtStart: sessionDocumentId,
                documentIdCurrent: currentDocumentIdRef.current,
              });
            }
            return;
          }

          const postRenderTransform =
            typeof context.getTransform === "function"
              ? context.getTransform().toString()
              : "unavailable";

          if (debugFlags.enabled) {
            console.debug("[PdfViewerDebug] context-transform", {
              documentId,
              pageIndex,
              preRenderTransform,
              postRenderTransform,
              renderTaskStatus: renderTaskStatusRef.current.get(pageIndex),
            });
          }

          captureDebugSnapshot({
            reason: "page-render-finished",
            pageIndex,
            canvas,
            viewportScale: scale,
            viewportRotation: scaledViewport.rotation,
            renderTaskStatus: renderTaskStatusRef.current.get(pageIndex) ?? "unknown",
          });

          const latestSnapshots = (
            window as Window & {
              __pdfBugSnapshots?: Array<{ chainHasFlip?: boolean }>;
            }
          ).__pdfBugSnapshots;
          const latestSnapshot = latestSnapshots?.[latestSnapshots.length - 1];
          if (latestSnapshot?.chainHasFlip) {
            captureDebugSnapshot({
              reason: "flip-detected-transform-chain",
              pageIndex,
              canvas,
              viewportScale: scale,
              viewportRotation: scaledViewport.rotation,
              renderTaskStatus: renderTaskStatusRef.current.get(pageIndex) ?? "unknown",
            });
          }

          const textContent = await page.getTextContent();
          if (cancelled || renderSession !== renderSessionRef.current) {
            return;
          }
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
        } catch (error) {
          renderTasksByPageRef.current.delete(pageIndex);
          const errorName =
            typeof error === "object" && error && "name" in error
              ? String((error as { name?: unknown }).name)
              : "UnknownError";
          if (errorName === "RenderingCancelledException") {
            renderTaskStatusRef.current.set(pageIndex, "cancelled");
          } else {
            renderTaskStatusRef.current.set(pageIndex, "failed");
          }
          // Keep rendering other pages even if one page fails.
          continue;
        } finally {
          renderingPages.current.delete(pageIndex);
        }
      }

      const allPagesRendered = renderedPages.current.size >= pdfDoc.numPages;
      if (
        !allPagesRendered &&
        missingCanvas &&
        retryCount < MAX_CANVAS_RETRIES &&
        !cancelled &&
        renderSession === renderSessionRef.current
      ) {
        retryCount += 1;
        retryTimer = window.setTimeout(() => {
          void renderAllPages();
        }, 50);
      }
    }

    renderAllPages();

    return () => {
      cancelled = true;
      cancelAllRenderTasks();
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [pdfDoc, containerWidth, totalPages, zoomLevel, documentId, debugFlags.enabled]);

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
          const pageIndex = Number((entry.target as HTMLElement).dataset.pageIndex || "0");
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
      },
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
    [totalPages],
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
    <div
      className={`flex h-full min-h-0 flex-col gap-[var(--canvas-gap)] ${
        debugFlags.enabled && debugFlags.noTransformSubtree ? "pdf-debug-no-transform-subtree" : ""
      }`}
      data-pdf-debug={debugFlags.enabled ? "on" : "off"}
    >
      {showPageNavigation && (
        <div
          data-testid="pdf-toolbar-shell"
          className="panel-shell relative z-20 flex items-center justify-between gap-4 px-2 py-2"
        >
          <div className="flex min-w-0 items-center gap-1">{toolbarLeftContent}</div>

          <div className="flex items-center gap-1">
            <IconButton
              label="Alejar"
              tooltip="Alejar"
              disabled={!canZoomOut}
              onClick={() => setZoomLevel((current) => clampZoomLevel(current - ZOOM_STEP))}
            >
              <ZoomOut size={17} className="h-[17px] w-[17px] shrink-0" />
            </IconButton>

            <Tooltip content="Nivel de zoom">
              <p
                className="min-w-14 text-center text-sm font-semibold text-textSecondary"
                aria-label="Nivel de zoom"
                data-testid="pdf-zoom-indicator"
              >
                {zoomPercent}%
              </p>
            </Tooltip>

            <IconButton
              label="Acercar"
              tooltip="Acercar"
              disabled={!canZoomIn}
              onClick={() => setZoomLevel((current) => clampZoomLevel(current + ZOOM_STEP))}
            >
              <ZoomIn size={17} className="h-[17px] w-[17px] shrink-0" />
            </IconButton>

            <IconButton
              label="Ajustar al ancho"
              tooltip="Ajustar al ancho"
              onClick={() => setZoomLevel(1)}
            >
              <ScanLine size={17} className="h-[17px] w-[17px] shrink-0" />
            </IconButton>
          </div>

          <span aria-hidden="true" className="h-5 w-px bg-page" />

          <div className="flex items-center gap-1">
            <IconButton
              label="Página anterior"
              tooltip="Página anterior"
              disabled={navDisabled || !canGoBack}
              onClick={() => scrollToPage(Math.max(1, pageNumber - 1))}
            >
              <ChevronLeft size={18} className="h-[18px] w-[18px] shrink-0" />
            </IconButton>
            <p className="min-w-12 text-center text-sm font-semibold text-textSecondary">
              {pageNumber}/{totalPages}
            </p>
            <IconButton
              label="Página siguiente"
              tooltip="Página siguiente"
              disabled={navDisabled || !canGoForward}
              onClick={() => scrollToPage(Math.min(totalPages, pageNumber + 1))}
            >
              <ChevronRight size={18} className="h-[18px] w-[18px] shrink-0" />
            </IconButton>
          </div>

          {toolbarRightExtra ? (
            <>
              <span aria-hidden="true" className="h-5 w-px bg-page" />
              <div className="flex items-center gap-1">{toolbarRightExtra}</div>
            </>
          ) : null}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          data-testid="pdf-scroll-container"
          className="panel-shell h-full min-h-0 overflow-y-auto p-[var(--canvas-gap)]"
        >
          <div ref={contentRef} className="mx-auto w-full">
            {loading && (
              <div className="flex h-72 items-center justify-center text-sm text-muted">
                Cargando PDF...
              </div>
            )}
            {error && (
              <div className="flex h-72 items-center justify-center text-sm text-statusError">
                {error}
              </div>
            )}
            {!loading &&
              !error &&
              fileUrl &&
              pages.map((page) => (
                <div
                  key={
                    debugFlags.enabled && debugFlags.hardRemountCanvas
                      ? `${documentId ?? fileUrl ?? "unknown"}:${page}:${zoomLevel}:0`
                      : `${documentId ?? fileUrl ?? "unknown"}:${page}`
                  }
                  ref={(node) => {
                    pageRefs.current[page - 1] = node;
                  }}
                  data-page-index={page}
                  data-testid="pdf-page"
                  className={`mb-6 last:mb-0 ${
                    focusPage === page && isSnippetLocated ? "rounded-card bg-accent/10 p-1" : ""
                  }`}
                >
                  <canvas
                    ref={(node) => {
                      canvasRefs.current[page - 1] = node;
                    }}
                    className="mx-auto rounded-card bg-surface"
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
          <div className="pointer-events-none absolute inset-3 z-10 flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-statusSuccess bg-surface/75 backdrop-blur-[1px]">
            <Upload size={20} className="text-statusSuccess" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">Suelta el PDF para subirlo</p>
          </div>
        )}
      </div>
    </div>
  );
}

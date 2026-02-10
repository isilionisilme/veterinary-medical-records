import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

import { PdfViewer } from "./PdfViewer";

vi.mock("pdfjs-dist/build/pdf.worker.min?url", () => ({
  default: "pdf-worker",
}));

let mockDoc: {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getViewport: ({ scale }: { scale: number }) => { width: number; height: number };
    render: () => { promise: Promise<void> };
  }>;
};

vi.mock("pdfjs-dist", () => {
  return {
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: vi.fn(() => ({
      promise: Promise.resolve(mockDoc),
    })),
  };
});

let lastObserver: MockIntersectionObserver | null = null;

class MockIntersectionObserver {
  private readonly callback: IntersectionObserverCallback;
  private readonly elements: Element[] = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    lastObserver = this;
  }

  observe(target: Element) {
    this.elements.push(target);
  }

  unobserve() {}

  disconnect() {}

  trigger(entries: IntersectionObserverEntry[]) {
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

describe("PdfViewer", () => {
  beforeEach(() => {
    const renderCallsByPage = new Map<number, number>();

    mockDoc = {
      numPages: 3,
      getPage: vi.fn(async (pageNumber: number) => ({
        getViewport: () => ({ width: 600, height: 800 }),
        render: () => {
          renderCallsByPage.set(pageNumber, (renderCallsByPage.get(pageNumber) ?? 0) + 1);
          return { promise: Promise.resolve() };
        },
      })),
    };
    lastObserver = null;
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  it("renders all pages in a continuous scroll", async () => {
    render(<PdfViewer fileUrl="blob://sample" filename="record.pdf" />);

    const pages = await screen.findAllByTestId("pdf-page");
    expect(pages).toHaveLength(3);
    await waitFor(() => {
      expect(mockDoc.getPage).toHaveBeenCalledWith(2);
    });
  });

  it("scrolls to next and previous pages on button click", async () => {
    const windowScrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    render(<PdfViewer fileUrl="blob://sample" filename="record.pdf" />);

    const pages = await screen.findAllByTestId("pdf-page");
    const container = screen.getByTestId("pdf-scroll-container");
    const containerScrollTo = vi.fn();
    (container as HTMLElement & { scrollTo: typeof container.scrollTo }).scrollTo = containerScrollTo;
    Object.defineProperty(container, "scrollTop", { value: 10, writable: true });
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 100,
      top: 100,
      left: 0,
      right: 600,
      bottom: 800,
      width: 600,
      height: 700,
      toJSON: () => "",
    });
    vi.spyOn(pages[1], "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 500,
      top: 500,
      left: 0,
      right: 600,
      bottom: 1300,
      width: 600,
      height: 800,
      toJSON: () => "",
    });

    const [nextButton] = screen.getAllByRole("button", { name: /Pagina siguiente/i });
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });
    fireEvent.click(nextButton);

    expect(containerScrollTo).toHaveBeenCalledWith({ top: 410, behavior: "smooth" });
    expect(windowScrollSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/Pagina 2 \/ 3/)).toBeInTheDocument();

    const [prevButton] = screen.getAllByRole("button", { name: /Pagina anterior/i });
    await waitFor(() => {
      expect(prevButton).not.toBeDisabled();
    });
    fireEvent.click(prevButton);
    expect(containerScrollTo).toHaveBeenCalledTimes(2);
    expect(windowScrollSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/Pagina 1 \/ 3/)).toBeInTheDocument();
  });

  it("updates the active page based on scroll position", async () => {
    render(<PdfViewer fileUrl="blob://sample" filename="record.pdf" />);

    const pages = await screen.findAllByTestId("pdf-page");
    expect(lastObserver).not.toBeNull();

    act(() => {
      lastObserver?.trigger([
        {
          target: pages[2],
          intersectionRatio: 0.8,
          isIntersecting: true,
        } as unknown as IntersectionObserverEntry,
      ]);
    });

    expect(screen.getByText(/Pagina 3 \/ 3/)).toBeInTheDocument();
  });

  it("disables Next on the last page (bounds)", async () => {
    render(<PdfViewer fileUrl="blob://sample" filename="record.pdf" />);

    const pages = await screen.findAllByTestId("pdf-page");
    expect(lastObserver).not.toBeNull();

    act(() => {
      lastObserver?.trigger([
        {
          target: pages[2],
          intersectionRatio: 0.9,
          isIntersecting: true,
        } as unknown as IntersectionObserverEntry,
      ]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Pagina 3 \/ 3/)).toBeInTheDocument();
    });

    const [nextButton] = screen.getAllByRole("button", { name: /Pagina siguiente/i });
    expect(nextButton).toBeDisabled();
  });

  it("hides page navigation when no document is selected", () => {
    render(<PdfViewer fileUrl={null} filename={null} />);

    expect(screen.queryByRole("button", { name: /Pagina siguiente/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pagina anterior/i })).toBeNull();
  });
});


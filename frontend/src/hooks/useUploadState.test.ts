import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useUploadState } from "./useUploadState";

function buildFile(name: string, type: string, size = 128) {
  const file = new File(["x".repeat(size)], name, { type });
  return file;
}

function buildDragEvent(file?: File) {
  return {
    dataTransfer: {
      types: ["Files"],
      files: file ? [file] : [],
    },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as Parameters<ReturnType<typeof useUploadState>["handleViewerDragEnter"]>[0];
}

describe("useUploadState", () => {
  it("exposes default state and opens file picker when not pending", () => {
    const { result } = renderHook(() =>
      useUploadState({
        isUploadPending: false,
        maxUploadSizeBytes: 1024,
        onQueueUpload: vi.fn(),
        onSetUploadFeedback: vi.fn(),
      }),
    );
    const click = vi.fn();

    act(() => {
      result.current.fileInputRef.current = { click } as unknown as HTMLInputElement;
      result.current.handleOpenUploadArea({ stopPropagation: vi.fn() });
    });

    expect(result.current.isDragOverViewer).toBe(false);
    expect(result.current.isDragOverSidebarUpload).toBe(false);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("tracks viewer drag enter/leave", () => {
    const { result } = renderHook(() =>
      useUploadState({
        isUploadPending: false,
        maxUploadSizeBytes: 1024,
        onQueueUpload: vi.fn(),
        onSetUploadFeedback: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleViewerDragEnter(buildDragEvent());
    });
    expect(result.current.isDragOverViewer).toBe(true);

    act(() => {
      result.current.handleViewerDragLeave(buildDragEvent());
    });
    expect(result.current.isDragOverViewer).toBe(false);
  });

  it("rejects invalid sidebar file input and clears the input value", () => {
    const onQueueUpload = vi.fn();
    const onSetUploadFeedback = vi.fn();
    const { result } = renderHook(() =>
      useUploadState({
        isUploadPending: false,
        maxUploadSizeBytes: 1024,
        onQueueUpload,
        onSetUploadFeedback,
      }),
    );
    const invalidFile = buildFile("notes.txt", "text/plain");
    const event = {
      target: { files: [invalidFile] },
      currentTarget: { value: "selected.txt" },
    } as unknown as Parameters<
      ReturnType<typeof useUploadState>["handleSidebarFileInputChange"]
    >[0];

    act(() => {
      result.current.handleSidebarFileInputChange(event);
    });

    expect(onQueueUpload).not.toHaveBeenCalled();
    expect(onSetUploadFeedback).toHaveBeenCalledWith({
      kind: "error",
      message: "Solo se admiten archivos PDF.",
    });
    expect(event.currentTarget.value).toBe("");
  });

  it("handles sidebar drop and queues valid pdf", () => {
    const onQueueUpload = vi.fn();
    const onSetUploadFeedback = vi.fn();
    const onSidebarUploadDrop = vi.fn();
    const { result } = renderHook(() =>
      useUploadState({
        isUploadPending: false,
        maxUploadSizeBytes: 1024 * 1024,
        onQueueUpload,
        onSetUploadFeedback,
        onSidebarUploadDrop,
      }),
    );
    const pdfFile = buildFile("report.pdf", "application/pdf");

    act(() => {
      result.current.handleSidebarUploadDrop(buildDragEvent(pdfFile));
    });

    expect(onSidebarUploadDrop).toHaveBeenCalledTimes(1);
    expect(onSetUploadFeedback).toHaveBeenCalledWith(null);
    expect(onQueueUpload).toHaveBeenCalledWith(pdfFile);
    expect(result.current.isDragOverSidebarUpload).toBe(false);
  });
});

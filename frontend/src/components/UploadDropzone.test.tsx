import type { ComponentProps, DragEvent, KeyboardEvent, MouseEvent } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UploadDropzone } from "./UploadDropzone";

const noop = vi.fn();

function renderDropzone(overrides?: Partial<ComponentProps<typeof UploadDropzone>>) {
  const onActivate = vi.fn();
  render(
    <UploadDropzone
      isDragOver={false}
      onActivate={
        onActivate as (event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => void
      }
      onDragEnter={noop as (event: DragEvent<HTMLDivElement>) => void}
      onDragOver={noop as (event: DragEvent<HTMLDivElement>) => void}
      onDragLeave={noop as (event: DragEvent<HTMLDivElement>) => void}
      onDrop={noop as (event: DragEvent<HTMLDivElement>) => void}
      {...overrides}
    />,
  );
  return { onActivate };
}

describe("UploadDropzone", () => {
  it("activates on Enter and Space key presses", () => {
    const { onActivate } = renderDropzone();
    const button = screen.getByRole("button");

    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: " " });

    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it("shows drag overlay only when both overlay and drag state are active", () => {
    const { rerender } = render(
      <UploadDropzone
        isDragOver={false}
        showDropOverlay={true}
        onActivate={noop}
        onDragEnter={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
      />,
    );

    expect(screen.queryByText(/Suelta el PDF para subirlo/i)).toBeNull();

    rerender(
      <UploadDropzone
        isDragOver={true}
        showDropOverlay={true}
        onActivate={noop}
        onDragEnter={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
      />,
    );

    expect(screen.getByText(/Suelta el PDF para subirlo/i)).toBeInTheDocument();
  });

  it("uses compact and non-compact aria labels correctly", () => {
    const { rerender } = render(
      <UploadDropzone
        isDragOver={false}
        compact={true}
        onActivate={noop}
        onDragEnter={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
      />,
    );

    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Cargar documento");

    rerender(
      <UploadDropzone
        isDragOver={false}
        compact={false}
        title="Arrastra un PDF aquí"
        subtitle="o haz clic para cargar"
        onActivate={noop}
        onDragEnter={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
      />,
    );

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Arrastra un PDF aquí o haz clic para cargar",
    );
  });
});

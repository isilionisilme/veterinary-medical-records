import type { DragEvent, KeyboardEvent, MouseEvent } from "react";
import { Upload } from "lucide-react";

type UploadDropzoneProps = {
  isDragOver: boolean;
  onActivate: (event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  showDropOverlay?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  ariaLabel?: string;
};

export function UploadDropzone({
  isDragOver,
  onActivate,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  showDropOverlay = false,
  className = "",
  title = "Arrastra un PDF aqui",
  subtitle = "o haz clic para cargar",
  compact = false,
  ariaLabel,
}: UploadDropzoneProps) {
  const resolvedAriaLabel = ariaLabel ?? (compact ? "Cargar documento" : `${title} ${subtitle}`.trim());

  return (
    <div
      className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition ${
        isDragOver
          ? "border-accent bg-accentSoft/35 ring-2 ring-accent/40"
          : "border-black/35 bg-white/85 hover:border-black/50 hover:bg-white"
      } ${compact ? "h-12 w-12 px-0 py-0" : "px-4 py-5"} ${className}`}
      role="button"
      aria-label={resolvedAriaLabel}
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate(event);
        }
      }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {showDropOverlay && isDragOver && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-white/75 ring-2 ring-accent/40">
          <p className="text-sm font-semibold text-ink">Suelta el PDF para subirlo</p>
        </div>
      )}
      <Upload size={18} className="text-ink" />
      {!compact && (
        <>
          <p className="mt-2 text-sm font-semibold text-ink">{title}</p>
          <p className="text-xs text-muted">{subtitle}</p>
        </>
      )}
    </div>
  );
}


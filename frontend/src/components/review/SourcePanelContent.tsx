import { PdfViewer } from "../PdfViewer";
import { SourcePanel } from "../SourcePanel";

type SourcePanelContentProps = {
  sourcePage: number | null;
  sourceSnippet: string | null;
  isSourcePinned: boolean;
  isDesktopForPin: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  fileUrl: string | null;
  activeId: string | null;
  filename: string | null;
  focusRequestId: number;
};

export function SourcePanelContent({
  sourcePage,
  sourceSnippet,
  isSourcePinned,
  isDesktopForPin,
  onTogglePin,
  onClose,
  fileUrl,
  activeId,
  filename,
  focusRequestId,
}: SourcePanelContentProps) {
  return (
    <SourcePanel
      sourcePage={sourcePage}
      sourceSnippet={sourceSnippet}
      isSourcePinned={isSourcePinned}
      isDesktopForPin={isDesktopForPin}
      onTogglePin={onTogglePin}
      onClose={onClose}
      content={
        fileUrl ? (
          <PdfViewer
            key={`source-${activeId ?? "empty"}`}
            documentId={activeId}
            fileUrl={fileUrl}
            filename={filename}
            isDragOver={false}
            focusPage={sourcePage}
            highlightSnippet={sourceSnippet}
            focusRequestId={focusRequestId}
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted">
            No hay PDF disponible para este documento.
          </div>
        )
      }
    />
  );
}

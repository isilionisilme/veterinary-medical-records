import { ReactNode } from "react";

import { Button } from "./ui/button";

type SourcePanelProps = {
  sourcePage: number | null;
  sourceSnippet: string | null;
  isSourcePinned: boolean;
  isDesktopForPin: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  content: ReactNode;
};

export function SourcePanel({
  sourcePage,
  sourceSnippet,
  isSourcePinned,
  isDesktopForPin,
  onTogglePin,
  onClose,
  content,
}: SourcePanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-black/10 bg-white p-4 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Fuente</p>
          <p className="mt-1 text-xs text-muted">
            {sourcePage ? `Página ${sourcePage}` : "Sin página seleccionada"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onTogglePin} disabled={!isDesktopForPin}>
            {isSourcePinned ? "Desfijar" : "📌 Fijar"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            ✕
          </Button>
        </div>
      </div>
      <div data-testid="source-panel-scroll" className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {content}
      </div>
      <div className="mt-3 rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-xs text-muted">
        <p className="font-semibold text-ink">Evidencia</p>
        <p className="mt-1">{sourceSnippet ?? "Sin evidencia disponible"}</p>
      </div>
    </div>
  );
}

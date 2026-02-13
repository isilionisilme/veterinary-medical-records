import { ReactNode } from "react";

import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

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
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-surface p-4 shadow-subtle">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-textSecondary">Fuente</p>
          <p className="mt-1 text-xs text-textSecondary">
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
      <ScrollArea data-testid="source-panel-scroll" className="mt-3 min-h-0 flex-1">
        {content}
      </ScrollArea>
      <div className="mt-3 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-textSecondary">
        <p className="font-semibold text-text">Evidencia</p>
        <p className="mt-1">{sourceSnippet ?? "Sin evidencia disponible"}</p>
      </div>
    </div>
  );
}

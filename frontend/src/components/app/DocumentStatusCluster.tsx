import { cn } from "../../lib/utils";
import { type DocumentStatusClusterModel } from "../../lib/documentStatus";
import { Tooltip } from "../ui/tooltip";

type DocumentStatusChipProps = {
  status: DocumentStatusClusterModel;
  compact?: boolean;
  className?: string;
  testId?: string;
};

function toneClass(tone: DocumentStatusClusterModel["tone"]): string {
  if (tone === "success") {
    return "bg-statusSuccess";
  }
  if (tone === "warn") {
    return "bg-statusWarn";
  }
  return "bg-statusError";
}

export function DocumentStatusChip({
  status,
  compact = false,
  className,
  testId,
}: DocumentStatusChipProps) {
  return (
    <Tooltip content={status.tooltip}>
      <span
        data-testid={testId}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-textSecondary",
          compact && "h-4 min-w-4 justify-center border-0 bg-transparent p-0",
          className
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            compact && "ring-2 ring-surface",
            toneClass(status.tone)
          )}
        />
        {compact ? <span className="sr-only">{status.label}</span> : <span>{status.label}</span>}
        {!compact && status.hint ? <span className="text-muted">· {status.hint}</span> : null}
      </span>
    </Tooltip>
  );
}

export const DocumentStatusCluster = DocumentStatusChip;

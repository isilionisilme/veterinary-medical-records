import { Tooltip } from "../ui/tooltip";

type CriticalIconProps = {
  testId?: string;
  compact?: boolean;
};

export function CriticalIcon({ testId, compact = false }: CriticalIconProps) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center justify-center rounded-full border border-critical/50 font-semibold leading-none text-critical ${
        compact ? "h-3.5 min-w-3.5 px-0 text-[9px]" : "h-4 min-w-4 px-1 text-[10px]"
      }`}
    >
      !
    </span>
  );
}

export function CriticalBadge({ testId }: { testId?: string }) {
  return (
    <Tooltip content="CRÍTICO">
      <span>
        <CriticalIcon testId={testId} />
      </span>
    </Tooltip>
  );
}

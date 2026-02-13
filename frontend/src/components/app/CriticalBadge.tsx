import { Tooltip } from "../ui/tooltip";

export function CriticalBadge({ testId }: { testId?: string }) {
  return (
    <Tooltip content="CRÍTICO">
      <span
        data-testid={testId}
        className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-critical/50 px-1 text-[10px] font-semibold leading-none text-critical"
      >
        !
      </span>
    </Tooltip>
  );
}

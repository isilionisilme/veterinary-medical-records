import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export function FieldBlock({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={cn("px-1 py-1.5", className)}>{children}</article>;
}

export function FieldRow({
  label,
  value,
  status,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  status?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex items-center gap-1.5 pr-3">{label}</div>
      <div className="flex min-w-0 max-w-[70%] items-start gap-2">
        <div className="min-w-0 text-right">{value}</div>
        {status ? <div className="flex shrink-0 items-center gap-1.5">{status}</div> : null}
      </div>
    </div>
  );
}

export function RepeatableList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-1 space-y-1", className)}>{children}</div>;
}

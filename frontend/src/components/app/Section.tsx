import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-xl bg-surface px-4 py-4", className)}>{children}</section>;
}

export function SectionHeader({ title, rightSlot }: { title: string; rightSlot?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 pb-2">
      <p className="text-base font-semibold text-text">{title}</p>
      {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
    </div>
  );
}

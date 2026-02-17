import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export function SectionBlock({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section data-testid={testId} className={cn("rounded-xl bg-surface px-4 py-4", className)}>
      {children}
    </section>
  );
}

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <SectionBlock className={className}>{children}</SectionBlock>;
}

export function SectionHeader({ title, rightSlot }: { title: string; rightSlot?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 pb-2">
      <p className="text-base font-semibold text-text">{title}</p>
      {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
    </div>
  );
}

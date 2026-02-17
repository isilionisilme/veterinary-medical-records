import {
  cloneElement,
  isValidElement,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useState,
} from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../../lib/utils";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  offset?: number;
  side?: "top" | "right" | "bottom" | "left";
  triggerClassName?: string;
};

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({
  content,
  children,
  disabled = false,
  offset = 8,
  side = "top",
  triggerClassName = "inline-flex",
}: TooltipProps) {
  const [open, setOpen] = useState(false);

  if (disabled) {
    return <span className={triggerClassName}>{children}</span>;
  }

  const triggerContent = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
      onMouseEnter: (event: MouseEvent) => {
        (children as ReactElement<{ onMouseEnter?: (event: MouseEvent) => void }>).props
          .onMouseEnter?.(event);
        setOpen(true);
      },
      onMouseLeave: (event: MouseEvent) => {
        (children as ReactElement<{ onMouseLeave?: (event: MouseEvent) => void }>).props
          .onMouseLeave?.(event);
        setOpen(false);
      },
      onFocus: (event: FocusEvent) => {
        (children as ReactElement<{ onFocus?: (event: FocusEvent) => void }>).props
          .onFocus?.(event);
        setOpen(true);
      },
      onBlur: (event: FocusEvent) => {
        (children as ReactElement<{ onBlur?: (event: FocusEvent) => void }>).props
          .onBlur?.(event);
        setOpen(false);
      },
    })
    : <span className={triggerClassName}>{children}</span>;

  return (
    <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
        <TooltipPrimitive.Trigger asChild>
          {triggerContent}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={offset}
            collisionPadding={8}
            className={cn(
              "z-[90] rounded-md bg-text px-2 py-1 text-[11px] font-medium text-white shadow-subtle"
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

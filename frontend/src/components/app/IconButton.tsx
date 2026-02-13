import type { ReactNode } from "react";
import { forwardRef } from "react";

import { Button } from "../ui/button";
import { Tooltip } from "../ui/tooltip";
import { cn } from "../../lib/utils";

type IconButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  label: string;
  tooltip?: string;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
  className?: string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  label,
  tooltip,
  type = "button",
  disabled = false,
  pressed = false,
  children,
  className,
  ...props
}, ref) {
  const tooltipText = tooltip ?? label;
  return (
    <Tooltip content={tooltipText} disabled={disabled}>
      <Button
        ref={ref}
        type={type}
        variant="icon"
        size="icon"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        className={cn(pressed && "bg-surfaceMuted text-text ring-1 ring-border", className)}
        {...props}
      >
        {children}
      </Button>
    </Tooltip>
  );
});

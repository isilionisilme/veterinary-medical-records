import type { ReactNode } from "react";

import { Button } from "../ui/button";
import { Tooltip } from "../ui/tooltip";
import { cn } from "../../lib/utils";

type IconButtonProps = {
  ariaLabel: string;
  tooltip: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
  className?: string;
};

export function IconButton({
  ariaLabel,
  tooltip,
  onClick,
  disabled = false,
  pressed = false,
  children,
  className,
}: IconButtonProps) {
  return (
    <Tooltip content={tooltip} disabled={disabled}>
      <Button
        type="button"
        variant="icon"
        size="icon"
        aria-label={ariaLabel}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
        className={cn(pressed && "bg-black/[0.10] text-text", className)}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

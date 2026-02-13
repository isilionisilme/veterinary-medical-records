import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipPosition = {
  top: number;
  left: number;
};

type TooltipProps = {
  content: string;
  children: ReactNode;
  disabled?: boolean;
  offset?: number;
  triggerClassName?: string;
};

export function Tooltip({
  content,
  children,
  disabled = false,
  offset = 8,
  triggerClassName = "inline-flex",
}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    const updatePosition = () => {
      const node = triggerRef.current;
      if (!node) {
        return;
      }
      const rect = node.getBoundingClientRect();
      setPosition({
        top: rect.top - offset,
        left: rect.left + rect.width / 2,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isVisible, offset]);

  return (
    <span
      ref={triggerRef}
      className={triggerClassName}
      onMouseEnter={() => {
        if (!disabled) {
          setIsVisible(true);
        }
      }}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => {
        if (!disabled) {
          setIsVisible(true);
        }
      }}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible &&
        !disabled &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[90] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-white shadow"
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
          >
            {content}
          </span>,
          document.body
        )}
    </span>
  );
}

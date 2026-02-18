import { type KeyboardEvent, useEffect, useMemo, useRef } from "react";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

type FieldEditDialogProps = {
  open: boolean;
  fieldKey: string | null;
  fieldLabel: string;
  value: string;
  isSaving: boolean;
  isSaveDisabled?: boolean;
  microchipErrorMessage?: string | null;
  weightErrorMessage?: string | null;
  onValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
};

export function FieldEditDialog({
  open,
  fieldKey,
  fieldLabel,
  value,
  isSaving,
  isSaveDisabled = false,
  microchipErrorMessage = null,
  weightErrorMessage = null,
  onValueChange,
  onOpenChange,
  onSave,
}: FieldEditDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldUseTextarea = useMemo(
    () => value.includes("\n") || value.length > 60,
    [value]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const focusTimer = window.setTimeout(() => {
      if (shouldUseTextarea) {
        textareaRef.current?.focus();
        return;
      }
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [open, shouldUseTextarea]);

  const handleSingleLineEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (!isSaving && !isSaveDisabled) {
      onSave();
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSaving) {
      return;
    }
    onOpenChange(nextOpen);
  };

  const titleText = fieldLabel.trim().length > 0 ? `Editar "${fieldLabel}"` : "Editar campo";
  const isMicrochipField = fieldKey === "microchip_id";
  const isWeightField = fieldKey === "weight";
  const microchipHintText = "Solo números (9–15 dígitos).";
  const weightHintText = "Ej.: 12,5 kg (0,5–120).";
  const handleValueChange = (nextValue: string) => {
    if (isMicrochipField) {
      const sanitized = nextValue.replace(/\D/g, "");
      onValueChange(sanitized);
      return;
    }
    if (isWeightField) {
      const sanitized = nextValue.replace(/[^0-9,.\skg]/gi, "");
      onValueChange(sanitized);
      return;
    }
    onValueChange(nextValue);
  };
  const shouldHighlightError =
    (isMicrochipField && microchipErrorMessage) || (isWeightField && weightErrorMessage);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (!isSaving) {
            return;
          }
          event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (!isSaving) {
            return;
          }
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
        </DialogHeader>

        {shouldUseTextarea ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => handleValueChange(event.target.value)}
            rows={6}
            className={`min-h-28 w-full resize-y rounded-control border bg-surface px-3 py-2 text-sm text-text outline-none transition focus-visible:bg-surfaceMuted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              shouldHighlightError
                ? "border-[var(--status-error)] focus-visible:outline-[var(--status-error)]"
                : "border-borderSubtle focus-visible:outline-accent"
            }`}
          />
        ) : (
          <Input
            ref={inputRef}
            value={value}
            onChange={(event) => handleValueChange(event.target.value)}
            onKeyDown={handleSingleLineEnter}
            className={
              isMicrochipField || isWeightField
                ? `rounded-control border bg-surface px-3 py-1 text-sm text-text ${
                    shouldHighlightError
                      ? "border-[var(--status-error)] focus-visible:outline-[var(--status-error)]"
                      : "border-borderSubtle focus-visible:outline-accent"
                  }`
                : undefined
            }
          />
        )}
        {isMicrochipField ? (
          <div className="mt-1 space-y-1">
            <p className={microchipErrorMessage ? "text-xs text-[var(--status-error)]" : "text-xs text-muted"}>
              {microchipErrorMessage ?? microchipHintText}
            </p>
          </div>
        ) : isWeightField ? (
          <div className="mt-1 space-y-1">
            <p className={weightErrorMessage ? "text-xs text-[var(--status-error)]" : "text-xs text-muted"}>
              {weightErrorMessage ?? weightHintText}
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              className="border border-border bg-surface text-text hover:bg-surfaceMuted"
              disabled={isSaving}
            >
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={onSave} disabled={isSaving || isSaveDisabled}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

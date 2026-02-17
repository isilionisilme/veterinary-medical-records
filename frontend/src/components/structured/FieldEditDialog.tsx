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
  fieldLabel: string;
  value: string;
  isSaving: boolean;
  onValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
};

export function FieldEditDialog({
  open,
  fieldLabel,
  value,
  isSaving,
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
    if (!isSaving) {
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
            onChange={(event) => onValueChange(event.target.value)}
            rows={6}
            className="min-h-28 w-full resize-y rounded-control border border-borderSubtle bg-surface px-3 py-2 text-sm text-text outline-none transition focus-visible:bg-surfaceMuted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        ) : (
          <Input
            ref={inputRef}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={handleSingleLineEnter}
          />
        )}

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
          <Button type="button" onClick={onSave} disabled={isSaving}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { CANONICAL_SPECIES_OPTIONS } from "../../extraction/fieldValidators";

type FieldEditDialogProps = {
  open: boolean;
  fieldKey: string | null;
  fieldLabel: string;
  value: string;
  isSaving: boolean;
  isSaveDisabled?: boolean;
  microchipErrorMessage?: string | null;
  weightErrorMessage?: string | null;
  dateErrorMessage?: string | null;
  sexErrorMessage?: string | null;
  speciesErrorMessage?: string | null;
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
  dateErrorMessage = null,
  sexErrorMessage = null,
  speciesErrorMessage = null,
  onValueChange,
  onOpenChange,
  onSave,
}: FieldEditDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const isSexField = fieldKey === "sex";
  const isSpeciesField = fieldKey === "species";
  const shouldUseTextarea = useMemo(
    () => !isSexField && !isSpeciesField && (value.includes("\n") || value.length > 60),
    [isSexField, isSpeciesField, value]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const focusTimer = window.setTimeout(() => {
      if (isSexField || isSpeciesField) {
        selectRef.current?.focus();
        return;
      }
      if (shouldUseTextarea) {
        textareaRef.current?.focus();
        return;
      }
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [isSexField, isSpeciesField, open, shouldUseTextarea]);

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
  const isDateField =
    fieldKey === "document_date" ||
    fieldKey === "visit_date" ||
    fieldKey === "admission_date" ||
    fieldKey === "discharge_date" ||
    fieldKey === "dob" ||
    Boolean(fieldKey?.startsWith("fecha_"));
  const microchipHintText = "Solo números (9–15 dígitos).";
  const weightHintText = "Ej.: 12,5 kg (0,5–120).";
  const dateHintText = "Formatos: dd/mm/aaaa o aaaa-mm-dd.";
  const sexHintText = "Selecciona macho o hembra.";
  const speciesHintText = "Selecciona canino o felino.";
  const normalizedSexValue = value.trim().toLowerCase();
  const isKnownSexValue = normalizedSexValue === "macho" || normalizedSexValue === "hembra";
  const hasLegacySexValue = isSexField && value.trim().length > 0 && !isKnownSexValue;
  const normalizedSpeciesValue = value.trim().toLowerCase();
  const isKnownSpeciesValue = CANONICAL_SPECIES_OPTIONS.some(
    (option) => option.value === normalizedSpeciesValue
  );
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
    if (isDateField) {
      const sanitized = nextValue.replace(/[^0-9/-]/g, "");
      onValueChange(sanitized);
      return;
    }
    if (isSexField) {
      onValueChange(nextValue);
      return;
    }
    if (isSpeciesField) {
      onValueChange(nextValue);
      return;
    }
    onValueChange(nextValue);
  };
  const shouldHighlightError =
    (isMicrochipField && microchipErrorMessage) ||
    (isWeightField && weightErrorMessage) ||
    (isDateField && dateErrorMessage) ||
    (isSexField && sexErrorMessage) ||
    (isSpeciesField && speciesErrorMessage);

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

        {isSexField ? (
          <select
            ref={selectRef}
            value={hasLegacySexValue ? value : isKnownSexValue ? normalizedSexValue : ""}
            onChange={(event) => handleValueChange(event.target.value)}
            className={`w-full rounded-control border bg-surface px-3 py-2 text-sm text-text outline-none transition focus-visible:bg-surfaceMuted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              shouldHighlightError
                ? "border-[var(--status-error)] focus-visible:outline-[var(--status-error)]"
                : "border-borderSubtle focus-visible:outline-accent"
            }`}
          >
            <option value="">Selecciona una opción</option>
            <option value="macho">Macho</option>
            <option value="hembra">Hembra</option>
            {hasLegacySexValue ? <option value={value}>{value}</option> : null}
          </select>
        ) : isSpeciesField ? (
          <select
            ref={selectRef}
            value={isKnownSpeciesValue ? normalizedSpeciesValue : ""}
            onChange={(event) => handleValueChange(event.target.value)}
            className={`w-full rounded-control border bg-surface px-3 py-2 text-sm text-text outline-none transition focus-visible:bg-surfaceMuted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              shouldHighlightError
                ? "border-[var(--status-error)] focus-visible:outline-[var(--status-error)]"
                : "border-borderSubtle focus-visible:outline-accent"
            }`}
          >
            <option value="">Selecciona una opción</option>
            {CANONICAL_SPECIES_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : shouldUseTextarea ? (
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
              isMicrochipField || isWeightField || isDateField
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
        ) : isDateField ? (
          <div className="mt-1 space-y-1">
            <p className={dateErrorMessage ? "text-xs text-[var(--status-error)]" : "text-xs text-muted"}>
              {dateErrorMessage ?? dateHintText}
            </p>
          </div>
        ) : isSexField ? (
          <div className="mt-1 space-y-1">
            <p className={sexErrorMessage ? "text-xs text-[var(--status-error)]" : "text-xs text-muted"}>
              {sexErrorMessage ?? sexHintText}
            </p>
          </div>
        ) : isSpeciesField ? (
          <div className="mt-1 space-y-1">
            <p className={speciesErrorMessage ? "text-xs text-[var(--status-error)]" : "text-xs text-muted"}>
              {speciesErrorMessage ?? speciesHintText}
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

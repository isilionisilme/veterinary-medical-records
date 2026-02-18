import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FieldEditDialog } from "./FieldEditDialog";

function renderSpeciesDialog(options?: {
  value?: string;
  isSaveDisabled?: boolean;
  speciesErrorMessage?: string | null;
}) {
  const onValueChange = vi.fn();
  const onOpenChange = vi.fn();
  const onSave = vi.fn();

  render(
    <FieldEditDialog
      open
      fieldKey="species"
      fieldLabel="Especie"
      value={options?.value ?? ""}
      isSaving={false}
      isSaveDisabled={options?.isSaveDisabled ?? false}
      speciesErrorMessage={options?.speciesErrorMessage ?? null}
      onValueChange={onValueChange}
      onOpenChange={onOpenChange}
      onSave={onSave}
    />
  );

  return { onValueChange, onOpenChange, onSave };
}

describe("FieldEditDialog species", () => {
  it("shows placeholder and error when species value is legacy invalid", () => {
    const { onSave } = renderSpeciesDialog({
      value: "equino",
      isSaveDisabled: true,
      speciesErrorMessage: "Valor no valido. Usa canino o felino.",
    });

    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("");
    expect(screen.getByText("Valor no valido. Usa canino o felino.")).toBeInTheDocument();
    expect(screen.queryByText("Selecciona canino o felino.")).toBeNull();

    const saveButton = screen.getByRole("button", { name: "Guardar" });
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows canonical species value and hint when valid", () => {
    renderSpeciesDialog({ value: "canino", isSaveDisabled: false, speciesErrorMessage: null });

    expect(screen.getByRole("combobox")).toHaveValue("canino");
    expect(screen.getByText("Selecciona canino o felino.")).toBeInTheDocument();
  });

  it("emits canonical option value when selecting species", () => {
    const { onValueChange } = renderSpeciesDialog({ value: "" });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "felino" } });

    expect(onValueChange).toHaveBeenCalledWith("felino");
  });
});

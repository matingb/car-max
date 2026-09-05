import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Checkbox from "./Checkbox";

describe("Checkbox", () => {
  it("renderiza la etiqueta y responde a clics", () => {
    const onChange = vi.fn();
    render(
      <Checkbox
        checked={false}
        onChange={onChange}
        label="Mi opción"
      />
    );

    expect(screen.getByText("Mi opción")).toBeInTheDocument();
    const input = screen.getByRole("checkbox", { name: "Mi opción" });
    expect(input).not.toBeChecked();

    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("no responde cuando está deshabilitado", () => {
    const onChange = vi.fn();
    render(
      <Checkbox
        checked={false}
        onChange={onChange}
        label="Opción deshabilitada"
        disabled
      />
    );

    const input = screen.getByRole("checkbox", { name: "Opción deshabilitada" });
    expect(input).toBeDisabled();
  });
});

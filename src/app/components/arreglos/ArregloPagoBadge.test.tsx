import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ArregloPagoBadge, { calcularEstadoPago } from "./ArregloPagoBadge";

vi.mock("@/app/components/arreglos/CobroArregloModal", () => ({
  default: ({ open, onClose, onPaid }: { open: boolean; onClose: () => void; onPaid?: (arreglo: unknown) => void }) => {
    if (!open) return null;
    return (
      <div data-testid="cobro-modal">
        <button onClick={onClose} data-testid="cobro-close-btn">
          Cerrar
        </button>
        <button
          onClick={() => onPaid?.({ id: "1", esta_pago: true, total_cobrado: 50000 })}
          data-testid="cobro-pay-btn"
        >
          Pagar
        </button>
      </div>
    );
  },
}));

describe("calcularEstadoPago", () => {
  it("retorna PENDIENTE si no se cobró nada y estaPago es falso", () => {
    expect(calcularEstadoPago({ totalCobrado: 0, precioFinal: 10000, estaPago: false })).toBe("PENDIENTE");
  });

  it("retorna PAGADO si estaPago es true sin monto cobrado", () => {
    expect(calcularEstadoPago({ totalCobrado: 0, precioFinal: 10000, estaPago: true })).toBe("PAGADO");
  });

  it("retorna PARCIAL si el monto cobrado es menor al precio final", () => {
    expect(calcularEstadoPago({ totalCobrado: 4000, precioFinal: 10000 })).toBe("PARCIAL");
  });

  it("retorna PAGADO si el monto cobrado es igual al precio final", () => {
    expect(calcularEstadoPago({ totalCobrado: 10000, precioFinal: 10000 })).toBe("PAGADO");
  });

  it("retorna SOBREPAGO si el monto cobrado supera al precio final", () => {
    expect(calcularEstadoPago({ totalCobrado: 12000, precioFinal: 10000 })).toBe("SOBREPAGO");
  });
});

describe("ArregloPagoBadge", () => {
  it("no renderiza nada si el estado es PRESUPUESTO", () => {
    const { container } = render(<ArregloPagoBadge estado="PRESUPUESTO" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza Pago pendiente cuando no está pago", () => {
    render(<ArregloPagoBadge estado="EN_PROGRESO" totalCobrado={0} precioFinal={10000} />);
    expect(screen.getByText("Pago pendiente")).toBeInTheDocument();
  });

  it("renderiza Pagado cuando está pagado en su totalidad", () => {
    render(<ArregloPagoBadge estado="EN_PROGRESO" totalCobrado={10000} precioFinal={10000} />);
    expect(screen.getByText("Pagado")).toBeInTheDocument();
  });

  it("renderiza saldo pendiente en estado PARCIAL", () => {
    render(
      <ArregloPagoBadge
        estado="EN_PROGRESO"
        totalCobrado={4000}
        precioFinal={10000}
        saldoPendiente={6000}
      />
    );
    expect(screen.getByText("Pendiente: $6.000")).toBeInTheDocument();
  });

  it("abre CobroArregloModal al hacer click si tiene arregloId y ejecuta onPagoUpdated al pagar", () => {
    const onPagoUpdated = vi.fn();
    render(
      <ArregloPagoBadge
        estado="EN_PROGRESO"
        totalCobrado={0}
        precioFinal={50000}
        arregloId="test-arreglo-id"
        onPagoUpdated={onPagoUpdated}
      />
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(screen.getByTestId("cobro-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cobro-pay-btn"));
    expect(onPagoUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1", esta_pago: true, total_cobrado: 50000 })
    );
  });

  it("ejecuta onClick custom si se provee en lugar de abrir modal", () => {
    const onClick = vi.fn();
    render(<ArregloPagoBadge estado="EN_PROGRESO" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
    expect(screen.queryByTestId("cobro-modal")).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ArregloItem from "@/app/components/arreglos/ArregloItem";
import { createArreglo } from "@/tests/factories";

let talleresMock: Array<{ id: string; nombre: string; ubicacion: string }> = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    talleres: talleresMock,
    tallerSeleccionadoId: talleresMock[0]?.id ?? "",
    setTallerSeleccionadoId: vi.fn(),
  }),
}));

vi.mock("@/app/components/arreglos/ArregloModal", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("@/app/providers/ArreglosProvider", () => ({
  useArreglos: () => ({
    update: vi.fn(),
  }),
}));

vi.mock("@/app/providers/CategoriasArregloProvider", () => ({
  useCategoriasArreglo: () => ({
    categorias: [],
  }),
}));

vi.mock("@/app/providers/EmpleadosProvider", () => ({
  useEmpleados: () => ({
    empleados: [],
  }),
  getEmpleadoColor: vi.fn(() => ({
    bg: "#eef2ff",
    text: "#4338ca",
    border: "#e0e7ff",
    avatarBg: "#c7d2fe",
    avatarText: "#312e81",
  })),
}));

vi.mock("@/app/providers/BreakpointProvider", () => ({
  useBreakpoint: () => ({
    isSm: false,
    isMd: false,
    isLg: false,
    isXl: false,
    is2Xl: false,
  }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock("@/app/providers/CuentasFinancierasProvider", () => ({
  useCuentasFinancieras: () => ({
    cuentas: [],
    cuentasActivas: [],
    loading: false,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("ArregloItem", () => {
  it("si hay más de un taller, muestra el IconLabel de Taller", () => {
    talleresMock = [
      { id: "t1", nombre: "Taller 1", ubicacion: "A" },
      { id: "t2", nombre: "Taller 2", ubicacion: "B" },
    ];

    render(
      <ArregloItem
        arreglo={createArreglo({
          taller: { id: "t2", nombre: "Taller 2", ubicacion: "B" },
        })}
      />
    );

    expect(screen.getByTestId("arreglo-item-taller-label")).toBeInTheDocument();
    expect(screen.getByText("Taller 2")).toBeInTheDocument();
  });

  it("si hay un único taller, NO muestra el IconLabel de Taller", () => {
    talleresMock = [{ id: "t1", nombre: "Taller 1", ubicacion: "A" }];

    render(
      <ArregloItem
        arreglo={createArreglo({
          taller: { id: "t1", nombre: "Taller 1", ubicacion: "A" },
        })}
      />
    );

    expect(screen.queryByTestId("arreglo-item-taller-label")).not.toBeInTheDocument();
    expect(screen.queryByText("Taller 1")).not.toBeInTheDocument();
  });

  it("muestra el estado del arreglo en la card", () => {
    talleresMock = [{ id: "t1", nombre: "Taller 1", ubicacion: "A" }];

    render(
      <ArregloItem
        arreglo={createArreglo({
          estado: "EN_PROGRESO",
        })}
      />
    );

    expect(screen.getByText("En progreso")).toBeInTheDocument();
  });

  it("muestra u oculta las observaciones según la prop showObservaciones", () => {
    talleresMock = [{ id: "t1", nombre: "Taller 1", ubicacion: "A" }];
    const arregloConObs = createArreglo({
      observaciones: "Service básico preventivo",
    });

    const { rerender } = render(
      <ArregloItem arreglo={arregloConObs} showObservaciones={true} />
    );

    expect(
      screen.getByText('"Service básico preventivo"')
    ).toBeInTheDocument();

    rerender(
      <ArregloItem arreglo={arregloConObs} showObservaciones={false} />
    );

    expect(
      screen.queryByText('"Service básico preventivo"')
    ).not.toBeInTheDocument();
  });

  it("soporta la prop mostrarObservaciones alternativamente", () => {
    talleresMock = [{ id: "t1", nombre: "Taller 1", ubicacion: "A" }];
    const arregloConObs = createArreglo({
      observaciones: "Observación de prueba",
    });

    render(
      <ArregloItem arreglo={arregloConObs} mostrarObservaciones={false} />
    );

    expect(
      screen.queryByText('"Observación de prueba"')
    ).not.toBeInTheDocument();
  });

  it("muestra el texto Pago pendiente cuando esta_pago es false", () => {
    talleresMock = [{ id: "t1", nombre: "Taller 1", ubicacion: "A" }];

    render(
      <ArregloItem
        arreglo={createArreglo({
          esta_pago: false,
        })}
      />
    );

    expect(screen.getByText("Pago pendiente")).toBeInTheDocument();
  });

  it("renderiza las iniciales de los empleados asignados", () => {
    talleresMock = [{ id: "t1", nombre: "Taller 1", ubicacion: "A" }];

    render(
      <ArregloItem
        arreglo={createArreglo({})}
        empleados={[
          { nombre: "Carlos", apellido: "Gimenez" },
          { nombre: "Maria", apellido: "Fernandez" },
        ]}
      />
    );

    expect(screen.getByText("CG")).toBeInTheDocument();
    expect(screen.getByText("MF")).toBeInTheDocument();
  });

  it("renderiza las iniciales desde la propiedad empleados que provee la base de datos (mapeada en el backend)", () => {
    talleresMock = [{ id: "t1", nombre: "Taller 1", ubicacion: "A" }];

    render(
      <ArregloItem
        arreglo={{
          ...createArreglo({}),
          empleados: [
            { id: "e1", nombre: "Laura", apellido: "Gomez" },
            { id: "e2", nombre: "Pedro", apellido: "Pascal" },
          ],
        }}
      />
    );

    expect(screen.getByText("LG")).toBeInTheDocument();
    expect(screen.getByText("PP")).toBeInTheDocument();
  });

  it("no muestra el texto Pago pendiente cuando el arreglo está en estado PRESUPUESTO", () => {
    talleresMock = [{ id: "t1", nombre: "Taller 1", ubicacion: "A" }];

    render(
      <ArregloItem
        arreglo={createArreglo({
          estado: "PRESUPUESTO",
          esta_pago: false,
        })}
      />
    );

    expect(screen.queryByText("Pago pendiente")).not.toBeInTheDocument();
    expect(screen.queryByText("Pagado")).not.toBeInTheDocument();
  });
});


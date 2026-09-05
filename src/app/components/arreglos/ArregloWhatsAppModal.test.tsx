import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArregloWhatsAppModal from "./ArregloWhatsAppModal";
import { createArreglo, createArregloDetalleData, createVehiculo } from "@/tests/factories";

const mocks = vi.hoisted(() => ({
  fetchCliente: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/providers/VehiculosProvider", () => ({
  useVehiculos: () => ({
    fetchCliente: mocks.fetchCliente,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mocks.toastSuccess,
    error: mocks.toastError,
  }),
}));

describe("ArregloWhatsAppModal", () => {
  const sampleData = createArregloDetalleData({
    arreglo: createArreglo({
      id: "a1",
      kilometraje_leido: 75000,
      observaciones: "Ruido en tren delantero",
      precio_final: 0,
      vehiculo: createVehiculo({ id: "v1", patente: "ABC123" }),
    }),
    detalles: [
      {
        id: "d1",
        arreglo_id: "a1",
        descripcion: "Mano de obra frenos",
        cantidad: 1,
        valor: 12000,
        categoria_arreglo_id: null,
        empleado_id: null,
      },
    ],
    asignaciones: [
      {
        id: "op1",
        tipo: "egreso",
        taller_id: "t1",
        created_at: "2026-01-01",
        lineas: [
          {
            id: "l1",
            operacion_id: "op1",
            stock_id: "s1",
            cantidad: 2,
            monto_unitario: 8000,
            delta_cantidad: -2,
            created_at: "2026-01-01",
            categoria_arreglo_id: null,
            empleado_id: null,
            producto: { id: "p1", codigo: "PAS-01", nombre: "Pastillas de freno" },
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchCliente.mockResolvedValue({
      id: "c1",
      nombre: "Carlos Gómez",
      codigo_pais: "+54",
      telefono: "91198765432",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza el modal de dos columnas con mockup de celular y datos del cliente", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    expect(screen.getByRole("heading", { name: "Compartir" })).toBeInTheDocument();
    expect(screen.getByText("Previsualización del mensaje")).toBeInTheDocument();
    expect(screen.getByText("Elementos a incluir")).toBeInTheDocument();

    // Debe cargar el cliente y mostrarlo tanto en la sección de cliente como en la cabecera del celular
    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    const phoneInput = screen.getByLabelText("WhatsApp") as HTMLInputElement;
    expect(phoneInput.value).toBe("5491198765432");
    expect(screen.getByText("en línea")).toBeInTheDocument();

    // Por defecto: Detalle ON, Precios OFF, Subtotales ON, Total ON
    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    expect(textarea.value).toContain("_Subtotal repuestos: $16.000_");
    expect(textarea.value).toContain("_Subtotal mano de obra: $12.000_");
    expect(textarea.value).toContain("• Pastillas de freno x2");
    expect(textarea.value).not.toContain("• Pastillas de freno x2 - $16.000");
    expect(textarea.value).toContain("*Total arreglo $28.000*");
  });

  it("permite apagar el detalle de trabajos para mostrar solo resumen de montos", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    const toggleDetalle = screen.getByRole("checkbox", { name: "Detalle de trabajos" });
    fireEvent.click(toggleDetalle);

    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    expect(textarea.value).toContain("💰 *Resumen:*");
    expect(textarea.value).toContain("• Repuestos: $16.000");
    expect(textarea.value).toContain("• Mano de obra: $12.000");
    expect(textarea.value).not.toContain("Pastillas de freno");
    expect(textarea.value).not.toContain("Mano de obra frenos");
    expect(textarea.value).toContain("*Total arreglo $28.000*");
  });

  it("permite prender precios individuales por ítem", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    const togglePrecios = screen.getByRole("checkbox", { name: "Precios unitarios" });
    fireEvent.click(togglePrecios);

    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    expect(textarea.value).toContain("• Pastillas de freno x2 - $16.000");
    expect(textarea.value).toContain("• Mano de obra frenos x1 - $12.000");
  });

  it("permite apagar el total general", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    const toggleTotal = screen.getByRole("checkbox", { name: "Total general" });
    fireEvent.click(toggleTotal);

    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    expect(textarea.value).not.toContain("*Total arreglo");
  });

  it("permite alternar el toggle de kilometraje", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    expect(textarea.value).toContain("⏱️ KM actual 75000");

    const toggleKm = screen.getByRole("checkbox", { name: "Kilometraje" });
    fireEvent.click(toggleKm);

    expect(textarea.value).not.toContain("⏱️ KM actual");
  });

  it("permite alternar el toggle de observaciones", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    expect(textarea.value).toContain("📝 Observaciones: Ruido en tren delantero");

    const toggleObs = screen.getByRole("checkbox", { name: "Observaciones" });
    fireEvent.click(toggleObs);

    expect(textarea.value).not.toContain("📝 Observaciones:");
  });

  it("permite editar el texto a mano directamente dentro de la burbuja y restablecerlo", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Mensaje personalizado para Carlos Gómez en su auto" } });

    expect(screen.getByText("✏️ Editado a mano")).toBeInTheDocument();
    expect(textarea.value).toBe("Mensaje personalizado para Carlos Gómez en su auto");
    expect(screen.getByRole("button", { name: "Restablecer texto" })).toBeInTheDocument();

    // Restablecer
    fireEvent.click(screen.getByRole("button", { name: "Restablecer texto" }));
    expect(screen.queryByText("✏️ Editado a mano")).not.toBeInTheDocument();
    expect(textarea.value).toContain("_Subtotal repuestos: $16.000_");
  });

  it("copia el mensaje al portapapeles desde el botón flotante", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    const copyBtn = screen.getByTitle("Copiar texto al portapapeles");
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      expect(screen.getByText("¡Copiado!")).toBeInTheDocument();
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Copiado", expect.any(String));
    });
  });

  it("envía por WhatsApp abriendo la ventana con la URL correspondiente", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);

    const onClose = vi.fn();

    render(
      <ArregloWhatsAppModal
        open
        onClose={onClose}
        data={sampleData}
        initialPhone="5491199998888"
        clienteNombre="Carlos Gómez"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    const submitBtn = screen.getByRole("button", { name: "Abrir chat de WhatsApp" });
    fireEvent.click(submitBtn);

    expect(openSpy).toHaveBeenCalled();
    const calledUrl = openSpy.mock.calls[0][0];
    expect(calledUrl).toContain("https://api.whatsapp.com/send/");
    expect(calledUrl).toContain("phone=5491199998888");
    expect(onClose).toHaveBeenCalled();
  });

  it("aplica los formatos de whatsapp como negrita y cursiva en la burbuja de previsualización", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    // En modo formato (por defecto), los títulos entre asteriscos se renderizan con <strong>
    const strongs = document.body.querySelectorAll("strong");
    const strongTexts = Array.from(strongs).map((s) => s.textContent);
    expect(strongTexts.some((t) => t?.includes("Presupuesto de Arreglo"))).toBe(true);
    expect(strongTexts.some((t) => t?.includes("Total arreglo"))).toBe(true);

    // Los subtotales entre guiones bajos se renderizan con <em>
    const ems = document.body.querySelectorAll("em");
    const emTexts = Array.from(ems).map((e) => e.textContent);
    expect(emTexts.some((t) => t?.includes("Subtotal repuestos"))).toBe(true);
    expect(emTexts.some((t) => t?.includes("Subtotal mano de obra"))).toBe(true);
  });

  it("permite alternar entre la vista de Formato y el modo Editar texto", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    // Cambiar a modo Editar
    const btnEditar = screen.getByRole("button", { name: "Editar" });
    fireEvent.click(btnEditar);

    // Debe mostrar la cabecera de edición y la sugerencia de formato
    expect(screen.getByText("Edición manual del mensaje")).toBeInTheDocument();
    expect(screen.getByText(/negrita/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver formato" })).not.toBeInTheDocument();

    // Volver a modo Formato
    const btnFormato = screen.getByRole("button", { name: "Formato" });
    fireEvent.click(btnFormato);

    expect(screen.getByText("Previsualización del mensaje")).toBeInTheDocument();
  });

  it("el nombre del cliente no es un input editable y se muestra como texto informativo", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    // Asegura que no sea un elemento input de texto
    expect(screen.queryByRole("textbox", { name: "Cliente" })).not.toBeInTheDocument();
  });

  it("el botón 'Abrir chat de WhatsApp' aplica efecto hover al pasar el cursor", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    const submitBtn = screen.getByRole("button", { name: "Abrir chat de WhatsApp" });
    expect(submitBtn.style.background).toBe("rgb(0, 121, 149)"); // COLOR.ACCENT.PRIMARY (#007995)

    act(() => {
      fireEvent.mouseEnter(submitBtn);
    });
    expect(submitBtn.style.background).toBe("rgb(0, 111, 135)"); // COLOR.ACCENT.HOVER (#006f87)

    act(() => {
      fireEvent.mouseLeave(submitBtn);
    });
    expect(submitBtn.style.background).toBe("rgb(0, 121, 149)"); // COLOR.ACCENT.PRIMARY (#007995)
  });

  it("en el modo editar el botón de copiar permanece alineado a la derecha por defecto y al editar", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-cliente-nombre")).toHaveTextContent("Carlos Gómez");
    });

    // Cambiar a modo Editar
    const btnEditar = screen.getByRole("button", { name: "Editar" });
    fireEvent.click(btnEditar);

    const copyBtn = screen.getByTitle("Copiar texto al portapapeles");
    const actionsGroup = copyBtn.parentElement as HTMLElement;
    expect(actionsGroup.style.marginLeft).toBe("auto");

    // Editar texto
    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Texto editado manualmente" } });

    expect(screen.getByText("✏️ Editado a mano")).toBeInTheDocument();
    expect(actionsGroup.style.marginLeft).toBe("auto");
  });
});



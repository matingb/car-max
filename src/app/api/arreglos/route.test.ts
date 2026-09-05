import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "@/app/api/arreglos/arregloService";
import { createCreateArregloRequest } from "@/tests/factories";
import { NextRequest } from "next/server";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("@/app/api/arreglos/arregloService", () => ({
  arregloService: {
    getArreglo: vi.fn(),
  },
}));

describe("POST /api/arreglos", () => {
  let formularioLookupResult: { data: unknown; error: unknown };
  const rpc = vi.fn();
  const createdArreglo = {
    id: "a1",
    tenant_id: "TEN-1",
    vehiculo_id: "v1",
    taller_id: "t1",
    estado: "SIN_INICIAR",
    descripcion: "Cambio aceite",
    kilometraje_leido: 123,
    fecha: "2026-01-01T00:00:00.000Z",
    observaciones: "",
    precio_final: 1000,
    precio_sin_iva: 826.45,
    esta_pago: false,
    extra_data: "",
  };

  const mockSupabase = {
    rpc,
    from: vi.fn((table: string) => {
      if (table === "formularios") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => formularioLookupResult),
            })),
          })),
        };
      }

      if (table === "arreglos") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: createdArreglo, error: null })),
            })),
          })),
        };
      }

      return {
        insert: vi.fn(async () => ({ error: null })),
        select: vi.fn(() => ({
          in: vi.fn(async () => ({ data: [], error: null })),
        })),
      };
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();

    formularioLookupResult = { data: null, error: null };
    rpc.mockResolvedValue({ data: "a1", error: null });
    vi.mocked(arregloService.getArreglo).mockResolvedValue({
      data: { items: [], hasMore: false },
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

  it("recibe el filtro de estado de pago en el listado", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/arreglos?taller_id=t1&estado_pago=PARCIAL")
    );

    expect(response.status).toBe(200);
    expect(arregloService.getArreglo).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({ tallerId: "t1", estadoPago: "PARCIAL" })
    );
  });

  it("si el insert es exitoso, registra cambios en los stats", async () => {
    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          detalles: [{ descripcion: "Cambio aceite", cantidad: 1, valor: 1000 }],
        })
      ),
    });

    await POST(req);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "rpc_crear_arreglo_completo",
      expect.objectContaining({
        p_descripcion: "Cambio aceite",
        p_detalles: [
          {
            descripcion: "Cambio aceite",
            cantidad: 1,
            valor: 1000,
            categoria_arreglo_id: null,
            empleado_id: null,
          },
        ],
      })
    );
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(expect.anything(), "TEN-1");
  });

  it("envía los datos de cobro incluidos en la firma de la RPC", async () => {
    const cuentaId = "c0000000-0000-4000-8000-000000000001";
    const idempotencyKey = "e0000000-0000-4000-8000-000000000001";
    const fechaCobro = "2026-08-25";
    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          esta_pago: true,
          cuenta_financiera_id: cuentaId,
          fecha_cobro: fechaCobro,
          idempotency_key: idempotencyKey,
        })
      ),
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith(
      "rpc_crear_arreglo_completo",
      expect.objectContaining({
        p_esta_pago: true,
        p_cuenta_id: cuentaId,
        p_fecha_cobro: expect.stringMatching(/^2026-08-25T/),
        p_idempotency_key: idempotencyKey,
      })
    );
  });

  it("rechaza la creación de un arreglo en estado PRESUPUESTO marcado como pagado", async () => {
    const cuentaId = "c0000000-0000-4000-8000-000000000001";
    const idempotencyKey = "e0000000-0000-4000-8000-000000000001";
    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          estado: "PRESUPUESTO",
          esta_pago: true,
          cuenta_financiera_id: cuentaId,
          idempotency_key: idempotencyKey,
        })
      ),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("No se puede registrar como pago un arreglo en estado PRESUPUESTO");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("bloquea creacion en TERMINADO cuando faltan required", async () => {
    formularioLookupResult = {
      data: {
        metadata: [
          {
            title: "Checklist",
            inputs: [{ key: "patente", label: "Patente", required: true }],
          },
        ],
      },
      error: null,
    };

    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          estado: "TERMINADO",
          detalle_formulario: {
            formulario_id: "f1",
            costo: 0,
            metadata: [{ title: "Checklist", inputs: [{ title: "Patente", value: null }] }],
          },
        })
      ),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(String(body?.error ?? "")).toContain("Patente");
    expect(rpc).not.toHaveBeenCalled();
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("permite creacion en TERMINADO cuando required estan completos", async () => {
    formularioLookupResult = {
      data: {
        metadata: [
          {
            title: "Checklist",
            inputs: [{ key: "patente", label: "Patente", required: true }],
          },
        ],
      },
      error: null,
    };

    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          estado: "TERMINADO",
          detalle_formulario: {
            formulario_id: "f1",
            costo: 0,
            metadata: [{ title: "Checklist", inputs: [{ title: "Patente", value: "AA123BB" }] }],
          },
        })
      ),
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(expect.anything(), "TEN-1");
  });

  it("propaga precio_compra de repuestos existentes al RPC de creacion completa", async () => {
    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          repuestos: [
            {
              stock_id: "s1",
              cantidad: 5,
              monto_unitario: 1500,
              precio_compra: 900,
            },
          ],
        })
      ),
    });

    await POST(req);

    expect(rpc).toHaveBeenCalledWith(
      "rpc_crear_arreglo_completo",
      expect.objectContaining({
        p_repuestos: [
          {
            stock_id: "s1",
            cantidad: 5,
            monto_unitario: 1500,
            precio_compra: 900,
            categoria_arreglo_id: null,
            empleado_id: null,
          },
        ],
      })
    );
  });

  it("exige cuenta financiera antes de crear un producto que genera compra automática", async () => {
    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          repuestos_nuevos: [
            {
              codigo: "FILT-1",
              nombre: "Filtro",
              precio_compra: 100,
              precio_venta: 180,
              cantidad: 1,
            },
          ],
        })
      ),
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("permite creacion en TERMINADO sin detalle/config", async () => {
    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          estado: "TERMINADO",
          detalle_formulario: undefined,
        })
      ),
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

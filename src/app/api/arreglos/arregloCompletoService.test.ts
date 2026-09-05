import { describe, it, expect, vi } from "vitest";
import { arregloCompletoService } from "./arregloCompletoService";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError } from "@/app/api/serviceError";

describe("arregloCompletoService", () => {
  it("retorna el detalle completo con arreglo, empleados normalizados, detalles y formulario custom", async () => {
    const mockRpcData = {
      arreglo: {
        id: "a1",
        descripcion: "Arreglo 1",
        empleados_detallados: [
          { id: "e1", nombre: "Juan", apellido: "Perez" },
        ],
      },
      detalles: [{ id: "d1", descripcion: "Mano de obra", valor: 1000 }],
      asignaciones: [{ id: "as1", tipo: "ASIGNACION", lineas: [] }],
      cobros: [{ id: "c1", importe: 500 }],
    };

    const mockDetalleForm = [
      {
        id: "df1",
        arreglo_id: "a1",
        formulario_id: "form-1",
        costo: 200,
        metadata: [{ title: "Checklist", inputs: [] }],
      },
    ];

    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: mockRpcData, error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockDetalleForm, error: null }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await arregloCompletoService.getArregloDetalleCompleto(supabase, "a1");

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.arreglo.id).toBe("a1");
    expect(result.data?.arreglo.empleados).toEqual([
      { id: "e1", nombre: "Juan", apellido: "Perez" },
    ]);
    expect(result.data?.detalles).toHaveLength(1);
    expect(result.data?.detalle_formulario?.id).toBe("df1");
    expect(result.data?.detalle_formulario?.formulario_id).toBe("form-1");
  });

  it("retorna ServiceError.NotFound si la RPC no devuelve datos", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as SupabaseClient;

    const result = await arregloCompletoService.getArregloDetalleCompleto(supabase, "a1");

    expect(result.data).toBeNull();
    expect(result.error).toBe(ServiceError.NotFound);
  });

  it("retorna ServiceError si la RPC falla", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "RPC failed", code: "50000" } }),
    } as unknown as SupabaseClient;

    const result = await arregloCompletoService.getArregloDetalleCompleto(supabase, "a1");

    expect(result.data).toBeNull();
    expect(result.error).toBe(ServiceError.Unknown);
  });
});

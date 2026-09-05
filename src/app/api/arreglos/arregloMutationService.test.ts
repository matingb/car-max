import { describe, it, expect, vi, beforeEach } from "vitest";
import { arregloMutationService } from "./arregloMutationService";
import { arregloService } from "./arregloService";
import { arregloFormularioService } from "./arregloFormularioService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Arreglo } from "@/model/types";
import { ServiceError } from "@/app/api/serviceError";

vi.mock("./arregloService", () => ({
  arregloService: {
    updateById: vi.fn(),
    getByIdWithVehiculo: vi.fn(),
    deleteById: vi.fn(),
  },
}));

vi.mock("./arregloFormularioService", () => ({
  arregloFormularioService: {
    validateTerminadoRequiredFields: vi.fn(),
    upsertDetalleFormulario: vi.fn(),
  },
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

describe("arregloMutationService", () => {
  const supabase = {} as SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateEstadoTransition", () => {
    it("bloquea transición a PRESUPUESTO si el arreglo registra pagos previos", async () => {
      vi.mocked(arregloService.getByIdWithVehiculo).mockResolvedValue({
        data: { id: "a1", esta_pago: true, total_cobrado: 5000 } as unknown as Arreglo,
        error: null,
      });

      const result = await arregloMutationService.validateEstadoTransition(
        supabase,
        "a1",
        "PRESUPUESTO"
      );

      expect(result.error).toBe("No se puede cambiar a presupuesto un arreglo que ya registra pagos");
      expect(result.status).toBe(400);
    });

    it("permite transición a PRESUPUESTO si no tiene pagos", async () => {
      vi.mocked(arregloService.getByIdWithVehiculo).mockResolvedValue({
        data: { id: "a1", esta_pago: false, total_cobrado: 0 } as unknown as Arreglo,
        error: null,
      });

      const result = await arregloMutationService.validateEstadoTransition(
        supabase,
        "a1",
        "PRESUPUESTO"
      );

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it("valida campos obligatorios al transicionar a TERMINADO", async () => {
      vi.mocked(arregloService.getByIdWithVehiculo).mockResolvedValue({
        data: { id: "a1", estado: "EN_PROGRESO" } as unknown as Arreglo,
        error: null,
      });
      vi.mocked(arregloFormularioService.validateTerminadoRequiredFields).mockResolvedValue({
        ok: false,
        error: "Faltan campos obligatorios",
        status: 400,
      });

      const result = await arregloMutationService.validateEstadoTransition(
        supabase,
        "a1",
        "TERMINADO"
      );

      expect(result.error).toBe("Faltan campos obligatorios");
      expect(result.status).toBe(400);
    });
  });

  describe("updateArregloCompleto", () => {
    it("rechaza payload con esta_pago", async () => {
      const result = await arregloMutationService.updateArregloCompleto(supabase, "a1", {
        esta_pago: true,
      });

      expect(result.error).toBe(
        "El cobro se registra desde la acción de pago para conservar el asiento financiero."
      );
      expect(result.status).toBe(400);
    });

    it("actualiza arreglo, upsert de formulario y notifica stats", async () => {
      vi.mocked(arregloService.updateById).mockResolvedValue({
        data: { id: "a1", tenant_id: "ten-1", estado: "EN_PROGRESO" } as unknown as Arreglo,
        error: null,
      });
      vi.mocked(arregloFormularioService.upsertDetalleFormulario).mockResolvedValue({
        error: null,
      });

      const result = await arregloMutationService.updateArregloCompleto(supabase, "a1", {
        estado: "EN_PROGRESO",
        observaciones: "Observación actualizada",
        detalle_formulario: {
          costo: 100,
          metadata: [],
        },
      });

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
      expect(arregloService.updateById).toHaveBeenCalledWith(supabase, "a1", {
        estado: "EN_PROGRESO",
        observaciones: "Observación actualizada",
      });
      expect(arregloFormularioService.upsertDetalleFormulario).toHaveBeenCalled();
      expect(statsService.onDataChanged).toHaveBeenCalledWith(supabase, "ten-1");
    });
  });

  describe("deleteArregloCompleto", () => {
    it("obtiene arreglo, borra y notifica a stats", async () => {
      vi.mocked(arregloService.getByIdWithVehiculo).mockResolvedValue({
        data: { id: "a1", tenant_id: "ten-1" } as unknown as Arreglo,
        error: null,
      });
      vi.mocked(arregloService.deleteById).mockResolvedValue({ error: null });

      const result = await arregloMutationService.deleteArregloCompleto(supabase, "a1");

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
      expect(arregloService.deleteById).toHaveBeenCalledWith(supabase, "a1");
      expect(statsService.onDataChanged).toHaveBeenCalledWith(supabase, "ten-1");
    });

    it("retorna 404 si el arreglo no existe", async () => {
      vi.mocked(arregloService.getByIdWithVehiculo).mockResolvedValue({
        data: null,
        error: ServiceError.NotFound,
      });

      const result = await arregloMutationService.deleteArregloCompleto(supabase, "a1");

      expect(result.error).toBe("Arreglo no encontrado");
      expect(result.status).toBe(404);
      expect(arregloService.deleteById).not.toHaveBeenCalled();
    });
  });
});

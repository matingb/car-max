import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT, DELETE } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "../arregloService";
import { syncArregloDescripcion } from "../arregloDescripcionService";
import { NextRequest } from "next/server";
import { Arreglo } from "@/model/types";
import { ServiceError } from "@/app/api/serviceError";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("../arregloService", () => ({
  arregloService: {
    updateById: vi.fn(),
    getByIdWithVehiculo: vi.fn(),
    deleteById: vi.fn(),
  },
}));

vi.mock("../arregloDescripcionService", () => ({
  syncArregloDescripcion: vi.fn(),
}));

describe("Mutaciones /api/arreglos/[id]", () => {
  let detalleLookupResult: { data: unknown; error: unknown };
  let formularioLookupResult: { data: unknown; error: unknown };

  const mockSupabase = {
    from: vi.fn((table: string) => {
      if (table === "detalle_form_custom") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => detalleLookupResult),
              })),
            })),
          })),
        };
      }

      if (table === "formularios") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => formularioLookupResult),
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        })),
      };
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();

    detalleLookupResult = { data: [], error: null };
    formularioLookupResult = { data: null, error: null };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(arregloService.updateById).mockResolvedValue({
      data: { id: "a1", tenant_id: "TEN-1", taller_id: "TAL-1" } as unknown as Arreglo,
      error: null,
    });
    vi.mocked(arregloService.getByIdWithVehiculo).mockResolvedValue({
      data: { id: "a1", tenant_id: "TEN-1", estado: "EN_PROGRESO", taller_id: "TAL-1" } as unknown as Arreglo,
      error: null,
    });
    vi.mocked(arregloService.deleteById).mockResolvedValue(
      { error: null } as unknown as { error: null }
    );
    vi.mocked(syncArregloDescripcion).mockResolvedValue({
      descripcion: "Service | Cambio aceite",
      error: null,
    });
  });

  it("si update es exitoso, registra cambios en los stats", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observaciones: "Nuevas observaciones" }),
    });

    const params = Promise.resolve({ id: "a1" });
    await PUT(req, { params });

    expect(arregloService.updateById).toHaveBeenCalledTimes(1);
    expect(arregloService.updateById).toHaveBeenCalledWith(
      mockSupabase,
      "a1",
      expect.objectContaining({ observaciones: "Nuevas observaciones" })
    );
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase, "TEN-1");
  });

  it("PUT: si el estado es inválido devuelve 400 y no llama al service", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "pausado" }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ data: null, error: "Estado de arreglo inválido" });
    expect(arregloService.updateById).not.toHaveBeenCalled();
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("PUT: normaliza estado (trim + uppercase) antes de llamar al service", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: " en_progreso " }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });

    expect(response.status).toBe(200);
    expect(arregloService.updateById).toHaveBeenCalledWith(
      mockSupabase,
      "a1",
      expect.objectContaining({ estado: "EN_PROGRESO" })
    );
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });

  it("PUT: si el service devuelve NotFound, responde 404", async () => {
    vi.mocked(arregloService.updateById).mockResolvedValue({
      data: null,
      error: ServiceError.NotFound,
    });

    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "TERMINADO" }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ data: null, error: "Arreglo no encontrado" });
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("PUT: bloquea transicion a TERMINADO cuando faltan required", async () => {
    detalleLookupResult = {
      data: [
        {
          config_id: "f1",
          metadata: [{ title: "Checklist", inputs: [{ title: "Patente", value: null }] }],
        },
      ],
      error: null,
    };
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

    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "TERMINADO" }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(String(body?.error ?? "")).toContain("Patente");
    expect(arregloService.updateById).not.toHaveBeenCalled();
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("PUT: permite transicion a TERMINADO cuando required estan completos", async () => {
    detalleLookupResult = {
      data: [
        {
          config_id: "f1",
          metadata: [{ title: "Checklist", inputs: [{ title: "Patente", value: "AA123BB" }] }],
        },
      ],
      error: null,
    };
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

    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "TERMINADO" }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });

    expect(response.status).toBe(200);
    expect(arregloService.updateById).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });

  it("PUT: permite transicion a TERMINADO cuando no hay detalle/config", async () => {
    detalleLookupResult = { data: [], error: null };

    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "TERMINADO" }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });

    expect(response.status).toBe(200);
    expect(arregloService.updateById).toHaveBeenCalledTimes(1);
  });

  it("PUT: rechaza el cambio a estado PRESUPUESTO si el arreglo ya registra pagos", async () => {
    vi.mocked(arregloService.getByIdWithVehiculo).mockResolvedValue({
      data: {
        id: "a1",
        estado: "EN_PROGRESO",
        esta_pago: true,
        total_cobrado: 15000,
      } as unknown as Arreglo,
      error: null,
    });

    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: "PRESUPUESTO",
      }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("No se puede cambiar a presupuesto un arreglo que ya registra pagos");
    expect(arregloService.updateById).not.toHaveBeenCalled();
  });

  it("PUT: si el JSON es inválido, responde 400", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "JSON inválido" });
    expect(arregloService.updateById).not.toHaveBeenCalled();
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("si delete es exitoso, registra cambios en los stats", async () => {
    const req = {} as NextRequest;
    const params = Promise.resolve({ id: "a1" });
    await DELETE(req, { params });

    expect(arregloService.deleteById).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase, "TEN-1");
  });
});

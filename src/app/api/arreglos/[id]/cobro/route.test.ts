import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DELETE, POST } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

const ARREGLO_ID = "11111111-1111-4111-8111-111111111111";
const CUENTA_ID = "22222222-2222-4222-8222-222222222222";
const IDEMPOTENCY_KEY = "33333333-3333-4333-8333-333333333333";

const arreglo = {
  id: ARREGLO_ID,
  tenant_id: "44444444-4444-4444-8444-444444444444",
  esta_pago: true,
  precio_final: 25000,
  estado: "TERMINADO",
};

function mockSupabase(rpc: ReturnType<typeof vi.fn>) {
  return {
    rpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: arreglo, error: null }),
          single: vi.fn().mockResolvedValue({ data: arreglo, error: null }),
        })),
      })),
    })),
  } as unknown as SupabaseClient;
}

describe("/api/arreglos/[id]/cobro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registra el cobro con cuenta, fecha e idempotencia y rehidrata el arreglo", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "evento-id", error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const response = await POST(
      new NextRequest(`http://localhost/api/arreglos/${ARREGLO_ID}/cobro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuenta_financiera_id: CUENTA_ID,
          fecha_cobro: "2026-07-31",
          idempotency_key: IDEMPOTENCY_KEY,
        }),
      }),
      { params: Promise.resolve({ id: ARREGLO_ID }) }
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_finanzas_cobrar_arreglo", {
      p_arreglo_id: ARREGLO_ID,
      p_cuenta_id: CUENTA_ID,
      p_monto: null,
      p_fecha_cobro: expect.stringMatching(/^2026-07-31T/),
      p_descripcion: null,
      p_idempotency_key: IDEMPOTENCY_KEY,
      p_pagos: null,
    });
    expect(statsService.onDataChanged).toHaveBeenCalledWith(expect.anything(), arreglo.tenant_id);
    await expect(response.json()).resolves.toMatchObject({ data: { id: ARREGLO_ID } });
  });

  it("registra cobro parcial con monto y descripcion", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { operacion_id: "op-1" }, error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const response = await POST(
      new NextRequest(`http://localhost/api/arreglos/${ARREGLO_ID}/cobro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuenta_financiera_id: CUENTA_ID,
          fecha_cobro: "2026-07-31",
          monto: 10000,
          descripcion: "Seña inicial",
          idempotency_key: IDEMPOTENCY_KEY,
        }),
      }),
      { params: Promise.resolve({ id: ARREGLO_ID }) }
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_finanzas_cobrar_arreglo", {
      p_arreglo_id: ARREGLO_ID,
      p_cuenta_id: CUENTA_ID,
      p_monto: 10000,
      p_fecha_cobro: expect.stringMatching(/^2026-07-31T/),
      p_descripcion: "Seña inicial",
      p_idempotency_key: IDEMPOTENCY_KEY,
      p_pagos: null,
    });
  });

  it("registra cobro dividido en múltiples cuentas", async () => {
    const CUENTA_2_ID = "55555555-5555-4555-8555-555555555555";
    const rpc = vi.fn().mockResolvedValue({ data: { operaciones_ids: ["op-1", "op-2"] }, error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const response = await POST(
      new NextRequest(`http://localhost/api/arreglos/${ARREGLO_ID}/cobro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_cobro: "2026-07-31",
          pagos: [
            { cuenta_financiera_id: CUENTA_ID, monto: 15000, descripcion: "Efectivo" },
            { cuenta_financiera_id: CUENTA_2_ID, monto: 10000, descripcion: "Mercado Pago" },
          ],
          idempotency_key: IDEMPOTENCY_KEY,
        }),
      }),
      { params: Promise.resolve({ id: ARREGLO_ID }) }
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_finanzas_cobrar_arreglo", {
      p_arreglo_id: ARREGLO_ID,
      p_cuenta_id: null,
      p_monto: null,
      p_fecha_cobro: expect.stringMatching(/^2026-07-31T/),
      p_descripcion: null,
      p_idempotency_key: IDEMPOTENCY_KEY,
      p_pagos: [
        { cuenta_id: CUENTA_ID, monto: 15000, descripcion: "Efectivo" },
        { cuenta_id: CUENTA_2_ID, monto: 10000, descripcion: "Mercado Pago" },
      ],
    });
  });

  it("anula el cobro entregando p_operacion_id si se especifica", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { anulada_operacion_id: "op-1" }, error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const response = await DELETE(
      new NextRequest(`http://localhost/api/arreglos/${ARREGLO_ID}/cobro?operacion_id=55555555-5555-4555-8555-555555555555`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: ARREGLO_ID }) }
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_finanzas_anular_cobro_arreglo", {
      p_arreglo_id: ARREGLO_ID,
      p_operacion_id: "55555555-5555-4555-8555-555555555555",
    });
  });

  it("anula el último cobro si no se especifica operacion_id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { anulada_operacion_id: "op-1" }, error: null });
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const response = await DELETE(
      new NextRequest(`http://localhost/api/arreglos/${ARREGLO_ID}/cobro`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: ARREGLO_ID }) }
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_finanzas_anular_cobro_arreglo", {
      p_arreglo_id: ARREGLO_ID,
      p_operacion_id: null,
    });
  });

  it("rechaza el cobro si no se especifica cuenta financiera", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const response = await POST(
      new NextRequest(`http://localhost/api/arreglos/${ARREGLO_ID}/cobro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_cobro: "2026-07-31",
          monto: 10000,
        }),
      }),
      { params: Promise.resolve({ id: ARREGLO_ID }) }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("cuenta financiera válida");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rechaza el cobro si algún pago en la lista no tiene cuenta", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const response = await POST(
      new NextRequest(`http://localhost/api/arreglos/${ARREGLO_ID}/cobro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_cobro: "2026-07-31",
          pagos: [
            { cuenta_financiera_id: "", monto: 10000 },
          ],
        }),
      }),
      { params: Promise.resolve({ id: ARREGLO_ID }) }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("cuenta financiera válida");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rechaza el cobro si el monto es menor o igual a cero", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue(mockSupabase(rpc));

    const response = await POST(
      new NextRequest(`http://localhost/api/arreglos/${ARREGLO_ID}/cobro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuenta_financiera_id: CUENTA_ID,
          fecha_cobro: "2026-07-31",
          monto: -500,
        }),
      }),
      { params: Promise.resolve({ id: ARREGLO_ID }) }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("mayor a 0");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rechaza el cobro si el arreglo está en estado PRESUPUESTO", async () => {
    const rpc = vi.fn();
    const supabaseMock = {
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { ...arreglo, estado: "PRESUPUESTO" },
              error: null,
            }),
            single: vi.fn().mockResolvedValue({
              data: { ...arreglo, estado: "PRESUPUESTO" },
              error: null,
            }),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    vi.mocked(createClient).mockResolvedValue(supabaseMock);

    const response = await POST(
      new NextRequest(`http://localhost/api/arreglos/${ARREGLO_ID}/cobro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuenta_financiera_id: CUENTA_ID,
          fecha_cobro: "2026-07-31",
          monto: 5000,
        }),
      }),
      { params: Promise.resolve({ id: ARREGLO_ID }) }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("No se pueden registrar pagos en un presupuesto");
    expect(rpc).not.toHaveBeenCalled();
  });
});

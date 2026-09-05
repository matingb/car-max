import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createClient } from "@/supabase/server";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("@/app/api/arreglos/arregloDescripcionService", () => ({
  syncArregloDescripcion: vi.fn().mockResolvedValue({ descripcion: null, error: null }),
}));

describe("POST /api/arreglos/[id]/repuestos", () => {
  const CUENTA_ID = "11111111-1111-4111-8111-111111111111";
  const IDEMPOTENCY_KEY = "22222222-2222-4222-8222-222222222222";
  const rpc = vi.fn();
  const mockSupabase = { rpc } as unknown as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

  it("agrega o edita un repuesto existente sin invalidar stats", async () => {
    rpc.mockResolvedValue({ data: "OP-1", error: null });

    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taller_id: "T-1",
        stock_id: "S-1",
        cantidad: 2,
        monto_unitario: 1500,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_asignar_repuesto_existente_con_compra", {
      p_arreglo_id: "A-1",
      p_taller_id: "T-1",
      p_stock_id: "S-1",
      p_cantidad: 2,
      p_monto_unitario: 1500,
      p_precio_compra: null,
      p_categoria_arreglo_id: null,
      p_empleado_id: null,
      p_cuenta_id: null,
      p_idempotency_key: null,
    });
    await expect(res.json()).resolves.toEqual({
      data: { operacion_id: "OP-1" },
      error: null,
    });
  });

  it("no invalida stats si falla la RPC", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "STOCK_INSUFICIENTE" } });

    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taller_id: "T-1",
        stock_id: "S-1",
        cantidad: 2,
        monto_unitario: 1500,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(409);
  });

  it("crea producto inline y asigna el repuesto usando el mismo POST", async () => {
    rpc.mockResolvedValue({ data: "OP-2", error: null });

    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "nuevo",
        taller_id: "T-1",
        codigo: "FILT-1",
        nombre: "Filtro",
        precio_compra: 100,
        precio_venta: 180,
        cantidad: 2,
        cuenta_financiera_id: CUENTA_ID,
        idempotency_key: IDEMPOTENCY_KEY,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_crear_producto_inline_para_arreglo", {
      p_arreglo_id: "A-1",
      p_taller_id: "T-1",
      p_codigo: "FILT-1",
      p_nombre: "Filtro",
      p_precio_compra: 100,
      p_precio_venta: 180,
      p_cantidad: 2,
      p_cuenta_id: CUENTA_ID,
      p_idempotency_key: IDEMPOTENCY_KEY,
      p_categoria_arreglo_id: null,
      p_empleado_id: null,
    });
    await expect(res.json()).resolves.toEqual({
      data: { operacion_id: "OP-2" },
      error: null,
    });
  });

  it("propaga precio_compra al RPC cuando el stock es insuficiente", async () => {
    rpc.mockResolvedValue({ data: "OP-3", error: null });

    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taller_id: "T-1",
        stock_id: "S-1",
        cantidad: 5,
        monto_unitario: 1500,
        precio_compra: 800,
        cuenta_financiera_id: CUENTA_ID,
        idempotency_key: IDEMPOTENCY_KEY,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_asignar_repuesto_existente_con_compra", {
      p_arreglo_id: "A-1",
      p_taller_id: "T-1",
      p_stock_id: "S-1",
      p_cantidad: 5,
      p_monto_unitario: 1500,
      p_precio_compra: 800,
      p_categoria_arreglo_id: null,
      p_empleado_id: null,
      p_cuenta_id: CUENTA_ID,
      p_idempotency_key: IDEMPOTENCY_KEY,
    });
  });

  it("exige cuenta e idempotencia antes de generar una compra automática", async () => {
    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "nuevo",
        taller_id: "T-1",
        codigo: "FILT-1",
        nombre: "Filtro",
        precio_compra: 100,
        precio_venta: 180,
        cantidad: 2,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mapea PRECIO_COMPRA_REQUERIDO del RPC a 400", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "PRECIO_COMPRA_REQUERIDO" },
    });

    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taller_id: "T-1",
        stock_id: "S-1",
        cantidad: 5,
        monto_unitario: 1500,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "Precio de compra requerido para cubrir stock faltante",
    });
  });

  it("rechaza precio_compra negativo con 400", async () => {
    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taller_id: "T-1",
        stock_id: "S-1",
        cantidad: 2,
        monto_unitario: 1500,
        precio_compra: -100,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "Precio de compra invalido",
    });
  });

  it("mapea codigo duplicado al crear producto inline", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "PRODUCTO_CODIGO_DUPLICADO" },
    });

    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "nuevo",
        taller_id: "T-1",
        codigo: "FILT-1",
        nombre: "Filtro",
        precio_compra: 100,
        precio_venta: 180,
        cantidad: 2,
        cuenta_financiera_id: CUENTA_ID,
        idempotency_key: IDEMPOTENCY_KEY,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(409);
  });

  it("normaliza categoria_arreglo_id y empleado_id vacios a null sin dar error de validacion", async () => {
    rpc.mockResolvedValue({ data: "OP-4", error: null });

    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taller_id: "T-1",
        stock_id: "S-1",
        cantidad: 1,
        monto_unitario: 1000,
        categoria_arreglo_id: "",
        empleado_id: "",
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("rpc_asignar_repuesto_existente_con_compra", {
      p_arreglo_id: "A-1",
      p_taller_id: "T-1",
      p_stock_id: "S-1",
      p_cantidad: 1,
      p_monto_unitario: 1000,
      p_precio_compra: null,
      p_categoria_arreglo_id: null,
      p_empleado_id: null,
      p_cuenta_id: null,
      p_idempotency_key: null,
    });
  });

  it("mapea errores de permisos o expiración de sesión a 401", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "JWT sin tenant_id" },
    });

    const req = new Request("http://localhost/api/arreglos/A-1/repuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taller_id: "T-1",
        stock_id: "S-1",
        cantidad: 1,
        monto_unitario: 1000,
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "A-1" }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: "Tu sesión expiró o no tenés permisos para realizar esta acción",
    });
  });
});

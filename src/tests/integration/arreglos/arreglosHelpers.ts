import { expect } from "vitest";
import type { NextRequest } from "next/server";
import { POST, type CreateArregloResponse } from "@/app/api/arreglos/route";
import {
  DELETE as deleteRepuestoLineaRoute,
  type DeleteRepuestoLineaResponse,
} from "@/app/api/arreglos/[id]/repuestos/[lineaId]/route";
import type { StockRow as Stock } from "@/app/api/stocks/stocksService";
import { arregloCompletoService } from "@/app/api/arreglos/arregloCompletoService";
import { testClient, SEED } from "@/tests/integration";
import { createCreateArregloRequest } from "@/tests/factories";
import { DadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface DadoQueExisteUnArregloConRepuestoArgs {
  stock?: Partial<Stock>;
  repuesto?: {
    cantidad?: number;
    monto_unitario?: number;
  };
}

export interface DadoQueExisteUnArregloConRepuestoResult {
  arregloId: string;
  stockId: string;
  lineaId: string;
  cantidadInicial: number;
  stockAUsar: number;
}

// ─── HTTP Driver Helpers ──────────────────────────────────────────────────────

/**
 * Invoca el endpoint POST /api/arreglos retornando la Response cruda.
 */
export async function callPostArreglo(payload: unknown): Promise<Response> {
  const req = new Request("http://localhost:3000/api/arreglos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return POST(req);
}

/**
 * Crea un arreglo mediante la API validando el código de estado HTTP esperado.
 */
export async function postArreglo(
  payload: unknown,
  expectedStatus = 201
): Promise<CreateArregloResponse> {
  const response = await callPostArreglo(payload);
  expect(response.status).toBe(expectedStatus);
  return response.json();
}

/**
 * Crea un arreglo mediante la API y retorna directamente su ID generado.
 */
export async function postArregloAndGetId(
  payload: unknown,
  expectedStatus = 201
): Promise<string> {
  const { data } = await postArreglo(payload, expectedStatus);
  return data!.id;
}

/**
 * Invoca el endpoint DELETE /api/arreglos/:id/repuestos/:lineaId.
 */
export async function deleteRepuestoLinea(
  arregloId: string,
  lineaId: string
): Promise<DeleteRepuestoLineaResponse> {
  const req = new Request(
    `http://localhost:3000/api/arreglos/${arregloId}/repuestos/${lineaId}`,
    { method: "DELETE" }
  );

  const response = await deleteRepuestoLineaRoute(req as unknown as NextRequest, {
    params: Promise.resolve({ id: arregloId, lineaId }),
  });
  expect(response.status).toBe(200);
  return response.json();
}

// ─── Precondición / Fixture Helpers ──────────────────────────────────────────

/**
 * Precondición: Crea un producto con stock y un arreglo que ya consume dicho repuesto.
 */
export async function DadoQueExisteUnArregloConRepuesto({
  stock = {},
  repuesto = {},
}: DadoQueExisteUnArregloConRepuestoArgs = {}): Promise<DadoQueExisteUnArregloConRepuestoResult> {
  const cantidadInicial = stock.cantidad ?? 200;
  const stockAUsar = repuesto.cantidad ?? 3;
  const montoUnitario = repuesto.monto_unitario ?? 6500;

  const { stockId } = await DadoQueExisteUnProductoConStock({
    stock: { cantidad: cantidadInicial, taller_id: SEED.tallerId, ...stock },
  });

  const arregloId = await postArregloAndGetId(
    createCreateArregloRequest({
      vehiculo_id: SEED.vehiculoId,
      taller_id: SEED.tallerId,
      precio_final: stockAUsar * montoUnitario,
      repuestos: [{ stock_id: stockId, cantidad: stockAUsar, monto_unitario: montoUnitario }],
    })
  );

  const { data: detalle } = await arregloCompletoService.getArregloDetalleCompleto(testClient, arregloId);
  const lineaId = detalle?.asignaciones[0]?.lineas[0]?.id;
  if (!lineaId) {
    throw new Error("DadoQueExisteUnArregloConRepuesto: no se encontró lineaId en el arreglo creado");
  }

  return { arregloId, stockId, lineaId, cantidadInicial, stockAUsar };
}

// ─── Assertion Helpers ────────────────────────────────────────────────────────

/**
 * Verifica que el arreglo no tenga ninguna línea de asignación de repuestos.
 */
export async function expectArregloSinRepuestos(arregloId: string) {
  const { data } = await arregloCompletoService.getArregloDetalleCompleto(testClient, arregloId);
  expect(data?.asignaciones).toEqual([]);
}

import { expect } from "vitest";
import type { ProductoRow as Producto } from "@/app/api/productos/productosService";
import { stocksService, type StockRow as Stock } from "@/app/api/stocks/stocksService";
import { testClient, SEED } from "@/tests/integration";

export interface DadoQueExisteUnProductoResult {
  productoId: string;
  stockId: string;
}

export interface DadoQueExisteUnProductoArgs {
  producto?: Partial<Producto>;
  stock?: Partial<Stock>;
}

/**
 * Crea un producto y su stock asociado en la base de datos para pruebas.
 */
export async function DadoQueExisteUnProductoConStock(
  { producto = {}, stock = {} }: DadoQueExisteUnProductoArgs = {},
  client = testClient
): Promise<DadoQueExisteUnProductoResult> {
  const { data: productoCreado, error: prodError } = await client
    .from("productos")
    .insert({
      tenant_id: SEED.tenantId,
      codigo: `ACE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      nombre: "Aceite 5W30",
      precio_unitario: 6500,
      costo_unitario: 4200,
      ...producto,
    })
    .select("id")
    .single();

  if (prodError || !productoCreado) {
    throw new Error(
      `DadoQueExisteUnProductoConStock: error al crear producto: ${prodError?.message ?? "sin respuesta"}`
    );
  }

  const { data: stockCreado, error: stockError } = await client
    .from("stocks")
    .insert({
      tenant_id: SEED.tenantId,
      taller_id: SEED.tallerId,
      cantidad: 200,
      stock_minimo: 10,
      stock_maximo: 300,
      ...stock,
      producto_id: stock.producto_id ?? productoCreado.id,
    })
    .select("id, cantidad, producto_id, taller_id")
    .single();

  if (stockError || !stockCreado) {
    throw new Error(
      `DadoQueExisteUnProductoConStock: error al crear stock: ${stockError?.message ?? "sin respuesta"}`
    );
  }

  return {
    productoId: productoCreado.id,
    stockId: stockCreado.id,
  };
}

/**
 * Verifica la cantidad disponible de un stock específico.
 */
export async function expectCantidadDeStock(stockId: string, cantidad: number) {
  const { data } = await stocksService.getById(testClient, stockId);
  expect(data?.cantidad).toBe(cantidad);
}

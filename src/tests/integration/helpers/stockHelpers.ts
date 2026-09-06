import { expect } from "vitest";
import {
  productosService,
  type CreateProductoInput,
  type ProductoRow as Producto,
} from "@/app/api/productos/productosService";
import {
  stocksService,
  type StockRow as Stock,
} from "@/app/api/stocks/stocksService";
import { testClient, SEED } from "@/tests/integration";

export interface DadoQueExisteUnProductoResult {
  productoId: string;
  stockId: string;
}

export interface DadoQueExisteUnProductoArgs {
  producto?: Partial<CreateProductoInput>;
  stock?: Partial<Omit<Stock, "id" | "tenant_id" | "created_at" | "updated_at">>;
}

/**
 * Crea un producto y su stock asociado utilizando los servicios de la aplicación.
 */
export async function DadoQueExisteUnProductoConStock(
  { producto = {}, stock = {} }: DadoQueExisteUnProductoArgs = {},
  client = testClient
): Promise<DadoQueExisteUnProductoResult> {
  const productoPayload: CreateProductoInput = {
    codigo: `ACE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    nombre: "Aceite 5W30",
    precio_unitario: 6500,
    costo_unitario: 4200,
    marca: null,
    modelo: null,
    descripcion: null,
    proveedor: null,
    categorias: [],
    show_in_stock: true,
    ...producto,
  };

  const { data: productoCreado, error: prodError } = await productosService.create(
    client,
    productoPayload
  );

  if (prodError || !productoCreado) {
    throw new Error(
      `DadoQueExisteUnProductoConStock: error al crear producto: ${prodError ?? "sin respuesta"}`
    );
  }

  const stockPayload = {
    taller_id: SEED.tallerId,
    cantidad: 200,
    stock_minimo: 10,
    stock_maximo: 300,
    ...stock,
    producto_id: stock.producto_id ?? productoCreado.id,
  };

  const { data: stockCreado, error: stockError } = await stocksService.create(
    client,
    stockPayload
  );

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

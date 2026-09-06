import { describe, it, expect, assert } from "vitest";
import { POST, type CreateArregloResponse } from "@/app/api/arreglos/route";
import type { ProductoRow as Producto } from "@/app/api/productos/productosService";
import { stocksService, type StockRow as Stock } from "@/app/api/stocks/stocksService";
import { supabaseArregloRepository } from "@/app/api/arreglos/arregloRepository";
import { operacionesService } from "@/app/api/operaciones/operacionesService";
import { testClient, SEED } from "@/tests/integration";
import { createCreateArregloRequest } from "@/tests/factories";

export interface DadoQueExisteUnProductoResult {
  productoId: string;
  stockId: string;
  id: string;
}

interface DadoQueExisteUnProductoArgs {
  producto?: Partial<Producto>;
  stock?: Partial<Stock>;
}

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
      `DadoQueExisteUnProducto: error al crear stock: ${stockError?.message ?? "sin respuesta"}`
    );
  }

  return {
    productoId: productoCreado.id,
    stockId: stockCreado.id,
    id: productoCreado.id,
  };
}

async function postArreglo(payload: unknown): Promise<CreateArregloResponse> {
  const req = new Request("http://localhost:3000/api/arreglos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const response = await POST(req);
  expect(response.status).toBe(201);
  return response.json();
}

describe("Integration - Creación de arreglos", () => {
  const client = testClient;

  it("Crea un arreglo persistiendo los datos especificados", async () => {
    const precioFinal = 15000;
    const requestPayload = createCreateArregloRequest({
      vehiculo_id: SEED.vehiculoId,
      taller_id: SEED.tallerId,
      estado: "SIN_INICIAR",
      kilometraje_leido: 52000,
      fecha: "2026-09-05",
      observaciones: "Test de integración creación de arreglo",
      precio_final: precioFinal,
      esta_pago: false,
    });

    const body = await postArreglo(requestPayload);
    const arregloId = body.data!.id;

    const { data: arregloCreado } = await supabaseArregloRepository.getByIdWithVehiculo(
      client,
      arregloId
    );

    assert(arregloCreado)
    expect(arregloCreado.taller_id).toBe(SEED.tallerId);
    expect(arregloCreado.estado).toBe("SIN_INICIAR");
    expect(arregloCreado.kilometraje_leido).toBe(52000);
    expect(Number(arregloCreado.precio_final)).toBe(precioFinal);
    expect(arregloCreado.esta_pago).toBe(false);
    expect(arregloCreado.observaciones).toBe("Test de integración creación de arreglo");
  });

  it("Cuando se utilizan repuestos en un arreglo, se asigna el repuesto y se descuenta el stock", async () => {
    const stockAUsar = 3;
    const precioUnitario = 6500;
    const precioFinalTotal = stockAUsar * precioUnitario; // 19500
    const cantidadInicial = 200;

    const { stockId } = await DadoQueExisteUnProductoConStock({
      stock: {
        cantidad: cantidadInicial,
        taller_id: SEED.tallerId,
      },
    });

    const requestPayload = createCreateArregloRequest({
      vehiculo_id: SEED.vehiculoId,
      taller_id: SEED.tallerId,
      precio_final: precioFinalTotal,
      repuestos: [
        {
          stock_id: stockId,
          cantidad: stockAUsar,
          monto_unitario: precioUnitario,
        },
      ],
    });

    const body = await postArreglo(requestPayload);
    const arregloId = body.data!.id;

    const { data: stockFinal } = await stocksService.getById(
      client,
      stockId
    );

    assert(stockFinal)
    expect(stockFinal.cantidad).toBe(cantidadInicial - stockAUsar);

    const { data: operacionIds } =
      await supabaseArregloRepository.listOperacionIdsByArregloId(client, arregloId);

    assert(operacionIds)
    expect(operacionIds).toHaveLength(1)

    const { data: operacion } = await operacionesService.getById(
      client,
      operacionIds[0]
    );

    assert(operacion);
    expect(operacion.tipo).toBe("ASIGNACION_ARREGLO");
    assert(operacion.operaciones_lineas)
    expect(operacion.operaciones_lineas).toHaveLength(1);
    expect(operacion.operaciones_lineas[0].stock_id).toBe(stockId);
    expect(operacion.operaciones_lineas[0].cantidad).toBe(stockAUsar);
    expect(operacion.operaciones_lineas[0].monto_unitario).toBe(precioUnitario);
  });
});



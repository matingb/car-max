import { describe, it, expect } from "vitest";
import { supabaseArregloRepository } from "@/app/api/arreglos/arregloRepository";
import { arregloCompletoService } from "@/app/api/arreglos/arregloCompletoService";
import { testClient, SEED } from "@/tests/integration";
import { createCreateArregloRequest } from "@/tests/factories";
import {
  DadoQueExisteUnProductoConStock,
  expectCantidadDeStock,
} from "../helpers/stockHelpers";
import {
  postArregloAndGetId,
  deleteRepuestoLinea,
  DadoQueExisteUnArregloConRepuesto,
  expectArregloSinRepuestos,
} from "./arreglosHelpers";

describe("Integration - Creación de arreglos", () => {
  it("Crea un arreglo persistiendo los datos especificados", async () => {
    const precioFinal = 15000;

    const arregloId = await postArregloAndGetId(
      createCreateArregloRequest({
        vehiculo_id: SEED.vehiculoId,
        taller_id: SEED.tallerId,
        estado: "SIN_INICIAR",
        kilometraje_leido: 52000,
        fecha: "2026-09-05",
        observaciones: "Test de integración creación de arreglo",
        precio_final: precioFinal,
        esta_pago: false,
      })
    );

    const { data: arregloCreado } = await supabaseArregloRepository.getByIdWithVehiculo(
      testClient,
      arregloId
    );

    expect(arregloCreado).toMatchObject({
      taller_id: SEED.tallerId,
      estado: "SIN_INICIAR",
      kilometraje_leido: 52000,
      esta_pago: false,
      observaciones: "Test de integración creación de arreglo",
    });
    expect(Number(arregloCreado?.precio_final)).toBe(precioFinal);
  });

  it("Cuando se utilizan repuestos en un arreglo, se asigna el repuesto y se descuenta el stock", async () => {
    const stockAUsar = 3;
    const precioUnitario = 6500;
    const precioFinalTotal = stockAUsar * precioUnitario; // 19500
    const cantidadInicial = 200;

    const { stockId } = await DadoQueExisteUnProductoConStock({
      stock: { cantidad: cantidadInicial, taller_id: SEED.tallerId },
    });

    const arregloId = await postArregloAndGetId(
      createCreateArregloRequest({
        vehiculo_id: SEED.vehiculoId,
        taller_id: SEED.tallerId,
        precio_final: precioFinalTotal,
        repuestos: [{ stock_id: stockId, cantidad: stockAUsar, monto_unitario: precioUnitario }],
      })
    );

    await expectCantidadDeStock(stockId, cantidadInicial - stockAUsar);

    const { data: detalle } = await arregloCompletoService.getArregloDetalleCompleto(
      testClient,
      arregloId
    );

    expect(detalle?.asignaciones).toHaveLength(1);
    expect(detalle?.asignaciones[0]).toMatchObject({
      tipo: "ASIGNACION_ARREGLO",
      lineas: [
        expect.objectContaining({
          stock_id: stockId,
          cantidad: stockAUsar,
          monto_unitario: precioUnitario,
        }),
      ],
    });
  });

  it("Cuando se elimina un repuesto de un arreglo, se revierte la asignación y devuelve el item al stock total", async () => {
    const { arregloId, stockId, lineaId, cantidadInicial } = await DadoQueExisteUnArregloConRepuesto({
      stock: { cantidad: 200, taller_id: SEED.tallerId },
      repuesto: { cantidad: 3, monto_unitario: 6500 },
    });

    const deleteResponse = await deleteRepuestoLinea(arregloId, lineaId);
    expect(deleteResponse.error).toBeNull();

    await expectCantidadDeStock(stockId, cantidadInicial);
    await expectArregloSinRepuestos(arregloId);
  });
});

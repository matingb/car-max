import { describe, expect, it } from "vitest";
import type { ArregloFilters } from "@/app/components/arreglos/ArregloFiltersModal";
import { filterArreglos } from "@/app/hooks/arreglos/useArreglosFilters";
import { createArreglo, createVehiculo } from "@/tests/factories";

const emptyFilters: ArregloFilters = {
  fechaDesde: "",
  fechaHasta: "",
  patente: "",

  estado: "",
  estadoPago: "",
};

describe("filterArreglos", () => {
  it("devuelve todos los arreglos cuando la búsqueda y los filtros están vacíos", () => {
    const arreglos = [
      createArreglo({ id: "1" }),
      createArreglo({ id: "2" }),
    ];
    const result = filterArreglos(arreglos, { search: "", filters: emptyFilters });
    expect(result.map((a) => a.id)).toEqual(["1", "2"]);
  });

  it("el filtro por búsqueda es case-insensitive e ignora espacios extra", () => {
    const arreglos = [
      createArreglo({ id: "1", descripcion: "Cambio de aceite" }),
      createArreglo({ id: "2", descripcion: "Reparación de frenos" }),
    ];
    const result = filterArreglos(arreglos, { search: "  frEnoS  ", filters: emptyFilters });
    expect(result.map((a) => a.id)).toEqual(["2"]);
  });

  it("filtra por búsqueda coincidiendo con la patente del vehículo", () => {
    const arreglos = [
      createArreglo({ id: "1", vehiculo: createVehiculo({ patente: "AAA111" }) }),
      createArreglo({ id: "2", vehiculo: createVehiculo({ patente: "BBB222" }) }),
    ];
    const result = filterArreglos(arreglos, { search: "bbB", filters: emptyFilters });
    expect(result.map((a) => a.id)).toEqual(["2"]);
  });

  it("filtra por busqueda coincidiendo con el nombre del dueno del vehiculo", () => {
    const arreglos = [
      createArreglo({ id: "1", vehiculo: createVehiculo({ nombre_cliente: "Ana Torres" }) }),
      createArreglo({ id: "2", vehiculo: createVehiculo({ nombre_cliente: "Juan Perez" }) }),
    ];
    const result = filterArreglos(arreglos, { search: "  juan  ", filters: emptyFilters });
    expect(result.map((a) => a.id)).toEqual(["2"]);
  });

  it("filtra por filtro de patente", () => {
    const arreglos = [
      createArreglo({ id: "1", vehiculo: createVehiculo({ patente: "ABC123" }) }),
      createArreglo({ id: "2", vehiculo: createVehiculo({ patente: "XYZ999" }) }),
    ];
    const result = filterArreglos(arreglos, {
      search: "",
      filters: { ...emptyFilters, patente: "xYz" },
    });
    expect(result.map((a) => a.id)).toEqual(["2"]);
  });

  it("filtra por estado de pago pendiente, parcial y pagado, excluyendo presupuestos de los filtros de cobro ya que no pueden estar pagos", () => {
    const arreglos = [
      createArreglo({ id: "pendiente", esta_pago: false, total_cobrado: 0 }),
      createArreglo({ id: "parcial", esta_pago: false, total_cobrado: 500 }),
      createArreglo({ id: "pagado", esta_pago: true, total_cobrado: 1000 }),
      createArreglo({ id: "presupuesto", estado: "PRESUPUESTO", esta_pago: false, total_cobrado: 0 }),
    ];

    expect(
      filterArreglos(arreglos, { search: "", filters: { ...emptyFilters, estadoPago: "PENDIENTE" } })
        .map((arreglo) => arreglo.id)
    ).toEqual(["pendiente"]);
    expect(
      filterArreglos(arreglos, { search: "", filters: { ...emptyFilters, estadoPago: "PARCIAL" } })
        .map((arreglo) => arreglo.id)
    ).toEqual(["parcial"]);
    expect(
      filterArreglos(arreglos, { search: "", filters: { ...emptyFilters, estadoPago: "PAGADO" } })
        .map((arreglo) => arreglo.id)
    ).toEqual(["pagado"]);
  });



  it("el filtro por rango de fechas es inclusivo", () => {
    const arreglos = [
      createArreglo({ id: "1", fecha: "2025-01-01" }),
      createArreglo({ id: "2", fecha: "2025-01-10" }),
      createArreglo({ id: "3", fecha: "2025-01-31" }),
    ];
    const result = filterArreglos(arreglos, {
      search: "",
      filters: { ...emptyFilters, fechaDesde: "2025-01-10", fechaHasta: "2025-01-31" },
    });
    expect(result.map((a) => a.id)).toEqual(["2", "3"]);
  });

});



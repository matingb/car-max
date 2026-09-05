"use client";

import type { Arreglo } from "@/model/types";
import { useMemo, useState } from "react";
import type { ArregloFilters } from "@/app/components/arreglos/ArregloFiltersModal";
import { formatDateLabel } from "@/lib/fechas";

export type ChipKind = "fechaRange" | "fechaDesde" | "fechaHasta" | "patente" | "estado" | "estadoPago";
export type Chip = { key: string; text: string; kind: ChipKind };

type DateRange = { from: Date | null; to: Date | null };

function createEmptyFilters(): ArregloFilters {
  return {
    fechaDesde: "",
    fechaHasta: "",
    patente: "",

    estado: "",
    estadoPago: "",
  };
}

function getDateRange(filters: ArregloFilters): DateRange {
  const hasDateFilter = filters.fechaDesde || filters.fechaHasta;
  if (!hasDateFilter) return { from: null, to: null };

  const from = filters.fechaDesde ? new Date(filters.fechaDesde) : null;
  const to = filters.fechaHasta ? new Date(filters.fechaHasta) : null;
  if (from) from.setHours(0, 0, 0, 0);
  if (to) to.setHours(23, 59, 59, 999);
  return { from, to };
}

function matchesSearch(arreglo: Arreglo, query: string) {
  if (!query) return true;
  const inFlat = Object.values(arreglo ?? {}).some((v) =>
    String(v ?? "").toLowerCase().includes(query)
  );
  const patente = String(arreglo?.vehiculo?.patente ?? "").toLowerCase();
  const nombreCliente = String(arreglo?.vehiculo?.nombre_cliente ?? "").toLowerCase();
  const inPatente = patente.includes(query);
  const inNombreCliente = nombreCliente.includes(query);
  return inFlat || inPatente || inNombreCliente;
}

function matchesPatenteFilter(arreglo: Arreglo, patenteFilter: string) {
  if (!patenteFilter) return true;
  return String(arreglo?.vehiculo?.patente ?? "")
    .toLowerCase()
    .includes(patenteFilter);
}



function matchesEstadoFilter(arreglo: Arreglo, estadoFilter: string) {
  if (!estadoFilter) return true;
  const current = String(arreglo?.estado ?? "").toLowerCase();
  return current.includes(estadoFilter);
}

function matchesEstadoPagoFilter(arreglo: Arreglo, estadoPagoFilter: string) {
  if (!estadoPagoFilter) return true;

  const estadoPago = estadoPagoFilter.toUpperCase();
  if (estadoPago !== "PENDIENTE" && estadoPago !== "PARCIAL" && estadoPago !== "PAGADO") {
    return true;
  }
  if (arreglo.estado === "PRESUPUESTO") return false;
  if (estadoPago === "PAGADO") return arreglo.esta_pago === true;

  if (arreglo.esta_pago === true) return false;
  const totalCobrado = Number(arreglo.total_cobrado ?? 0);
  return estadoPago === "PARCIAL" ? totalCobrado > 0 : totalCobrado <= 0;
}

function matchesDateRange(arreglo: Arreglo, range: DateRange) {
  if (!range.from && !range.to) return true;

  const fecha = new Date(arreglo.fecha);
  if (Number.isNaN(fecha.getTime())) return false;
  if (range.from && fecha < range.from) return false;
  if (range.to && fecha > range.to) return false;
  return true;
}

export function filterArreglos(
  arreglos: Arreglo[] | undefined,
  params: { search: string; filters: ArregloFilters }
) {
  if (!arreglos) return [];
  const query = params.search.trim().toLowerCase();
  const patenteFilter = params.filters.patente.trim().toLowerCase();

  const estadoFilter = params.filters.estado.trim().toLowerCase();
  const estadoPagoFilter = params.filters.estadoPago.trim();
  const dateRange = getDateRange(params.filters);

  return arreglos.filter(
    (a) =>
      matchesSearch(a, query) &&
      matchesPatenteFilter(a, patenteFilter) &&

      matchesEstadoFilter(a, estadoFilter) &&
      matchesEstadoPagoFilter(a, estadoPagoFilter) &&
      matchesDateRange(a, dateRange)
  );
}

export function useArreglosFilters(arreglos?: Arreglo[]) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ArregloFilters>(createEmptyFilters);

  const arreglosFiltrados = useMemo(() => {
    return filterArreglos(arreglos, { search, filters });
  }, [arreglos, search, filters]);

  const chips = useMemo<Chip[]>(() => {
    const items: Chip[] = [];

    if (filters.fechaDesde || filters.fechaHasta) {
      const desde = formatDateLabel(filters.fechaDesde);
      const hasta = formatDateLabel(filters.fechaHasta);
      if (filters.fechaDesde && filters.fechaHasta) {
        items.push({
          key: "fechaRange",
          text: `${desde} - ${hasta}`,
          kind: "fechaRange",
        });
      } else if (filters.fechaDesde) {
        items.push({
          key: "fechaDesde",
          text: `Desde: ${desde}`,
          kind: "fechaDesde",
        });
      } else if (filters.fechaHasta) {
        items.push({
          key: "fechaHasta",
          text: `Hasta: ${hasta}`,
          kind: "fechaHasta",
        });
      }
    }

    if (filters.patente.trim()) {
      items.push({
        key: "patente",
        text: filters.patente.trim(),
        kind: "patente",
      });
    }



    if (filters.estado.trim()) {
      items.push({
        key: "estado",
        text: filters.estado.trim().replaceAll("_", " "),
        kind: "estado",
      });
    }

    if (filters.estadoPago.trim()) {
      items.push({
        key: "estadoPago",
        text: `Pago: ${filters.estadoPago.trim().toLowerCase()}`,
        kind: "estadoPago",
      });
    }

    return items;
  }, [filters]);

  const removeFilter = (kind: ChipKind) => {
    setFilters((prev) => {
      switch (kind) {
        case "fechaRange":
          return { ...prev, fechaDesde: "", fechaHasta: "" };
        case "fechaDesde":
          return { ...prev, fechaDesde: "" };
        case "fechaHasta":
          return { ...prev, fechaHasta: "" };
        case "patente":
          return { ...prev, patente: "" };

        case "estado":
          return { ...prev, estado: "" };
        case "estadoPago":
          return { ...prev, estadoPago: "" };
        default:
          return prev;
      }
    });
  };

  const clearFilters = () => setFilters(createEmptyFilters());
  const applyFilters = (next: ArregloFilters) => setFilters(next);

  return {
    search,
    setSearch,
    filters,
    chips,
    arreglosFiltrados,
    applyFilters,
    clearFilters,
    removeFilter,
  };
}



import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { isValidUuid } from "@/lib/uuid";
import type { Arreglo } from "@/model/types";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { isValidDate, toISODateTimeWithCurrentTime } from "@/lib/fechas";
import { logger } from "@/lib/logger";


import { arregloService } from "../../arregloService";
import { ServiceError } from "@/app/api/serviceError";

type CobroRequest = {
  cuenta_financiera_id?: unknown;
  fecha_cobro?: unknown;
  idempotency_key?: unknown;
  monto?: unknown;
  descripcion?: unknown;
  pagos?: unknown;
};

type CobroResponse = {
  data: Arreglo | null;
  error?: string | null;
};

async function fetchArreglo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<{ data: Arreglo | null; error: string | null }> {
  const { data, error } = await arregloService.getByIdWithVehiculo(supabase, id);
  if (error) {
    return {
      data: null,
      error: error === ServiceError.NotFound ? "Arreglo no encontrado" : "No se pudo recuperar el arreglo",
    };
  }
  if (!data) return { data: null, error: "Arreglo no encontrado" };
  return { data, error: null };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;
  const body: CobroRequest | null = await req.json().catch(() => null);

  if (!isValidUuid(id)) {
    return Response.json({ data: null, error: "arreglo_id inválido" } satisfies CobroResponse, { status: 400 });
  }
  const fechaCobro = typeof body?.fecha_cobro === "string" ? body.fecha_cobro : "";
  const idempotencyKey = typeof body?.idempotency_key === "string" ? body.idempotency_key : "";
  const rawPagos = Array.isArray(body?.pagos) ? body.pagos : null;

  if (!isValidDate(fechaCobro)) {
    return Response.json({ data: null, error: "fecha_cobro inválida" } satisfies CobroResponse, { status: 400 });
  }
  if (idempotencyKey && !isValidUuid(idempotencyKey)) {
    return Response.json({ data: null, error: "idempotency_key inválida" } satisfies CobroResponse, { status: 400 });
  }

  if (Array.isArray(body?.pagos) && body?.pagos.length === 0) {
    return Response.json({ data: null, error: "Debe especificar al menos un pago para registrar el cobro" } satisfies CobroResponse, { status: 400 });
  }

  let formattedPagos: Array<{ cuenta_id: string; monto: number; descripcion: string | null }> | null = null;
  let singleCuentaId: string | null = null;
  let singleMonto: number | null = null;
  let singleDescripcion: string | null = null;

  if (rawPagos && rawPagos.length > 0) {
    formattedPagos = [];
    for (const p of rawPagos as Array<Record<string, unknown>>) {
      const cId = typeof p.cuenta_financiera_id === "string" ? p.cuenta_financiera_id.trim() : "";
      const m = Number(p.monto);
      const d = typeof p.descripcion === "string" ? p.descripcion.trim() : null;

      if (!cId) {
        return Response.json({ data: null, error: "Cada cobro debe especificar una cuenta financiera válida" } satisfies CobroResponse, { status: 400 });
      }
      if (!isValidUuid(cId)) {
        return Response.json({ data: null, error: "cuenta_financiera_id inválida en uno de los pagos" } satisfies CobroResponse, { status: 400 });
      }
      if (!Number.isFinite(m) || m <= 0) {
        return Response.json({ data: null, error: "monto a cobrar debe ser mayor a 0 en todos los pagos" } satisfies CobroResponse, { status: 400 });
      }
      formattedPagos.push({ cuenta_id: cId, monto: m, descripcion: d });
    }
  } else {
    singleCuentaId = typeof body?.cuenta_financiera_id === "string" ? body.cuenta_financiera_id.trim() : "";
    singleMonto = typeof body?.monto === "number" ? body.monto : null;
    singleDescripcion = typeof body?.descripcion === "string" ? body.descripcion.trim() : null;

    if (!singleCuentaId) {
      return Response.json({ data: null, error: "Debe especificar una cuenta financiera válida para registrar el cobro" } satisfies CobroResponse, { status: 400 });
    }
    if (!isValidUuid(singleCuentaId)) {
      return Response.json({ data: null, error: "cuenta_financiera_id inválida" } satisfies CobroResponse, { status: 400 });
    }
    if (singleMonto !== null && (!Number.isFinite(singleMonto) || singleMonto <= 0)) {
      return Response.json({ data: null, error: "monto a cobrar debe ser mayor a 0" } satisfies CobroResponse, { status: 400 });
    }
  }

  const existingArregloResult = await fetchArreglo(supabase, id);
  if (existingArregloResult.error || !existingArregloResult.data) {
    logger.error(`[POST /api/arreglos/${id}/cobro] Error al recuperar el arreglo ${id}.`, existingArregloResult.error);
    return Response.json(
      { data: null, error: existingArregloResult.error ?? "Arreglo no encontrado" } satisfies CobroResponse,
      { status: existingArregloResult.error === "Arreglo no encontrado" ? 404 : 500 }
    );
  }
  if (existingArregloResult.data.estado === "PRESUPUESTO") {
    logger.warn(`[POST /api/arreglos/${id}/cobro] Se intentó cobrar el arreglo ${id} que se encuentra en estado PRESUPUESTO.`);
    return Response.json(
      { data: null, error: "No se pueden registrar pagos en un presupuesto" } satisfies CobroResponse,
      { status: 400 }
    );
  }

  const { error: rpcError } = await supabase.rpc("rpc_finanzas_cobrar_arreglo", {
    p_arreglo_id: id,
    p_cuenta_id: singleCuentaId,
    p_monto: singleMonto,
    p_fecha_cobro: toISODateTimeWithCurrentTime(fechaCobro),
    p_descripcion: singleDescripcion,
    p_idempotency_key: idempotencyKey || null,
    p_pagos: formattedPagos,
  });
  if (rpcError) {
    const errorMsg = rpcError.message || "No se pudo registrar el cobro";
    return Response.json({ data: null, error: errorMsg } satisfies CobroResponse, { status: 400 });
  }

  const result = await fetchArreglo(supabase, id);
  if (result.error || !result.data) {
    return Response.json({ data: null, error: result.error ?? "No se pudo recuperar el arreglo" } satisfies CobroResponse, { status: result.error === "Arreglo no encontrado" ? 404 : 500 });
  }
  await statsService.onDataChanged(supabase, (result.data as { tenant_id?: string | null }).tenant_id);
  return Response.json({ data: result.data, error: null } satisfies CobroResponse, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;
  const operacionIdHeader = req.headers.get("x-operacion-id")?.trim() || null;
  const searchParams = req.nextUrl.searchParams;
  const operacionIdParam = searchParams.get("operacion_id")?.trim() || null;
  const operacionId = operacionIdHeader || operacionIdParam;

  if (!isValidUuid(id)) {
    return Response.json({ data: null, error: "arreglo_id inválido" } satisfies CobroResponse, { status: 400 });
  }
  if (operacionId && !isValidUuid(operacionId)) {
    return Response.json({ data: null, error: "operacion_id inválida" } satisfies CobroResponse, { status: 400 });
  }

  const { error: rpcError } = await supabase.rpc("rpc_finanzas_anular_cobro_arreglo", {
    p_arreglo_id: id,
    p_operacion_id: operacionId,
  });
  if (rpcError) {
    return Response.json({ data: null, error: rpcError.message || "No se pudo anular el cobro" } satisfies CobroResponse, { status: 400 });
  }

  const result = await fetchArreglo(supabase, id);
  if (result.error || !result.data) {
    return Response.json({ data: null, error: result.error ?? "No se pudo recuperar el arreglo" } satisfies CobroResponse, { status: result.error === "Arreglo no encontrado" ? 404 : 500 });
  }
  await statsService.onDataChanged(supabase, (result.data as { tenant_id?: string | null }).tenant_id);
  return Response.json({ data: result.data, error: null } satisfies CobroResponse, { status: 200 });
}

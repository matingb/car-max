import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { repuestosService } from "@/app/api/arreglos/repuestos/repuestosService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { syncArregloDescripcion } from "@/app/api/arreglos/arregloDescripcionService";
import { logger } from "@/lib/logger";

export type DeleteRepuestoLineaResponse = {
  error?: string | null;
};

function isUnauthorizedSupabaseError(err: unknown): boolean {
  const code = String((err as { code?: unknown } | null)?.code ?? "");
  const msg = String((err as { message?: unknown } | null)?.message ?? "");
  return (
    code.includes("42501") ||
    msg.includes("JWT sin tenant_id") ||
    msg.toLowerCase().includes("permission denied")
  );
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; lineaId: string }> }
) {
  const supabase = await createClient();
  const { id: arregloId, lineaId } = await params;

  if (!arregloId) {
    return Response.json({ error: "Falta arreglo_id" } satisfies DeleteRepuestoLineaResponse, { status: 400 });
  }
  if (!lineaId) {
    return Response.json({ error: "Falta lineaId" } satisfies DeleteRepuestoLineaResponse, { status: 400 });
  }

  const { data: linea, error: lineaErr } =
    await repuestosService.getOperacionLineaById(supabase, lineaId);

  if (lineaErr) {
    logger.error("Error buscando operaciones_lineas:", lineaErr);
    if (isUnauthorizedSupabaseError(lineaErr)) {
      return Response.json(
        { error: "Tu sesión expiró o no tenés permisos para eliminar este repuesto." } satisfies DeleteRepuestoLineaResponse,
        { status: 401 }
      );
    }
    return Response.json(
      { error: "No se pudo validar el repuesto. Intentá nuevamente." } satisfies DeleteRepuestoLineaResponse,
      { status: 500 }
    );
  }
  if (!linea?.id || !linea.operacion_id) {
    return Response.json({ error: "Repuesto no encontrado en este arreglo." } satisfies DeleteRepuestoLineaResponse, { status: 404 });
  }

  const { data: asig, error: asigErr } =
    await repuestosService.getAsignacionByOperacionAndArreglo(supabase, {
      operacionId: linea.operacion_id,
      arregloId,
    });

  if (asigErr) {
    logger.error("Error validando operaciones_asignacion_arreglo:", asigErr);
    if (isUnauthorizedSupabaseError(asigErr)) {
      return Response.json(
        { error: "Tu sesión expiró o no tenés permisos para eliminar este repuesto." } satisfies DeleteRepuestoLineaResponse,
        { status: 401 }
      );
    }
    return Response.json(
      { error: "No se pudo validar el repuesto. Intentá nuevamente." } satisfies DeleteRepuestoLineaResponse,
      { status: 500 }
    );
  }
  if (!asig?.operacion_id) {
    return Response.json({ error: "Repuesto no encontrado en este arreglo." } satisfies DeleteRepuestoLineaResponse, { status: 404 });
  }

  const { error } = await repuestosService.deleteAsignacionArregloLinea(
    supabase,
    lineaId
  );

  if (error) {
    logger.error("Error rpc_delete_asignacion_arreglo_linea:", error);
    if (isUnauthorizedSupabaseError(error)) {
      return Response.json(
        { error: "Tu sesión expiró o no tenés permisos para eliminar este repuesto." } satisfies DeleteRepuestoLineaResponse,
        { status: 401 }
      );
    }
    return Response.json(
      { error: "No se pudo eliminar el repuesto. Intentá nuevamente." } satisfies DeleteRepuestoLineaResponse,
      { status: 500 }
    );
  }

  await syncArregloDescripcion(supabase, arregloId);
  await statsService.onDataChanged(supabase);

  return Response.json({ error: null } satisfies DeleteRepuestoLineaResponse, { status: 200 });
}


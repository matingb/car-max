import type { SupabaseClient } from "@supabase/supabase-js";
import type { Arreglo, CobroArregloItem } from "@/model/types";
import { ServiceError, ServiceResult, toServiceError } from "@/app/api/serviceError";
import type { ArregloFormularioLineaValue } from "./arregloRequests";
import { logger } from "@/lib/logger";

export type DetalleArreglo = {
  id: string;
  arreglo_id: string;
  descripcion: string;
  cantidad: number;
  valor: number;
  categoria_arreglo_id: string | null;
  empleado_id: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AsignacionArregloProducto = {
  id: string;
  codigo: string;
  nombre: string;
  precio_unitario?: number;
  costo_unitario?: number;
  proveedor?: string | null;
  categorias?: string[];
};

export type AsignacionArregloLinea = {
  id: string;
  operacion_id: string;
  stock_id: string;
  cantidad: number;
  monto_unitario: number;
  delta_cantidad: number;
  created_at: string;
  categoria_arreglo_id: string | null;
  empleado_id: string | null;
  producto?: AsignacionArregloProducto | null;
};

export type AsignacionArregloOperacion = {
  id: string;
  tipo: string;
  taller_id: string;
  created_at: string;
  lineas: AsignacionArregloLinea[];
};

export type DetalleArregloFormulario = {
  id: string;
  arreglo_id: string;
  formulario_id: string | null;
  costo: number;
  metadata: ArregloFormularioLineaValue[];
  created_at?: string;
  updated_at?: string;
};

export type ArregloDetalleData = {
  arreglo: Arreglo;
  detalles: DetalleArreglo[];
  asignaciones: AsignacionArregloOperacion[];
  detalle_formulario: DetalleArregloFormulario | null;
  cobros?: CobroArregloItem[];
};

export type GetArregloByIdResponse = {
  data: ArregloDetalleData | null;
  error?: string | null;
};

export type UpdateArregloResponse = {
  data: Arreglo | null;
  error?: string | null;
};

export const arregloCompletoService = {
  async getArregloDetalleCompleto(
    supabase: SupabaseClient,
    id: string
  ): Promise<ServiceResult<ArregloDetalleData>> {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "rpc_get_arreglo_detalle",
      { p_arreglo_id: id }
    );

    if (rpcError) {
      logger.error("[getArregloDetalleCompleto] Error rpc_get_arreglo_detalle:", rpcError);
      return { data: null, error: toServiceError(rpcError) };
    }

    if (!rpcData) {
      return { data: null, error: ServiceError.NotFound };
    }

    const rpc = rpcData as {
      arreglo?: unknown;
      detalles?: unknown;
      asignaciones?: unknown;
      cobros?: unknown;
    };

    const arregloRaw = (rpc.arreglo ?? {}) as Record<string, unknown>;
    const { empleados_detallados, ...rest } = arregloRaw;
    const arreglo = {
      ...rest,
      empleados: empleados_detallados || [],
    };
    const typedArreglo = arreglo as Arreglo;

    const detalles = (Array.isArray(rpc.detalles) ? rpc.detalles : []) as DetalleArreglo[];
    const asignaciones = (Array.isArray(rpc.asignaciones) ? rpc.asignaciones : []) as AsignacionArregloOperacion[];
    const cobros = (Array.isArray(rpc.cobros) ? rpc.cobros : []) as CobroArregloItem[];

    const { data: detalleFormularioRows, error: detalleFormularioError } = await supabase
      .from("detalle_form_custom")
      .select("id, arreglo_id, formulario_id:config_id, costo, metadata, created_at, updated_at")
      .eq("arreglo_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (detalleFormularioError) {
      logger.error("[getArregloDetalleCompleto] Error cargando detalle de formulario:", detalleFormularioError);
      return { data: null, error: toServiceError(detalleFormularioError) };
    }

    const detalleFormularioRaw = Array.isArray(detalleFormularioRows)
      ? detalleFormularioRows[0]
      : null;

    const detalleFormulario: DetalleArregloFormulario | null = detalleFormularioRaw
      ? {
          id: String(detalleFormularioRaw.id ?? ""),
          arreglo_id: String(detalleFormularioRaw.arreglo_id ?? ""),
          formulario_id:
            detalleFormularioRaw.formulario_id != null
              ? String(detalleFormularioRaw.formulario_id)
              : null,
          costo: Number(detalleFormularioRaw.costo) || 0,
          metadata: Array.isArray(detalleFormularioRaw.metadata)
            ? (detalleFormularioRaw.metadata as ArregloFormularioLineaValue[])
            : [],
          created_at:
            detalleFormularioRaw.created_at == null
              ? undefined
              : String(detalleFormularioRaw.created_at),
          updated_at:
            detalleFormularioRaw.updated_at == null
              ? undefined
              : String(detalleFormularioRaw.updated_at),
        }
      : null;

    const payload: ArregloDetalleData = {
      arreglo: typedArreglo,
      detalles,
      asignaciones,
      detalle_formulario: detalleFormulario,
      cobros,
    };

    return { data: payload, error: null };
  },
};

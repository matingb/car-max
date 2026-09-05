import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildTerminadoRequiredFieldsErrorMessage,
  findMissingRequiredCustomFormFields,
} from "@/lib/arreglosCustomFormRequired";
import type {
  ArregloFormularioLineaValue,
  CreateArregloDetalleFormularioInput,
} from "./arregloRequests";
import type { DetalleArregloFormulario } from "./arregloCompletoService";
import { ServiceResult, toServiceError } from "@/app/api/serviceError";
import { logger } from "@/lib/logger";

export type ValidateTerminadoResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export const arregloFormularioService = {
  async getDetalleFormulario(
    supabase: SupabaseClient,
    arregloId: string
  ): Promise<ServiceResult<DetalleArregloFormulario | null>> {
    const { data: detalleRows, error } = await supabase
      .from("detalle_form_custom")
      .select("id, arreglo_id, formulario_id:config_id, costo, metadata, created_at, updated_at")
      .eq("arreglo_id", arregloId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      logger.error("[arregloFormularioService.getDetalleFormulario] Error:", error);
      return { data: null, error: toServiceError(error) };
    }

    const row = Array.isArray(detalleRows) ? detalleRows[0] : null;
    if (!row) {
      return { data: null, error: null };
    }

    return {
      data: {
        id: String(row.id ?? ""),
        arreglo_id: String(row.arreglo_id ?? ""),
        formulario_id:
          row.formulario_id != null
            ? String(row.formulario_id)
            : null,
        costo: Number(row.costo) || 0,
        metadata: Array.isArray(row.metadata)
          ? (row.metadata as ArregloFormularioLineaValue[])
          : [],
        created_at: row.created_at == null ? undefined : String(row.created_at),
        updated_at: row.updated_at == null ? undefined : String(row.updated_at),
      },
      error: null,
    };
  },

  async validateTerminadoRequiredFields(
    supabase: SupabaseClient,
    arregloId: string,
    incomingDetalleForm?: CreateArregloDetalleFormularioInput
  ): Promise<ValidateTerminadoResult> {
    const { data: detalleRows, error: detalleLookupError } = await supabase
      .from("detalle_form_custom")
      .select("config_id, metadata")
      .eq("arreglo_id", arregloId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (detalleLookupError) {
      logger.error("[validateTerminadoRequiredFields] Error cargando detalle de formulario:", detalleLookupError);
      return { ok: false, error: "Error cargando detalle de formulario", status: 500 };
    }

    const detalleRow = Array.isArray(detalleRows) ? detalleRows[0] : null;
    const existingConfigId =
      detalleRow?.config_id == null ? null : String(detalleRow.config_id).trim() || null;
    const existingMetadata = Array.isArray(detalleRow?.metadata)
      ? (detalleRow.metadata as ArregloFormularioLineaValue[])
      : [];

    const hasIncomingConfigId =
      incomingDetalleForm !== undefined &&
      (incomingDetalleForm.formulario_id !== undefined ||
        incomingDetalleForm.config_id !== undefined);
    const incomingConfigId =
      hasIncomingConfigId && incomingDetalleForm
        ? String(incomingDetalleForm.formulario_id ?? incomingDetalleForm.config_id ?? "").trim() ||
          null
        : undefined;

    const incomingMetadata =
      incomingDetalleForm !== undefined
        ? Array.isArray(incomingDetalleForm.metadata)
          ? incomingDetalleForm.metadata
          : []
        : undefined;

    const effectiveConfigId =
      incomingConfigId !== undefined ? incomingConfigId : existingConfigId;
    const effectiveMetadata = incomingMetadata ?? existingMetadata;

    if (!effectiveConfigId) {
      return { ok: true };
    }

    const { data: formularioRow, error: formularioError } = await supabase
      .from("formularios")
      .select("metadata")
      .eq("id", effectiveConfigId)
      .maybeSingle();

    if (formularioError) {
      logger.error("[validateTerminadoRequiredFields] Error cargando formulario custom:", formularioError);
      return { ok: false, error: "Error cargando formulario custom", status: 500 };
    }

    if (!formularioRow) {
      return { ok: false, error: "Formulario custom no encontrado", status: 400 };
    }

    const missingFields = findMissingRequiredCustomFormFields({
      formMetadata: formularioRow.metadata,
      detalleMetadata: effectiveMetadata,
    });

    if (missingFields.length > 0) {
      return {
        ok: false,
        error: buildTerminadoRequiredFieldsErrorMessage(missingFields),
        status: 400,
      };
    }

    return { ok: true };
  },

  async upsertDetalleFormulario(
    supabase: SupabaseClient,
    arregloId: string,
    detalleFormulario: CreateArregloDetalleFormularioInput
  ): Promise<{ error: string | null; status?: number }> {
    const hasConfigId =
      detalleFormulario.formulario_id !== undefined ||
      detalleFormulario.config_id !== undefined;
    const configId = hasConfigId
      ? String(detalleFormulario.formulario_id ?? detalleFormulario.config_id ?? "").trim() || null
      : undefined;
    const costo = Number(detalleFormulario.costo);
    const metadata = Array.isArray(detalleFormulario.metadata)
      ? detalleFormulario.metadata
      : [];

    if (!Number.isFinite(costo) || costo < 0) {
      return { error: "Costo inválido en detalle de formulario", status: 400 };
    }

    const { data: detalleRows, error: detalleLookupError } = await supabase
      .from("detalle_form_custom")
      .select("id")
      .eq("arreglo_id", arregloId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (detalleLookupError) {
      logger.error("[upsertDetalleFormulario] Error buscando detalle de formulario:", detalleLookupError);
      return { error: "Error cargando detalle de formulario", status: 500 };
    }

    const detalleId = Array.isArray(detalleRows)
      ? String(detalleRows[0]?.id ?? "").trim()
      : "";

    if (detalleId) {
      const updatePayload: {
        costo: number;
        metadata: ArregloFormularioLineaValue[];
        config_id?: string | null;
      } = {
        costo,
        metadata,
      };
      if (hasConfigId) {
        updatePayload.config_id = configId;
      }

      const { error: detalleUpdateError } = await supabase
        .from("detalle_form_custom")
        .update(updatePayload)
        .eq("id", detalleId);

      if (detalleUpdateError) {
        logger.error("[upsertDetalleFormulario] Error actualizando detalle_form_custom:", detalleUpdateError);
        return { error: "Error actualizando detalle del formulario", status: 500 };
      }
    } else {
      const { error: detalleInsertError } = await supabase
        .from("detalle_form_custom")
        .insert([
          {
            arreglo_id: arregloId,
            config_id: configId ?? null,
            costo,
            metadata,
          },
        ]);

      if (detalleInsertError) {
        logger.error("[upsertDetalleFormulario] Error insertando detalle_form_custom:", detalleInsertError);
        return { error: "Error guardando detalle del formulario", status: 500 };
      }
    }

    return { error: null };
  },
};

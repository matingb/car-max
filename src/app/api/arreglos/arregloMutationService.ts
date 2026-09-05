import type { SupabaseClient } from "@supabase/supabase-js";
import type { Arreglo, EstadoArreglo } from "@/model/types";
import { ESTADOS_ARREGLO } from "@/model/types";
import { ServiceError } from "@/app/api/serviceError";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "./arregloService";
import { arregloFormularioService } from "./arregloFormularioService";
import type {
  CreateArregloDetalleFormularioInput,
  UpdateArregloRequest,
} from "./arregloRequests";

export type MutationResult<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

export const arregloMutationService = {
  async validateEstadoTransition(
    supabase: SupabaseClient,
    arregloId: string,
    patchEstado: EstadoArreglo,
    cachedArreglo?: Arreglo | null,
    incomingDetalleForm?: CreateArregloDetalleFormularioInput
  ): Promise<{
    currentArreglo: Arreglo | null;
    error: string | null;
    status: number;
  }> {
    let currentArreglo = cachedArreglo ?? null;

    const ensureCurrentArreglo = async () => {
      if (currentArreglo) return { data: currentArreglo, error: null };
      const { data, error } = await arregloService.getByIdWithVehiculo(supabase, arregloId);
      if (error) {
        const status = error === ServiceError.NotFound ? 404 : 500;
        const message = status === 404 ? "Arreglo no encontrado" : "Error actualizando arreglo";
        return { data: null, error: message, status };
      }
      currentArreglo = data;
      return { data, error: null };
    };

    if (patchEstado === "PRESUPUESTO") {
      const fetchResult = await ensureCurrentArreglo();
      if (fetchResult.error) {
        return { currentArreglo: null, error: fetchResult.error, status: fetchResult.status ?? 500 };
      }

      if (currentArreglo?.esta_pago || Number(currentArreglo?.total_cobrado ?? 0) > 0) {
        return {
          currentArreglo,
          error: "No se puede cambiar a presupuesto un arreglo que ya registra pagos",
          status: 400,
        };
      }
    }

    if (patchEstado === "TERMINADO") {
      const fetchResult = await ensureCurrentArreglo();
      if (fetchResult.error) {
        return { currentArreglo: null, error: fetchResult.error, status: fetchResult.status ?? 500 };
      }

      const isTransitionToTerminado =
        String(currentArreglo?.estado ?? "").trim().toUpperCase() !== "TERMINADO";

      if (isTransitionToTerminado) {
        const validation = await arregloFormularioService.validateTerminadoRequiredFields(
          supabase,
          arregloId,
          incomingDetalleForm
        );

        if (!validation.ok) {
          return {
            currentArreglo,
            error: validation.error,
            status: validation.status,
          };
        }
      }
    }

    return { currentArreglo, error: null, status: 200 };
  },

  async updateArregloCompleto(
    supabase: SupabaseClient,
    id: string,
    payload: UpdateArregloRequest
  ): Promise<MutationResult<Arreglo>> {
    if (Object.prototype.hasOwnProperty.call(payload, "esta_pago")) {
      return {
        data: null,
        error: "El cobro se registra desde la acción de pago para conservar el asiento financiero.",
        status: 400,
      };
    }

    const { detalle_formulario, ...restPayload } = payload;
    const arregloPatch: UpdateArregloRequest = { ...restPayload };
    delete (arregloPatch as { descripcion?: unknown }).descripcion;

    if (arregloPatch.estado !== undefined) {
      const estado = String(arregloPatch.estado ?? "").trim().toUpperCase();
      if (!(ESTADOS_ARREGLO as string[]).includes(estado)) {
        return { data: null, error: "Estado de arreglo inválido", status: 400 };
      }
      arregloPatch.estado = estado as EstadoArreglo;
    }

    const patchEntries = Object.entries(arregloPatch).filter(([, value]) => value !== undefined);
    let currentArreglo: Arreglo | null = null;

    if (arregloPatch.estado) {
      const transitionResult = await this.validateEstadoTransition(
        supabase,
        id,
        arregloPatch.estado,
        currentArreglo,
        detalle_formulario
      );

      currentArreglo = transitionResult.currentArreglo;
      if (transitionResult.error) {
        return {
          data: null,
          error: transitionResult.error,
          status: transitionResult.status,
        };
      }
    }

    let updatedArreglo: Arreglo | null = null;
    if (patchEntries.length > 0) {
      const { data, error } = await arregloService.updateById(
        supabase,
        id,
        arregloPatch
      );

      if (error) {
        const status = error === ServiceError.NotFound ? 404 : 500;
        const message = status === 404 ? "Arreglo no encontrado" : "Error actualizando arreglo";
        return { data: null, error: message, status };
      }

      updatedArreglo = data;
    } else {
      if (currentArreglo) {
        updatedArreglo = currentArreglo;
      } else {
        const { data: fetchedArreglo, error: currentError } = await arregloService.getByIdWithVehiculo(
          supabase,
          id
        );

        if (currentError) {
          const status = currentError === ServiceError.NotFound ? 404 : 500;
          const message = status === 404 ? "Arreglo no encontrado" : "Error actualizando arreglo";
          return { data: null, error: message, status };
        }

        updatedArreglo = fetchedArreglo;
      }
    }

    if (detalle_formulario) {
      const formUpsertResult = await arregloFormularioService.upsertDetalleFormulario(
        supabase,
        id,
        detalle_formulario
      );

      if (formUpsertResult.error) {
        return {
          data: null,
          error: formUpsertResult.error,
          status: formUpsertResult.status ?? 500,
        };
      }
    }

    await statsService.onDataChanged(
      supabase,
      (updatedArreglo as { tenant_id?: string | null } | null)?.tenant_id
    );

    return { data: updatedArreglo, error: null, status: 200 };
  },

  async deleteArregloCompleto(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ error: string | null; status: number }> {
    if (!id) {
      return { error: "ID de arreglo no proporcionado", status: 400 };
    }

    const { data: currentArreglo, error: currentError } = await arregloService.getByIdWithVehiculo(
      supabase,
      id
    );

    if (currentError) {
      const status = currentError === ServiceError.NotFound ? 404 : 500;
      const message = status === 404 ? "Arreglo no encontrado" : "Error eliminando arreglo";
      return { error: message, status };
    }

    const { error } = await arregloService.deleteById(supabase, id);

    if (error) {
      const status = error === ServiceError.NotFound ? 404 : 500;
      const message = status === 404 ? "Arreglo no encontrado" : "Error eliminando arreglo";
      return { error: message, status };
    }

    await statsService.onDataChanged(
      supabase,
      (currentArreglo as { tenant_id?: string | null } | null)?.tenant_id
    );

    return { error: null, status: 200 };
  },
};

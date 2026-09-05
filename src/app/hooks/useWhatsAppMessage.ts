"use client";

import { useCallback } from "react";
import { useToast } from "@/app/providers/ToastProvider";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import {
  assembleClientePhone,
  buildArregloWhatsappMessage,
  buildWhatsappLink,
  normalizeWhatsappPhone,
  type ArregloWhatsappOptions,
} from "@/lib/whatsapp";
import type { ArregloDetalleData } from "@/app/api/arreglos/[id]/route";

const ERRORS = {
  message_empty: "No se pudo generar el mensaje",
  phone_missing: "El cliente no tiene teléfono cargado",
  phone_invalid: "El teléfono del cliente no es válido",
  open_failed: "No se pudo abrir WhatsApp",
  vehiculo_missing: "No se pudo identificar el vehículo",
} as const;

export function useWhatsAppMessage() {
  const toast = useToast();
  const { fetchCliente } = useVehiculos();

  const share = useCallback(
    async (message: string, phone: string | null | undefined): Promise<void> => {
      const normalizedMessage = String(message ?? "").trim();
      if (!normalizedMessage) {
        toast.error("Error", ERRORS.message_empty);
        return;
      }

      if (!phone) {
        toast.error("Error", ERRORS.phone_missing);
        return;
      }

      const cleanPhone = normalizeWhatsappPhone(phone);
      if (!cleanPhone) {
        toast.error("Error", ERRORS.phone_invalid);
        return;
      }

      const url = buildWhatsappLink(cleanPhone, normalizedMessage);
      try {
        const opened = window.open(url, "_blank");
        if (!opened) {
          toast.error("Error", ERRORS.open_failed);
          return;
        }
      } catch {
        toast.error("Error", ERRORS.open_failed);
        return;
      }
    },
    [toast]
  );

  const shareArreglo = useCallback(
    async (data: ArregloDetalleData | null, options?: ArregloWhatsappOptions): Promise<void> => {
      if (!data?.arreglo?.vehiculo?.id) {
        toast.error("Error", ERRORS.vehiculo_missing);
        return;
      }

      const cliente = await fetchCliente(data.arreglo.vehiculo.id);
      const fullPhone = cliente ? assembleClientePhone(cliente) : "";
      if (!fullPhone) {
        toast.error("Error", ERRORS.phone_missing);
        return;
      }

      const tenantName = options?.tenantName ?? (localStorage.getItem("tenant_name") || undefined);
      const mensaje = buildArregloWhatsappMessage(data, {
        ...options,
        tenantName,
      });
      if (!mensaje) {
        toast.error("Error", ERRORS.message_empty);
        return;
      }

      await share(mensaje, fullPhone);
    },
    [fetchCliente, share, toast]
  );

  return { share, shareArreglo };
}

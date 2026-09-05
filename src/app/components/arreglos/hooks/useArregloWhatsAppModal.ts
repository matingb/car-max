"use client";

import { useEffect, useMemo, useState } from "react";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import {
  assembleClientePhone,
  buildArregloWhatsappMessage,
  buildWhatsappLink,
  normalizeWhatsappPhone,
} from "@/lib/whatsapp";
import type { ArregloDetalleData } from "@/app/api/arreglos/[id]/route";

export interface WhatsAppContentConfig {
  mostrarDetalleItems: boolean;
  mostrarPreciosItems: boolean;
  mostrarSubtotales: boolean;
  mostrarTotal: boolean;
  incluirKm: boolean;
  incluirObservaciones: boolean;
}

export const DEFAULT_WHATSAPP_CONFIG: WhatsAppContentConfig = {
  mostrarDetalleItems: true,
  mostrarPreciosItems: false,
  mostrarSubtotales: true,
  mostrarTotal: true,
  incluirKm: true,
  incluirObservaciones: true,
};

interface Params {
  open: boolean;
  onClose: () => void;
  data: ArregloDetalleData | null;
  initialPhone?: string | null;
  clienteNombre?: string | null;
}

export function useArregloWhatsAppModal({
  open,
  onClose,
  data,
  initialPhone,
  clienteNombre: initialClienteNombre,
}: Params) {
  const toast = useToast();
  const { fetchCliente } = useVehiculos();

  const [config, setConfig] = useState<WhatsAppContentConfig>(DEFAULT_WHATSAPP_CONFIG);
  const [mensaje, setMensaje] = useState("");
  const [isCustomized, setIsCustomized] = useState(false);
  const [copied, setCopied] = useState(false);

  const [phone, setPhone] = useState(initialPhone ?? "");
  const [clienteNombre, setClienteNombre] = useState(initialClienteNombre ?? "");
  const [loadingCliente, setLoadingCliente] = useState(false);

  // Cargar datos del cliente al abrir
  useEffect(() => {
    if (!open || !data?.arreglo?.vehiculo?.id) return;

    if (initialPhone != null) setPhone(initialPhone);
    if (initialClienteNombre != null) setClienteNombre(initialClienteNombre);

    if (initialPhone == null || initialClienteNombre == null) {
      let isMounted = true;
      setLoadingCliente(true);
      fetchCliente(data.arreglo.vehiculo.id)
        .then((cliente) => {
          if (!isMounted || !cliente) return;
          if (initialPhone == null) setPhone(assembleClientePhone(cliente));
          if (initialClienteNombre == null) setClienteNombre(cliente.nombre ?? "");
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingCliente(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [open, data, initialPhone, initialClienteNombre, fetchCliente]);

  // Generar mensaje automáticamente
  const generatedMessage = useMemo(() => {
    if (!data) return "";
    const tenantName =
      (typeof window !== "undefined" && localStorage.getItem("tenant_name")) || undefined;
    return buildArregloWhatsappMessage(data, {
      tenantName,
      ...config,
      mostrarPreciosItems: config.mostrarDetalleItems ? config.mostrarPreciosItems : false,
    });
  }, [data, config]);

  // Actualizar mensaje si no ha sido personalizado a mano
  useEffect(() => {
    if (!isCustomized) {
      setMensaje(generatedMessage);
    }
  }, [generatedMessage, isCustomized]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setIsCustomized(false);
      setCopied(false);
      setConfig(DEFAULT_WHATSAPP_CONFIG);
    }
  }, [open, data]);

  const updateConfig = (key: keyof WhatsAppContentConfig, value: boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    if (isCustomized) {
      setIsCustomized(false);
    }
  };

  const handleCustomTextChange = (value: string) => {
    setMensaje(value);
    setIsCustomized(true);
  };

  const handleReset = () => {
    if (isCustomized) {
      setIsCustomized(false);
      setMensaje(generatedMessage);
    } else {
      setConfig(DEFAULT_WHATSAPP_CONFIG);
    }
  };

  const handleCopy = async () => {
    const textToCopy = mensaje.trim();
    if (!textToCopy) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success("Copiado", "Mensaje copiado al portapapeles.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Error", "No se pudo copiar el mensaje al portapapeles.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = mensaje.trim();
    if (!textToSend) {
      toast.error("Error", "El mensaje no puede estar vacío");
      return;
    }

    const cleanPhone = normalizeWhatsappPhone(phone);
    if (!cleanPhone) {
      toast.error("Error", "El teléfono no es válido o está vacío");
      return;
    }

    const url = buildWhatsappLink(cleanPhone, textToSend);
    try {
      const opened = window.open(url, "_blank");
      if (!opened) {
        toast.error("Error", "El navegador bloqueó la apertura de WhatsApp");
        return;
      }
      onClose();
    } catch {
      toast.error("Error", "No se pudo abrir WhatsApp");
    }
  };

  return {
    config,
    updateConfig,
    mensaje,
    handleCustomTextChange,
    isCustomized,
    handleReset,
    copied,
    handleCopy,
    phone,
    setPhone,
    clienteNombre,
    setClienteNombre,
    loadingCliente,
    handleSubmit,
  };
}

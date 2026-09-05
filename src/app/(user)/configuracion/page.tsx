"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ShieldCheck, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Button from "@/app/components/ui/Button";
import Checkbox from "@/app/components/ui/Checkbox";
import FacturacionEmpresaCard from "@/app/components/facturacion/FacturacionEmpresaCard";
import FacturacionFiscalCard from "@/app/components/facturacion/FacturacionFiscalCard";
import FacturacionCertificadosCard from "@/app/components/facturacion/FacturacionCertificadosCard";
import { COLOR } from "@/theme/theme";
import type { FacturacionConfiguracionPublica } from "@/lib/facturacion/types";

const emptyConfig: FacturacionConfiguracionPublica = {
  razonSocial: "",
  nombreFantasia: null,
  cuit: "",
  condicionIvaEmisor: "MONOTRIBUTISTA",
  domicilio: "",
  ingresosBrutos: null,
  inicioActividades: "",
  puntoVenta: 1,
  habilitada: false,
  ambiente: "HOMOLOGACION",
  credenciales: {
    configuradas: false,
    certificadoNombre: null,
    clavePrivadaNombre: null,
    fingerprintSha256: null,
    vencimiento: null,
    actualizadasAt: null,
  },
};

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<FacturacionConfiguracionPublica>(emptyConfig);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [privateKey, setPrivateKey] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/facturacion/configuracion", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo cargar la configuración fiscal");
      setConfig(body.data ?? emptyConfig);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la configuración fiscal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof FacturacionConfiguracionPublica>(
    key: K,
    value: FacturacionConfiguracionPublica[K],
  ) => {
    setConfig((previous) => ({ ...previous, [key]: value }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (Boolean(certificate) !== Boolean(privateKey)) {
      setError("Para reemplazar las credenciales seleccioná tanto el certificado como la clave privada.");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("config", JSON.stringify(config));
      if (certificate && privateKey) {
        formData.append("certificate", certificate);
        formData.append("privateKey", privateKey);
      }

      const response = await fetch("/api/facturacion/configuracion", {
        method: "PUT",
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo guardar la configuración fiscal");

      setConfig(body.data);
      setCertificate(null);
      setPrivateKey(null);
      setMessage(
        body.data.credenciales.configuradas
          ? "Configuración fiscal guardada y credenciales activas en Storage privado."
          : "Configuración guardada. Subí el certificado y la clave privada para habilitar la emisión.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la configuración fiscal");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/facturacion/configuracion/probar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo probar la conexión fiscal");
      setMessage(
        `Conexión correcta con ARCA. Último comprobante: ${body.data.ultimoComprobante}.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo probar la conexión fiscal");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={styles.pageRoot}>
      <ScreenHeader title="Configuración" breadcrumbs={["Administración"]} />

      <main style={styles.main}>
        <div style={styles.container}>
          {/* Header descriptivo de Facturación */}
          <div style={styles.headingSection}>
            <h2 style={styles.headingTitle}>Facturación</h2>
            <p style={styles.headingDescription}>
              Datos fiscales, credenciales y emisión de comprobantes ARCA.
            </p>
          </div>

          {loading ? (
            <div style={styles.loadingContainer}>
              <Loader2 size={32} color={COLOR.ACCENT.PRIMARY} style={styles.spinner} />
              <p style={styles.loadingText}>Cargando configuración fiscal…</p>
            </div>
          ) : (
            <form onSubmit={save} style={styles.form}>
              {/* Card 1: Datos de la Empresa */}
              <FacturacionEmpresaCard
                razonSocial={config.razonSocial}
                nombreFantasia={config.nombreFantasia}
                domicilio={config.domicilio}
                disabled={saving || testing}
                onChange={(patch) => {
                  setConfig((prev) => ({ ...prev, ...patch }));
                }}
              />

              {/* Card 2: Datos Fiscales */}
              <FacturacionFiscalCard
                cuit={config.cuit}
                inicioActividades={config.inicioActividades}
                condicionIvaEmisor={config.condicionIvaEmisor}
                ingresosBrutos={config.ingresosBrutos}
                puntoVenta={config.puntoVenta}
                disabled={saving || testing}
                onChange={(patch) => {
                  setConfig((prev) => ({ ...prev, ...patch }));
                }}
              />

              {/* Card 3: Certificado y Clave Privada */}
              <FacturacionCertificadosCard
                credenciales={config.credenciales}
                certificate={certificate}
                privateKey={privateKey}
                disabled={saving || testing}
                onCertificateChange={setCertificate}
                onPrivateKeyChange={setPrivateKey}
              />

              {/* Feedback Alerts */}
              {error && (
                <div style={styles.errorAlert} role="alert">
                  <AlertCircle size={18} color={COLOR.SEMANTIC.DANGER} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {message && (
                <div style={styles.successAlert} role="status">
                  <CheckCircle2 size={18} color={COLOR.SEMANTIC.SUCCESS} style={{ flexShrink: 0 }} />
                  <span>{message}</span>
                </div>
              )}

              {/* Acciones y Habilitación */}
              <div style={styles.actionsBar}>
                <Checkbox
                  id="habilitar-emision"
                  checked={config.habilitada}
                  onChange={(checked) => update("habilitada", checked)}
                  label="Habilitar emisión de comprobantes"
                  disabled={saving || testing}
                />

                <div style={styles.actionButtons}>
                  <Button
                    type="button"
                    text={testing ? "Probando conexión…" : "Probar conexión"}
                    outline
                    disabled={testing || saving || !config.credenciales.configuradas}
                    onClick={testConnection}
                    hideTextOnMobile={false}
                  />

                  <Button
                    type="submit"
                    text={saving ? "Guardando…" : "Guardar configuración"}
                    icon={<ShieldCheck size={18} />}
                    disabled={saving || testing}
                    hideTextOnMobile={false}
                  />
                </div>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

const styles = {
  pageRoot: {
    width: "100%",
  },
  main: {
    padding: "16px 0 40px",
  },
  container: {
    maxWidth: 920,
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
  },
  headingSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  headingTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
  },
  headingDescription: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
    margin: 0,
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 20px",
    gap: 12,
  },
  spinner: {
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
  },
  errorAlert: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 8,
    color: COLOR.SEMANTIC.DANGER,
    background: `${COLOR.SEMANTIC.DANGER}14`,
    border: `1px solid ${COLOR.SEMANTIC.DANGER}33`,
    fontSize: 13,
    fontWeight: 500,
  },
  successAlert: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 8,
    color: COLOR.SEMANTIC.SUCCESS,
    background: `${COLOR.SEMANTIC.SUCCESS}14`,
    border: `1px solid ${COLOR.SEMANTIC.SUCCESS}33`,
    fontSize: 13,
    fontWeight: 500,
  },
  actionsBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap" as const,
    paddingTop: 16,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  actionButtons: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap" as const,
  },
} as const;

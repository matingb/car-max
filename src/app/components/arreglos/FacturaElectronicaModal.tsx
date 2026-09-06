"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import Modal from "@/app/components/ui/Modal";
import Button from "@/app/components/ui/Button";
import { COLOR } from "@/theme/theme";
import {
  CONDICIONES_IVA_RECEPTOR,
  TIPOS_DOCUMENTO_FISCAL,
  type FacturaElectronicaResumen,
  type FacturaFechaInput,
  type FacturacionPreflight,
  type PerfilFiscalCliente,
} from "@/lib/facturacion/types";
import { determineVoucher } from "@/lib/facturacion/arcaPayload";

type Props = {
  open: boolean;
  arregloId?: string;
  operacionId?: string;
  onClose: () => void;
  onAuthorized: (factura: FacturaElectronicaResumen) => void;
};

type FiscalDraft = {
  tipoDocumento: string;
  numeroDocumento: string;
  condicionIvaReceptorId: string;
};

function defaultDraft(receptor: PerfilFiscalCliente): FiscalDraft {
  return {
    tipoDocumento: String(receptor.tipoDocumento ?? 99),
    numeroDocumento: receptor.numeroDocumento ?? "",
    condicionIvaReceptorId: String(receptor.condicionIvaReceptorId ?? 5),
  };
}

export default function FacturaElectronicaModal({ open, arregloId, operacionId, onClose, onAuthorized }: Props) {
  const [preflight, setPreflight] = useState<FacturacionPreflight | null>(null);
  const [factura, setFactura] = useState<FacturaElectronicaResumen | null>(null);
  const [receptor, setReceptor] = useState<FiscalDraft>({ tipoDocumento: "99", numeroDocumento: "", condicionIvaReceptorId: "5" });
  const [fechas, setFechas] = useState<FacturaFechaInput>({ fechaComprobante: "" });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const endpoint = operacionId ? `/api/operaciones/${operacionId}/factura` : `/api/arreglos/${arregloId}/factura`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreflight(null);
    setFactura(null);
    fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "No se pudo preparar la factura electrónica");
        if (cancelled) return;
        const data = body.data as { factura: FacturaElectronicaResumen | null; preflight: FacturacionPreflight };
        setPreflight(data.preflight);
        setFactura(data.factura);
        setReceptor(defaultDraft(data.preflight.receptor));
        setFechas(data.preflight.fechasDefault);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudo preparar la factura electrónica");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, open]);

  const canRetry = factura?.estado === "RECHAZADA";
  const canSubmit = Boolean(preflight && (preflight.puedeEmitir || canRetry) && factura?.estado !== "AUTORIZADA" && factura?.estado !== "INCIERTA");
  const isServiceConcept = preflight?.concepto === 2 || preflight?.concepto === 3;
  const voucherPreview = useMemo(() => {
    if (!preflight?.emisor) return null;
    return determineVoucher(
      preflight.emisor.condicionIvaEmisor,
      Number(receptor.condicionIvaReceptorId) as PerfilFiscalCliente["condicionIvaReceptorId"],
    );
  }, [preflight?.emisor, receptor.condicionIvaReceptorId]);
  const submitText = canRetry ? "Reintentar emisión" : `Emitir ${voucherPreview ? `Factura ${voucherPreview.clase}` : "factura"}`;

  const invoiceLabel = useMemo(() => {
    if (!factura?.numeroComprobante) return "";
    return `${String(preflight?.emisor?.puntoVenta ?? 0).padStart(5, "0")}-${String(factura.numeroComprobante).padStart(8, "0")}`;
  }, [factura?.numeroComprobante, preflight?.emisor?.puntoVenta]);

  const handleSubmit = async () => {
    if (!preflight || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          condicionVenta: "CONTADO",
          receptor: {
            tipoDocumento: Number(receptor.tipoDocumento),
            numeroDocumento: receptor.numeroDocumento,
            condicionIvaReceptorId: Number(receptor.condicionIvaReceptorId),
          },
          fechas,
        }),
      });
      const body = await response.json();
      if (body.data) setFactura(body.data as FacturaElectronicaResumen);
      if (!response.ok) throw new Error(body.error || "La emisión fiscal no fue autorizada");
      const issued = body.data as FacturaElectronicaResumen;
      setFactura(issued);
      onAuthorized(issued);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La emisión fiscal no fue autorizada");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadPdf = () => {
    if (!factura?.id) return;
    window.location.assign(`/api/facturas/${factura.id}/pdf`);
  };

  return (
    <Modal
      open={open}
      title="Facturación electrónica"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText={submitText}
      submitting={submitting}
      disabledSubmit={!canSubmit || loading}
      modalStyle={{ width: "min(860px, 96vw)", overflow: "auto" }}
      modalError={error ? { titulo: "No se pudo emitir la factura", descripcion: error } : null}
    >
      {loading ? <p style={styles.muted}>Preparando datos fiscales…</p> : null}
      {!loading && preflight ? (
        <div style={styles.content}>
          {factura?.estado === "AUTORIZADA" ? (
            <div style={styles.authorized}>
              <strong>Factura {factura.claseComprobante} autorizada: {invoiceLabel}</strong>
              <span>CAE {factura.cae ?? "-"} · vence {factura.caeVencimiento ?? "-"}</span>
              <Button icon={<Download size={16} />} text="Descargar PDF" onClick={downloadPdf} hideTextOnMobile={false} />
            </div>
          ) : null}
          <section style={styles.summary}>
            <div><span style={styles.label}>Emisor</span><strong>{preflight.emisor?.razonSocial ?? "Configuración pendiente"}</strong><span>{preflight.emisor?.cuit ?? ""} · Punto de venta {preflight.emisor?.puntoVenta ?? "-"}</span></div>
            <div><span style={styles.label}>Comprobante</span><strong>Factura {voucherPreview?.clase ?? preflight.claseComprobante} (tipo {voucherPreview?.tipo ?? preflight.tipoComprobante})</strong><span>Concepto {preflight.concepto}: {preflight.concepto === 1 ? "productos" : preflight.concepto === 2 ? "servicios" : "productos y servicios"}</span></div>
          </section>
          <section style={styles.box}>
            <strong>Receptor</strong>
            <span style={styles.muted}>{preflight.receptor.nombre}</span>
            <div style={styles.grid}>
              <label style={styles.field}>Tipo de documento
                <select style={styles.input} value={receptor.tipoDocumento} onChange={(event) => setReceptor((previous) => ({
                  ...previous,
                  tipoDocumento: event.target.value,
                  ...(event.target.value === "99" ? { numeroDocumento: "", condicionIvaReceptorId: "5" } : {}),
                }))}>
                  {TIPOS_DOCUMENTO_FISCAL.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.label}</option>)}
                </select>
              </label>
              <label style={styles.field}>Número de documento
                <input style={styles.input} inputMode="numeric" value={receptor.numeroDocumento} disabled={receptor.tipoDocumento === "99"} placeholder={receptor.tipoDocumento === "99" ? "No requerido" : undefined} onChange={(event) => setReceptor((previous) => ({ ...previous, numeroDocumento: event.target.value }))} />
              </label>
              <label style={styles.field}>Condición IVA
                <select style={styles.input} value={receptor.condicionIvaReceptorId} disabled={receptor.tipoDocumento === "99"} onChange={(event) => setReceptor((previous) => ({ ...previous, condicionIvaReceptorId: event.target.value }))}>
                  {CONDICIONES_IVA_RECEPTOR.map((condicion) => <option key={condicion.id} value={condicion.id}>{condicion.label}</option>)}
                </select>
              </label>
            </div>
          </section>
          <section style={styles.box}>
            <strong>Fechas</strong>
            <div style={styles.grid}>
              <label style={styles.field}>Fecha de comprobante
                <input type="date" style={styles.input} value={fechas.fechaComprobante} onChange={(event) => setFechas((previous) => ({ ...previous, fechaComprobante: event.target.value }))} />
              </label>
              {isServiceConcept ? <>
                <label style={styles.field}>Servicio desde
                  <input type="date" style={styles.input} value={fechas.fechaServicioDesde ?? ""} onChange={(event) => setFechas((previous) => ({ ...previous, fechaServicioDesde: event.target.value }))} />
                </label>
                <label style={styles.field}>Servicio hasta
                  <input type="date" style={styles.input} value={fechas.fechaServicioHasta ?? ""} onChange={(event) => setFechas((previous) => ({ ...previous, fechaServicioHasta: event.target.value }))} />
                </label>
                <label style={styles.field}>Vencimiento de pago
                  <input type="date" style={styles.input} value={fechas.fechaVencimientoPago ?? ""} onChange={(event) => setFechas((previous) => ({ ...previous, fechaVencimientoPago: event.target.value }))} />
                </label>
              </> : null}
            </div>
          </section>
          <section style={styles.box}>
            <strong>Detalle fiscal</strong>
            <div style={styles.lines}>
              {preflight.lineas.map((linea) => <div style={styles.line} key={`${linea.origen}-${linea.ordinal}`}><span>{linea.descripcion}{linea.codigo ? ` (${linea.codigo})` : ""} × {linea.cantidad}</span><strong>{linea.subtotal.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</strong></div>)}
            </div>
            <div style={styles.total}><span>Total</span><strong>{preflight.total.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</strong></div>
          </section>
          {preflight.mensaje && factura?.estado !== "RECHAZADA" ? <div style={styles.warning}>{preflight.mensaje}</div> : null}
          {factura?.estado === "INCIERTA" ? <div style={styles.warning}>La emisión quedó incierta. No se asignará otro número hasta reconciliar el comprobante candidato.</div> : null}
          {factura?.estado !== "AUTORIZADA" ? <div style={styles.immutability}><ExternalLink size={16} />Luego de autorizar la factura, ya no podrán realizarse modificaciones sobre el arreglo.</div> : null}
        </div>
      ) : null}
    </Modal>
  );
}

const styles = {
  content: { display: "flex", flexDirection: "column" as const, gap: 14 },
  summary: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, padding: 12, borderRadius: 8, background: COLOR.BACKGROUND.SUBTLE },
  box: { display: "flex", flexDirection: "column" as const, gap: 10, border: `1px solid ${COLOR.BORDER.SUBTLE}`, borderRadius: 8, padding: 12 },
  label: { display: "block", fontSize: 11, color: COLOR.TEXT.TERTIARY, textTransform: "uppercase" as const, marginBottom: 4 },
  muted: { color: COLOR.TEXT.SECONDARY, fontSize: 13, lineHeight: 1.4 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },
  field: { display: "flex", flexDirection: "column" as const, gap: 5, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  input: { height: 40, borderRadius: 8, border: `1px solid ${COLOR.BORDER.SUBTLE}`, padding: "0 10px", color: COLOR.TEXT.PRIMARY, background: COLOR.INPUT.PRIMARY.BACKGROUND },
  lines: { display: "flex", flexDirection: "column" as const, gap: 7 },
  line: { display: "flex", justifyContent: "space-between", gap: 12, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  total: { display: "flex", justifyContent: "space-between", borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`, paddingTop: 10, color: COLOR.TEXT.PRIMARY },
  warning: { background: COLOR.BACKGROUND.DANGER_TINT, color: COLOR.ICON.DANGER, borderRadius: 8, padding: 10, fontSize: 13 },
  immutability: { display: "flex", alignItems: "center", gap: 8, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  authorized: { display: "flex", flexDirection: "column" as const, alignItems: "flex-start", gap: 8, background: COLOR.BACKGROUND.SUCCESS_TINT, color: COLOR.SEMANTIC.SUCCESS, padding: 12, borderRadius: 8 },
} as const;

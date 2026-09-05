"use client";

import React from "react";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import type { CondicionIvaEmisor } from "@/lib/facturacion/types";

interface FacturacionFiscalCardProps {
  cuit: string;
  inicioActividades: string;
  condicionIvaEmisor: CondicionIvaEmisor;
  ingresosBrutos: string | null;
  puntoVenta: number;
  onChange: (patch: {
    cuit?: string;
    inicioActividades?: string;
    condicionIvaEmisor?: CondicionIvaEmisor;
    ingresosBrutos?: string | null;
    puntoVenta?: number;
  }) => void;
  disabled?: boolean;
}

const CONDICION_IVA_OPTIONS: Array<{ value: CondicionIvaEmisor; label: string }> = [
  { value: "MONOTRIBUTISTA", label: "Monotributista" },
  { value: "RESPONSABLE_INSCRIPTO", label: "Responsable Inscripto" },
];

export default function FacturacionFiscalCard({
  cuit,
  inicioActividades,
  condicionIvaEmisor,
  ingresosBrutos,
  puntoVenta,
  onChange,
  disabled = false,
}: FacturacionFiscalCardProps) {
  return (
    <section style={styles.card} aria-labelledby="fiscal-heading">
      <div style={styles.header}>
        <h3 id="fiscal-heading" style={styles.title}>
          Datos Fiscales
        </h3>
        <p style={styles.description}>Identificación y tributación ARCA.</p>
      </div>

      <div style={styles.body}>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="facturacion-cuit">
              CUIT <span style={styles.required}>*</span>
            </label>
            <input
              id="facturacion-cuit"
              required
              disabled={disabled}
              inputMode="numeric"
              value={cuit}
              onChange={(e) => onChange({ cuit: e.target.value })}
              placeholder="Ej: 30712345678"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="facturacion-inicio-actividades">
              Inicio de actividades <span style={styles.required}>*</span>
            </label>
            <input
              id="facturacion-inicio-actividades"
              type="date"
              required
              disabled={disabled}
              value={inicioActividades}
              onChange={(e) => onChange({ inicioActividades: e.target.value })}
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="facturacion-condicion-iva">
              Condición frente al IVA <span style={styles.required}>*</span>
            </label>
            <select
              id="facturacion-condicion-iva"
              required
              disabled={disabled}
              value={condicionIvaEmisor}
              onChange={(e) =>
                onChange({
                  condicionIvaEmisor: e.target.value as CondicionIvaEmisor,
                })
              }
              style={styles.select}
            >
              {CONDICION_IVA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="facturacion-iibb">
              N° de inscripción IIBB
            </label>
            <input
              id="facturacion-iibb"
              disabled={disabled}
              value={ingresosBrutos ?? ""}
              onChange={(e) =>
                onChange({ ingresosBrutos: e.target.value || null })
              }
              placeholder="Ej: 30-71234567-8"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="facturacion-punto-venta">
              N° de punto de venta <span style={styles.required}>*</span>
            </label>
            <input
              id="facturacion-punto-venta"
              type="number"
              min={1}
              required
              disabled={disabled}
              value={puntoVenta}
              onChange={(e) =>
                onChange({ puntoVenta: Number(e.target.value) || 1 })
              }
              placeholder="Ej: 1"
              style={styles.input}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

const styles = {
  card: {
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    overflow: "hidden" as const,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
  },
  header: {
    padding: "16px 20px",
    background: COLOR.BACKGROUND.SUBTLE,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
  },
  description: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    margin: 0,
  },
  body: {
    padding: 20,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
  },
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    height: 42,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  select: {
    width: "100%",
    height: 42,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    outline: "none",
    cursor: "pointer",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
} as const;

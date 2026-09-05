"use client";

import React from "react";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";

interface FacturacionEmpresaCardProps {
  razonSocial: string;
  nombreFantasia: string | null;
  domicilio: string;
  onChange: (patch: {
    razonSocial?: string;
    nombreFantasia?: string | null;
    domicilio?: string;
  }) => void;
  disabled?: boolean;
}

export default function FacturacionEmpresaCard({
  razonSocial,
  nombreFantasia,
  domicilio,
  onChange,
  disabled = false,
}: FacturacionEmpresaCardProps) {
  return (
    <section style={styles.card} aria-labelledby="empresa-heading">
      <div style={styles.header}>
        <h3 id="empresa-heading" style={styles.title}>
          Datos de la Empresa
        </h3>
        <p style={styles.description}>Información general de tu negocio.</p>
      </div>

      <div style={styles.body}>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="facturacion-razon-social">
              Razón social <span style={styles.required}>*</span>
            </label>
            <input
              id="facturacion-razon-social"
              required
              disabled={disabled}
              value={razonSocial}
              onChange={(e) => onChange({ razonSocial: e.target.value })}
              placeholder="Ej: B2Car S.A."
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="facturacion-nombre-fantasia">
              Nombre de fantasía
            </label>
            <input
              id="facturacion-nombre-fantasia"
              disabled={disabled}
              value={nombreFantasia ?? ""}
              onChange={(e) =>
                onChange({ nombreFantasia: e.target.value || null })
              }
              placeholder="Ej: Taller B2Car"
              style={styles.input}
            />
          </div>

          <div style={{ ...styles.field, ...styles.fullWidth }}>
            <label style={styles.label} htmlFor="facturacion-domicilio">
              Domicilio <span style={styles.required}>*</span>
            </label>
            <input
              id="facturacion-domicilio"
              required
              disabled={disabled}
              value={domicilio}
              onChange={(e) => onChange({ domicilio: e.target.value })}
              placeholder="Ej: Av. San Martín 1234, CABA"
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
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  fullWidth: {
    gridColumn: "1 / -1",
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
} as const;

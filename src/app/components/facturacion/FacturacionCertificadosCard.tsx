"use client";

import React from "react";
import { ShieldCheck, Info } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { formatDateLabel } from "@/lib/fechas";
import CertificadoUploader from "./CertificadoUploader";
import type { FacturacionConfiguracionPublica } from "@/lib/facturacion/types";

interface FacturacionCertificadosCardProps {
  credenciales: FacturacionConfiguracionPublica["credenciales"];
  certificate: File | null;
  privateKey: File | null;
  onCertificateChange: (file: File | null) => void;
  onPrivateKeyChange: (file: File | null) => void;
  disabled?: boolean;
}

export default function FacturacionCertificadosCard({
  credenciales,
  certificate,
  privateKey,
  onCertificateChange,
  onPrivateKeyChange,
  disabled = false,
}: FacturacionCertificadosCardProps) {
  const isConfigured = credenciales.configuradas;

  return (
    <section style={styles.card} aria-labelledby="certificados-heading">
      <div style={styles.header}>
        <div style={styles.headerTitles}>
          <h3 id="certificados-heading" style={styles.title}>
            Certificado y Clave Privada
          </h3>
          <p style={styles.description}>
            Se guarda el par de certificados encriptados en Storage privado.
          </p>
        </div>

        <div>
          {isConfigured ? (
            <span style={styles.activeBadge}>
              <ShieldCheck size={14} /> Credenciales activas
            </span>
          ) : (
            <span style={styles.pendingBadge}>
              <Info size={14} /> Credenciales pendientes
            </span>
          )}
        </div>
      </div>

      <div style={styles.body}>
        {isConfigured && (
          <div style={styles.metadataCard}>
            <div style={styles.metadataItem}>
              <span style={styles.metadataLabel}>Certificado</span>
              <strong style={styles.metadataValue} title={credenciales.certificadoNombre ?? ""}>
                {credenciales.certificadoNombre ?? "-"}
              </strong>
            </div>

            <div style={styles.metadataItem}>
              <span style={styles.metadataLabel}>Clave privada</span>
              <strong style={styles.metadataValue} title={credenciales.clavePrivadaNombre ?? ""}>
                {credenciales.clavePrivadaNombre ?? "-"}
              </strong>
            </div>

            <div style={styles.metadataItem}>
              <span style={styles.metadataLabel}>Vencimiento</span>
              <strong style={styles.metadataValue}>
                {formatDateLabel(credenciales.vencimiento, "-")}
              </strong>
            </div>

            <div style={styles.metadataItem}>
              <span style={styles.metadataLabel}>Fingerprint SHA-256</span>
              <strong
                style={{ ...styles.metadataValue, ...styles.mono }}
                title={credenciales.fingerprintSha256 ?? ""}
              >
                {credenciales.fingerprintSha256 ?? "-"}
              </strong>
            </div>
          </div>
        )}

        <div style={styles.uploadersGrid}>
          <CertificadoUploader
            label={
              isConfigured
                ? "Reemplazar certificado (.crt o .pem)"
                : "Certificado (.crt o .pem)"
            }
            accept=".crt,.pem"
            file={certificate}
            onFileChange={onCertificateChange}
            existingFileName={credenciales.certificadoNombre}
            disabled={disabled}
          />

          <CertificadoUploader
            label={
              isConfigured
                ? "Reemplazar clave privada (.key o .pem)"
                : "Clave privada (.key o .pem)"
            }
            accept=".key,.pem"
            file={privateKey}
            onFileChange={onPrivateKeyChange}
            existingFileName={credenciales.clavePrivadaNombre}
            disabled={disabled}
          />
        </div>

        <p style={styles.note}>
          Máximo 64 KiB por archivo. Las claves con passphrase no están admitidas.
        </p>
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
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap" as const,
  },
  headerTitles: {
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
  activeBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.SEMANTIC.SUCCESS,
    background: `${COLOR.SEMANTIC.SUCCESS}18`,
    border: `1px solid ${COLOR.SEMANTIC.SUCCESS}33`,
    whiteSpace: "nowrap" as const,
  },
  pendingBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.SEMANTIC.WARNING,
    background: `${COLOR.SEMANTIC.WARNING}18`,
    border: `1px solid ${COLOR.SEMANTIC.WARNING}33`,
    whiteSpace: "nowrap" as const,
  },
  body: {
    padding: 20,
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  metadataCard: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    padding: "14px 16px",
    borderRadius: 8,
    background: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  metadataItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    minWidth: 0,
  },
  metadataLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: COLOR.TEXT.TERTIARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.03em",
  },
  metadataValue: {
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  mono: {
    fontFamily: "monospace",
    fontSize: 11,
  },
  uploadersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },
  note: {
    fontSize: 12,
    color: COLOR.TEXT.TERTIARY,
    margin: 0,
  },
} as const;

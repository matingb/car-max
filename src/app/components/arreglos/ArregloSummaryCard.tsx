"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Wrench,
  Pencil,
  Trash,
  Gauge,
  FileText,
  ReceiptText,
  Download,
  CarFront,
  Users,
} from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Card from "@/app/components/ui/Card";
import IconButton from "@/app/components/ui/IconButton";
import WhatsAppIcon from "@/app/components/ui/WhatsAppIcon";
import ArregloEstadoBadge from "@/app/components/arreglos/ArregloEstadoBadge";
import ArregloPagoBadge from "@/app/components/arreglos/ArregloPagoBadge";
import Avatar from "@/app/components/ui/Avatar";
import { formatArs } from "@/lib/format";
import { formatDateLabel } from "@/lib/fechas";
import { ROUTES } from "@/routing/routes";
import { logger } from "@/lib/logger";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { getEmpleadoColor } from "@/app/providers/EmpleadosProvider";

import { useCategoriasArreglo } from "@/app/providers/CategoriasArregloProvider";
import type { EstadoArreglo } from "@/model/types";
import type { ArregloDetalleData } from "@/app/api/arreglos/[id]/route";
import { useArregloPrintableInvoice } from "@/app/components/arreglos/hooks/useArregloPrintableInvoice";
import ArregloWhatsAppModal from "@/app/components/arreglos/ArregloWhatsAppModal";
import CategoriaChip from "@/app/components/arreglos/lineas/shared/CategoriaChip";
import { getArregloDeleteConfirmationMessage } from "@/app/components/arreglos/arregloDeleteConfirmation";
import { css } from "@emotion/react";
import type { FacturaElectronicaResumen } from "@/lib/facturacion/types";

export interface ArregloSummaryCardProps {
  data: ArregloDetalleData;
  totalCalculado: number;
  onOpenEdit: () => void;
  onArregloChange: (updatedArreglo: NonNullable<ArregloDetalleData["arreglo"]>) => void;
  canEmitFactura?: boolean;
  facturaElectronica?: FacturaElectronicaResumen | null;
  onOpenFactura?: () => void;
}

export default function ArregloSummaryCard({
  data,
  totalCalculado,
  onOpenEdit,
  onArregloChange,
  canEmitFactura = false,
  facturaElectronica,
  onOpenFactura,
}: ArregloSummaryCardProps) {
  const router = useRouter();
  const { update, remove, loading } = useArreglos();
  const { confirm } = useModalMessage();
  const { success, error } = useToast();
  const { handleOpenPrintableInvoice } = useArregloPrintableInvoice();
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  const { categorias } = useCategoriasArreglo();
  const arreglo = data.arreglo;

  const assignedEmpleados = useMemo(
    () => arreglo?.empleados ?? [],
    [arreglo?.empleados]
  );

  const categoriasDelArreglo = useMemo(() =>
    [...new Set(arreglo?.categorias ?? [])].filter((id) =>
      categorias.some((c) => c.id === id)
    ),
    [arreglo?.categorias, categorias]
  );

  if (!arreglo) return null;

  const categoriasMostradas = categoriasDelArreglo.slice(0, 3);
  const categoriasRestantes = categoriasDelArreglo.length - categoriasMostradas.length;

  const handlePrintableInvoice = () => {
    handleOpenPrintableInvoice(data);
  };

  const handleWhatsApp = () => {
    setIsWhatsAppModalOpen(true);
  };

  const handleNavigateToVehiculo = () => {
    if (arreglo.vehiculo) {
      router.push(`${ROUTES.vehiculos}/${arreglo.vehiculo.id}`);
    }
  };

  const handleDeleteArreglo = async () => {
    const confirmed = await confirm({
      message: getArregloDeleteConfirmationMessage(data.cobros?.length ?? 0),
      title: "Eliminar arreglo",
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) return;
    try {
      await remove(arreglo.id);
      router.push(ROUTES.arreglos);
      success("Arreglo eliminado", "El arreglo se eliminó correctamente.");
    } catch (err: unknown) {
      logger.error("Error deleting arreglo:", err);
      error("Error", "No se pudo eliminar el arreglo");
    }
  };

  const handleEstadoChange = async (nextEstado: EstadoArreglo) => {
    if (loading || arreglo.estado === nextEstado) return;

    try {
      const response = await update(arreglo.id, {
        estado: nextEstado,
      });
      if (!response) return;
      onArregloChange(response);
      success("Estado actualizado", "El estado del arreglo se actualizó correctamente.");
    } catch (err: unknown) {
      logger.error("Error updating arreglo estado:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo actualizar el estado del arreglo."
      );
    }
  };

  return (
    <section style={styles.container}>
      <Card style={{ padding: 0, overflow: "hidden", backgroundColor: COLOR.BACKGROUND.SECONDARY }}>
        {/* Top Header */}
        <div css={styles.header}>
          <div style={styles.headerLeft}>
            {/* Vehículo info */}
            {arreglo.vehiculo ? (
              <Card
                style={styles.vehiculoCard}
                onClick={handleNavigateToVehiculo}
                role="button"
                tabIndex={0}
              >
                <div style={styles.vehiculoPatenteRow}>
                  <CarFront size={16} color={COLOR.ICON.MUTED} />
                  <span style={styles.patente}>{arreglo.vehiculo.patente}</span>
                </div>
                <div css={styles.hideOnMobileDivider} />
                <span css={styles.hideOnMobileText}>
                  {arreglo.vehiculo.marca} {arreglo.vehiculo.modelo}
                  {arreglo.vehiculo.fecha_patente ? ` (${arreglo.vehiculo.fecha_patente})` : ""}
                </span>
                {arreglo.vehiculo.nro_interno && (
                  <div css={styles.hideOnMobileInternalCode}>
                    <span>
                      INT: {arreglo.vehiculo.nro_interno}
                    </span>
                  </div>
                )}
              </Card>
            ) : (
              <span style={{ fontSize: 14, color: COLOR.TEXT.SECONDARY }}>Sin vehículo</span>
            )}

            {/* Estado */}
            <div style={styles.estadoRow}>
              <ArregloEstadoBadge
                estado={arreglo.estado}
                onStateChange={handleEstadoChange}
              />
              <ArregloPagoBadge
                estado={arreglo.estado}
                estaPago={arreglo.esta_pago}
                totalCobrado={arreglo.total_cobrado}
                saldoPendiente={
                  arreglo.saldo_pendiente != null
                    ? arreglo.saldo_pendiente
                    : Math.max(0, (totalCalculado || arreglo.precio_final || 0) - (arreglo.total_cobrado || 0))
                }
                precioFinal={totalCalculado || arreglo.precio_final}
                arregloId={arreglo.id}
                onPagoUpdated={onArregloChange}
                size="md"
                hideTextOnMobile
              />
            </div>
          </div>

          <div style={styles.headerActions}>
            {facturaElectronica?.estado === "AUTORIZADA" ? (
              <div style={styles.facturaAutorizada}>
                <button type="button" style={styles.facturaInfoButton} onClick={onOpenFactura}>
                  FC {String(facturaElectronica.numeroComprobante ?? "").padStart(8, "0")} · CAE {facturaElectronica.cae ?? "-"} · vence {facturaElectronica.caeVencimiento ?? "-"}
                </button>
                <IconButton
                  icon={<Download />}
                  size={18}
                  onClick={onOpenFactura}
                  title="Descargar PDF de Factura C"
                  ariaLabel="Descargar PDF de Factura C"
                  hoverColor={COLOR.SEMANTIC.SUCCESS}
                />
              </div>
            ) : canEmitFactura ? (
              <IconButton
                icon={<ReceiptText />}
                size={18}
                onClick={onOpenFactura}
                title={facturaElectronica?.estado === "RECHAZADA" ? "Reintentar factura electrónica" : "Facturar electrónicamente"}
                ariaLabel={facturaElectronica?.estado === "RECHAZADA" ? "Reintentar factura electrónica" : "Facturar electrónicamente"}
                hoverColor={COLOR.ACCENT.PRIMARY}
              />
            ) : null}
            <IconButton
              icon={<Trash />}
              size={18}
              onClick={handleDeleteArreglo}
              title="Eliminar arreglo"
              ariaLabel="Eliminar arreglo"
              hoverColor={COLOR.SEMANTIC.DANGER}
            />
            <IconButton
              icon={<FileText />}
              size={18}
              onClick={handlePrintableInvoice}
              title="Comprobante no fiscal"
              ariaLabel="Comprobante no fiscal"
              hoverColor={COLOR.ACCENT.PRIMARY}
            />
            <IconButton
              icon={<WhatsAppIcon size={18} />}
              size={18}
              onClick={handleWhatsApp}
              title="Enviar WhatsApp"
              ariaLabel="Enviar WhatsApp"
              hoverColor={COLOR.SEMANTIC.SUCCESS}
            />
            <IconButton
              icon={<Pencil />}
              size={18}
              onClick={onOpenEdit}
              title="Editar arreglo"
              ariaLabel="Editar arreglo"
              hoverColor={COLOR.ACCENT.PRIMARY}
            />
          </div>
        </div>

        {/* Body Content */}
        <div style={styles.bodyContent}>
          <div css={styles.gridContainer}>
            {/* Block 1: Amount, Date, Mileage */}
            <div style={styles.block1}>
              <div>
                <span style={styles.blockLabel}>Total Estimado</span>
                <div style={styles.totalAmount}>
                  {formatArs(totalCalculado, { maxDecimals: 0, minDecimals: 0 })}
                </div>
              </div>
              <div style={styles.detailsGrid}>
                <div style={styles.detailBox}>
                  <span style={styles.blockLabel}>Ingreso</span>
                  <div style={styles.detailValue}>
                    <Calendar size={16} color={COLOR.ICON.MUTED} />
                    {arreglo.fecha ? formatDateLabel(arreglo.fecha) : "-"}
                  </div>
                </div>
                <div style={styles.detailBox}>
                  <span style={styles.blockLabel}>Kilometraje</span>
                  <div style={styles.detailValue}>
                    <Gauge size={16} color={COLOR.ICON.MUTED} />
                    {arreglo.kilometraje_leido
                      ? `${arreglo.kilometraje_leido.toLocaleString()} km`
                      : "-"}
                  </div>
                </div>
              </div>
            </div>

            {/* Block 2: Categories and Personnel */}
            <div style={styles.block2}>
              <div>
                <span style={styles.blockLabelWithIcon}>
                  <Wrench size={14} /> Tipos de Arreglo
                </span>
                <div style={styles.chipsRow}>
                  {categoriasMostradas.length > 0 ? (
                    <>
                      {categoriasMostradas.map((categoriaId, idx) => (
                        <CategoriaChip
                          key={categoriaId ? `cat-${categoriaId}` : `cat-idx-${idx}`}
                          categoriaArregloId={categoriaId}
                        />
                      ))}
                      {categoriasRestantes > 0 ? (
                        <CategoriaChip
                          key="cat-restantes"
                          categoriaArregloId={null}
                          label={`+${categoriasRestantes}`}
                        />
                      ) : null}
                    </>
                  ) : (
                    <span style={styles.emptyText}>Sin categorías registradas</span>
                  )}
                </div>
              </div>

              <div>
                <span style={styles.blockLabelWithIcon}>
                  <Users size={14} /> Personal Asignado
                </span>
                <div style={styles.chipsRow}>
                  {assignedEmpleados.length > 0 ? (
                    assignedEmpleados.map((emp) => {
                      const color = getEmpleadoColor(emp.id);
                      return (
                        <span
                          key={emp.id}
                          style={{
                            ...styles.empleadoChip,
                            backgroundColor: color.bg,
                            color: color.text,
                            borderColor: color.border,
                          }}
                        >
                          <Avatar
                            nombre={`${emp.nombre} ${emp.apellido ?? ""}`.trim()}
                            size={20}
                            bgColor={color.avatarBg}
                            textColor={color.avatarText}
                          />
                          {emp.nombre} {emp.apellido}
                        </span>
                      );
                    })
                  ) : (
                    <span style={styles.emptyText}>Sin personal asignado</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Block 3: Observations */}
          {arreglo.observaciones && (
            <div style={styles.observationsContainer}>
              <span style={styles.blockLabel}>Observaciones Generales</span>
              <p style={styles.observationsText}>{arreglo.observaciones}</p>
            </div>
          )}
        </div>
      </Card>
      <ArregloWhatsAppModal
        open={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        data={data}
      />
    </section>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    marginTop: 16,
    fontFamily: "var(--font-geist-sans), sans-serif",
  },
  header: css({
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
  }),
  headerLeft: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    gap: 12,
  },
  vehiculoCard: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    padding: "6px 12px",
    gap: 12,
  },
  vehiculoPatenteRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  patente: {
    fontFamily: "monospace",
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
  },
  hideOnMobileDivider: css({
    width: 1,
    height: 16,
    backgroundColor: COLOR.BORDER.DEFAULT,
    display: "none",
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      display: "block",
    },
  }),
  hideOnMobileText: css({
    fontSize: 14,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    display: "none",
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      display: "block",
    },
  }),
  hideOnMobileInternalCode: css({
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.TERTIARY,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    display: "none",
    borderLeft: `2px solid ${COLOR.BORDER.DEFAULT}`,
    paddingLeft: 6,
    [`@media (min-width: ${BREAKPOINTS.lg}px)`]: {
      display: "block",
    },
  }),
  estadoRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    gap: 12,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  facturaAutorizada: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    maxWidth: 380,
  },
  facturaInfoButton: {
    border: "none",
    background: COLOR.BACKGROUND.SUCCESS_TINT,
    color: COLOR.SEMANTIC.SUCCESS,
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 11,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  bodyContent: {
    padding: 24,
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
  },
  gridContainer: css({
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 32,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateColumns: "1fr 1fr",
    },
  }),
  block1: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  blockLabel: {
    fontSize: 10,
    textTransform: "uppercase" as const,
    fontWeight: 700,
    color: COLOR.TEXT.TERTIARY,
    letterSpacing: "0.05em",
    marginBottom: 4,
    display: "block",
  },
  blockLabelWithIcon: {
    fontSize: 10,
    textTransform: "uppercase" as const,
    fontWeight: 700,
    color: COLOR.TEXT.TERTIARY,
    letterSpacing: "0.05em",
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    letterSpacing: "-0.025em",
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 12,
  },
  detailBox: {
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: 12,
  },
  detailValue: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
    marginTop: 4,
    whiteSpace: "nowrap" as const,
  },
  block2: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
  },
  chipsRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
  },
  empleadoChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 8,
    border: "1px solid",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  emptyText: {
    fontSize: 14,
    color: COLOR.TEXT.TERTIARY,
    fontStyle: "italic",
  },
  observationsContainer: {
    paddingTop: 20,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  observationsText: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: 12,
    margin: 0,
    lineHeight: 1.5,
  },
};

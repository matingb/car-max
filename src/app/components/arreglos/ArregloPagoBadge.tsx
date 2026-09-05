import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, Loader2 } from "lucide-react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { Arreglo, EstadoArreglo, EstadoPagoArreglo } from "@/model/types";
import CobroArregloModal from "@/app/components/arreglos/CobroArregloModal";
import { formatArs } from "@/lib/format";

type Props = {
  estado?: EstadoArreglo | string | null;
  estaPago?: boolean;
  totalCobrado?: number;
  saldoPendiente?: number;
  precioFinal?: number;
  arregloId?: string | number;
  onClick?: (e: React.MouseEvent) => void;
  onPagoUpdated?: (updatedArreglo: Arreglo) => void;
  size?: "sm" | "md";
  hideTextOnMobile?: boolean;
};

export function calcularEstadoPago({
  totalCobrado = 0,
  precioFinal = 0,
  estaPago,
}: {
  totalCobrado?: number | null;
  precioFinal?: number | null;
  estaPago?: boolean | null;
}): EstadoPagoArreglo {
  const cobrado = Number(totalCobrado ?? 0);
  const total = Number(precioFinal ?? 0);

  if (cobrado <= 0) {
    return estaPago ? "PAGADO" : "PENDIENTE";
  }
  if (total > 0) {
    if (cobrado < total) return "PARCIAL";
    if (cobrado === total) return "PAGADO";
    return "SOBREPAGO";
  }
  return "PAGADO";
}

export default function ArregloPagoBadge({
  estado,
  estaPago,
  totalCobrado,
  saldoPendiente,
  precioFinal,
  arregloId,
  onClick,
  onPagoUpdated,
  size = "md",
  hideTextOnMobile,
}: Props) {
  const [loading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [cobroOpen, setCobroOpen] = useState(false);

  if (estado === "PRESUPUESTO") {
    return null;
  }

  const isInteractive = Boolean(onClick || arregloId);
  const badgeSize = size === "sm" ? 14 : 16;
  const padding = size === "sm" ? "4px 10px" : "6px 10px";
  const fontSize = size === "sm" ? 12 : 13;

  const effectiveEstado: EstadoPagoArreglo = calcularEstadoPago({
    totalCobrado,
    precioFinal,
    estaPago,
  });

  const effectiveSaldoPendiente = saldoPendiente != null
    ? saldoPendiente
    : Math.max(0, Number(precioFinal || 0) - Number(totalCobrado || 0));

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (onClick) {
      onClick(e);
      return;
    }

    if (!arregloId || loading) return;
    setCobroOpen(true);
  };

  const textStyles = hideTextOnMobile ? css({
    display: "none",
    [`@media (min-width: ${BREAKPOINTS.sm}px)`]: {
      display: "inline",
    }
  }) : undefined;

  let content: React.ReactNode;
  let activeColor: string;
  let tooltipText: string;

  if (loading) {
    activeColor = COLOR.TEXT.SECONDARY;
    tooltipText = "Actualizando...";
    content = (
      <>
        <Loader2 size={badgeSize} color={COLOR.TEXT.SECONDARY} className="animate-spin" />
        <span css={textStyles}>Actualizando...</span>
      </>
    );
  } else {
    switch (effectiveEstado) {
      case "PAGADO":
        activeColor = COLOR.SEMANTIC.SUCCESS;
        tooltipText = totalCobrado ? `Pagado total: ${formatArs(totalCobrado)}` : "Pagado";
        content = (
          <>
            <CheckCircle2 size={badgeSize} color={COLOR.SEMANTIC.SUCCESS} />
            <span css={textStyles}>Pagado</span>
          </>
        );
        break;

      case "PARCIAL":
        activeColor = "#d97706"; // Amber 600
        tooltipText = effectiveSaldoPendiente > 0
          ? `Saldo pendiente: ${formatArs(effectiveSaldoPendiente)} (Cobrado: ${formatArs(totalCobrado || 0)})`
          : "Pago parcial";
        content = (
          <>
            <AlertCircle size={badgeSize} color="#d97706" />
            <span css={textStyles}>
              {effectiveSaldoPendiente > 0
                ? `Pendiente: ${formatArs(effectiveSaldoPendiente, { maxDecimals: 0 })}`
                : "Pago parcial"}
            </span>
          </>
        );
        break;

      case "SOBREPAGO":
        activeColor = COLOR.ACCENT.PRIMARY;
        tooltipText = "Saldo a favor del cliente";
        content = (
          <>
            <Info size={badgeSize} color={COLOR.ACCENT.PRIMARY} />
            <span css={textStyles}>Saldo a favor</span>
          </>
        );
        break;

      case "PENDIENTE":
      default:
        activeColor = COLOR.SEMANTIC.DANGER;
        tooltipText = "Registrar cobro";
        content = (
          <>
            <XCircle size={badgeSize} color={COLOR.SEMANTIC.DANGER} />
            <span css={textStyles}>Pago pendiente</span>
          </>
        );
        break;
    }
  }

  const baseBg = "transparent";

  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: size === "sm" ? 6 : 8,
    whiteSpace: "nowrap",
    fontSize,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: baseBg,
    padding,
    height: size === "sm" ? 26 : 32,
    borderRadius: 8,
    border: `1px solid ${isHovered && isInteractive && !loading ? activeColor : COLOR.BORDER.SUBTLE}`,
    filter: isHovered && isInteractive && !loading ? "brightness(0.97)" : "none",
    cursor: isInteractive && !loading ? "pointer" : "default",
    transition: "all 0.18s ease-in-out",
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInteractive && !loading) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInteractive) {
      setIsHovered(false);
    }
  };

  if (isInteractive) {
    return (
      <>
        <button
          onClick={handleToggle}
          type="button"
          disabled={loading}
          data-isolate-hover="true"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseOver={(e) => e.stopPropagation()}
          onMouseOut={(e) => e.stopPropagation()}
          title={tooltipText}
          style={{
            ...style,
            color: COLOR.TEXT.PRIMARY,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {content}
        </button>
        {arregloId ? (
          <CobroArregloModal
            open={cobroOpen}
            arregloId={arregloId}
            onClose={() => setCobroOpen(false)}
            onPaid={(updated) => {
              onPagoUpdated?.(updated);
            }}
          />
        ) : null}
      </>
    );
  }

  return <span style={style}>{content}</span>;
}

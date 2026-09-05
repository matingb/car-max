"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  Check,
  Copy,
  DollarSign,
  Eye,
  Gauge,
  List,
  Pencil,
  PenTool,
  RotateCcw,
  Send,
  Tag,
  User,
  X,
} from "lucide-react";
import Modal from "@/app/components/ui/Modal";
import {
  useArregloWhatsAppModal,
  type WhatsAppContentConfig,
} from "./hooks/useArregloWhatsAppModal";
import { styles } from "./ArregloWhatsAppModal.styles";
import { renderWhatsAppFormattedText } from "./whatsappFormat";
import type { ArregloDetalleData } from "@/app/api/arreglos/[id]/route";
import { COLOR } from "@/theme/theme";

type Props = {
  open: boolean;
  onClose: () => void;
  data: ArregloDetalleData | null;
  initialPhone?: string | null;
  clienteNombre?: string | null;
};

interface ToggleItemDef {
  key: keyof WhatsAppContentConfig;
  title: string;
  description: string;
  icon: React.ReactNode;
  disabled?: (config: WhatsAppContentConfig) => boolean;
}

interface IconToggleProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function IconToggle({
  icon,
  title,
  description,
  active,
  disabled = false,
  onClick,
}: IconToggleProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="checkbox"
      aria-checked={active}
      aria-disabled={disabled}
      aria-label={title}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onClick();
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.itemRow,
        ...(active ? styles.itemRowActive : styles.itemRowInactive),
        ...(hovered && !active && !disabled ? { background: COLOR.BACKGROUND.PRIMARY } : {}),
        ...(disabled ? { opacity: 0.4, cursor: "not-allowed", pointerEvents: "none" } : {}),
      }}
    >
      <div
        style={{
          ...styles.itemIconPill,
          ...(active ? styles.itemIconPillActive : styles.itemIconPillInactive),
        }}
      >
        {icon}
      </div>
      <div style={styles.itemTextCol}>
        <span
          style={{
            ...styles.itemTitle,
            color: active ? "#004b5c" : COLOR.TEXT.PRIMARY,
          }}
        >
          {title}
        </span>
        <span style={styles.itemDescription}>{description}</span>
      </div>
      <div
        style={{
          ...styles.checkboxBox,
          ...(active ? styles.checkboxBoxActive : styles.checkboxBoxInactive),
        }}
      >
        {active && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </div>
  );
}

export default function ArregloWhatsAppModal({
  open,
  onClose,
  data,
  initialPhone,
  clienteNombre: initialClienteNombre,
}: Props) {
  const {
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
    loadingCliente,
    handleSubmit,
  } = useArregloWhatsAppModal({
    open,
    onClose,
    data,
    initialPhone,
    clienteNombre: initialClienteNombre,
  });

  const [previewMode, setPreviewMode] = useState<"formatted" | "edit">("formatted");
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);

  const [currentTime, setCurrentTime] = useState("12:00");
  useEffect(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setCurrentTime(`${hours}:${minutes}`);
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (previewMode === "edit" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [previewMode]);

  const toggleItems = useMemo<ToggleItemDef[]>(() => {
    const items: ToggleItemDef[] = [
      {
        key: "mostrarDetalleItems",
        title: "Detalle de trabajos",
        description: "Lista completa de repuestos y servicios",
        icon: <List size={18} />,
      },
      {
        key: "mostrarPreciosItems",
        title: "Precios unitarios",
        description: "Valor individual por cada ítem",
        icon: <Tag size={18} />,
        disabled: (c) => !c.mostrarDetalleItems,
      },
      {
        key: "mostrarSubtotales",
        title: "Subtotales",
        description: "Suma parcial por categorías",
        icon: <Calculator size={18} />,
      },
      {
        key: "mostrarTotal",
        title: "Total general",
        description: "Importe final presupuestado",
        icon: <DollarSign size={18} />,
      },
    ];

    if (data?.arreglo?.kilometraje_leido) {
      items.push({
        key: "incluirKm",
        title: "Kilometraje",
        description: "Kilometraje actual del vehículo",
        icon: <Gauge size={18} />,
      });
    }

    if (data?.arreglo?.observaciones) {
      items.push({
        key: "incluirObservaciones",
        title: "Observaciones",
        description: "Notas técnicas del arreglo",
        icon: <PenTool size={18} />,
      });
    }

    return items;
  }, [data?.arreglo?.kilometraje_leido, data?.arreglo?.observaciones]);

  return (
    <Modal
      open={open}
      title="Compartir por WhatsApp"
      onClose={onClose}
      onSubmit={handleSubmit}
      hideHeader
      hideFooter
      modalStyle={styles.modalOverride}
    >
      <div className="flex flex-col md:flex-row h-auto md:h-[580px]" style={styles.modalWrapper}>
        <div className="w-full md:w-[380px] shrink-0 h-auto md:h-full" style={styles.settingsColumn}>
          <div style={styles.headerRow}>
            <h2 style={styles.headerTitle}>Compartir</h2>
            <div style={styles.headerRightActions}>
              <button
                type="button"
                onClick={onClose}
                style={styles.closeIconButton}
                title="Cerrar modal"
                aria-label="Cerrar modal"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Contact Section: Info Cliente (no editable) + Input WhatsApp */}
          <div style={styles.contactSection}>
            <div style={styles.clientSection}>
              <span id="modal-cliente-label" style={styles.fieldLabel}>
                Cliente
              </span>
              <div style={styles.clientCard}>
                <div style={styles.clientAvatarWrap}>
                  <User size={15} color={COLOR.ACCENT.PRIMARY} />
                </div>
                <span
                  id="modal-cliente-nombre"
                  data-testid="modal-cliente-nombre"
                  aria-labelledby="modal-cliente-label"
                  style={
                    clienteNombre.trim()
                      ? styles.clientName
                      : styles.clientNameEmpty
                  }
                  title={clienteNombre.trim() || undefined}
                >
                  {loadingCliente
                    ? "Cargando..."
                    : clienteNombre.trim() || "Sin cliente"}
                </span>
              </div>
            </div>

            <div style={styles.contactField}>
              <label htmlFor="modal-cliente-telefono" style={styles.fieldLabel}>
                WhatsApp
              </label>
              <input
                id="modal-cliente-telefono"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono"
                style={styles.contactInput}
              />
            </div>
          </div>

          <div style={styles.sectionContainer}>
            <label style={styles.sectionTitle}>Elementos a incluir</label>
            <div style={styles.itemsList}>
              {toggleItems.map((item) => (
                <IconToggle
                  key={item.key}
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                  active={config[item.key]}
                  disabled={item.disabled?.(config)}
                  onClick={() => updateConfig(item.key, !config[item.key])}
                />
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div style={{ marginTop: "auto" }}>
            <button
              type="button"
              onClick={handleSubmit}
              onMouseEnter={() => setIsSubmitHovered(true)}
              onMouseLeave={() => setIsSubmitHovered(false)}
              style={{
                ...styles.submitButton,
                ...(isSubmitHovered ? styles.submitButtonHover : {}),
              }}
            >
              <Send size={16} color={COLOR.TEXT.CONTRAST} />
              <span>Abrir chat de WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Columna Derecha: Live Mockup de WhatsApp o Editor */}
        <div className="w-full md:w-[400px] shrink-0 h-auto md:h-full" style={styles.previewColumn}>
          {/* Subtle background pattern */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at 2px 2px, rgba(0,0,0,0.06) 1px, transparent 0)",
              backgroundSize: "20px 20px",
            }}
          />

          {/* Header Row with Title and Mode Switch */}
          <div style={styles.previewHeaderRow}>
            <h3 style={styles.previewColumnHeader}>
              {previewMode === "formatted"
                ? "Previsualización del mensaje"
                : "Edición manual del mensaje"}
            </h3>
            <div style={styles.modeSwitchGroup}>
              <button
                type="button"
                onClick={() => setPreviewMode("formatted")}
                style={{
                  ...styles.modeSwitchBtn,
                  ...(previewMode === "formatted" ? styles.modeSwitchBtnActive : {}),
                }}
                title="Ver con formato en el celular (negrita y cursiva)"
              >
                <Eye size={12} />
                <span>Formato</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("edit")}
                style={{
                  ...styles.modeSwitchBtn,
                  ...(previewMode === "edit" ? styles.modeSwitchBtnActive : {}),
                }}
                title="Editar texto libremente en caja amplia"
              >
                <Pencil size={12} />
                <span>Editar</span>
              </button>
            </div>
          </div>

          {previewMode === "formatted" ? (
            /* Smartphone Frame (formato compacto y estilizado: 340px) */
            <div style={styles.phoneFrame}>
              {/* Top Notch */}
              <div style={styles.notch} />

              {/* Screen */}
              <div style={styles.phoneScreen}>
                {/* WhatsApp Header */}
                <div style={styles.whatsappHeader}>
                  <div style={styles.whatsappAvatar}>
                    <User size={18} />
                  </div>
                  <div style={styles.whatsappHeaderInfo}>
                    <span style={styles.whatsappContactName}>
                      {clienteNombre.trim() || "Cliente"}
                    </span>
                    <span style={styles.whatsappStatus}>en línea</span>
                  </div>
                </div>

                {/* Chat Area with Message Bubble */}
                <div style={styles.chatArea}>
                  <div style={styles.bubble}>
                    <div
                      style={styles.bubbleFormattedContainer}
                      onClick={() => setPreviewMode("edit")}
                      title="Hacé clic para editar el texto a mano"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setPreviewMode("edit");
                        }
                      }}
                    >
                      <div style={styles.bubbleFormattedContent}>
                        {renderWhatsAppFormattedText(mensaje)}
                      </div>
                    </div>

                    <div style={styles.bubbleFooter}>
                      <span style={styles.bubbleTime}>{currentTime}</span>
                      <span style={styles.doubleCheck}>✓✓</span>
                    </div>
                  </div>

                  {isCustomized && (
                    <div style={styles.editedHint}>
                      ✏️ Editado a mano
                    </div>
                  )}
                </div>
              </div>

              {/* Hidden textarea when in formatted mode for accessibility and tests */}
              <textarea
                value={mensaje}
                onChange={(e) => handleCustomTextChange(e.target.value)}
                placeholder="El mensaje de WhatsApp aparecerá aquí..."
                aria-label="Mensaje de WhatsApp"
                style={{ display: "none" }}
                tabIndex={-1}
                aria-hidden="true"
              />

              {/* Actions Group: Restablecer + Copiar */}
              <div style={styles.floatingActionsGroup}>
                {isCustomized && (
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      ...styles.actionButtonPill,
                      ...styles.resetActionButton,
                    }}
                    title="Restablecer texto original"
                    aria-label="Restablecer texto"
                  >
                    <RotateCcw size={12} />
                    <span>Restablecer</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    ...styles.actionButtonPill,
                    ...(copied ? styles.copyFloatingButtonCopied : {}),
                  }}
                  title="Copiar texto al portapapeles"
                  aria-label="Copiar texto al portapapeles"
                >
                  {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                  <span>{copied ? "¡Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Wide Edit Card (caja de edición: 420px) */
            <div style={styles.wideEditCard}>
              <div style={styles.wideEditHeader}>
                <div style={styles.wideEditRecipientBadge}>
                  <User size={15} color={COLOR.ACCENT.PRIMARY} />
                  <span>Para: {clienteNombre.trim() || "Cliente"}</span>
                </div>
                <div style={styles.wideEditTip}>
                  Usá <strong>*negrita*</strong> y <em>_cursiva_</em>
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={mensaje}
                onChange={(e) => handleCustomTextChange(e.target.value)}
                style={styles.wideEditTextarea}
                placeholder="El mensaje de WhatsApp aparecerá aquí..."
                aria-label="Mensaje de WhatsApp"
                autoFocus
              />

              <div style={styles.wideEditFooter}>
                {isCustomized ? (
                  <span style={styles.wideEditHint}>
                    ✏️ Editado a mano
                  </span>
                ) : (
                  <span />
                )}

                <div style={styles.wideEditActionsGroup}>
                  {isCustomized && (
                    <button
                      type="button"
                      onClick={handleReset}
                      style={{
                        ...styles.actionButtonPill,
                        ...styles.resetActionButton,
                        boxShadow: "none",
                      }}
                      title="Restablecer texto original"
                      aria-label="Restablecer texto"
                    >
                      <RotateCcw size={12} />
                      <span>Restablecer</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      ...styles.actionButtonPill,
                      boxShadow: "none",
                      ...(copied ? styles.copyFloatingButtonCopied : {}),
                    }}
                    title="Copiar texto al portapapeles"
                    aria-label="Copiar texto al portapapeles"
                  >
                    {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                    <span>{copied ? "¡Copiado!" : "Copiar"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

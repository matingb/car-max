"use client";

import React, { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import Card from "./Card";
import Button from "./Button";
import { COLOR } from "@/theme/theme";


type Props = {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit?: (e: React.FormEvent) => void | Promise<void>;
  submitText?: string;
  submitting?: boolean;
  disabledSubmit?: boolean;
  modalStyle?: React.CSSProperties;
  modalError?: { titulo: string; descripcion?: React.ReactNode } | null;
  hideHeader?: boolean;
  hideFooter?: boolean;
};

export default function Modal({
  open,
  title,
  children,
  onClose,
  onSubmit,
  submitText = "Guardar",
  submitting = false,
  disabledSubmit = false,
  modalStyle,
  modalError,
  hideHeader = false,
  hideFooter = false,
}: Props) {
  const titleId = useId();
  const restoreScrollRef = useRef<null | (() => void)>(null);
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSubmit) {
      await onSubmit(e);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (submitting) return;
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      restoreScrollRef.current?.();
      restoreScrollRef.current = null;
      return;
    }

    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    const prevBody = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    const prevHtmlOverflow = html.style.overflow;

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";

    restoreScrollRef.current = () => {
      body.style.position = prevBody.position;
      body.style.top = prevBody.top;
      body.style.left = prevBody.left;
      body.style.right = prevBody.right;
      body.style.width = prevBody.width;
      body.style.overflow = prevBody.overflow;
      html.style.overflow = prevHtmlOverflow;
      window.scrollTo(0, scrollY);
    };

    return () => {
      restoreScrollRef.current?.();
      restoreScrollRef.current = null;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const isSubmitDisabled = disabledSubmit || submitting;

  const modalContent = (
    <div
      style={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="modal-overlay"
      onClick={handleOverlayClick}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <Card style={{ ...styles.modal, ...modalStyle }}>
          {!hideHeader && title ? (
            <div style={styles.headerRow}>
              <h2 id={titleId} style={styles.title} data-testid="modal-title">
                {title}
              </h2>
            </div>
          ) : null}

          <form onSubmit={handleFormSubmit}>
            {children}
            {modalError ? (
              <div style={styles.errorBox} role="alert" aria-live="polite" data-testid="modal-error">
                <div style={styles.errorTitle}>{modalError.titulo}</div>
                {modalError.descripcion ? (
                  <div style={styles.errorText}>{modalError.descripcion}</div>
                ) : null}
              </div>
            ) : null}
            {!hideFooter ? (
              <div style={styles.footer}>
                <button
                  type="button"
                  style={styles.cancel}
                  onClick={onClose}
                  disabled={submitting}
                  data-testid="modal-cancel"
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  text={submitting ? "Guardando..." : submitText}
                  disabled={isSubmitDisabled}
                  dataTestId="modal-submit"
                  hideTextOnMobile={false}
                />
              </div>
            ) : null}
          </form>
        </Card>
    </div>
  );

  return createPortal(modalContent, document.body);
}

const styles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    overflowY: "auto" as const,
    overscrollBehavior: "contain" as const,
  },
  modal: {
    width: "min(640px, 92vw)",
    maxHeight: "90dvh",
    WebkitOverflowScrolling: "touch" as const,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    margin: 0,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  cancel: {
    background: "transparent",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    padding: "0.5rem 1rem",
    borderRadius: 8,
    cursor: "pointer",
  },
  errorBox: {
    background: COLOR.BACKGROUND.DANGER_TINT,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "12px 14px",
    marginBottom: 10,
    marginTop: 10,
    color: COLOR.ICON.DANGER,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  },
} as const;



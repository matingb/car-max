"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, CheckCircle2, FileCheck, X, AlertCircle } from "lucide-react";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";

const MAX_FILE_SIZE_BYTES = 64 * 1024; // 64 KiB

interface CertificadoUploaderProps {
  label: string;
  accept: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingFileName?: string | null;
  required?: boolean;
  disabled?: boolean;
  helpText?: string;
  id?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

export default function CertificadoUploader({
  label,
  accept,
  file,
  onFileChange,
  existingFileName,
  required = false,
  disabled = false,
  helpText,
  id,
}: CertificadoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const processFile = (selectedFile: File | null) => {
    setSizeError(null);
    if (!selectedFile) {
      onFileChange(null);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setSizeError(
        `El archivo supera el límite de 64 KiB (${formatFileSize(selectedFile.size)}).`
      );
      return;
    }

    onFileChange(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileChange(null);
    setSizeError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <div style={styles.container}>
      <div style={styles.labelRow}>
        <span style={styles.label}>
          {label}
          {required && <span style={styles.required}> *</span>}
        </span>
        {existingFileName && !file && (
          <span style={styles.configuredBadge}>Configurado</span>
        )}
      </div>

      <div
        onClick={openPicker}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          ...styles.dropZone,
          borderColor: isDragOver
            ? COLOR.ACCENT.PRIMARY
            : sizeError
            ? COLOR.SEMANTIC.DANGER
            : file
            ? COLOR.SEMANTIC.SUCCESS
            : COLOR.BORDER.SUBTLE,
          backgroundColor: isDragOver
            ? COLOR.BACKGROUND.PRIMARY
            : COLOR.BACKGROUND.SUBTLE,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
        role="button"
        tabIndex={0}
        aria-label={label}
      >
        <input
          id={id}
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={handleInputChange}
          style={styles.hiddenInput}
        />

        {file ? (
          <div style={styles.content}>
            <CheckCircle2 size={30} color={COLOR.SEMANTIC.SUCCESS} />
            <div style={styles.fileInfo}>
              <span style={styles.fileName} title={file.name}>
                {file.name}
              </span>
              <span style={styles.fileSubtext}>
                {formatFileSize(file.size)} • Listo para guardar
              </span>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                style={styles.removeButton}
                title="Quitar archivo"
                aria-label="Quitar archivo"
              >
                <X size={16} color={COLOR.TEXT.SECONDARY} />
              </button>
            )}
          </div>
        ) : existingFileName ? (
          <div style={styles.content}>
            <FileCheck size={30} color={COLOR.ACCENT.PRIMARY} />
            <div style={styles.fileInfo}>
              <span style={styles.fileName} title={existingFileName}>
                {existingFileName}
              </span>
              <span style={styles.fileSubtext}>
                Click o arrastrá para reemplazar ({accept})
              </span>
            </div>
          </div>
        ) : (
          <div style={styles.emptyContent}>
            <UploadCloud size={30} color={isDragOver ? COLOR.ACCENT.PRIMARY : COLOR.TEXT.SECONDARY} />
            <span style={styles.uploadPrompt}>
              Seleccionar o arrastrar archivo
            </span>
            <span style={styles.acceptedFormats}>({accept})</span>
          </div>
        )}
      </div>

      {sizeError && (
        <div style={styles.errorRow}>
          <AlertCircle size={14} color={COLOR.SEMANTIC.DANGER} />
          <span style={styles.errorText}>{sizeError}</span>
        </div>
      )}

      {helpText && !sizeError && (
        <span style={styles.helpText}>{helpText}</span>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    width: "100%",
  },
  labelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
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
  configuredBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: COLOR.ACCENT.PRIMARY,
    background: `${COLOR.ACCENT.PRIMARY}18`,
    padding: "2px 8px",
    borderRadius: 12,
  },
  dropZone: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 116,
    padding: "16px 20px",
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "dashed" as const,
    transition: "border-color 0.2s, background-color 0.2s",
    position: "relative" as const,
  },
  hiddenInput: {
    display: "none",
  },
  content: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  emptyContent: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    textAlign: "center" as const,
  },
  fileInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontSize: 14,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  fileSubtext: {
    fontSize: 12,
    color: COLOR.TEXT.TERTIARY,
  },
  uploadPrompt: {
    fontSize: 13,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
  },
  acceptedFormats: {
    fontSize: 12,
    color: COLOR.TEXT.TERTIARY,
  },
  removeButton: {
    background: "transparent",
    border: "none",
    padding: 6,
    borderRadius: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  errorRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    color: COLOR.SEMANTIC.DANGER,
  },
  helpText: {
    fontSize: 12,
    color: COLOR.TEXT.TERTIARY,
  },
} as const;

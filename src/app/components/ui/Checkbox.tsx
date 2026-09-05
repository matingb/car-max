"use client";

import React from "react";
import { COLOR } from "@/theme/theme";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export default function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  id,
  className,
}: Props) {
  return (
    <label
      htmlFor={id}
      className={className}
      style={{
        ...styles.container,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={styles.input}
      />
      <span style={styles.label}>{label}</span>
    </label>
  );
}

const styles = {
  container: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    userSelect: "none" as const,
  },
  input: {
    width: 16,
    height: 16,
    accentColor: COLOR.ACCENT.PRIMARY,
    cursor: "inherit",
    margin: 0,
    flexShrink: 0,
  },
  label: {
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    lineHeight: 1.2,
  },
} as const;

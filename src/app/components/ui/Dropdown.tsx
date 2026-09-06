import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { COLOR } from "@/theme/theme";
import { ChevronDown } from "lucide-react";

export interface DropdownOption {
    value: string;
    label: string;
  }

  interface DropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    style?: React.CSSProperties;
    dataTestId?: string;
    disabled?: boolean;
    id?: string;
  }

export default function Dropdown({
    options,
    value,
    onChange,
    style,
    dataTestId,
    disabled = false,
    id,
}: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                !dropdownRef.current?.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setHighlightedIndex(-1);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const updatePosition = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight || 0;
            const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 8);
            const spaceAbove = Math.max(0, rect.top - 8);
            const placeAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
            const maxHeight = Math.max(140, placeAbove ? spaceAbove : spaceBelow);

            setDropdownStyle(
                placeAbove
                    ? { position: "fixed", bottom: viewportHeight - rect.top + 4, left: rect.left, width: rect.width, maxHeight, zIndex: 2000 }
                    : { position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight, zIndex: 2000 }
            );
        };

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setIsOpen(true);
                setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                break;
            case "Enter":
            case " ":
                e.preventDefault();
                if (isOpen && highlightedIndex >= 0 && options[highlightedIndex]) {
                    handleSelect(options[highlightedIndex]);
                } else {
                    setIsOpen((prev) => !prev);
                }
                break;
            case "Escape":
                setIsOpen(false);
                setHighlightedIndex(-1);
                break;
        }
    };

    const handleSelect = (option: DropdownOption) => {
        onChange(option.value);
        setIsOpen(false);
        setHighlightedIndex(-1);
    };

    return (
        <div ref={containerRef} style={{ ...styles.container, ...style }}>
            <button
                id={id}
                type="button"
                role="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-disabled={disabled}
                disabled={disabled}
                tabIndex={disabled ? -1 : 0}
                style={{
                    ...styles.trigger,
                    ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : {}),
                    ...style,
                }}
                onClick={() => {
                    if (disabled) return;
                    setIsOpen((prev) => !prev);
                }}
                onKeyDown={(e) => {
                    if (disabled) return;
                    handleKeyDown(e);
                }}
                data-testid={dataTestId}
            >
                <span style={styles.label}>{options.find((option: DropdownOption) => option.value === value)?.label}</span>
                <ChevronDown
                    size={16}
                    color={COLOR.TEXT.SECONDARY}
                    style={{
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                        flexShrink: 0,
                    }}
                />
            </button>

            {isOpen
                ? createPortal(
                    <div ref={dropdownRef} role="listbox" style={{ ...styles.dropdown, ...(dropdownStyle ?? {}) }}>
                        <div style={styles.optionsList}>
                            {options.map((option: DropdownOption, index: number) => (
                                <div
                                    key={option.value}
                                    role="option"
                                    aria-selected={value === option.value}
                                    style={{
                                        ...styles.option,
                                        ...(highlightedIndex === index ? styles.optionHighlighted : {}),
                                        ...(value === option.value ? styles.optionSelected : {}),
                                    }}
                                    onClick={() => handleSelect(option)}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    data-testid={dataTestId ? `${dataTestId}-option-${option.value}` : undefined}
                                >
                                    <span style={styles.optionLabel}>{option.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>,
                    document.body
                )
                : null}
        </div>
    );
}

const styles = {
    container: {
        position: "relative" as const,
        width: "150px",
    },
    trigger: {
        width: "100%",
        padding: "6px 10px",
        borderRadius: 8,
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
        fontSize: 12,
        fontWeight: 500,
        color: COLOR.TEXT.SECONDARY,
        outline: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        boxSizing: "border-box" as const,
        userSelect: "none" as const,
    },
    dropdown: {
        position: "fixed" as const,
        backgroundColor: COLOR.BACKGROUND.SECONDARY,
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        zIndex: 2000,
        maxHeight: 300,
        overflow: "hidden",
    },
    optionsList: {
        maxHeight: 300,
        overflowY: "auto" as const,
    },
    option: {
        padding: "8px 12px",
        cursor: "pointer",
        transition: "background 0.15s",
        borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    },
    optionHighlighted: {
        backgroundColor: COLOR.BACKGROUND.PRIMARY,
    },
    optionSelected: {
        backgroundColor: COLOR.BACKGROUND.SUBTLE,
    },
    label: {
        fontSize: 13,
        color: COLOR.TEXT.PRIMARY,
        fontWeight: 500,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap" as const,
    },
    optionLabel: {
        fontSize: 13,
        color: COLOR.TEXT.PRIMARY,
        fontWeight: 500,
    },
}
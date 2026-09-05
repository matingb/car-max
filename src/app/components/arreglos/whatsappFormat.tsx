import React from "react";

/**
 * Formatea un texto con sintaxis de WhatsApp para previsualización web:
 * - *negrita* -> <strong>negrita</strong>
 * - _cursiva_ -> <em>cursiva</em>
 * - ~tachado~ -> <del>tachado</del>
 * - `monoespaciado` -> <code>monoespaciado</code>
 * Respeta saltos de línea y emojis.
 */
export function renderWhatsAppFormattedText(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");

  return lines.map((line, lineIdx) => {
    if (!line) {
      return <div key={lineIdx} style={{ height: "0.8em" }} />;
    }

    // Separa tokens por *...*, _..._, ~...~, `...`
    const tokenRegex = /(\*[^*]+?\*|_[^_]+?_|~[^~]+?~|`[^`]+?`)/g;
    const parts = line.split(tokenRegex);

    const formattedParts = parts.map((part, partIdx) => {
      if (!part) return null;

      // *negrita*
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        const inner = part.slice(1, -1);
        if (inner.startsWith("_") && inner.endsWith("_") && inner.length > 2) {
          return (
            <strong key={partIdx} style={{ fontWeight: 700 }}>
              <em style={{ fontStyle: "italic" }}>{inner.slice(1, -1)}</em>
            </strong>
          );
        }
        return (
          <strong key={partIdx} style={{ fontWeight: 700 }}>
            {inner}
          </strong>
        );
      }

      // _cursiva_
      if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
        const inner = part.slice(1, -1);
        if (inner.startsWith("*") && inner.endsWith("*") && inner.length > 2) {
          return (
            <em key={partIdx} style={{ fontStyle: "italic" }}>
              <strong style={{ fontWeight: 700 }}>{inner.slice(1, -1)}</strong>
            </em>
          );
        }
        return (
          <em key={partIdx} style={{ fontStyle: "italic" }}>
            {inner}
          </em>
        );
      }

      // ~tachado~
      if (part.startsWith("~") && part.endsWith("~") && part.length > 2) {
        return (
          <del key={partIdx} style={{ textDecoration: "line-through" }}>
            {part.slice(1, -1)}
          </del>
        );
      }

      // `código`
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code
            key={partIdx}
            style={{
              fontFamily: "monospace",
              background: "rgba(0,0,0,0.06)",
              padding: "1px 4px",
              borderRadius: 3,
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      return <span key={partIdx}>{part}</span>;
    });

    return (
      <div key={lineIdx} style={{ minHeight: "1.25em" }}>
        {formattedParts}
      </div>
    );
  });
}

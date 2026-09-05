import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWhatsAppFormattedText } from "./whatsappFormat";

describe("renderWhatsAppFormattedText", () => {
  it("renderiza negrita con asteriscos (*texto*)", () => {
    const { container } = render(<div>{renderWhatsAppFormattedText("*Presupuesto de Arreglo*")}</div>);
    const strongEl = container.querySelector("strong");
    expect(strongEl).not.toBeNull();
    expect(strongEl?.textContent).toBe("Presupuesto de Arreglo");
  });

  it("renderiza cursiva con guiones bajos (_texto_)", () => {
    const { container } = render(<div>{renderWhatsAppFormattedText("_Subtotal repuestos: $16.000_")}</div>);
    const emEl = container.querySelector("em");
    expect(emEl).not.toBeNull();
    expect(emEl?.textContent).toBe("Subtotal repuestos: $16.000");
  });

  it("renderiza texto mixto con emojis, negrita, cursiva y texto plano", () => {
    const text = [
      "*Presupuesto de Arreglo - B2Car*",
      "🚗 Patente ABC123",
      "📦 *Repuestos:*",
      "• Pastillas de freno x2 - $16.000",
      "_Subtotal repuestos: $16.000_",
      "💰 *Total general: $28.000*",
    ].join("\n");

    const { container } = render(<div>{renderWhatsAppFormattedText(text)}</div>);
    const strongs = container.querySelectorAll("strong");
    const ems = container.querySelectorAll("em");

    expect(strongs.length).toBe(3);
    expect(strongs[0].textContent).toBe("Presupuesto de Arreglo - B2Car");
    expect(strongs[1].textContent).toBe("Repuestos:");
    expect(strongs[2].textContent).toBe("Total general: $28.000");

    expect(ems.length).toBe(1);
    expect(ems[0].textContent).toBe("Subtotal repuestos: $16.000");

    expect(screen.getByText("🚗 Patente ABC123")).toBeInTheDocument();
    expect(screen.getByText("• Pastillas de freno x2 - $16.000")).toBeInTheDocument();
  });

  it("renderiza tachado (~texto~) y código (`texto`)", () => {
    const { container } = render(<div>{renderWhatsAppFormattedText("~descuento viejo~ y `codigo123`")}</div>);
    const delEl = container.querySelector("del");
    const codeEl = container.querySelector("code");

    expect(delEl?.textContent).toBe("descuento viejo");
    expect(codeEl?.textContent).toBe("codigo123");
  });

  it("retorna null si el texto está vacío", () => {
    const { container } = render(<div>{renderWhatsAppFormattedText("")}</div>);
    expect(container.firstChild?.textContent).toBe("");
  });
});

import { formatArs } from "@/lib/format";
import type { ArregloDetalleData, AsignacionArregloLinea } from "@/app/api/arreglos/[id]/route";
import type { Turno } from "@/model/types";
import { formatPatenteConMarcaYModelo } from "@/lib/vehiculos";
import { safeNumber } from "@/lib/numbers";

export interface ArregloWhatsappOptions {
	tenantName?: string;
	mostrarDetalleItems?: boolean;
	mostrarPreciosItems?: boolean;
	mostrarSubtotales?: boolean;
	mostrarTotal?: boolean;
	incluirKm?: boolean;
	incluirObservaciones?: boolean;
}

export function buildArregloWhatsappMessage(
	data: ArregloDetalleData,
	tenantNameOrOptions?: string | ArregloWhatsappOptions
): string {
	if (!data?.arreglo) return "";

	const options: ArregloWhatsappOptions =
		typeof tenantNameOrOptions === "string"
			? { tenantName: tenantNameOrOptions }
			: tenantNameOrOptions ?? {};

	const {
		tenantName,
		mostrarDetalleItems = true,
		mostrarPreciosItems = true,
		mostrarSubtotales = false,
		mostrarTotal = true,
		incluirKm = true,
		incluirObservaciones = true,
	} = options;

	const arreglo = data.arreglo;
	const detalles = Array.isArray(data.detalles) ? data.detalles : [];
	const repuestosLineas = flattenAsignacionesLineas(data);

	const isPagado =
		(arreglo.total_cobrado || 0) >= (arreglo.precio_final || 0) && (arreglo.precio_final || 0) > 0;

	const lines: string[] = [];

	// 1. Cabecera
	const esTecnico = !mostrarTotal && !mostrarPreciosItems && !mostrarSubtotales;
	lines.push(buildHeaderLine(isPagado, esTecnico, tenantName));

	// 2. Información del vehículo
	const vehiculoLines = buildVehiculoInfoLines(arreglo, { incluirKm, incluirObservaciones });
	lines.push(...vehiculoLines);
	lines.push("");

	// 3. Totales calculados
	const totals = calculateArregloTotals(detalles, repuestosLineas, arreglo.precio_final);

	// 4. Secciones
	if (mostrarDetalleItems) {
		// Repuestos
		if (repuestosLineas.length) {
			lines.push(
				...buildRepuestosSectionLines(
					repuestosLineas,
					mostrarPreciosItems,
					mostrarSubtotales,
					totals.subtotalRepuestos
				)
			);
			lines.push("");
		}

		// Servicios
		if (detalles.length) {
			lines.push(
				...buildServiciosSectionLines(
					detalles,
					mostrarPreciosItems,
					mostrarSubtotales,
					totals.subtotalServicios
				)
			);
			lines.push("");
		}
	} else if (mostrarSubtotales) {
		// Modo sin detalle pero con subtotales agrupados
		const montosLines = buildSoloMontosSectionLines(
			totals.subtotalRepuestos,
			totals.subtotalServicios,
			repuestosLineas.length > 0,
			detalles.length > 0
		);
		if (montosLines.length) {
			lines.push(...montosLines);
			lines.push("");
		}
	}

	// 5. Total final
	if (mostrarTotal) {
		lines.push(`*Total arreglo ${formatArs(totals.total, { maxDecimals: 0, minDecimals: 0 })}*`);
	} else {
		// Quitar línea vacía sobrante si terminó con espacio
		if (lines[lines.length - 1] === "") {
			lines.pop();
		}
	}

	return lines.join("\n");
}

function buildHeaderLine(
	isPagado: boolean,
	esTecnico: boolean,
	tenantName?: string
): string {
	const normalizedTenant = (tenantName ?? "").trim();
	const header = esTecnico
		? "Detalle de Arreglo"
		: isPagado
		? "Detalle de Arreglo"
		: "Presupuesto de Arreglo";
	return `*${header}${normalizedTenant ? ` - ${normalizedTenant}` : ""}*`;
}

function buildVehiculoInfoLines(
	arreglo: ArregloDetalleData["arreglo"],
	options: { incluirKm: boolean; incluirObservaciones: boolean }
): string[] {
	const lines: string[] = [];
	lines.push(`🚗 Patente ${arreglo.vehiculo?.patente || "-"}`);

	if (options.incluirKm && arreglo.kilometraje_leido) {
		lines.push(`⏱️ KM actual ${arreglo.kilometraje_leido}`);
	}

	if (options.incluirObservaciones && arreglo.observaciones) {
		lines.push(`📝 Observaciones: ${arreglo.observaciones}`);
	}

	return lines;
}

function calculateArregloTotals(
	detalles: ArregloDetalleData["detalles"],
	repuestosLineas: AsignacionArregloLinea[],
	precioFinal: number
): { subtotalServicios: number; subtotalRepuestos: number; total: number } {
	const subtotalServicios = (detalles ?? []).reduce(
		(acc, d) => acc + safeNumber(d.valor) * safeNumber(d.cantidad),
		0
	);
	const subtotalRepuestos = repuestosLineas.reduce(
		(acc, l) => acc + safeNumber(l.monto_unitario) * safeNumber(l.cantidad),
		0
	);
	const totalCalculado = subtotalServicios + subtotalRepuestos;
	const total = precioFinal > 0 ? precioFinal : totalCalculado;

	return { subtotalServicios, subtotalRepuestos, total };
}

function buildItemLine(label: string, cantidad: number, totalMonto?: number): string {
	const qty = cantidad ? ` x${cantidad}` : "";
	const price =
		totalMonto != null ? ` - ${formatArs(totalMonto, { maxDecimals: 0, minDecimals: 0 })}` : "";
	return `• ${label}${qty}${price}`;
}

function buildRepuestosSectionLines(
	repuestosLineas: AsignacionArregloLinea[],
	showItemPrices: boolean,
	showSubtotal: boolean,
	subtotal: number
): string[] {
	const lines: string[] = ["📦 *Repuestos:*"];
	repuestosLineas.forEach((r) => {
		const cantidad = safeNumber(r.cantidad);
		const monto = safeNumber(r.monto_unitario);
		const total = cantidad * monto;
		const producto = r.producto?.nombre || r.producto?.codigo || "Repuesto";
		lines.push(buildItemLine(producto, cantidad, showItemPrices ? total : undefined));
	});
	if (showSubtotal) {
		lines.push(`_Subtotal repuestos: ${formatArs(subtotal, { maxDecimals: 0, minDecimals: 0 })}_`);
	}
	return lines;
}

function buildServiciosSectionLines(
	detalles: NonNullable<ArregloDetalleData["detalles"]>,
	showItemPrices: boolean,
	showSubtotal: boolean,
	subtotal: number
): string[] {
	const lines: string[] = ["👨‍🔧 *Servicios:*"];
	detalles.forEach((d) => {
		const cantidad = safeNumber(d.cantidad);
		const valor = safeNumber(d.valor);
		const total = cantidad * valor;
		const label = String(d.descripcion ?? "").trim() || "Servicio";
		lines.push(buildItemLine(label, cantidad, showItemPrices ? total : undefined));
	});
	if (showSubtotal) {
		lines.push(`_Subtotal mano de obra: ${formatArs(subtotal, { maxDecimals: 0, minDecimals: 0 })}_`);
	}
	return lines;
}

function buildSoloMontosSectionLines(
	subtotalRepuestos: number,
	subtotalServicios: number,
	hasRepuestos: boolean,
	hasServicios: boolean
): string[] {
	const lines: string[] = ["💰 *Resumen:*"];
	if (hasRepuestos) {
		lines.push(
			`• Repuestos: ${formatArs(subtotalRepuestos, { maxDecimals: 0, minDecimals: 0 })}`
		);
	}
	if (hasServicios) {
		lines.push(
			`• Mano de obra: ${formatArs(subtotalServicios, { maxDecimals: 0, minDecimals: 0 })}`
		);
	}
	return lines;
}

export function buildTurnoWhatsappMessage(turno: Turno, tenantName?: string): string {
	const lines: string[] = [];
	const normalizedTenant = (tenantName ?? "").trim();

	lines.push(`*Detalle del turno${normalizedTenant ? ` - ${normalizedTenant}` : ""}*`);
	if (turno.cliente?.nombre) {
		lines.push(`👤 ${turno.cliente.nombre}`);
	}
	if (turno.vehiculo) {
		const vehiculoLabel = formatPatenteConMarcaYModelo(turno.vehiculo);
		lines.push(`🚗 ${vehiculoLabel}`);
	}
	lines.push("");
	lines.push(`📅 Fecha: ${turno.fecha}`);
	lines.push(`⏰ Hora: ${turno.hora} hs`);
	if (turno.duracion != null && turno.duracion > 0) {
		lines.push(`⏱️ Duración: ${turno.duracion} minutos`);
	}
	if (turno.descripcion) {
		lines.push("");
		lines.push(`📝 ${turno.descripcion}`);
	}
	if (turno.observaciones) {
		lines.push("");
		lines.push(`🗒️ Observaciones: ${turno.observaciones}`);
	}

	return lines.join("\n");
}

export function buildWhatsappLink(phone: string, message: string): string {
	const encodedMessage = encodeURIComponent(message);
	return `https://api.whatsapp.com/send/?phone=${phone}&text=${encodedMessage}&type=phone_number&app_absent=0`;
}

/**
 * Construye el número completo para WhatsApp a partir de los campos separados
 * del modelo de cliente. Equivalente a pasar el número normalizado a normalizeWhatsappPhone.
 */
export function assembleClientePhone(cliente: {
  codigo_pais?: string | null;
  telefono?: string | null;
}): string {
  return [cliente.codigo_pais, cliente.telefono]
    .map((s) => (s ?? "").replace(/\D/g, ""))
    .filter(Boolean)
    .join("");
}

export function normalizeWhatsappPhone(rawPhone: string): string | null {
	const cleaned = String(rawPhone ?? "").replace(/\D/g, "");
	if (!cleaned) return null;
	return cleaned;
}

function flattenAsignacionesLineas(
	data: ArregloDetalleData
): AsignacionArregloLinea[] {
	if (!Array.isArray(data.asignaciones)) return [];
	const out: AsignacionArregloLinea[] = [];
	for (const op of data.asignaciones) {
		if (!op || !Array.isArray(op.lineas)) continue;
		for (const l of op.lineas) {
			if (!l) continue;
			out.push(l);
		}
	}
	return out;
}

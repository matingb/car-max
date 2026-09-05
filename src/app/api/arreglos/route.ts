import { logger } from "@/lib/logger";
import { Arreglo, ESTADOS_ARREGLO, EstadoArreglo } from "@/model/types"
import { createClient } from "@/supabase/server"
import { IVA_RATE } from "@/lib/ivaRate";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "@/app/api/arreglos/arregloService";
import type { CreateArregloInsertPayload, CreateArregloRequest } from "./arregloRequests";
import type { NextRequest } from "next/server";
import { ServiceError } from "../serviceError";
import type { ArregloListFilters } from "./arregloRepository";
import { normalizePaginationLimit } from "@/lib/pagination";
import {
    buildTerminadoRequiredFieldsErrorMessage,
    findMissingRequiredCustomFormFields,
} from "@/lib/arreglosCustomFormRequired";
import { buildArregloDescripcion } from "@/lib/arreglos";
import { isValidUuid } from "@/lib/uuid";
import { toISODateTimeWithCurrentTime } from "@/lib/fechas";

export type GetArreglosResponse = {
    data: Arreglo[] | null;
    page: {
        hasMore: boolean;
    };
    error?: string | null;
};

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const query = req.nextUrl.searchParams;
    const toUndef = (value: string | null) => {
        const trimmed = String(value ?? "").trim();
        return trimmed ? trimmed : undefined;
    };

    const limit = normalizePaginationLimit(query.get("limit"));

    const filters: ArregloListFilters = {
        tallerId: toUndef(query.get("taller_id")),
        search: toUndef(query.get("search")),
        patente: toUndef(query.get("patente")),
        estado: toUndef(query.get("estado")),
        estadoPago: toUndef(query.get("estado_pago")),
        fechaDesde: toUndef(query.get("fecha_desde")),
        fechaHasta: toUndef(query.get("fecha_hasta")),
        limit,
    };

    const { data, error } = await arregloService.getArreglo(supabase, filters)
    if (error) {
        const status = error === ServiceError.NotFound ? 404 : 500;
        const message = status === 404 ? "Arreglos no encontrados" : "Error cargando arreglos";
        return Response.json({
            data: [],
            page: { hasMore: false },
            error: message
        }, { status })
    }

    logger.debug("GET /api/arreglos - data:", data, "error:", error);

    const arreglos: Arreglo[] = (data?.items ?? [])
    return Response.json({
        data: arreglos,
        page: {
            hasMore: data?.hasMore ?? false,
        },
    })
}

export type CreateArregloResponse = {
    data: Arreglo | null;
    error?: string | null;
};

// POST /api/arreglos -> crear arreglo
export async function POST(req: Request) {
    const supabase = await createClient();
    const body = await req.json().catch(() => null);
    if (!body) return Response.json({ error: "JSON inválido" }, { status: 400 });

    const {
        vehiculo_id,
        taller_id,
        estado,
        kilometraje_leido,
        fecha,
        observaciones,
        precio_final,
        esta_pago,
        cuenta_financiera_id,
        fecha_cobro,
        idempotency_key,
        extra_data,
        detalles,
        repuestos,
        repuestos_nuevos,
        detalle_formulario,
    } = body as CreateArregloRequest

    if (!vehiculo_id) return Response.json({ error: "Falta vehiculo_id" }, { status: 400 });
    if (!taller_id) return Response.json({ error: "Falta taller_id" }, { status: 400 });
    if (!fecha) return Response.json({ error: "Falta fecha" }, { status: 400 });

    const cuentaFinancieraId = typeof cuenta_financiera_id === "string" ? cuenta_financiera_id.trim() : "";
    const fechaCobro = typeof fecha_cobro === "string" ? fecha_cobro.trim() : "";
    const idempotencyKey = typeof idempotency_key === "string" ? idempotency_key.trim() : "";
    const estaPagoValue = typeof esta_pago === "boolean" ? esta_pago : false;
    if (estaPagoValue && !cuentaFinancieraId) {
        return Response.json({ error: "Seleccioná una cuenta financiera para registrar el cobro" }, { status: 400 });
    }
    if (cuentaFinancieraId && !isValidUuid(cuentaFinancieraId)) {
        return Response.json({ error: "cuenta_financiera_id inválida" }, { status: 400 });
    }
    if (fechaCobro && Number.isNaN(new Date(`${fechaCobro}T00:00:00.000Z`).getTime())) {
        return Response.json({ error: "fecha_cobro inválida" }, { status: 400 });
    }
    if ((estaPagoValue || cuentaFinancieraId) && !isValidUuid(idempotencyKey)) {
        return Response.json({ error: "idempotency_key inválida" }, { status: 400 });
    }

    const precioFinalNumber = Number(precio_final) || 0;
    const kmNumber = Number(kilometraje_leido) || 0;
    const estadoRaw = String(estado ?? "SIN_INICIAR").trim().toUpperCase();

    if (!(ESTADOS_ARREGLO as string[]).includes(estadoRaw)) {
        return Response.json({ error: "Estado de arreglo inválido" }, { status: 400 });
    }

    const estadoValue = estadoRaw as EstadoArreglo;

    if (estadoValue === "PRESUPUESTO" && estaPagoValue) {
        return Response.json({ error: "No se puede registrar como pago un arreglo en estado PRESUPUESTO" }, { status: 400 });
    }
    const detalleFormularioConfigId = detalle_formulario
        ? String(detalle_formulario.formulario_id ?? detalle_formulario.config_id ?? "").trim()
        : "";
    const detalleFormularioMetadata = Array.isArray(detalle_formulario?.metadata)
        ? detalle_formulario.metadata
        : [];
    const detallesArr = Array.isArray(detalles) ? detalles : [];
    const repuestosArr = Array.isArray(repuestos) ? repuestos : [];
    const repuestosNuevosArr = Array.isArray(repuestos_nuevos) ? repuestos_nuevos : [];
    const normalizedDetalles = detallesArr.map((d) => ({
        descripcion: String((d as { descripcion?: unknown }).descripcion ?? "").trim(),
        cantidad: Number((d as { cantidad?: unknown }).cantidad),
        valor: Number((d as { valor?: unknown }).valor),
        categoria_arreglo_id: (d as { categoria_arreglo_id?: unknown }).categoria_arreglo_id || null,
        empleado_id: (d as { empleado_id?: unknown }).empleado_id || null,
    }));

    for (const d of normalizedDetalles) {
        if (!d.descripcion) return Response.json({ error: "Falta descripción en servicios" }, { status: 400 });
        if (!Number.isFinite(d.cantidad) || d.cantidad <= 0) {
            return Response.json({ error: "Cantidad inválida en servicios" }, { status: 400 });
        }
        if (!Number.isFinite(d.valor) || d.valor < 0) {
            return Response.json({ error: "Valor inválido en servicios" }, { status: 400 });
        }
        if (d.categoria_arreglo_id != null && !isValidUuid(d.categoria_arreglo_id)) {
            return Response.json({ error: "categoria_arreglo_id inválido en servicios" }, { status: 400 });
        }
        if (d.empleado_id != null && !isValidUuid(d.empleado_id)) {
            return Response.json({ error: "empleado_id inválido en servicios" }, { status: 400 });
        }
    }

    if (estadoValue === "TERMINADO" && detalleFormularioConfigId) {
        const { data: formularioRow, error: formularioError } = await supabase
            .from("formularios")
            .select("metadata")
            .eq("id", detalleFormularioConfigId)
            .maybeSingle();

        if (formularioError) {
            return Response.json({ error: "Error cargando formulario custom" }, { status: 500 });
        }

        if (!formularioRow) {
            return Response.json({ error: "Formulario custom no encontrado" }, { status: 400 });
        }

        const missingFields = findMissingRequiredCustomFormFields({
            formMetadata: formularioRow.metadata,
            detalleMetadata: detalleFormularioMetadata,
        });

        if (missingFields.length > 0) {
            return Response.json(
                { error: buildTerminadoRequiredFieldsErrorMessage(missingFields) },
                { status: 400 }
            );
        }
    }

    const ivaRate = IVA_RATE
    const computedSinIva = Number((precioFinalNumber / (1 + ivaRate)).toFixed(2));

    const insertPayload: CreateArregloInsertPayload = {
        vehiculo_id,
        taller_id,
        estado: estadoValue,
        descripcion: buildArregloDescripcion({
            detalles: normalizedDetalles,
            detalleFormulario: detalleFormularioMetadata,
        }),
        kilometraje_leido: kmNumber,
        fecha,
        observaciones: observaciones ?? null,
        precio_final: precioFinalNumber,
        precio_sin_iva: computedSinIva,
        esta_pago: estaPagoValue,
        extra_data: extra_data ?? null,
    };

    // Opcional: crear líneas (servicios + repuestos) en el mismo POST.
    // Esto se usa principalmente desde el ArregloModal (crear).
    const normalizedRepuestos = repuestosArr.map((r) => ({
        stock_id: String((r as { stock_id?: unknown }).stock_id ?? "").trim(),
        cantidad: Number((r as { cantidad?: unknown }).cantidad),
        monto_unitario: Number((r as { monto_unitario?: unknown }).monto_unitario),
        precio_compra:
            (r as { precio_compra?: unknown }).precio_compra == null
                ? null
                : Number((r as { precio_compra?: unknown }).precio_compra),
        categoria_arreglo_id: (r as { categoria_arreglo_id?: unknown }).categoria_arreglo_id || null,
        empleado_id: (r as { empleado_id?: unknown }).empleado_id || null,
    }));

    const normalizedRepuestosNuevos = repuestosNuevosArr.map((r) => ({
        codigo: String((r as { codigo?: unknown }).codigo ?? "").trim(),
        nombre: String((r as { nombre?: unknown }).nombre ?? "").trim(),
        precio_compra: Number((r as { precio_compra?: unknown }).precio_compra),
        precio_venta: Number((r as { precio_venta?: unknown }).precio_venta),
        cantidad: Number((r as { cantidad?: unknown }).cantidad),
        categoria_arreglo_id: (r as { categoria_arreglo_id?: unknown }).categoria_arreglo_id || null,
        empleado_id: (r as { empleado_id?: unknown }).empleado_id || null,
    }));

    for (const r of normalizedRepuestos) {
        if (!r.stock_id) return Response.json({ error: "Falta stock_id en repuestos" }, { status: 400 });
        if (!Number.isFinite(r.cantidad) || r.cantidad <= 0) return Response.json({ error: "Cantidad invalida en repuestos" }, { status: 400 });
        if (!Number.isFinite(r.monto_unitario) || r.monto_unitario < 0) return Response.json({ error: "Monto unitario invalido en repuestos" }, { status: 400 });
        if (r.precio_compra != null && (!Number.isFinite(r.precio_compra) || r.precio_compra < 0)) {
            return Response.json({ error: "Precio de compra invalido en repuestos" }, { status: 400 });
        }
        if (r.categoria_arreglo_id != null && !isValidUuid(r.categoria_arreglo_id)) {
            return Response.json({ error: "categoria_arreglo_id invalido en repuestos" }, { status: 400 });
        }
        if (r.empleado_id != null && !isValidUuid(r.empleado_id)) {
            return Response.json({ error: "empleado_id invalido en repuestos" }, { status: 400 });
        }
    }

    const stockIdSet = new Set<string>();
    for (const r of normalizedRepuestos) {
        if (stockIdSet.has(r.stock_id)) {
            return Response.json({ error: "Repuestos duplicados (stock_id)" }, { status: 400 });
        }
        stockIdSet.add(r.stock_id);
    }

    const codigoSet = new Set<string>();
    for (const r of normalizedRepuestosNuevos) {
        const codigoKey = r.codigo.toLowerCase();
        if (!r.codigo) return Response.json({ error: "Falta codigo en producto nuevo" }, { status: 400 });
        if (!r.nombre) return Response.json({ error: "Falta nombre en producto nuevo" }, { status: 400 });
        if (!Number.isFinite(r.precio_compra) || r.precio_compra < 0) return Response.json({ error: "Precio de compra invalido" }, { status: 400 });
        if (!Number.isFinite(r.precio_venta) || r.precio_venta < 0) return Response.json({ error: "Precio de venta invalido" }, { status: 400 });
        if (!Number.isFinite(r.cantidad) || r.cantidad <= 0) return Response.json({ error: "Cantidad invalida en producto nuevo" }, { status: 400 });
        if (r.categoria_arreglo_id != null && !isValidUuid(r.categoria_arreglo_id)) {
            return Response.json({ error: "categoria_arreglo_id invalido en producto nuevo" }, { status: 400 });
        }
        if (r.empleado_id != null && !isValidUuid(r.empleado_id)) {
            return Response.json({ error: "empleado_id invalido en producto nuevo" }, { status: 400 });
        }
        if (codigoSet.has(codigoKey)) {
            return Response.json({ error: "Ya existe un producto con ese codigo. Seleccionalo desde el listado." }, { status: 409 });
        }
        codigoSet.add(codigoKey);
    }

    if (normalizedRepuestosNuevos.length > 0 && !cuentaFinancieraId) {
        return Response.json(
            { error: "Seleccioná una cuenta financiera para registrar la compra automática" },
            { status: 400 }
        );
    }

    if (detalle_formulario) {
        const costo = Number(detalle_formulario.costo);
        if (!Number.isFinite(costo) || costo < 0) {
            return Response.json({ error: "Costo invalido en detalle de formulario" }, { status: 400 });
        }
    }

    const rpcPayload = {
        p_vehiculo_id: insertPayload.vehiculo_id,
        p_taller_id: insertPayload.taller_id,
        p_estado: insertPayload.estado,
        p_descripcion: insertPayload.descripcion,
        p_kilometraje_leido: insertPayload.kilometraje_leido,
        p_fecha: toISODateTimeWithCurrentTime(insertPayload.fecha),
        p_observaciones: insertPayload.observaciones,
        p_precio_final: insertPayload.precio_final,
        p_precio_sin_iva: insertPayload.precio_sin_iva,
        p_esta_pago: insertPayload.esta_pago,
        p_extra_data: insertPayload.extra_data,
        p_detalles: normalizedDetalles,
        p_repuestos: normalizedRepuestos,
        p_repuestos_nuevos: normalizedRepuestosNuevos,
        p_detalle_formulario: detalle_formulario ?? null,
        p_cuenta_id: cuentaFinancieraId || null,
        p_fecha_cobro: fechaCobro ? toISODateTimeWithCurrentTime(fechaCobro) : null,
        p_idempotency_key: idempotencyKey || null,
    };

    logger.debug("Llamando a rpc_crear_arreglo_completo con payload:", JSON.stringify(rpcPayload, null, 2));

    const { data: arregloIdRpc, error: rpcError } = await supabase.rpc("rpc_crear_arreglo_completo", rpcPayload);

    if (rpcError || !arregloIdRpc) {
        logger.error("RPC Error in rpc_crear_arreglo_completo:", rpcError);
        const raw = String(rpcError?.message ?? "");
        const isStock = raw.includes("STOCK_INSUFICIENTE");
        const isDuplicate = raw.includes("PRODUCTO_CODIGO_DUPLICADO") || raw.includes("uq_productos_tenant_codigo");
        const requiereCuenta = raw.includes("cuenta_id requerido") || raw.includes("CUENTA_FINANCIERA_REQUERIDA");
        const status = isStock ? 409 : isDuplicate ? 409 : requiereCuenta ? 400 : 500;
        const message = isStock
            ? "Stock insuficiente"
            : isDuplicate
                ? "Ya existe un producto con ese codigo. Seleccionalo desde el listado."
                : requiereCuenta
                    ? "Seleccioná una cuenta financiera para registrar la compra automática"
                : "No se pudieron guardar los repuestos.";
        return Response.json({ error: message }, { status });
    }

    const { data: createdArreglo, error: fetchError } = await supabase
        .from("arreglos")
        .select("*")
        .eq("id", String(arregloIdRpc))
        .single();

    if (fetchError || !createdArreglo) {
        return Response.json({ error: "Arreglo creado, pero no se pudo cargar" }, { status: 500 });
    }

    await statsService.onDataChanged(
        supabase,
        (createdArreglo as { tenant_id?: string | null }).tenant_id
    );
    return Response.json({ data: createdArreglo, error: null }, { status: 201 });

}

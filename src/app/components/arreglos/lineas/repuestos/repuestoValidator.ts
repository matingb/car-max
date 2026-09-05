import { safeInt, safeNumber } from "@/lib/numbers";
import type {
  RepuestoDraft,
  RepuestoLinea,
  RepuestoUpsertInput,
} from "./RepuestoLineasEditableSection";

export const NEW_PRODUCT_VALUE = "__nuevo_producto__";

export type InventarioEntry = {
  id: string;
  codigo?: string | null;
  stockActual?: number | null;
  precioUnitario?: number | null;
  costoUnitario?: number | null;
};

function stockFaltante(requestedQty: number, baseQty: number, stockActual: number): number {
  return Math.max(0, requestedQty - baseQty - stockActual);
}

export type RepuestoStockState = {
  mode: "add" | "edit";
  isNewProduct: boolean;
  hasExistingRepuestoConflict: boolean;
  hasStockIssue: boolean;
  stockActual: number;
  faltante: number;
  showPurchaseField: boolean;
};

/**
 * Derives the flags that drive the editor card: which mode we're in, whether to show the
 * purchase-price field, whether to surface a stock-issue hint or a "repuesto duplicado" warning.
 * Pure: same inputs always produce the same flags.
 */
export function computeStockState(
  item: RepuestoLinea | null,
  draft: RepuestoDraft,
  items: RepuestoLinea[],
  inventario: ReadonlyArray<InventarioEntry>,
): RepuestoStockState {
  const mode: "add" | "edit" = item ? "edit" : "add";
  const isNewProduct = item?.tipo === "nuevo" || draft.stockId === NEW_PRODUCT_VALUE;

  const stockId = item ? item.stock_id : draft.stockId;
  const stock = !isNewProduct ? inventario.find((s) => s.id === stockId) ?? null : null;
  const stockActual = stock ? Number(stock.stockActual) || 0 : 0;

  const baseQty = item ? Number(item.cantidad) || 0 : 0;
  const faltanteRaw = stockFaltante(safeInt(draft.cantidad), baseQty, stockActual);

  const hasExistingRepuestoConflict =
    mode === "add" && !isNewProduct && !!stock && items.some((i) => i.stock_id === draft.stockId);
  const hasStockIssue =
    !isNewProduct && !!stock && !hasExistingRepuestoConflict && faltanteRaw > 0;
  const faltante = hasStockIssue ? faltanteRaw : 0;
  const showPurchaseField = isNewProduct || hasStockIssue;

  return {
    mode,
    isNewProduct,
    hasExistingRepuestoConflict,
    hasStockIssue,
    stockActual,
    faltante,
    showPurchaseField,
  };
}

/**
 * Computes the next draft when the user picks an option in the stock autocomplete.
 * Three cases: the "new product" sentinel, a real inventario entry, or an empty/unknown pick.
 */
export function applyStockSelection(
  value: string,
  prev: RepuestoDraft,
  inventario: ReadonlyArray<InventarioEntry>,
  defaultNewProductCode = "",
): RepuestoDraft {
  // Sentinel: keep whatever the user typed in the new-product fields.
  if (value === NEW_PRODUCT_VALUE) {
    const codigo = String(prev.codigo ?? "").trim()
      ? prev.codigo
      : defaultNewProductCode;
    return { ...prev, stockId: value, montoUnitario: "", codigo };
  }

  const stock = inventario.find((s) => s.id === value) ?? null;

  // Cleared selection or unknown id: drop the new-product fields, keep current montoUnitario.
  if (!stock) {
    return {
      ...prev,
      stockId: value,
      precioVenta: "",
      precioCompra: "",
      precioVentaTouched: false,
    };
  }

  // Real stock: prefill from inventario, but don't overwrite a monto the user already typed.
  const userTypedMonto = String(prev.montoUnitario || "").trim().length > 0;
  return {
    ...prev,
    stockId: value,
    montoUnitario: userTypedMonto
      ? prev.montoUnitario
      : String(Number(stock.precioUnitario) || 0),
    precioVenta: "",
    precioCompra: String(Number(stock.costoUnitario) || 0),
    precioVentaTouched: false,
  };
}

export type RepuestoValidatorEnv = {
  tallerId: string | null;
  items: RepuestoLinea[];
  inventario: ReadonlyArray<InventarioEntry>;
};

export type RepuestoValidatorCtx = {
  mode: "add" | "edit";
  item?: RepuestoLinea;
};

export type RepuestoValidationResult =
  | { ok: true; value: RepuestoUpsertInput }
  | { ok: false; message: string };

export function getNewProductConflictMessage(
  codigo: string,
  env: Pick<RepuestoValidatorEnv, "items" | "inventario">,
  currentItemId?: string,
): string | null {
  const codigoLower = String(codigo ?? "").trim().toLowerCase();
  if (!codigoLower) return null;

  const collidesWithItem = env.items.some((i) => {
    if (i.id === currentItemId) return false;
    if (i.tipo === "nuevo") {
      return i.nuevoProducto?.codigo?.trim().toLowerCase() === codigoLower;
    }
    return i.producto?.codigo?.trim().toLowerCase() === codigoLower;
  });
  if (collidesWithItem) return "Este producto ya fue cargado en este arreglo";

  const collidesWithInventario = env.inventario.some(
    (s) => (s.codigo ?? "").trim().toLowerCase() === codigoLower,
  );
  if (collidesWithInventario) {
    return "Ya existe un producto con ese código. Seleccionalo desde el listado.";
  }

  return null;
}

export function validateRepuestoDraft(
  draft: RepuestoDraft,
  ctx: RepuestoValidatorCtx,
  env: RepuestoValidatorEnv,
): RepuestoValidationResult {
  if (!env.tallerId) return { ok: false, message: "No hay taller asociado" };

  const stockId = String(draft.stockId || "").trim();
  const cantidad = safeInt(draft.cantidad);

  if (!stockId) return { ok: false, message: "Falta producto" };
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { ok: false, message: "Cantidad inválida" };
  }

  if (stockId === NEW_PRODUCT_VALUE) {
    return validateNewProduct(draft, cantidad, ctx, env);
  }

  return validateExistingStock(draft, cantidad, stockId, ctx, env);
}

function validateNewProduct(
  draft: RepuestoDraft,
  cantidad: number,
  ctx: RepuestoValidatorCtx,
  env: RepuestoValidatorEnv,
): RepuestoValidationResult {
  const codigo = String(draft.codigo ?? "").trim();
  const nombre = String(draft.nombre ?? "").trim();
  const precioCompra = safeNumber(draft.precioCompra);
  const precioVenta = safeNumber(draft.precioVenta);

  if (!codigo) return { ok: false, message: "Falta código" };
  if (!nombre) return { ok: false, message: "Falta nombre" };
  if (!Number.isFinite(precioCompra) || precioCompra < 0) {
    return { ok: false, message: "Precio de compra inválido" };
  }
  if (!Number.isFinite(precioVenta) || precioVenta < 0) {
    return { ok: false, message: "Precio de venta inválido" };
  }

  const editingId = ctx.mode === "edit" && ctx.item ? ctx.item.id : undefined;
  const conflict = getNewProductConflictMessage(codigo, env, editingId);
  if (conflict) return { ok: false, message: conflict };

  return {
    ok: true,
    value: {
      tipo: "nuevo",
      codigo,
      nombre,
      precio_compra: precioCompra,
      precio_venta: precioVenta,
      cantidad,
      monto_unitario: precioVenta,
      categoria_arreglo_id: draft.categoriaArregloId || null,
      empleado_id: draft.empleadoId || null,
    },
  };
}

function validateExistingStock(
  draft: RepuestoDraft,
  cantidad: number,
  stockId: string,
  ctx: RepuestoValidatorCtx,
  env: RepuestoValidatorEnv,
): RepuestoValidationResult {
  const montoUnitario = safeNumber(draft.montoUnitario);
  if (!Number.isFinite(montoUnitario) || montoUnitario < 0) {
    return { ok: false, message: "Monto inválido" };
  }

  if (ctx.mode === "add" && env.items.some((i) => i.stock_id === stockId)) {
    return { ok: false, message: "Ese repuesto ya está agregado" };
  }

  const stock = env.inventario.find((s) => s.id === stockId) ?? null;
  if (!stock) return { ok: false, message: "Stock no encontrado" };

  const baseQty = ctx.mode === "edit" && ctx.item ? Number(ctx.item.cantidad) || 0 : 0;
  const faltante = stockFaltante(cantidad, baseQty, Number(stock.stockActual) || 0);

  if (faltante > 0) {
    const precioCompra = safeNumber(draft.precioCompra);
    if (!Number.isFinite(precioCompra) || precioCompra <= 0) {
      return { ok: false, message: "Falta precio de compra para cubrir el faltante" };
    }
    return {
      ok: true,
      value: {
        tipo: "existente",
        stock_id: stockId,
        cantidad,
        monto_unitario: montoUnitario,
        precio_compra: precioCompra,
        categoria_arreglo_id: draft.categoriaArregloId || null,
        empleado_id: draft.empleadoId || null,
      },
    };
  }

  return {
    ok: true,
    value: {
      tipo: "existente",
      stock_id: stockId,
      cantidad,
      monto_unitario: montoUnitario,
      categoria_arreglo_id: draft.categoriaArregloId || null,
      empleado_id: draft.empleadoId || null,
    },
  };
}

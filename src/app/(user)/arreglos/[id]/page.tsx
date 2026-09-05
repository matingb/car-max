"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { COLOR } from "@/theme/theme";
import { Skeleton, Theme } from "@radix-ui/themes";
import ArregloModal from "@/app/components/arreglos/ArregloModal";
import ArregloSummaryCard from "@/app/components/arreglos/ArregloSummaryCard";
import ArregloTotalsFooter from "@/app/components/arreglos/ArregloTotalsFooter";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { logger } from "@/lib/logger";
import { safeNumber } from "@/lib/numbers";
import type {
  ArregloDetalleData,
  AsignacionArregloLinea,
} from "@/app/api/arreglos/[id]/route";
import type { ArregloFormularioLineaValue } from "@/app/api/arreglos/arregloRequests";
import ServicioLineasEditableSection from "@/app/components/arreglos/lineas/servicios/ServicioLineasEditableSection";
import ServicioLineasCustomSection, {
  parseCustomServicioLineDefs,
} from "@/app/components/arreglos/lineas/servicios/ServicioLineasCustomSection";
import RepuestoLineasEditableSection from "@/app/components/arreglos/lineas/repuestos/RepuestoLineasEditableSection";
import type { RepuestoUpsertInput } from "@/app/components/arreglos/lineas/repuestos/RepuestoLineasEditableSection";
import { useFormularios } from "@/app/providers/FormulariosProvider";
import type { ServicioLinea } from "@/app/components/arreglos/lineas/servicios/ServicioLineasEditableSection";
import { useInventario } from "@/app/providers/InventarioProvider";
import { useUltimoTipoEmpleado } from "@/app/components/arreglos/hooks/useUltimoTipoEmpleado";
import { useCategoriasArreglo } from "@/app/providers/CategoriasArregloProvider";
import { useEmpleados } from "@/app/providers/EmpleadosProvider";
import CuentaCompraAutomaticaModal from "@/app/components/arreglos/CuentaCompraAutomaticaModal";
import { generateUuidV4 } from "@/lib/uuid";
import FacturaElectronicaModal from "@/app/components/arreglos/FacturaElectronicaModal";
import type { FacturaElectronicaResumen } from "@/lib/facturacion/types";
import { LockKeyhole } from "lucide-react";

export default function ArregloDetailsPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ArregloDetalleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [compraPendiente, setCompraPendiente] = useState<RepuestoUpsertInput | null>(null);
  const [customServiciosDraft, setCustomServiciosDraft] = useState<ServicioLinea[]>([]);
  const [facturaElectronica, setFacturaElectronica] = useState<FacturaElectronicaResumen | null>(null);
  const [canEmitFactura, setCanEmitFactura] = useState(false);
  const [openFacturaModal, setOpenFacturaModal] = useState(false);
  const {
    fetchById,
    update,
    createDetalle,
    updateDetalle,
    deleteDetalle,
    upsertRepuestoLinea,
    deleteRepuestoLinea,
    loading: providerLoading,
  } = useArreglos();
  const { formularios } = useFormularios();
  const { loadInventarioByTaller } = useInventario();
  const { loadCategorias } = useCategoriasArreglo();
  const { loadEmpleados } = useEmpleados();
  const { confirm } = useModalMessage();
  const { success, error } = useToast();
  const { ultimo: ultimoUsado, registrar: registrarUltimoUsado } = useUltimoTipoEmpleado();

  const refreshFacturaElectronica = useCallback(async () => {
    const response = await fetch(`/api/arreglos/${params.id}/factura`, { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    const fiscal = body?.data;
    setFacturaElectronica(fiscal?.factura ?? null);
    setCanEmitFactura(Boolean(fiscal?.canEmit));
  }, [params.id]);

  const reload = useCallback(async (options?: { showPageLoading?: boolean }) => {
    const showPageLoading = options?.showPageLoading ?? false;
    if (showPageLoading) {
      setLoading(true);
    }
    setErrorState(null);

    try {
      const [fetchedData] = await Promise.all([
        fetchById(params.id),
        loadCategorias().catch(() => {}),
        loadEmpleados().catch(() => {}),
        refreshFacturaElectronica().catch(() => {}),
      ]);
      if (!fetchedData) {
        setData(null);
        return;
      }
      setData(fetchedData);
    } catch (err: unknown) {
      console.error(err);
      setErrorState(err instanceof Error ? err.message : "Error cargando arreglo");
    } finally {
      if (showPageLoading) {
        setLoading(false);
      }
    }
  }, [params.id, fetchById, loadCategorias, loadEmpleados, refreshFacturaElectronica]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cancelled) return;
      await reload({ showPageLoading: true });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const handleOpenEdit = () => {
    setOpenModal(true);
  };

  const handleCloseModal = async () => {
    setOpenModal(false);
  };

  const handleDeleteServicio = async (detalleId: string) => {
    if (!data?.arreglo?.id) return;
    const confirmed = await confirm({
      title: "Eliminar servicio",
      message: "¿Querés eliminar este servicio del arreglo?",
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) return;
    try {
      await deleteDetalle(data.arreglo.id, detalleId);
      success("Servicio eliminado", "El servicio se eliminó correctamente.");
      await reload();
    } catch (err: unknown) {
      logger.error("Error deleting detalle:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo eliminar el servicio"
      );
    }
  };

  const handleDeleteRepuesto = async (lineaId: string) => {
    if (!data?.arreglo?.id) return;
    const confirmed = await confirm({
      title: "Eliminar repuesto",
      message:
        "¿Querés eliminar este repuesto del arreglo? Esto devolverá el stock.",
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) return;
    try {
      await deleteRepuestoLinea(data.arreglo.id, lineaId);
      success("Repuesto eliminado", "El repuesto se eliminó correctamente.");
      await reload();
    } catch (err: unknown) {
      logger.error("Error deleting repuesto linea:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo eliminar el repuesto"
      );
    }
  };

  const handleAddServicio = async (input: {
    descripcion: string;
    cantidad: number;
    valor: number;
    categoriaArregloId: string | null;
    empleadoId: string | null;
  }) => {
    if (!data?.arreglo?.id) return;
    try {
      await createDetalle(data.arreglo.id, {
        descripcion: input.descripcion,
        cantidad: input.cantidad,
        valor: input.valor,
        categoria_arreglo_id: input.categoriaArregloId,
        empleado_id: input.empleadoId,
      });
      registrarUltimoUsado(input.categoriaArregloId, input.empleadoId);
      success("Servicio agregado", "La mano de obra se agregó correctamente.");
      await reload();
    } catch (err: unknown) {
      logger.error("Error creating detalle:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo agregar el servicio"
      );
      throw err;
    }
  };

  const handleUpdateServicio = async (
    detalleId: string,
    patch: {
      descripcion: string;
      cantidad: number;
      valor: number;
      categoriaArregloId: string | null;
      empleadoId: string | null;
    }
  ) => {
    if (!data?.arreglo?.id) return;
    try {
      await updateDetalle(data.arreglo.id, detalleId, {
        descripcion: patch.descripcion,
        cantidad: patch.cantidad,
        valor: patch.valor,
        categoria_arreglo_id: patch.categoriaArregloId,
        empleado_id: patch.empleadoId,
      });
      registrarUltimoUsado(patch.categoriaArregloId, patch.empleadoId);
      success("Servicio actualizado", "El servicio se actualizó correctamente.");
      await reload();
    } catch (err: unknown) {
      logger.error("Error updating detalle:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo actualizar el servicio"
      );
      throw err;
    }
  };

  const handleUpsertRepuesto = async (
    input: RepuestoUpsertInput,
    cuentaFinancieraId?: string,
  ) => {
    if (!data?.arreglo?.id) return;
    const tallerId = data.arreglo.taller_id ?? null;
    if (!tallerId) return;
    const requiereCompraAutomatica =
      input.tipo === "nuevo" ||
      input.precio_compra !== undefined;
    if (requiereCompraAutomatica && !cuentaFinancieraId) {
      setCompraPendiente(input);
      return;
    }

    const cuentaPayload = requiereCompraAutomatica
      ? {
        cuenta_financiera_id: cuentaFinancieraId,
        idempotency_key: generateUuidV4(),
      }
      : {};
    try {
      if (input.tipo === "nuevo") {
        await upsertRepuestoLinea(data.arreglo.id, {
          tipo: "nuevo",
          taller_id: tallerId,
          codigo: input.codigo,
          nombre: input.nombre,
          precio_compra: input.precio_compra,
          precio_venta: input.precio_venta,
          cantidad: input.cantidad,
          ...cuentaPayload,
          categoria_arreglo_id: input.categoria_arreglo_id ?? null,
          empleado_id: input.empleado_id ?? null,
        });
      } else {
        await upsertRepuestoLinea(data.arreglo.id, {
          taller_id: tallerId,
          stock_id: input.stock_id,
          cantidad: input.cantidad,
          monto_unitario: input.monto_unitario,
          precio_compra: input.precio_compra,
          ...cuentaPayload,
          categoria_arreglo_id: input.categoria_arreglo_id ?? null,
          empleado_id: input.empleado_id ?? null,
        });
      }
      registrarUltimoUsado(input.categoria_arreglo_id ?? null, input.empleado_id ?? null);
      success("Repuesto actualizado", "El repuesto se actualizó correctamente.");
      await loadInventarioByTaller(tallerId);
      await reload();
    } catch (err: unknown) {
      logger.error("Error upserting repuesto:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo guardar el repuesto"
      );
      throw err;
    }
  };

  const selectedCustomFormulario = useMemo(() => {
    const formId = data?.detalle_formulario?.formulario_id;
    if (!formId) return null;
    return (
      formularios.find(
        (formulario) => formulario.id === formId
      ) ?? null
    );
  }, [data?.detalle_formulario?.formulario_id, formularios]);
  const isCustomTipoSelected = Boolean(selectedCustomFormulario);
  const customLineDefs = useMemo(
    () => parseCustomServicioLineDefs(selectedCustomFormulario?.metadata),
    [selectedCustomFormulario]
  );

  useEffect(() => {
    setCustomServiciosDraft([]);
  }, [data?.arreglo?.id, isCustomTipoSelected]);

  if (loading) return loadingScreen();

  if (errorState) {
    return (
      <div>
        <ScreenHeader title="Arreglos" breadcrumbs={["Detalle"]} hasBackButton />
        <div style={{ marginTop: 16, color: COLOR.ICON.DANGER }}>{errorState}</div>
      </div>
    );
  }

  if (!data?.arreglo) {
    return (
      <div>
        <ScreenHeader title="Arreglos" breadcrumbs={["Detalle"]} hasBackButton />
        <div style={{ marginTop: 16 }}>No se encontró el arreglo solicitado.</div>
      </div>
    );
  }

  const arreglo = data.arreglo;
  const fiscalReadOnly = facturaElectronica?.estado === "AUTORIZADA";
  const detalles = Array.isArray(data.detalles) ? data.detalles : [];
  const repuestosLineas = flattenAsignacionesLineas(data);

  const subtotalServicios = detalles.reduce(
    (acc, d) => acc + safeNumber(d.valor) * safeNumber(d.cantidad),
    0
  );
  const subtotalServiciosCustom =
    customServiciosDraft.length > 0
      ? customServiciosDraft.reduce(
        (acc, s) => acc + safeNumber(s.valor) * safeNumber(s.cantidad),
        0
      )
      : safeNumber(data.detalle_formulario?.costo);
  const subtotalRepuestos = repuestosLineas.reduce(
    (acc, l) => acc + safeNumber(l.monto_unitario) * safeNumber(l.cantidad),
    0
  );
  const totalCalculado = subtotalServicios + subtotalServiciosCustom + subtotalRepuestos;

  const handleConfirmCustomEdit = async ({
    costo,
    metadata,
  }: {
    costo: number;
    metadata: ArregloFormularioLineaValue[];
  }) => {
    if (!data?.arreglo?.id) return;

    const nextPrecioFinal = subtotalServicios + costo + subtotalRepuestos;

    try {
      await update(data.arreglo.id, {
        precio_final: nextPrecioFinal,
        detalle_formulario: {
          formulario_id: selectedCustomFormulario?.id,
          costo,
          metadata,
        },
      });

      success(
        "Formulario actualizado",
        "Se actualizaron el arreglo y su detalle custom."
      );
      await reload();
    } catch (err: unknown) {
      logger.error("Error updating custom form detail:", err);
      error(
        "Error",
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el formulario custom"
      );
      throw err;
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ScreenHeader
          title="Arreglos"
          breadcrumbs={["Detalle"]}
          hasBackButton
          style={{ width: "100%" }}
        />
      </div>

      <ArregloSummaryCard
        data={data}
        totalCalculado={totalCalculado}
        onOpenEdit={handleOpenEdit}
        onArregloChange={async (nuevoArreglo) => {
          setData((prev) => (prev ? { ...prev, arreglo: { ...prev.arreglo, ...nuevoArreglo } } : prev));
          await reload();
        }}
        canEmitFactura={canEmitFactura}
        facturaElectronica={facturaElectronica}
        onOpenFactura={() => setOpenFacturaModal(true)}
      />

      <div style={{ marginTop: 16 }}>
        <div style={styles.detalleHeader}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
              Detalle del Arreglo
            </h3>
            <div style={{ color: COLOR.TEXT.SECONDARY, marginTop: 2 }}>
              Servicios y productos incluidos
            </div>
          </div>
        </div>
        {fiscalReadOnly ? (
          <div style={styles.fiscalLockNotice} role="status">
            <LockKeyhole size={20} />
            <div>
              <strong>
                Factura C N° {String(facturaElectronica.numeroComprobante ?? 0).padStart(8, "0")} autorizada
              </strong>
              <div style={styles.fiscalLockText}>
                Las líneas de mano de obra, formulario y repuestos coinciden con un comprobante fiscal y ya no pueden modificarse.
              </div>
            </div>
          </div>
        ) : null}
        {isCustomTipoSelected ? (
          <>
            <ServicioLineasCustomSection
              formTitle={selectedCustomFormulario?.descripcion}
              defaultCosto={selectedCustomFormulario?.costoDefault}
              lineDefs={customLineDefs}
              initialDetalle={data.detalle_formulario}
              editableOnLoad={false}
              showEditButton
              disabled={providerLoading}
              readOnly={fiscalReadOnly}
              onServiciosChange={setCustomServiciosDraft}
              onConfirmEdit={handleConfirmCustomEdit}
            />
            <div style={styles.divider} />
          </>
        ) : null}
        <ServicioLineasEditableSection
          items={detalles.map((d) => ({
            id: d.id,
            descripcion: d.descripcion,
            cantidad: safeNumber(d.cantidad),
            valor: safeNumber(d.valor),
            categoriaArregloId: d.categoria_arreglo_id ?? null,
            empleadoId: d.empleado_id ?? null,
          }))}
          defaultCategoriaArregloId={ultimoUsado.categoriaArregloId}
          defaultEmpleadoId={ultimoUsado.empleadoId}
          onAdd={handleAddServicio}
          onUpdate={handleUpdateServicio}
          onDelete={handleDeleteServicio}
          disabled={providerLoading}
          readOnly={fiscalReadOnly}
        />
        <div
          style={{
            height: 1,
            background: COLOR.BORDER.SUBTLE,
            margin: "12px 0",
          }}
        />

        <RepuestoLineasEditableSection
          tallerId={arreglo.taller_id ?? null}
          items={repuestosLineas.map((l) => ({
            id: l.id,
            stock_id: l.stock_id,
            cantidad: safeNumber(l.cantidad),
            monto_unitario: safeNumber(l.monto_unitario),
            producto: l.producto ? { nombre: l.producto.nombre, codigo: l.producto.codigo } : null,
            categoriaArregloId: l.categoria_arreglo_id ?? null,
            empleadoId: l.empleado_id ?? null,
          }))}
          defaultCategoriaArregloId={ultimoUsado.categoriaArregloId}
          defaultEmpleadoId={ultimoUsado.empleadoId}
          onUpsert={handleUpsertRepuesto}
          onDelete={handleDeleteRepuesto}
          disabled={providerLoading}
          readOnly={fiscalReadOnly}
        />

        <ArregloTotalsFooter
          subtotalServicios={subtotalServicios + subtotalServiciosCustom}
          subtotalRepuestos={subtotalRepuestos}
          total={totalCalculado}
          totalCobrado={arreglo.total_cobrado}
          saldoPendiente={
            arreglo.saldo_pendiente != null
              ? arreglo.saldo_pendiente
              : Math.max(0, totalCalculado - (arreglo.total_cobrado || 0))
          }
        />
      </div>

      {arreglo && arreglo.vehiculo && (
        <ArregloModal
          open={openModal}
          onClose={handleCloseModal}
          onSubmitSuccess={async (nuevo) => {
            setData((prev) => (prev ? { ...prev, arreglo: { ...prev.arreglo, ...nuevo } } : prev));
            await reload();
          }}
          vehiculoId={arreglo.vehiculo.id}
          initial={{
            id: arreglo.id,
            estado: arreglo.estado,
            fecha: arreglo.fecha,
            kilometraje_leido: arreglo.kilometraje_leido,
            precio_final: arreglo.precio_final,
            observaciones: arreglo.observaciones,
            descripcion: arreglo.descripcion,
            esta_pago: arreglo.esta_pago,
            extra_data: arreglo.extra_data,
          }}
        />
      )}
      <CuentaCompraAutomaticaModal
        open={Boolean(compraPendiente)}
        onClose={() => setCompraPendiente(null)}
        onConfirm={async (cuentaId) => {
          const pending = compraPendiente;
          if (!pending) return;
          await handleUpsertRepuesto(pending, cuentaId);
          setCompraPendiente(null);
        }}
      />
      <FacturaElectronicaModal
        open={openFacturaModal}
        arregloId={arreglo.id}
        onClose={() => setOpenFacturaModal(false)}
        onAuthorized={(factura) => {
          setFacturaElectronica(factura);
          setCanEmitFactura(false);
          setCompraPendiente(null);
          void refreshFacturaElectronica();
        }}
      />
    </div>
  );
}

function loadingScreen() {
  return (
    <div style={{ maxHeight: "100%", minHeight: "0vh" }}>
      <Theme style={{ height: "100%", minHeight: "0vh" }}>
        <ScreenHeader
          title="Arreglos"
          breadcrumbs={["Detalle"]}
          hasBackButton
        />

        <div style={styles.loadingContainer}>
          <Skeleton width="64px" height="64px" />
          <Skeleton width="256px" height="16px" />
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <div style={styles.loadingColumn}>
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="95%" height="16px" />
          </div>
          <div style={styles.loadingColumn}>
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="90%" height="16px" />
          </div>
        </div>

        <div style={styles.loadingFooter}>
          <Skeleton width="100%" height="16px" />
          <Skeleton width="90%" height="16px" />
          <Skeleton width="90%" height="16px" />
        </div>
      </Theme>
    </div>
  );
}

const styles = {
  divider: {
    height: 1,
    background: COLOR.BORDER.SUBTLE,
    margin: "18px 0",
  },
  detalleHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap" as const,
  },
  fiscalLockNotice: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    margin: "14px 0",
    padding: 14,
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
  },
  fiscalLockText: {
    color: COLOR.TEXT.SECONDARY,
    marginTop: 3,
    lineHeight: 1.4,
  },
  loadingContainer: {
    flex: 1,
    marginTop: 16,
    gap: 16,
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "center",
  },
  loadingColumn: {
    flex: 1,
    marginTop: 16,
    gap: 16,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "start",
    width: "50%",
  },
  loadingFooter: {
    flex: 1,
    marginTop: 32,
    gap: 24,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    width: "100%",
  },
} as const;

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

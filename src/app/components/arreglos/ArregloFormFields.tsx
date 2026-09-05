"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Autocomplete, {
  type AutocompleteOption,
} from "@/app/components/ui/Autocomplete";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { isValidDate } from "@/lib/fechas";
import { formatArs } from "@/lib/format";
import ServicioLineasEditableSection, {
  type ServicioLinea,
} from "@/app/components/arreglos/lineas/servicios/ServicioLineasEditableSection";
import RepuestoLineasEditableSection, {
  type RepuestoLinea,
} from "@/app/components/arreglos/lineas/repuestos/RepuestoLineasEditableSection";
import type { CreateArregloDetalleFormularioInput } from "@/app/api/arreglos/arregloRequests";
import { useServiciosDraft } from "@/app/components/arreglos/hooks/useServiciosDraft";
import { useRepuestosDraft } from "@/app/components/arreglos/hooks/useRepuestosDraft";
import { useUltimoTipoEmpleado } from "@/app/components/arreglos/hooks/useUltimoTipoEmpleado";
import { ESTADOS_ARREGLO, EstadoArreglo } from "@/model/types";
import ArregloPagoBadge from "@/app/components/arreglos/ArregloPagoBadge";

export type ArregloForm = {

  estado?: EstadoArreglo;
  fecha: string;
  kilometraje_leido: number | string;
  precio_final: number | string;
  observaciones?: string;
  descripcion?: string;
  esta_pago?: boolean;
  extra_data?: string;
};

export type ArregloFormFieldsValues = {

  estado: EstadoArreglo;
  fecha: string;
  km: string;
  observaciones: string;
  estaPago: boolean;
  extraData: string;
  selectedVehiculoId: string;
};

export type ArregloFormFieldsInternal = {
  serviciosDraft: ServicioLinea[];
  repuestosDraft: RepuestoLinea[];
  detalleFormulario: CreateArregloDetalleFormularioInput | null;
  subtotalServicios: number;
  subtotalRepuestos: number;
  totalCalculado: number;
  totalCalculadoLabel: string;
};

type Props = {
  vehiculoId?: number | string;
  vehiculoOptions: AutocompleteOption[];
  isEdit: boolean;
  submitting: boolean;
  tallerId: string | null;
  values: ArregloFormFieldsValues;
  onValuesChange: (patch: Partial<ArregloFormFieldsValues>) => void;
  onValidityChange?: (isValid: boolean) => void;
  onChange?: (next: ArregloFormFieldsInternal) => void;
};



const estadoOptions: AutocompleteOption[] = ESTADOS_ARREGLO.map((estado) => ({
  value: estado,
  label: estado.replaceAll("_", " "),
}));

export function validateArregloForm(
  values: ArregloFormFieldsValues,
  vehiculoId?: number | string,
): boolean {
  const hasVehiculo = Boolean(
    vehiculoId || values.selectedVehiculoId.trim().length > 0,
  );
  return hasVehiculo && isValidDate(values.fecha);
}

export function shouldBlockCreateByCustomRequired(params: {
  isEdit: boolean;
  estado: EstadoArreglo;
  isCustomTipoSelected: boolean;
  missingRequiredCount: number;
}): boolean {
  return (
    !params.isEdit &&
    params.estado === "TERMINADO" &&
    params.isCustomTipoSelected &&
    params.missingRequiredCount > 0
  );
}

export default function ArregloFormFields({
  vehiculoId,
  vehiculoOptions,
  isEdit,
  submitting,
  tallerId,
  values,
  onValuesChange,
  onValidityChange,
  onChange,
}: Props) {
  const [customServiciosDraft, setCustomServiciosDraft] = useState<ServicioLinea[]>([]);

  const baseIsValid = useMemo(
    () => validateArregloForm(values, vehiculoId),
    [values, vehiculoId],
  );

  const isCustomTipoSelected = false;
  const blockCreateByCustomRequired = false;

  const isValid = useMemo(
    () => baseIsValid && !blockCreateByCustomRequired,
    [baseIsValid, blockCreateByCustomRequired]
  );

  const {
    items: serviciosDraft,
    onAdd: onServiciosAdd,
    onUpdate: onServiciosUpdate,
    onDelete: onServiciosDelete,
    reset: resetServicios,
  } = useServiciosDraft();

  const {
    items: repuestosDraft,
    onUpsert: onRepuestosUpsert,
    onDelete: onRepuestosDelete,
    reset: resetRepuestos,
  } = useRepuestosDraft();

  const { ultimo: ultimoUsado, registrar: registrarUltimoUsado } = useUltimoTipoEmpleado();

  const handleServiciosAdd = useCallback(
    (input: Parameters<typeof onServiciosAdd>[0]) => {
      registrarUltimoUsado(input.categoriaArregloId, input.empleadoId);
      return onServiciosAdd(input);
    },
    [onServiciosAdd, registrarUltimoUsado]
  );
  const handleServiciosUpdate = useCallback(
    (id: string, patch: Parameters<typeof onServiciosUpdate>[1]) => {
      registrarUltimoUsado(patch.categoriaArregloId, patch.empleadoId);
      return onServiciosUpdate(id, patch);
    },
    [onServiciosUpdate, registrarUltimoUsado]
  );
  const handleRepuestosUpsert = useCallback(
    (input: Parameters<typeof onRepuestosUpsert>[0]) => {
      registrarUltimoUsado(input.categoria_arreglo_id ?? null, input.empleado_id ?? null);
      return onRepuestosUpsert(input);
    },
    [onRepuestosUpsert, registrarUltimoUsado]
  );

  const serviciosActivos = useMemo(
    () =>
      isCustomTipoSelected
        ? [...serviciosDraft, ...customServiciosDraft]
        : serviciosDraft,
    [isCustomTipoSelected, serviciosDraft, customServiciosDraft]
  );


  const subtotalServicios = useMemo(
    () =>
      serviciosActivos.reduce(
        (acc, s) =>
          acc + (Number(s.cantidad) || 0) * (Number(s.valor) || 0),
        0,
      ),
    [serviciosActivos],
  );
  const subtotalRepuestos = useMemo(
    () =>
      repuestosDraft.reduce(
        (acc, r) =>
          acc +
          (Number(r.cantidad) || 0) * (Number(r.monto_unitario) || 0),
        0,
      ),
    [repuestosDraft],
  );
  const totalCalculado = subtotalServicios + subtotalRepuestos;
  const totalCalculadoLabel = useMemo(
    () => formatArs(totalCalculado, { maxDecimals: 0, minDecimals: 0 }),
    [totalCalculado],
  );

  const internalSnapshot = useMemo<ArregloFormFieldsInternal>(
    () => ({
      serviciosDraft,
      repuestosDraft,
      detalleFormulario: null,
      subtotalServicios,
      subtotalRepuestos,
      totalCalculado,
      totalCalculadoLabel,
    }),
    [serviciosDraft, repuestosDraft, subtotalServicios, subtotalRepuestos, totalCalculado, totalCalculadoLabel],
  );

  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  useEffect(() => {
    resetServicios();
    resetRepuestos();
  }, [isEdit, resetServicios, resetRepuestos]);

  useEffect(() => {
    if (isCustomTipoSelected) {
      resetServicios();
      return;
    }
    setCustomServiciosDraft([]);
  }, [isCustomTipoSelected, resetServicios]);

  useEffect(() => {
    onChange?.(internalSnapshot);
  }, [onChange, internalSnapshot]);

  return (
    <>
      <div css={styles.row}>
        {!vehiculoId && (
          <div style={styles.field}>
            <label style={styles.label}>
              Vehiculo{" "}
              <span aria-hidden="true" style={styles.required}>
                *
              </span>
            </label>
            <Autocomplete
              options={vehiculoOptions}
              value={values.selectedVehiculoId}
              onChange={(next) => onValuesChange({ selectedVehiculoId: next })}
              placeholder="Buscar vehiculo..."
            />
          </div>
        )}

        <div style={styles.field}>
          <label style={styles.label}>Estado</label>
          <Autocomplete
            options={estadoOptions}
            value={values.estado}
            onChange={(next) => {
              if ((ESTADOS_ARREGLO as string[]).includes(next)) {
                const nextEstado = next as EstadoArreglo;
                onValuesChange({
                  estado: nextEstado,
                  ...(nextEstado === "PRESUPUESTO" ? { estaPago: false } : {}),
                });
              }
            }}
            placeholder="Seleccionar estado"
            hideClearButton={true}
          />
        </div>
      </div>

      <div css={styles.kmRow}>
        <div css={styles.kmFechaField}>
          <label style={styles.label}>Kilometraje</label>
          <input
            style={styles.input}
            inputMode="numeric"
            pattern="[0-9]*"
            value={values.km}
            onChange={(e) =>
              onValuesChange({ km: e.target.value.replace(/\D/g, "") })
            }
            placeholder="123456"
          />
        </div>
        <div css={styles.kmFechaField}>
          <label style={styles.label}>
            Fecha{" "}
            <span aria-hidden="true" style={styles.required}>
              *
            </span>
          </label>
          <input
            type="date"
            style={styles.input}
            value={values.fecha}
            onChange={(e) => onValuesChange({ fecha: e.target.value })}
          />
        </div>
        {values.estado !== "PRESUPUESTO" && (
          <div css={styles.pagoField}>
            <label style={styles.label}>¿Esta pago?</label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: 44,
              }}
            >
              <ArregloPagoBadge
                estado={values.estado}
                estaPago={values.estaPago}
                onClick={isEdit ? undefined : () => onValuesChange({ estaPago: !values.estaPago })}
                size="md"
              />
            </div>
          </div>
        )}
      </div>

      {!isEdit ? (
        <div style={{ marginTop: 6 }}>

          <ServicioLineasEditableSection
            items={serviciosDraft}
            defaultCategoriaArregloId={ultimoUsado.categoriaArregloId}
            defaultEmpleadoId={ultimoUsado.empleadoId}
            onAdd={handleServiciosAdd}
            onUpdate={handleServiciosUpdate}
            onDelete={onServiciosDelete}
            disabled={submitting}
          />
          <div style={styles.divider} />

          <RepuestoLineasEditableSection
            tallerId={tallerId}
            items={repuestosDraft}
            defaultCategoriaArregloId={ultimoUsado.categoriaArregloId}
            defaultEmpleadoId={ultimoUsado.empleadoId}
            onUpsert={handleRepuestosUpsert}
            onDelete={onRepuestosDelete}
            disabled={submitting}
          />

          <div style={stylesModal.totalRow}>
            <span style={stylesModal.totalLabel}>Total calculado</span>
            <span style={stylesModal.totalValue}>{totalCalculadoLabel}</span>
          </div>
        </div>
      ) : null}

      <div css={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Observaciones</label>
          <textarea
            style={styles.input}
            value={values.observaciones}
            onChange={(e) => onValuesChange({ observaciones: e.target.value })}
            placeholder="Observaciones"
            rows={3}
          />
        </div>
      </div>
    </>
  );
}

const styles = {
  row: css({
    display: "flex",
    gap: 16,
    marginTop: 10,
    width: "auto",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "100%",
      flexDirection: "column",
      gap: 8,
    },
  }),
  kmRow: css({
    display: "flex",
    gap: 16,
    marginTop: 10,
    width: "auto",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      width: "100%",
      flexWrap: "wrap",
      gap: 8,
    },
  }),
  kmFechaField: css({
    flex: 1,
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      flex: "1 1 calc(50% - 4px)",
      minWidth: 140,
    },
  }),
  pagoField: css({
    flex: 1,
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      flex: "1 1 100%",
    },
  }),
  field: { flex: 1 },
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
    marginLeft: 2,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    boxSizing: "border-box" as const,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  divider: {
    height: 1,
    background: COLOR.BORDER.SUBTLE,
    margin: "18px 0",
  },
  validationError: {
    marginTop: 8,
    color: COLOR.ICON.DANGER,
    fontSize: 13,
    fontWeight: 600,
  },
} as const;

const stylesModal = {
  totalRow: {
    marginTop: 12,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "baseline",
    gap: 8,
  },
  totalLabel: {
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 700,
  },
  totalValue: {
    fontWeight: 700,
    fontSize: 18,
    color: COLOR.TEXT.PRIMARY,
  },
} as const;

-- rpc_crear_arreglo_completo llama a _asignar_repuestos_existentes_a_arreglo sin
-- reenviar p_cuenta_id/p_idempotency_key. Como rpc_asignar_repuesto_existente_con_compra
-- ahora exige esos parametros cuando detecta faltante de stock (ver
-- 20260828190623_fix_repuesto_existing_purchase_account.sql), cualquier repuesto
-- existente con compra automatica creado junto con el arreglo fallaba con
-- CUENTA_FINANCIERA_REQUERIDA aunque el cliente hubiera enviado una cuenta valida.

CREATE OR REPLACE FUNCTION public._asignar_repuestos_existentes_a_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_repuestos jsonb,
  p_cuenta_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF p_repuestos IS NULL OR jsonb_array_length(p_repuestos) = 0 THEN RETURN; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_repuestos) LOOP
    PERFORM public.rpc_asignar_repuesto_existente_con_compra(
      p_arreglo_id := p_arreglo_id, p_taller_id := p_taller_id,
      p_stock_id := (v_item ->> 'stock_id')::uuid, p_cantidad := (v_item ->> 'cantidad')::int,
      p_monto_unitario := (v_item ->> 'monto_unitario')::numeric,
      p_precio_compra := NULLIF(v_item ->> 'precio_compra', '')::numeric,
      p_categoria_arreglo_id := NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid,
      p_cuenta_id := p_cuenta_id,
      p_idempotency_key := p_idempotency_key
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._asignar_repuestos_existentes_a_arreglo(uuid, uuid, jsonb, uuid, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public._asignar_repuestos_existentes_a_arreglo(uuid, uuid, jsonb, uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_crear_arreglo_completo(
  p_vehiculo_id uuid,
  p_taller_id uuid,
  p_estado public.estado_arreglo,
  p_descripcion text,
  p_kilometraje_leido integer,
  p_fecha timestamptz,
  p_observaciones text,
  p_precio_final numeric,
  p_precio_sin_iva numeric,
  p_esta_pago boolean,
  p_extra_data jsonb,
  p_detalles jsonb DEFAULT '[]'::jsonb,
  p_repuestos jsonb DEFAULT '[]'::jsonb,
  p_repuestos_nuevos jsonb DEFAULT '[]'::jsonb,
  p_detalle_formulario jsonb DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_fecha_cobro timestamptz DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_arreglo_id uuid;
BEGIN
  IF p_vehiculo_id IS NULL THEN RAISE EXCEPTION 'vehiculo_id requerido'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido'; END IF;
  IF p_fecha IS NULL THEN RAISE EXCEPTION 'fecha requerida'; END IF;
  IF COALESCE(p_esta_pago, false) AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id requerido para registrar el cobro' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_esta_pago, false) AND p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key requerido para registrar el cobro' USING ERRCODE = '22023';
  END IF;

  p_detalles := COALESCE(p_detalles, '[]'::jsonb);
  p_repuestos := COALESCE(p_repuestos, '[]'::jsonb);
  p_repuestos_nuevos := COALESCE(p_repuestos_nuevos, '[]'::jsonb);

  IF jsonb_typeof(p_detalles) <> 'array' THEN RAISE EXCEPTION 'detalles debe ser array'; END IF;
  IF jsonb_typeof(p_repuestos) <> 'array' THEN RAISE EXCEPTION 'repuestos debe ser array'; END IF;
  IF jsonb_typeof(p_repuestos_nuevos) <> 'array' THEN RAISE EXCEPTION 'repuestos_nuevos debe ser array'; END IF;
  IF jsonb_array_length(p_repuestos_nuevos) > 0 AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id requerido para registrar la compra automática' USING ERRCODE = '22023';
  END IF;

  PERFORM public._check_codigos_unicos_en_array(p_repuestos_nuevos);

  v_arreglo_id := public._insert_arreglo_base(
    p_vehiculo_id := p_vehiculo_id,
    p_taller_id := p_taller_id,
    p_estado := p_estado,
    p_descripcion := p_descripcion,
    p_kilometraje_leido := p_kilometraje_leido,
    p_fecha := p_fecha,
    p_observaciones := p_observaciones,
    p_precio_final := p_precio_final,
    p_precio_sin_iva := p_precio_sin_iva,
    p_esta_pago := false,
    p_extra_data := p_extra_data
  );

  PERFORM public._insert_detalles_arreglo(v_arreglo_id, p_detalles);
  PERFORM public._insert_detalle_form_custom(v_arreglo_id, p_detalle_formulario);
  PERFORM public._asignar_repuestos_existentes_a_arreglo(
    v_arreglo_id,
    p_taller_id,
    p_repuestos,
    p_cuenta_id,
    p_idempotency_key
  );
  PERFORM public._crear_repuestos_nuevos_para_arreglo(
    v_arreglo_id,
    p_taller_id,
    p_repuestos_nuevos,
    p_cuenta_id
  );

  UPDATE public.arreglos
  SET precio_final = COALESCE(p_precio_final, precio_final),
      precio_sin_iva = COALESCE(p_precio_sin_iva, precio_sin_iva),
      updated_at = now()
  WHERE id = v_arreglo_id;

  IF COALESCE(p_esta_pago, false) THEN
    PERFORM public.rpc_finanzas_cobrar_arreglo(
      p_arreglo_id := v_arreglo_id,
      p_cuenta_id := p_cuenta_id,
      p_monto := COALESCE(p_precio_final, 0),
      p_fecha_cobro := COALESCE(p_fecha_cobro, p_fecha),
      p_descripcion := NULL,
      p_idempotency_key := p_idempotency_key
    );
  END IF;

  RETURN v_arreglo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_crear_arreglo_completo(
  uuid,
  uuid,
  public.estado_arreglo,
  text,
  integer,
  timestamptz,
  text,
  numeric,
  numeric,
  boolean,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  timestamptz,
  uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_crear_arreglo_completo(
  uuid,
  uuid,
  public.estado_arreglo,
  text,
  integer,
  timestamptz,
  text,
  numeric,
  numeric,
  boolean,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  timestamptz,
  uuid
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

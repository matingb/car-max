-- Migración: Restricción de pago/cobro para arreglos en estado PRESUPUESTO

-- 1. Actualizar rpc_finanzas_cobrar_arreglo para bloquear cobros en presupuestos
DROP FUNCTION IF EXISTS public.rpc_finanzas_cobrar_arreglo(uuid,uuid,numeric,timestamptz,text,uuid,jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_cobrar_arreglo CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_cobrar_arreglo(
  p_arreglo_id      uuid,
  p_cuenta_id       uuid        DEFAULT NULL,
  p_monto           numeric     DEFAULT NULL,
  p_fecha_cobro     timestamptz DEFAULT now(),
  p_descripcion     text        DEFAULT NULL,
  p_idempotency_key uuid        DEFAULT NULL,
  p_pagos           jsonb       DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id            uuid    := public.current_tenant_id();
  v_arreglo              record;
  v_monto_total_cobrado  numeric := 0;
  v_operacion_id         uuid;
  v_pago                 jsonb;
  v_pago_cuenta_id       uuid;
  v_pago_monto           numeric;
  v_pago_desc            text;
  v_operaciones_ids      uuid[]  := ARRAY[]::uuid[];
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  -- Idempotencia: si ya existe una operación con este idempotency_key, devolver estado actual
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':cobro:' || p_idempotency_key::text));
    SELECT omc.operacion_id INTO v_operacion_id
    FROM public.operaciones_movimiento_cuenta omc
    WHERE omc.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;
    IF v_operacion_id IS NOT NULL THEN
      SELECT a.total_cobrado, a.precio_final, a.esta_pago
      INTO v_arreglo FROM public.arreglos a
      WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id;
      RETURN jsonb_build_object(
        'operacion_id',    v_operacion_id,
        'idempotent',      true,
        'total_cobrado',   v_arreglo.total_cobrado,
        'saldo_pendiente', GREATEST(0, COALESCE(v_arreglo.precio_final, 0) - v_arreglo.total_cobrado),
        'esta_pago',       v_arreglo.esta_pago
      );
    END IF;
  END IF;

  SELECT a.id, a.precio_final, a.total_cobrado, a.tenant_id, a.estado, v.patente
  INTO v_arreglo
  FROM public.arreglos a
  LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id
  FOR UPDATE OF a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado: %', p_arreglo_id USING ERRCODE = 'P0002'; END IF;

  IF v_arreglo.estado = 'PRESUPUESTO' THEN
    RAISE EXCEPTION 'No se pueden registrar cobros en un presupuesto' USING ERRCODE = '22023';
  END IF;

  -- MODO 1: Múltiples cuentas (p_pagos como array JSON)
  IF p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0 THEN
    FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos)
    LOOP
      v_pago_cuenta_id := (v_pago ->> 'cuenta_id')::uuid;
      v_pago_monto := (v_pago ->> 'monto')::numeric;
      v_pago_desc := NULLIF(btrim(v_pago ->> 'descripcion'), '');

      IF v_pago_cuenta_id IS NULL THEN
        RAISE EXCEPTION 'Cada cobro debe especificar una cuenta válida' USING ERRCODE = '22023';
      END IF;
      IF v_pago_monto IS NULL OR v_pago_monto <= 0 THEN
        RAISE EXCEPTION 'El monto de cada cobro debe ser mayor a 0' USING ERRCODE = '22023';
      END IF;

      PERFORM public._finanzas_exigir_cuenta(v_pago_cuenta_id, v_tenant_id, true);

      INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
      VALUES (v_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha_cobro, now()))
      RETURNING id INTO v_operacion_id;

      INSERT INTO public.operaciones_movimiento_cuenta (
        operacion_id, tenant_id, subtipo, cuenta_id, importe,
        descripcion, created_by
      ) VALUES (
        v_operacion_id, v_tenant_id, 'INGRESO', v_pago_cuenta_id, v_pago_monto,
        COALESCE(
          v_pago_desc,
          NULLIF(btrim(p_descripcion), ''),
          'Cobro de arreglo' || CASE WHEN v_arreglo.patente IS NOT NULL THEN ' - ' || v_arreglo.patente ELSE '' END
        ),
        auth.uid()
      );

      INSERT INTO public.operaciones_cobro_arreglo (operacion_id, arreglo_id, tenant_id)
      VALUES (v_operacion_id, p_arreglo_id, v_tenant_id);

      v_operaciones_ids := array_append(v_operaciones_ids, v_operacion_id);
      v_monto_total_cobrado := v_monto_total_cobrado + v_pago_monto;
    END LOOP;

  -- MODO 2: Cobro simple (una sola cuenta)
  ELSE
    IF p_cuenta_id IS NULL THEN
      RAISE EXCEPTION 'Debe especificar una cuenta financiera de destino' USING ERRCODE = '22023';
    END IF;

    v_pago_monto := COALESCE(
      p_monto,
      GREATEST(0, COALESCE(v_arreglo.precio_final, 0) - COALESCE(v_arreglo.total_cobrado, 0))
    );
    IF v_pago_monto <= 0 THEN
      RAISE EXCEPTION 'El monto a cobrar debe ser mayor a 0' USING ERRCODE = '22023';
    END IF;

    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);

    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
    VALUES (v_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha_cobro, now()))
    RETURNING id INTO v_operacion_id;

    INSERT INTO public.operaciones_movimiento_cuenta (
      operacion_id, tenant_id, subtipo, cuenta_id, importe,
      descripcion, idempotency_key, created_by
    ) VALUES (
      v_operacion_id, v_tenant_id, 'INGRESO', p_cuenta_id, v_pago_monto,
      COALESCE(
        NULLIF(btrim(p_descripcion), ''),
        'Cobro de arreglo' || CASE WHEN v_arreglo.patente IS NOT NULL THEN ' - ' || v_arreglo.patente ELSE '' END
      ),
      p_idempotency_key, auth.uid()
    );

    INSERT INTO public.operaciones_cobro_arreglo (operacion_id, arreglo_id, tenant_id)
    VALUES (v_operacion_id, p_arreglo_id, v_tenant_id);

    v_operaciones_ids := array_append(v_operaciones_ids, v_operacion_id);
    v_monto_total_cobrado := v_pago_monto;
  END IF;

  -- Actualizar total cobrado en arreglo
  UPDATE public.arreglos
  SET total_cobrado = COALESCE(total_cobrado, 0) + v_monto_total_cobrado
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;

  SELECT a.total_cobrado, a.precio_final, a.esta_pago
  INTO v_arreglo FROM public.arreglos a WHERE a.id = p_arreglo_id;

  RETURN jsonb_build_object(
    'operaciones_ids', to_jsonb(v_operaciones_ids),
    'monto_cobrado',   v_monto_total_cobrado,
    'total_cobrado',   v_arreglo.total_cobrado,
    'saldo_pendiente', GREATEST(0, COALESCE(v_arreglo.precio_final, 0) - v_arreglo.total_cobrado),
    'esta_pago',       v_arreglo.esta_pago
  );
END; $$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_cobrar_arreglo(uuid,uuid,numeric,timestamptz,text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_cobrar_arreglo(uuid,uuid,numeric,timestamptz,text,uuid,jsonb) TO authenticated, service_role;


-- 2. Actualizar rpc_crear_arreglo_completo para impedir p_esta_pago = true cuando p_estado = 'PRESUPUESTO'
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
  IF p_estado = 'PRESUPUESTO' AND COALESCE(p_esta_pago, false) THEN
    RAISE EXCEPTION 'No se puede crear un presupuesto como pagado' USING ERRCODE = '22023';
  END IF;
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

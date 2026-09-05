-- ===========================================================================
-- Migración: Excluir arreglos en estado PRESUPUESTO de las métricas de facturación y dashboard
-- ===========================================================================

-- 1. Resumen de arreglos (tarjeta Facturación, balance y estado de cobro)
DROP FUNCTION IF EXISTS public.dashboard_arreglos_resumen(timestamptz, timestamptz, uuid);

CREATE FUNCTION public.dashboard_arreglos_resumen(
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(
  total integer,
  cobrados integer,
  pendientes integer,
  parciales integer,
  monto_ingresos numeric,
  monto_cobrado_total numeric,
  monto_cobrado_parcial numeric,
  monto_pendiente_parcial numeric,
  monto_pendiente numeric
)
LANGUAGE sql
SET search_path = public
AS $$
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE a.esta_pago = true)::int AS cobrados,
    COUNT(*) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) <= 0
    )::int AS pendientes,
    COUNT(*) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) > 0
    )::int AS parciales,
    COALESCE(SUM(a.precio_final), 0)::numeric AS monto_ingresos,
    COALESCE(SUM(a.total_cobrado) FILTER (WHERE a.esta_pago = true), 0)::numeric AS monto_cobrado_total,
    COALESCE(SUM(a.total_cobrado) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) > 0
    ), 0)::numeric AS monto_cobrado_parcial,
    COALESCE(SUM(GREATEST(0, COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0))) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) > 0
    ), 0)::numeric AS monto_pendiente_parcial,
    COALESCE(SUM(GREATEST(0, COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0))) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) <= 0
    ), 0)::numeric AS monto_pendiente
  FROM public.arreglos a
  WHERE (p_from IS NULL OR a.fecha >= p_from)
    AND (p_to IS NULL OR a.fecha < p_to)
    AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
    AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO');
$$;

REVOKE ALL ON FUNCTION public.dashboard_arreglos_resumen(timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_arreglos_resumen(timestamptz, timestamptz, uuid) TO authenticated, service_role;


-- 2. Ingresos por período (gráfico temporal de Facturación)
DROP FUNCTION IF EXISTS public.dashboard_ingresos_por_periodo(timestamptz, timestamptz, uuid);

CREATE FUNCTION public.dashboard_ingresos_por_periodo(
  p_from      timestamptz,
  p_to        timestamptz,
  p_taller_id uuid DEFAULT NULL
)
RETURNS TABLE(label text, mano_de_obra numeric, repuestos numeric, ventas numeric)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);

  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, p_from),
      date_trunc(b.trunc_name, p_to - interval '1 second'),
      b.step
    ) AS slot_start
  ),
  ra AS (
    SELECT date_trunc(b.trunc_name, a.fecha) AS slot_start,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS rep
    FROM public.arreglos a
    JOIN public.operaciones_asignacion_arreglo oa ON oa.arreglo_id = a.id
    JOIN public.operaciones o  ON o.id = oa.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  ),
  ia AS (
    SELECT date_trunc(b.trunc_name, a.fecha) AS slot_start,
           COALESCE(SUM(a.precio_final), 0)::numeric AS total
    FROM public.arreglos a
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  ),
  vd AS (
    SELECT date_trunc(b.trunc_name, o.fecha) AS slot_start,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS ventas
    FROM public.operaciones o
    JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
    WHERE o.tipo = 'VENTA' AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id)
    GROUP BY 1
  )
  SELECT to_char(s.slot_start, b.label_fmt),
         GREATEST(COALESCE(ia.total, 0) - COALESCE(ra.rep, 0), 0),
         COALESCE(ra.rep, 0),
         COALESCE(vd.ventas, 0)
  FROM slots s
  LEFT JOIN ra USING (slot_start)
  LEFT JOIN ia USING (slot_start)
  LEFT JOIN vd USING (slot_start)
  ORDER BY s.slot_start;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_ingresos_por_periodo(timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_ingresos_por_periodo(timestamptz, timestamptz, uuid) TO authenticated, service_role;


-- 3. Facturación por categoría (gráfico de torta)
DROP FUNCTION IF EXISTS public.dashboard_facturacion_por_categoria(integer, timestamptz, timestamptz, uuid);

CREATE FUNCTION public.dashboard_facturacion_por_categoria(
  top         integer     DEFAULT 6,
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(label text, cantidad integer, monto numeric)
LANGUAGE sql
SET search_path = public
AS $$
  WITH lineas AS (
    SELECT d.categoria_arreglo_id AS cat_id, (d.cantidad * d.valor)::numeric AS monto
    FROM public.detalle_arreglo d
    JOIN public.arreglos a ON a.id = d.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')

    UNION ALL

    SELECT ol.categoria_arreglo_id AS cat_id, (ol.cantidad * ol.monto_unitario)::numeric AS monto
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
  ),
  agg AS (
    SELECT
      COALESCE(c.nombre, 'Sin categoría')::text AS label,
      COUNT(*)::int AS cantidad,
      COALESCE(SUM(l.monto), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.categorias_arreglo c ON c.id = l.cat_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto,
           ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn
    FROM agg
  ),
  top_rows AS (
    SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)
  ),
  otros AS (
    SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto
    FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0)
  )
  SELECT s.label, s.cantidad, s.monto
  FROM (
    SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows
    UNION ALL
    SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0
  ) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$$;

REVOKE ALL ON FUNCTION public.dashboard_facturacion_por_categoria(integer, timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_facturacion_por_categoria(integer, timestamptz, timestamptz, uuid) TO authenticated, service_role;


-- 4. Facturación por empleado (gráfico de torta)
DROP FUNCTION IF EXISTS public.dashboard_facturacion_por_empleado(integer, timestamptz, timestamptz, uuid);

CREATE FUNCTION public.dashboard_facturacion_por_empleado(
  top         integer     DEFAULT 6,
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(label text, cantidad integer, monto numeric)
LANGUAGE sql
SET search_path = public
AS $$
  WITH lineas AS (
    SELECT d.empleado_id AS empleado_id, (d.cantidad * d.valor)::numeric AS monto
    FROM public.detalle_arreglo d
    JOIN public.arreglos a ON a.id = d.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to IS NULL OR a.fecha < p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')

    UNION ALL

    SELECT ol.empleado_id AS empleado_id, (ol.cantidad * ol.monto_unitario)::numeric AS monto
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to IS NULL OR a.fecha < p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
  ),
  agg AS (
    SELECT COALESCE(NULLIF(trim(e.nombre || ' ' || e.apellido), ''), 'Sin asignar')::text AS label,
           COUNT(*)::int AS cantidad,
           COALESCE(SUM(l.monto), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.empleados e ON e.id = l.empleado_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto,
           ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn
    FROM agg
  ),
  top_rows AS (SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)),
  otros AS (SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0))
  SELECT s.label, s.cantidad, s.monto
  FROM (SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows UNION ALL SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$$;

REVOKE ALL ON FUNCTION public.dashboard_facturacion_por_empleado(integer, timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_facturacion_por_empleado(integer, timestamptz, timestamptz, uuid) TO authenticated, service_role;


-- 5. Arreglos por período (tarjeta Arreglos realizados)
DROP FUNCTION IF EXISTS public.dashboard_arreglos_por_periodo(timestamptz, timestamptz, uuid);

CREATE FUNCTION public.dashboard_arreglos_por_periodo(
  p_from      timestamptz,
  p_to        timestamptz,
  p_taller_id uuid DEFAULT NULL
)
RETURNS TABLE(label text, cantidad bigint)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);

  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, p_from),
      date_trunc(b.trunc_name, p_to - interval '1 second'),
      b.step
    ) AS slot_start
  ),
  agg AS (
    SELECT date_trunc(b.trunc_name, a.fecha) AS slot_start,
           COUNT(*)::bigint AS cnt
    FROM public.arreglos a
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  )
  SELECT to_char(s.slot_start, b.label_fmt), COALESCE(agg.cnt, 0)
  FROM slots s LEFT JOIN agg USING (slot_start)
  ORDER BY s.slot_start;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_arreglos_por_periodo(timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_arreglos_por_periodo(timestamptz, timestamptz, uuid) TO authenticated, service_role;


-- 6. Costo por categoría (panel de Gastos)
DROP FUNCTION IF EXISTS public.dashboard_costo_por_categoria(integer, timestamptz, timestamptz, uuid);

CREATE FUNCTION public.dashboard_costo_por_categoria(
  top         integer     DEFAULT 6,
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(label text, cantidad integer, monto numeric)
LANGUAGE sql
SET search_path = public
AS $$
  WITH lineas AS (
    SELECT ol.categoria_arreglo_id AS cat_id, (ol.cantidad * p.costo_unitario)::numeric AS costo
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    JOIN public.stocks s ON s.id = ol.stock_id
    JOIN public.productos p ON p.id = s.producto_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
  ),
  agg AS (
    SELECT COALESCE(c.nombre, 'Sin categoría')::text AS label, COUNT(*)::int AS cantidad, COALESCE(SUM(l.costo), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.categorias_arreglo c ON c.id = l.cat_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto, ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn FROM agg
  ),
  top_rows AS (SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)),
  otros AS (SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0))
  SELECT s.label, s.cantidad, s.monto
  FROM (SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows UNION ALL SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$$;

REVOKE ALL ON FUNCTION public.dashboard_costo_por_categoria(integer, timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_costo_por_categoria(integer, timestamptz, timestamptz, uuid) TO authenticated, service_role;


-- 7. Costo por empleado (panel de Gastos)
DROP FUNCTION IF EXISTS public.dashboard_costo_por_empleado(timestamptz, timestamptz, integer, uuid);

CREATE FUNCTION public.dashboard_costo_por_empleado(
  p_from      timestamptz,
  p_to        timestamptz,
  top         integer     DEFAULT 6,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(label text, cantidad integer, monto numeric)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN RAISE EXCEPTION 'p_from y p_to son obligatorios'; END IF;
  RETURN QUERY
  WITH repuestos AS (
    SELECT ol.empleado_id AS empleado_id, COUNT(*)::int AS cantidad, COALESCE(SUM(ol.cantidad * p.costo_unitario), 0)::numeric AS costo
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    JOIN public.stocks s ON s.id = ol.stock_id
    JOIN public.productos p ON p.id = s.producto_id
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  ),
  meses AS (SELECT generate_series(date_trunc('month', p_from), date_trunc('month', p_to - interval '1 second'), interval '1 month') AS mes_start),
  sueldos AS (
    SELECT e.id AS empleado_id, COALESCE(SUM(eff.salario), 0)::numeric AS sueldo
    FROM public.empleados e
    JOIN meses m ON true
    LEFT JOIN LATERAL (SELECT es.salario FROM public.empleado_salarios es WHERE es.empleado_id = e.id AND es.vigente_desde < (m.mes_start + interval '1 month')::date ORDER BY es.vigente_desde DESC LIMIT 1) eff ON true
    WHERE (p_taller_id IS NULL OR e.taller_id = p_taller_id) AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso < (m.mes_start + interval '1 month')::date)
    GROUP BY 1 HAVING COALESCE(SUM(eff.salario), 0) > 0
  ),
  agg AS (
    SELECT COALESCE(NULLIF(trim(e.nombre || ' ' || e.apellido), ''), 'Sin asignar')::text AS label, COALESCE(r.cantidad, 0) AS cantidad, (COALESCE(r.costo, 0) + COALESCE(su.sueldo, 0))::numeric AS monto
    FROM repuestos r
    FULL OUTER JOIN sueldos su ON su.empleado_id = r.empleado_id
    LEFT JOIN public.empleados e ON e.id = COALESCE(r.empleado_id, su.empleado_id)
  ),
  ranked AS (SELECT agg.label, agg.cantidad, agg.monto, ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn FROM agg),
  top_rows AS (SELECT ranked.label, ranked.cantidad, ranked.monto FROM ranked WHERE ranked.rn <= GREATEST(COALESCE(top, 0), 0)),
  otros AS (SELECT 'Otros'::text AS label, COALESCE(SUM(ranked.cantidad), 0)::int AS cantidad, COALESCE(SUM(ranked.monto), 0)::numeric AS monto FROM ranked WHERE ranked.rn > GREATEST(COALESCE(top, 0), 0))
  SELECT s.label, s.cantidad, s.monto FROM (SELECT top_rows.label, top_rows.cantidad, top_rows.monto, 0 AS sort_group FROM top_rows UNION ALL SELECT otros.label, otros.cantidad, otros.monto, 1 AS sort_group FROM otros WHERE otros.monto > 0) s ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_costo_por_empleado(timestamptz, timestamptz, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_costo_por_empleado(timestamptz, timestamptz, integer, uuid) TO authenticated, service_role;

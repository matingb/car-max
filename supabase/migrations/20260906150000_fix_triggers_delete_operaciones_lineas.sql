-- Corrige compatibilidad de triggers en operaciones DELETE para operaciones_lineas y operaciones.
-- En PostgreSQL PL/pgSQL, la variable de registro `NEW` no está asignada durante operaciones DELETE.
-- Intentar acceder a `NEW.<campo>` o acceder a columnas inexistentes en disparadores polimórficos
-- provocaba el error 42703 (record "new"/"old" has no field ...).

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_rec jsonb;
  v_operacion_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec := to_jsonb(OLD);
  ELSE
    v_rec := to_jsonb(NEW);
  END IF;

  IF TG_TABLE_NAME = 'operaciones' THEN
    v_operacion_id := (v_rec ->> 'id')::uuid;
  ELSE
    v_operacion_id := (v_rec ->> 'operacion_id')::uuid;
  END IF;

  IF public.facturacion_operacion_autorizada(v_operacion_id) THEN
    RAISE EXCEPTION 'No se puede modificar una venta con comprobante fiscal autorizado';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_arreglo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rec jsonb;
  v_arreglo_id uuid;
  v_protegido boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec := to_jsonb(OLD);
  ELSE
    v_rec := to_jsonb(NEW);
  END IF;

  IF TG_TABLE_NAME = 'arreglos' THEN
    v_arreglo_id := (v_rec ->> 'id')::uuid;
    v_protegido := public.facturacion_arreglo_autorizado(v_arreglo_id);
    IF NOT v_protegido THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
    IF TG_OP = 'DELETE'
       OR OLD.vehiculo_id IS DISTINCT FROM NEW.vehiculo_id
       OR OLD.taller_id IS DISTINCT FROM NEW.taller_id
       OR OLD.fecha IS DISTINCT FROM NEW.fecha
       OR OLD.precio_final IS DISTINCT FROM NEW.precio_final
       OR OLD.precio_sin_iva IS DISTINCT FROM NEW.precio_sin_iva
       OR OLD.estado IS DISTINCT FROM NEW.estado THEN
      RAISE EXCEPTION 'El arreglo ya posee una factura electronica autorizada y sus datos fiscales no se pueden modificar';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'vehiculos' THEN
    IF TG_OP = 'UPDATE' AND OLD.cliente_id IS NOT DISTINCT FROM NEW.cliente_id THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.arreglos a
      WHERE a.vehiculo_id = (v_rec ->> 'id')::uuid
        AND public.facturacion_arreglo_autorizado(a.id)
    ) THEN
      RAISE EXCEPTION 'No se puede cambiar el cliente de un vehiculo con arreglos facturados';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_TABLE_NAME = 'operaciones_lineas' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = (v_rec ->> 'operacion_id')::uuid
    LIMIT 1;
  ELSIF TG_TABLE_NAME = 'operaciones' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = (v_rec ->> 'id')::uuid
    LIMIT 1;
  ELSE
    v_arreglo_id := (v_rec ->> 'arreglo_id')::uuid;
  END IF;

  IF v_arreglo_id IS NOT NULL AND public.facturacion_arreglo_autorizado(v_arreglo_id) THEN
    RAISE EXCEPTION 'No se pueden modificar lineas de un arreglo con factura electronica autorizada';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalcular_precio_final_arreglo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec jsonb;
  v_arreglo_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec := to_jsonb(OLD);
  ELSE
    v_rec := to_jsonb(NEW);
  END IF;

  IF TG_TABLE_NAME = 'detalle_arreglo' THEN
    v_arreglo_id := (v_rec ->> 'arreglo_id')::uuid;
  
  ELSIF TG_TABLE_NAME = 'operaciones_asignacion_arreglo' THEN
    v_arreglo_id := (v_rec ->> 'arreglo_id')::uuid;
  
  ELSIF TG_TABLE_NAME = 'operaciones_lineas' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = (v_rec ->> 'operacion_id')::uuid
    LIMIT 1;
    
    IF v_arreglo_id IS NULL THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
  END IF;

  IF v_arreglo_id IS NOT NULL THEN
    UPDATE public.arreglos
    SET precio_final = public.calcular_precio_final_arreglo(v_arreglo_id)
    WHERE id = v_arreglo_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

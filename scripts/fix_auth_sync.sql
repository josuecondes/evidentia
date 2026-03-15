-- ========================================================================================
-- FIX FINAL (v3): Sincronización ultra-robusta
-- ========================================================================================
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- ========================================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Perfil básico (Operación Crítica)
  INSERT INTO public.usuarios (id, nombre, email, rol)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'),
    new.email,
    'cliente'
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    email  = EXCLUDED.email;

  -- 2. Estructura (Operación Secundaria - Protegida)
  BEGIN
    INSERT INTO public.clientes_estructura (
      usuario_id,
      sesiones_semanales,
      distribucion_semanal,
      hora_habitual,
      precio_por_sesion,
      fecha_inicio,
      estado
    )
    VALUES (
      new.id,
      COALESCE((new.raw_user_meta_data->>'sesiones_semanales')::INTEGER, 1),
      CASE 
        WHEN new.raw_user_meta_data ? 'distribucion_semanal' 
        THEN ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data->'distribucion_semanal'))
        ELSE ARRAY['lun']::TEXT[]
      END,
      COALESCE(new.raw_user_meta_data->>'hora_habitual', '10:00'),
      COALESCE((new.raw_user_meta_data->>'precio_por_sesion')::NUMERIC, 0),
      CASE 
        WHEN NULLIF(new.raw_user_meta_data->>'fecha_inicio', '') IS NOT NULL 
        THEN (new.raw_user_meta_data->>'fecha_inicio')::DATE 
        ELSE NULL 
      END,
      'activo'
    )
    ON CONFLICT (usuario_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Fallo silencioso en estructura para no bloquear el registro
    NULL;
  END;

  RETURN new;
END;
$$;

-- Re-vincular trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- KILLAQ · 002 · Permisos de perfiles, reseñas, pedidos y estadísticas.
-- Ejecutar después de 001_restore_media.sql. Requiere el esquema base existente.
-- Es idempotente. No elimina filas, asigna administradores ni altera precios.
BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); $$;

-- Los clientes no pueden elevar su rol ni siquiera al insertar un perfil.
-- Las operaciones del SQL Editor/servicio sin sesión de cliente siguen disponibles.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.role IS DISTINCT FROM 'customer' THEN RAISE EXCEPTION 'Rol no permitido'; END IF;
    ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Solo un administrador puede cambiar roles de usuario';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_profile_role_self_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_role_self_escalation BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_self_escalation();

-- Mantener aprobación y autoría de reseñas bajo control administrativo.
CREATE OR REPLACE FUNCTION public.protect_review_moderation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.is_approved THEN RAISE EXCEPTION 'La reseña requiere moderación'; END IF;
    ELSIF NEW.is_approved IS DISTINCT FROM OLD.is_approved
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN
      RAISE EXCEPTION 'No puedes modificar la moderación ni la autoría de una reseña';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_review_moderation ON public.reviews;
CREATE TRIGGER protect_review_moderation BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.protect_review_moderation();

-- Un cliente no puede insertar un pedido como pagado/entregado ni referencias de pago.
-- Los importes deberán calcularse en servidor al implementar una pasarela real.
DROP POLICY IF EXISTS "Usuario puede crear su propia orden" ON public.orders;
CREATE POLICY "Usuario puede crear su propia orden" ON public.orders FOR INSERT
  WITH CHECK (public.is_admin() OR (user_id = auth.uid() AND status = 'pending'
    AND payment_status = 'pending' AND payment_ref IS NULL));

-- Las imágenes de piezas despublicadas no deben exponerse por la tabla.
DROP POLICY IF EXISTS "Imágenes visibles para todos" ON public.product_images;
CREATE POLICY "Imágenes visibles para todos" ON public.product_images FOR SELECT
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.is_active));

-- Una vista con propietario elevado debe comprobar explícitamente el rol.
CREATE OR REPLACE VIEW public.admin_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM public.products WHERE is_active) AS total_products,
  (SELECT COUNT(*) FROM public.products WHERE stock = 0 AND is_active) AS out_of_stock,
  (SELECT COUNT(*) FROM public.orders WHERE status = 'pending') AS pending_orders,
  (SELECT COUNT(*) FROM public.orders WHERE DATE(created_at) = CURRENT_DATE) AS orders_today,
  (SELECT COALESCE(SUM(total), 0) FROM public.orders WHERE payment_status = 'paid'
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) AS revenue_this_month,
  (SELECT COUNT(*) FROM auth.users) AS total_users,
  (SELECT COUNT(*) FROM public.reviews WHERE NOT is_approved) AS pending_reviews
WHERE public.is_admin();
REVOKE ALL ON public.admin_dashboard_stats FROM PUBLIC, anon;
GRANT SELECT ON public.admin_dashboard_stats TO authenticated;

COMMIT;

-- =============================================================
--  KILLAQ JOYERIA FINA - Mejoras de arquitectura complementarias
--  Ejecutar DESPUES de killaq_schema.sql.
--  Archivo idempotente: no recrea el esquema base ya aplicado.
-- =============================================================

-- 0. Perfil extendido + bootstrap del dueño.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS document_type TEXT
        CHECK (document_type IS NULL OR document_type IN ('dni','carnet_extranjeria','pasaporte','ruc')),
    ADD COLUMN IF NOT EXISTS document_number TEXT,
    ADD COLUMN IF NOT EXISTS birthdate DATE,
    ADD COLUMN IF NOT EXISTS residence_country TEXT DEFAULT 'Peru',
    ADD COLUMN IF NOT EXISTS residence_city TEXT,
    ADD COLUMN IF NOT EXISTS residence_district TEXT,
    ADD COLUMN IF NOT EXISTS residence_address TEXT,
    ADD COLUMN IF NOT EXISTS reference_note TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_document_number
    ON public.profiles(document_number)
    WHERE document_number IS NOT NULL;

-- Asigna acceso admin a la cuenta del dueño.
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
    SELECT id
    FROM auth.users
    WHERE email = 'sebastian.17shulla@gmail.com'
    LIMIT 1
);

-- Evita que un cliente se asigne admin editando su propio perfil.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo un administrador puede cambiar roles de usuario';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_self_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_role_self_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_self_escalation();

-- 1. Reforzar helper admin con search_path explicito.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    );
$$;

-- 2. Restricciones utiles para calidad de datos existentes.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_compare_price_gt_price'
    ) THEN
        ALTER TABLE public.products
        ADD CONSTRAINT products_compare_price_gt_price
        CHECK (compare_price IS NULL OR compare_price > price) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'hero_slides_cta_url_not_empty'
    ) THEN
        ALTER TABLE public.hero_slides
        ADD CONSTRAINT hero_slides_cta_url_not_empty
        CHECK (length(trim(cta_url)) > 0) NOT VALID;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_product_sort_unique
    ON public.product_images(product_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_products_created_at
    ON public.products(created_at DESC);

-- 3. Configuracion editable del sitio.
CREATE TABLE IF NOT EXISTS public.site_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS site_settings_updated_at ON public.site_settings;
CREATE TRIGGER site_settings_updated_at
    BEFORE UPDATE ON public.site_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'site_settings'
          AND policyname = 'Configuracion visible para todos'
    ) THEN
        CREATE POLICY "Configuracion visible para todos"
            ON public.site_settings FOR SELECT
            USING (TRUE);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'site_settings'
          AND policyname = 'Solo admin gestiona configuracion'
    ) THEN
        CREATE POLICY "Solo admin gestiona configuracion"
            ON public.site_settings FOR ALL
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

INSERT INTO public.site_settings (key, value, description)
VALUES
    ('contact', '{"phone":"+51 912 964 356","email":"contacto@killaq.pe","city":"Lima, Peru"}', 'Datos de contacto publicos'),
    ('checkout', '{"mode":"whatsapp","whatsapp":"+51912964356"}', 'Configuracion temporal de checkout')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 3.b. Ofertas: se consideran productos activos con compare_price mayor al precio vigente.
CREATE INDEX IF NOT EXISTS idx_products_active_offers
    ON public.products(created_at DESC)
    WHERE is_active = TRUE
      AND compare_price IS NOT NULL
      AND compare_price > price;

-- 4. Auditoria simple para acciones administrativas.
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    entity      TEXT NOT NULL,
    entity_id   TEXT,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
    ON public.admin_audit_logs(actor_id, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'admin_audit_logs'
          AND policyname = 'Solo admin ve auditoria'
    ) THEN
        CREATE POLICY "Solo admin ve auditoria"
            ON public.admin_audit_logs FOR SELECT
            USING (public.is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'admin_audit_logs'
          AND policyname = 'Solo admin escribe auditoria'
    ) THEN
        CREATE POLICY "Solo admin escribe auditoria"
            ON public.admin_audit_logs FOR INSERT
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- 5. Movimientos de inventario: deja trazabilidad al cambiar stock.
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id          BIGSERIAL PRIMARY KEY,
    product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('manual_adjustment','sale','return','restock')),
    quantity_delta INT NOT NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product
    ON public.inventory_movements(product_id, created_at DESC);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'inventory_movements'
          AND policyname = 'Solo admin gestiona movimientos de inventario'
    ) THEN
        CREATE POLICY "Solo admin gestiona movimientos de inventario"
            ON public.inventory_movements FOR ALL
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- 6. Leads de contacto para consultas sin checkout inmediato.
CREATE TABLE IF NOT EXISTS public.contact_leads (
    id          BIGSERIAL PRIMARY KEY,
    full_name   TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    message     TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'web',
    status      TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','contacted','closed','spam')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS contact_leads_updated_at ON public.contact_leads;
CREATE TRIGGER contact_leads_updated_at
    BEFORE UPDATE ON public.contact_leads
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contact_leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'contact_leads'
          AND policyname = 'Cualquiera puede crear leads'
    ) THEN
        CREATE POLICY "Cualquiera puede crear leads"
            ON public.contact_leads FOR INSERT
            WITH CHECK (TRUE);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'contact_leads'
          AND policyname = 'Solo admin gestiona leads'
    ) THEN
        CREATE POLICY "Solo admin gestiona leads"
            ON public.contact_leads FOR ALL
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- 7. Libro de reclamaciones.
CREATE TABLE IF NOT EXISTS public.complaints_book (
    id              BIGSERIAL PRIMARY KEY,
    full_name       TEXT NOT NULL,
    document_number TEXT NOT NULL,
    email           TEXT,
    phone           TEXT NOT NULL,
    address         TEXT,
    claim_type      TEXT NOT NULL DEFAULT 'reclamo'
                    CHECK (claim_type IN ('reclamo','queja')),
    order_reference TEXT,
    detail          TEXT NOT NULL,
    request         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','in_review','answered','closed')),
    response        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS complaints_book_updated_at ON public.complaints_book;
CREATE TRIGGER complaints_book_updated_at
    BEFORE UPDATE ON public.complaints_book
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_complaints_book_created_at
    ON public.complaints_book(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaints_book_status
    ON public.complaints_book(status);

ALTER TABLE public.complaints_book ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'complaints_book'
          AND policyname = 'Cualquiera puede registrar reclamaciones'
    ) THEN
        CREATE POLICY "Cualquiera puede registrar reclamaciones"
            ON public.complaints_book FOR INSERT
            WITH CHECK (TRUE);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'complaints_book'
          AND policyname = 'Solo admin gestiona reclamaciones'
    ) THEN
        CREATE POLICY "Solo admin gestiona reclamaciones"
            ON public.complaints_book FOR ALL
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- FIN

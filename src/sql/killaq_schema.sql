-- =============================================================
--  KILLAQ JOYERÍA — Esquema Completo de Base de Datos
--  Plataforma: Supabase (PostgreSQL)
--  Incluye: Auth, Perfiles, Catálogo, Carrito, Órdenes,
--           Panel Admin, Carrusel Hero, RLS Policies
-- =============================================================


-- =============================================================
-- 0. EXTENSIONES
-- =============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsqueda de texto


-- =============================================================
-- 1. PERFILES DE USUARIO
--    Extiende auth.users de Supabase
-- =============================================================
CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    phone       TEXT,
    avatar_url  TEXT,
    role        TEXT NOT NULL DEFAULT 'customer'
                    CHECK (role IN ('customer', 'admin')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================
-- 2. CATEGORÍAS Y SUBCATEGORÍAS
-- =============================================================
CREATE TABLE public.categories (
    id          SERIAL PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,      -- ej: 'anillos'
    name        TEXT NOT NULL,             -- ej: 'Anillos'
    description TEXT,
    image_url   TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.subcategories (
    id          SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    slug        TEXT UNIQUE NOT NULL,      -- ej: 'anillos-compromiso'
    name        TEXT NOT NULL,             -- ej: 'Compromiso'
    description TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Datos iniciales: Categorías
INSERT INTO public.categories (slug, name, sort_order) VALUES
    ('anillos',   'Anillos',   1),
    ('collares',  'Collares',  2),
    ('aretes',    'Aretes',    3),
    ('pulseras',  'Pulseras',  4);

-- Datos iniciales: Subcategorías
INSERT INTO public.subcategories (category_id, slug, name, sort_order) VALUES
    -- Anillos
    (1, 'anillos-compromiso',  'Compromiso',  1),
    (1, 'anillos-matrimonio',  'Matrimonio',  2),
    (1, 'anillos-moda',        'Moda',        3),
    (1, 'anillos-sellos',      'Sellos',      4),
    -- Collares
    (2, 'collares-cadenas',    'Cadenas',     1),
    (2, 'collares-dijes',      'Dijes',       2),
    (2, 'collares-gargantillas','Gargantillas',3),
    -- Aretes
    (3, 'aretes-argollas',     'Argollas',    1),
    (3, 'aretes-broqueles',    'Broqueles',   2),
    (3, 'aretes-largos',       'Largos',      3),
    -- Pulseras
    (4, 'pulseras-brazaletes', 'Brazaletes',  1),
    (4, 'pulseras-cadenas',    'Cadenas',     2),
    (4, 'pulseras-amuletos',   'Amuletos',    3);


-- =============================================================
-- 3. MATERIALES
--    El admin puede añadir/editar desde el panel
-- =============================================================
CREATE TABLE public.materials (
    id          SERIAL PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,   -- ej: 'oro-18k'
    name        TEXT NOT NULL,          -- ej: 'Oro 18k'
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Datos iniciales: Materiales
INSERT INTO public.materials (slug, name, sort_order) VALUES
    ('oro-18k',   'Oro 18k',   1),
    ('oro-14k',   'Oro 14k',   2),
    ('oro-rosa',  'Oro Rosa',  3),
    ('plata-950', 'Plata 950', 4),
    ('plata-925', 'Plata 925', 5);


-- =============================================================
-- 4. COLECCIONES (ej: "Eternidad", "Matrimonio")
-- =============================================================
CREATE TABLE public.collections (
    id          SERIAL PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    image_url   TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================
-- 5. PRODUCTOS
-- =============================================================
CREATE TABLE public.products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    compare_price   NUMERIC(10,2),              -- Precio tachado (oferta)
    category_id     INT REFERENCES public.categories(id) ON DELETE SET NULL,
    subcategory_id  INT REFERENCES public.subcategories(id) ON DELETE SET NULL,
    material_id     INT REFERENCES public.materials(id) ON DELETE SET NULL,
    collection_id   INT REFERENCES public.collections(id) ON DELETE SET NULL,
    stock           INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,   -- Productos Destacados (Home)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,    -- Visible en tienda
    sku             TEXT UNIQUE,
    weight_grams    NUMERIC(8,2),
    -- Campos extra para anillos
    sizes_available TEXT[],   -- ej: ARRAY['6','7','8','9']
    -- Campos SEO
    meta_title      TEXT,
    meta_description TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Índices para búsqueda y filtrado
CREATE INDEX idx_products_category    ON public.products(category_id);
CREATE INDEX idx_products_subcategory ON public.products(subcategory_id);
CREATE INDEX idx_products_material    ON public.products(material_id);
CREATE INDEX idx_products_featured    ON public.products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_products_active      ON public.products(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_products_price       ON public.products(price);
-- Búsqueda full-text en nombre y descripción
CREATE INDEX idx_products_search ON public.products
    USING GIN (to_tsvector('spanish', coalesce(name,'') || ' ' || coalesce(description,'')));


-- =============================================================
-- 6. IMÁGENES DE PRODUCTOS (Cloudinary URLs)
-- =============================================================
CREATE TABLE public.product_images (
    id          SERIAL PRIMARY KEY,
    product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,          -- URL de Cloudinary
    alt_text    TEXT,
    sort_order  INT NOT NULL DEFAULT 0, -- 0 = imagen principal
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON public.product_images(product_id);


-- =============================================================
-- 7. CARRUSEL HERO (Panel Admin)
-- =============================================================
CREATE TABLE public.hero_slides (
    id              SERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    subtitle        TEXT,
    cta_text        TEXT DEFAULT 'VER CATÁLOGO',
    cta_url         TEXT DEFAULT '/colecciones',
    image_url       TEXT NOT NULL,          -- Cloudinary
    image_alt       TEXT,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER hero_slides_updated_at
    BEFORE UPDATE ON public.hero_slides
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Datos iniciales
INSERT INTO public.hero_slides (title, subtitle, cta_url, image_url, sort_order) VALUES
    ('Colección Matrimonio', 'Sella tu promesa con el brillo de nuestros diamantes exclusivos.',
     '/colecciones/matrimonio', 'https://res.cloudinary.com/placeholder/hero-matrimonio.jpg', 1),
    ('Nueva Colección Eternidad', 'Descubre piezas únicas diseñadas para brillar eternamente.',
     '/colecciones/eternidad',  'https://res.cloudinary.com/placeholder/hero-eternidad.jpg', 2);


-- =============================================================
-- 8. CARRITO DE COMPRAS
-- =============================================================
CREATE TABLE public.carts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id  TEXT,   -- Para usuarios no logueados
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cart_owner CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE TABLE public.cart_items (
    id          SERIAL PRIMARY KEY,
    cart_id     UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity    INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    size        TEXT,                   -- Talla seleccionada (para anillos)
    unit_price  NUMERIC(10,2) NOT NULL, -- Precio al momento de añadir
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cart_id, product_id, size)
);

CREATE TRIGGER carts_updated_at
    BEFORE UPDATE ON public.carts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================
-- 9. ÓRDENES / PEDIDOS
-- =============================================================
-- Secuencia para número de orden (debe ir ANTES de la tabla)
CREATE SEQUENCE IF NOT EXISTS order_seq START 1;

CREATE TABLE public.orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number    TEXT UNIQUE NOT NULL DEFAULT 'KLQ-' || LPAD(NEXTVAL('order_seq')::TEXT, 6, '0'),
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Datos del cliente (snapshot al momento de comprar)
    customer_name   TEXT NOT NULL,
    customer_email  TEXT NOT NULL,
    customer_phone  TEXT,
    -- Dirección de envío
    shipping_address TEXT,
    shipping_city    TEXT,
    shipping_country TEXT DEFAULT 'Perú',
    -- Totales
    subtotal        NUMERIC(10,2) NOT NULL,
    shipping_cost   NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount        NUMERIC(10,2) NOT NULL DEFAULT 0,
    total           NUMERIC(10,2) NOT NULL,
    -- Estado
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
    payment_status  TEXT NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending','paid','failed','refunded')),
    payment_method  TEXT,
    payment_ref     TEXT,   -- Referencia externa (Culqi, PayPal, etc.)
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.order_items (
    id              SERIAL PRIMARY KEY,
    order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name    TEXT NOT NULL,  -- Snapshot del nombre
    product_sku     TEXT,
    quantity        INT NOT NULL CHECK (quantity > 0),
    size            TEXT,
    unit_price      NUMERIC(10,2) NOT NULL,
    total_price     NUMERIC(10,2) NOT NULL,
    image_url       TEXT
);

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_orders_user   ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);


-- =============================================================
-- 10. DIRECCIONES DE ENVÍO GUARDADAS
-- =============================================================
CREATE TABLE public.addresses (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label       TEXT DEFAULT 'Casa',    -- "Casa", "Trabajo", etc.
    full_name   TEXT NOT NULL,
    phone       TEXT,
    address     TEXT NOT NULL,
    district    TEXT,
    city        TEXT NOT NULL DEFAULT 'Lima',
    country     TEXT NOT NULL DEFAULT 'Perú',
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================
-- 11. LISTA DE DESEOS (Wishlist)
-- =============================================================
CREATE TABLE public.wishlists (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);


-- =============================================================
-- 12. RESEÑAS DE PRODUCTOS
-- =============================================================
CREATE TABLE public.reviews (
    id          SERIAL PRIMARY KEY,
    product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title       TEXT,
    body        TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, user_id)
);


-- =============================================================
-- 13. FUNCIÓN: BÚSQUEDA DE PRODUCTOS
--    Búsqueda por texto, categoría, material y rango de precio
-- =============================================================
CREATE OR REPLACE FUNCTION public.search_products(
    search_query    TEXT    DEFAULT NULL,
    p_category_slug TEXT    DEFAULT NULL,
    p_material_ids  INT[]   DEFAULT NULL,
    p_min_price     NUMERIC DEFAULT NULL,
    p_max_price     NUMERIC DEFAULT NULL,
    p_sort_by       TEXT    DEFAULT 'relevance',  -- 'relevance','price_asc','price_desc','newest'
    p_limit         INT     DEFAULT 20,
    p_offset        INT     DEFAULT 0
)
RETURNS TABLE (
    id              UUID,
    slug            TEXT,
    name            TEXT,
    price           NUMERIC,
    compare_price   NUMERIC,
    category_name   TEXT,
    subcategory_name TEXT,
    material_name   TEXT,
    stock           INT,
    is_featured     BOOLEAN,
    primary_image   TEXT,
    total_count     BIGINT
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    WITH filtered AS (
        SELECT
            p.id, p.slug, p.name, p.price, p.compare_price,
            c.name  AS category_name,
            sc.name AS subcategory_name,
            m.name  AS material_name,
            p.stock, p.is_featured,
            (SELECT pi.url FROM public.product_images pi
             WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS primary_image,
            COUNT(*) OVER() AS total_count
        FROM public.products p
        LEFT JOIN public.categories    c  ON c.id = p.category_id
        LEFT JOIN public.subcategories sc ON sc.id = p.subcategory_id
        LEFT JOIN public.materials     m  ON m.id = p.material_id
        WHERE
            p.is_active = TRUE
            AND (p_category_slug IS NULL OR c.slug = p_category_slug)
            AND (p_material_ids  IS NULL OR p.material_id = ANY(p_material_ids))
            AND (p_min_price     IS NULL OR p.price >= p_min_price)
            AND (p_max_price     IS NULL OR p.price <= p_max_price)
            AND (
                search_query IS NULL OR
                to_tsvector('spanish', coalesce(p.name,'') || ' ' || coalesce(p.description,''))
                    @@ plainto_tsquery('spanish', search_query)
            )
    )
    SELECT * FROM filtered
    ORDER BY
        CASE WHEN p_sort_by = 'price_asc'  THEN filtered.price  END ASC,
        CASE WHEN p_sort_by = 'price_desc' THEN filtered.price  END DESC,
        CASE WHEN p_sort_by = 'newest'     THEN filtered.id::TEXT END DESC,
        filtered.is_featured DESC,
        filtered.name ASC
    LIMIT  p_limit
    OFFSET p_offset;
END;
$$;


-- =============================================================
-- 14. ROW LEVEL SECURITY (RLS) — Seguridad por fila
-- =============================================================

-- Helper: verificar si el usuario actual es admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- ── PROFILES ──────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfil visible por su dueño o admin"
    ON public.profiles FOR SELECT
    USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Perfil editable solo por su dueño"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

-- ── CATEGORIES (lectura pública, escritura solo admin) ─────────
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorías visibles para todos"
    ON public.categories FOR SELECT USING (TRUE);

CREATE POLICY "Solo admin puede gestionar categorías"
    ON public.categories FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── SUBCATEGORIES ──────────────────────────────────────────────
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subcategorías visibles para todos"
    ON public.subcategories FOR SELECT USING (TRUE);

CREATE POLICY "Solo admin puede gestionar subcategorías"
    ON public.subcategories FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── MATERIALS ─────────────────────────────────────────────────
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Materiales visibles para todos"
    ON public.materials FOR SELECT USING (TRUE);

CREATE POLICY "Solo admin puede gestionar materiales"
    ON public.materials FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── COLLECTIONS ───────────────────────────────────────────────
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colecciones visibles para todos"
    ON public.collections FOR SELECT USING (TRUE);

CREATE POLICY "Solo admin puede gestionar colecciones"
    ON public.collections FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── PRODUCTS (lectura pública de activos, escritura solo admin) ─
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Productos activos visibles para todos"
    ON public.products FOR SELECT
    USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Solo admin puede gestionar productos"
    ON public.products FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── PRODUCT IMAGES ────────────────────────────────────────────
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Imágenes visibles para todos"
    ON public.product_images FOR SELECT USING (TRUE);

CREATE POLICY "Solo admin puede gestionar imágenes"
    ON public.product_images FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── HERO SLIDES ───────────────────────────────────────────────
ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Slides activos visibles para todos"
    ON public.hero_slides FOR SELECT
    USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Solo admin puede gestionar slides"
    ON public.hero_slides FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── CARTS ─────────────────────────────────────────────────────
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Carrito propio del usuario"
    ON public.carts FOR ALL
    USING (user_id = auth.uid() OR public.is_admin());

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items del carrito del usuario"
    ON public.cart_items FOR ALL
    USING (
        cart_id IN (SELECT id FROM public.carts WHERE user_id = auth.uid())
        OR public.is_admin()
    );

-- ── ORDERS ────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Órdenes propias del usuario o admin"
    ON public.orders FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Usuario puede crear su propia orden"
    ON public.orders FOR INSERT
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Solo admin puede actualizar órdenes"
    ON public.orders FOR UPDATE
    USING (public.is_admin());

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items de la orden visible por dueño o admin"
    ON public.order_items FOR SELECT
    USING (
        order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
        OR public.is_admin()
    );

-- ── ADDRESSES ─────────────────────────────────────────────────
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Direcciones propias o admin"
    ON public.addresses FOR ALL
    USING (user_id = auth.uid() OR public.is_admin());

-- ── WISHLISTS ─────────────────────────────────────────────────
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wishlist propia del usuario"
    ON public.wishlists FOR ALL
    USING (user_id = auth.uid());

-- ── REVIEWS ───────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reseñas aprobadas visibles para todos"
    ON public.reviews FOR SELECT
    USING (is_approved = TRUE OR user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Usuario puede crear su reseña"
    ON public.reviews FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuario puede editar su propia reseña"
    ON public.reviews FOR UPDATE
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Solo admin puede aprobar/eliminar reseñas"
    ON public.reviews FOR DELETE
    USING (public.is_admin());


-- =============================================================
-- 15. VISTA: Dashboard Admin — resumen rápido
-- =============================================================
CREATE OR REPLACE VIEW public.admin_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM public.products WHERE is_active = TRUE)           AS total_products,
    (SELECT COUNT(*) FROM public.products WHERE stock = 0 AND is_active = TRUE) AS out_of_stock,
    (SELECT COUNT(*) FROM public.orders WHERE status = 'pending')           AS pending_orders,
    (SELECT COUNT(*) FROM public.orders WHERE DATE(created_at) = CURRENT_DATE) AS orders_today,
    (SELECT COALESCE(SUM(total),0) FROM public.orders WHERE payment_status = 'paid'
     AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW()))      AS revenue_this_month,
    (SELECT COUNT(*) FROM auth.users)                                        AS total_users,
    (SELECT COUNT(*) FROM public.reviews WHERE is_approved = FALSE)         AS pending_reviews;


-- =============================================================
-- 16. ÍNDICE ADICIONAL PARA BÚSQUEDA POR SLUG
-- =============================================================
CREATE INDEX idx_categories_slug    ON public.categories(slug);
CREATE INDEX idx_subcategories_slug ON public.subcategories(slug);
CREATE INDEX idx_materials_slug     ON public.materials(slug);
CREATE INDEX idx_products_slug      ON public.products(slug);


-- =============================================================
-- FIN DEL ESQUEMA
-- Para asignar un admin manualmente, ejecutar:
--   UPDATE public.profiles SET role = 'admin' WHERE id = '<user-uuid>';
-- =============================================================


-- =============================================================
-- 17. VIDEOS DE PRODUCTOS Y REDES SOCIALES
--    Ejecutar si tu proyecto fue creado antes de esta mejora.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.product_videos (
    id          SERIAL PRIMARY KEY,
    product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    video_type  TEXT NOT NULL DEFAULT 'upload'
                    CHECK (video_type IN ('upload','instagram','tiktok','external')),
    title       TEXT,
    url         TEXT NOT NULL,
    poster_url  TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_videos_product
    ON public.product_videos(product_id);

CREATE TABLE IF NOT EXISTS public.social_videos (
    id            SERIAL PRIMARY KEY,
    platform      TEXT NOT NULL DEFAULT 'instagram'
                      CHECK (platform IN ('instagram','tiktok','external')),
    title         TEXT NOT NULL,
    video_url     TEXT NOT NULL,
    thumbnail_url TEXT,
    sort_order    INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_videos_active
    ON public.social_videos(is_active, sort_order);

ALTER TABLE public.product_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Videos de producto visibles para todos" ON public.product_videos;
DROP POLICY IF EXISTS "Solo admin puede gestionar videos de producto" ON public.product_videos;

CREATE POLICY "Videos de producto visibles para todos"
    ON public.product_videos FOR SELECT USING (TRUE);

CREATE POLICY "Solo admin puede gestionar videos de producto"
    ON public.product_videos FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.social_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Videos sociales activos visibles para todos" ON public.social_videos;
DROP POLICY IF EXISTS "Solo admin puede gestionar videos sociales" ON public.social_videos;

CREATE POLICY "Videos sociales activos visibles para todos"
    ON public.social_videos FOR SELECT
    USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Solo admin puede gestionar videos sociales"
    ON public.social_videos FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-videos',
    'product-videos',
    TRUE,
    104857600,
    ARRAY['video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Videos de producto publicos en storage" ON storage.objects;
DROP POLICY IF EXISTS "Solo admin puede subir videos de producto" ON storage.objects;
DROP POLICY IF EXISTS "Solo admin puede actualizar videos de producto" ON storage.objects;
DROP POLICY IF EXISTS "Solo admin puede eliminar videos de producto" ON storage.objects;

CREATE POLICY "Videos de producto publicos en storage"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'product-videos');

CREATE POLICY "Solo admin puede subir videos de producto"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'product-videos' AND public.is_admin());

CREATE POLICY "Solo admin puede actualizar videos de producto"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'product-videos' AND public.is_admin())
    WITH CHECK (bucket_id = 'product-videos' AND public.is_admin());

CREATE POLICY "Solo admin puede eliminar videos de producto"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'product-videos' AND public.is_admin());

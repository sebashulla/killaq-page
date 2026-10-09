-- KILLAQ · 001 · Restaurar tablas de videos y bucket.
-- Ejecutar en Supabase SQL Editor sobre el esquema Killaq existente.
-- Es idempotente. No inserta productos ni modifica el catálogo.
BEGIN;

CREATE TABLE IF NOT EXISTS public.product_videos (
  id SERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  video_type TEXT NOT NULL DEFAULT 'upload' CHECK (video_type IN ('upload','instagram','tiktok','external')),
  title TEXT,
  url TEXT NOT NULL,
  poster_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.social_videos (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'instagram' CHECK (platform IN ('instagram','tiktok','external')),
  title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_videos_product ON public.product_videos(product_id);
CREATE INDEX IF NOT EXISTS idx_social_videos_active ON public.social_videos(is_active, sort_order);
ALTER TABLE public.product_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Videos de producto visibles para todos" ON public.product_videos;
DROP POLICY IF EXISTS "Solo admin puede gestionar videos de producto" ON public.product_videos;
CREATE POLICY "Videos de producto visibles para todos" ON public.product_videos FOR SELECT
  USING (public.is_admin() OR (is_active AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.is_active)));
CREATE POLICY "Solo admin puede gestionar videos de producto" ON public.product_videos FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Videos sociales activos visibles para todos" ON public.social_videos;
DROP POLICY IF EXISTS "Solo admin puede gestionar videos sociales" ON public.social_videos;
CREATE POLICY "Videos sociales activos visibles para todos" ON public.social_videos FOR SELECT
  USING (is_active OR public.is_admin());
CREATE POLICY "Solo admin puede gestionar videos sociales" ON public.social_videos FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT ON public.product_videos, public.social_videos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_videos, public.social_videos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.product_videos_id_seq, public.social_videos_id_seq TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-videos', 'product-videos', TRUE, 104857600, ARRAY['video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS "Videos de producto publicos en storage" ON storage.objects;
DROP POLICY IF EXISTS "Solo admin puede subir videos de producto" ON storage.objects;
DROP POLICY IF EXISTS "Solo admin puede actualizar videos de producto" ON storage.objects;
DROP POLICY IF EXISTS "Solo admin puede eliminar videos de producto" ON storage.objects;
CREATE POLICY "Videos de producto publicos en storage" ON storage.objects FOR SELECT USING (bucket_id = 'product-videos');
CREATE POLICY "Solo admin puede subir videos de producto" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-videos' AND public.is_admin());
CREATE POLICY "Solo admin puede actualizar videos de producto" ON storage.objects FOR UPDATE USING (bucket_id = 'product-videos' AND public.is_admin()) WITH CHECK (bucket_id = 'product-videos' AND public.is_admin());
CREATE POLICY "Solo admin puede eliminar videos de producto" ON storage.objects FOR DELETE USING (bucket_id = 'product-videos' AND public.is_admin());

COMMIT;

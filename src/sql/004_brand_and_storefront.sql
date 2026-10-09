-- KILLAQ · 004 · Portada y experiencia de marca
-- Ejecutar completo después de 001, 002 y 003 en el SQL Editor de Supabase.
-- No elimina campañas propias, productos ni datos de contacto existentes.
BEGIN;

ALTER TABLE public.hero_slides
  ADD COLUMN IF NOT EXISTS jewelry_tone TEXT NOT NULL DEFAULT 'gold'
    CHECK (jewelry_tone IN ('gold', 'silver')),
  ADD COLUMN IF NOT EXISTS background_style TEXT NOT NULL DEFAULT 'auto'
    CHECK (background_style IN ('auto', 'black', 'gold', 'white')),
  ADD COLUMN IF NOT EXISTS image_fit TEXT NOT NULL DEFAULT 'cover'
    CHECK (image_fit IN ('contain', 'cover'));

-- Reemplaza solamente la primera campaña de ejemplo intacta.
UPDATE public.hero_slides
SET title = E'El brillo de lo\nque permanece.',
    subtitle = 'Hay detalles que dicen todo. Descubre joyas de oro y plata para llevar contigo lo que más importa.',
    cta_text = 'Descubrir las joyas', cta_url = '/colecciones',
    image_url = '/images/killaq-ring-v2.png',
    image_alt = 'Anillo de oro con gema, imagen ilustrativa de campaña Killaq',
    jewelry_tone = 'gold', background_style = 'black', image_fit = 'contain'
WHERE title = 'Colección Matrimonio'
  AND subtitle = 'Sella tu promesa con el brillo de nuestros diamantes exclusivos.'
  AND cta_text = 'VER CATÁLOGO' AND cta_url = '/colecciones/matrimonio'
  AND image_alt IS NULL
  AND (image_url = '/images/hero-bg.png' OR image_url LIKE '%/placeholder/%');

-- Conserva la segunda campaña de ejemplo para poder editarla en el panel.
UPDATE public.hero_slides SET is_active = FALSE
WHERE title = 'Nueva Colección Eternidad'
  AND subtitle = 'Descubre piezas únicas diseñadas para brillar eternamente.'
  AND cta_text = 'VER CATÁLOGO' AND cta_url = '/colecciones/eternidad'
  AND image_alt IS NULL
  AND (image_url = '/images/product-1.png' OR image_url LIKE '%/placeholder/%');

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Configuracion visible para todos" ON public.site_settings;
CREATE POLICY "Configuracion visible para todos" ON public.site_settings FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Solo admin gestiona configuracion" ON public.site_settings;
CREATE POLICY "Solo admin gestiona configuracion" ON public.site_settings FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;

INSERT INTO public.site_settings (key, value, description)
VALUES ('storefront', '{
  "welcome_enabled": true,
  "artisan_enabled": true,
  "hero_autoplay": false,
  "hero_interval": 9,
  "personalized_title": "Una idea tuya.\nUna joya única.",
  "personalized_description": "Hay piezas que empiezan con un recuerdo, un deseo o un boceto. Conversemos sobre la joya que imaginas y encontremos juntos cómo darle forma.",
  "whatsapp_number": "51912964356"
}'::jsonb, 'Bienvenida, portada y atención personalizada de Killaq')
ON CONFLICT (key) DO NOTHING;

COMMIT;

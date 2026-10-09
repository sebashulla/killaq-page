-- KILLAQ · 005 · Imágenes de categorías, charms y pieza exclusiva
-- Ejecutar completo después de 004_brand_and_storefront.sql.
-- No crea productos ni publica una pieza exclusiva de ejemplo.
BEGIN;

INSERT INTO public.categories(slug, name, sort_order) VALUES
  ('anillos','Anillos',1), ('collares','Collares',2), ('aretes','Aretes',3),
  ('pulseras','Pulseras',4), ('charms','Charms',5)
ON CONFLICT(slug) DO NOTHING;

-- Conserva cualquier imagen propia que ya se haya guardado.
UPDATE public.categories AS c
SET image_url = images.url
FROM (VALUES
  ('anillos','/images/categories/anillos-v1.webp'),
  ('collares','/images/categories/collares-v1.webp'),
  ('aretes','/images/categories/aretes-v1.webp'),
  ('pulseras','/images/categories/pulseras-v1.webp'),
  ('charms','/images/categories/charms-v1.webp')
) AS images(slug,url)
WHERE c.slug = images.slug AND (c.image_url IS NULL OR c.image_url = '');

-- Resuelve los IDs por slug, sin asumir que Charms tendrá el ID 5.
INSERT INTO public.subcategories(category_id,slug,name,sort_order)
SELECT c.id,s.slug,s.name,s.position
FROM (VALUES
  ('anillos','anillos-compromiso','Compromiso',1),
  ('anillos','anillos-matrimonio','Matrimonio',2),
  ('anillos','anillos-moda','Moda',3),
  ('anillos','anillos-sellos','Sellos',4),
  ('collares','collares-cadenas','Cadenas',1),
  ('collares','collares-dijes','Dijes',2),
  ('collares','collares-gargantillas','Gargantillas',3),
  ('aretes','aretes-argollas','Argollas',1),
  ('aretes','aretes-broqueles','Broqueles',2),
  ('aretes','aretes-largos','Largos',3),
  ('pulseras','pulseras-brazaletes','Brazaletes',1),
  ('pulseras','pulseras-cadenas','Cadenas',2),
  ('pulseras','pulseras-amuletos','Amuletos',3),
  ('charms','charms-simbolos','Símbolos',1),
  ('charms','charms-iniciales','Iniciales',2),
  ('charms','charms-piedras','Piedras',3)
) AS s(category_slug,slug,name,position)
JOIN public.categories c ON c.slug = s.category_slug
ON CONFLICT(slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.validate_product_subcategory()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.subcategory_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subcategories s
    WHERE s.id = NEW.subcategory_id AND s.category_id = NEW.category_id
  ) THEN
    RAISE EXCEPTION 'La subcategoría debe pertenecer a la categoría del producto.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS products_validate_subcategory ON public.products;
CREATE TRIGGER products_validate_subcategory
  BEFORE INSERT OR UPDATE OF category_id, subcategory_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_subcategory();

-- Segunda campaña: se agrega una sola vez a la portada Killaq original.
-- Una campaña desactivada o editada por el admin no se vuelve a activar.
INSERT INTO public.hero_slides(title,subtitle,cta_text,cta_url,image_url,image_alt,jewelry_tone,background_style,image_fit,sort_order,is_active)
SELECT E'Un detalle tuyo.\nUn brillo único.',
  'Cadenas y dijes que acompañan tu historia. Encuentra una forma de llevar cerca lo que más quieres.',
  'Explorar collares','/colecciones?category=collares',
  '/images/categories/collares-v1.webp',
  'Collar de oro con dije circular, imagen ilustrativa de campaña Killaq',
  'gold','black','cover',
  (SELECT COALESCE(MAX(sort_order),0)+1 FROM public.hero_slides),TRUE
WHERE EXISTS (SELECT 1 FROM public.hero_slides WHERE image_url='/images/killaq-ring-v2.png' AND title=E'El brillo de lo\nque permanece.')
  AND NOT EXISTS (SELECT 1 FROM public.hero_slides WHERE image_url='/images/categories/collares-v1.webp');

-- Activa la nueva pasarela en la primera aplicación de 005.
-- Al repetir el archivo conserva la elección posterior del administrador.
UPDATE public.site_settings SET value =
  '{"exclusive_enabled":false,"exclusive_product_id":"","exclusive_title":"Una pieza fuera de lo habitual.","exclusive_description":"Diseño, intención y detalles que hacen de esta joya una elección especial."}'::jsonb || value ||
  CASE WHEN value->>'catalog_version' = '5' THEN '{"catalog_version":5}'::jsonb
  ELSE '{"catalog_version":5,"hero_autoplay":true}'::jsonb END,
  updated_at = NOW()
WHERE key='storefront';

COMMIT;

-- KILLAQ · 007 · Operaciones atómicas del administrador.
-- Aplicar COMPLETO después de 001–006. No crea tablas, productos ni roles.
-- SECURITY INVOKER mantiene RLS. Los RPC comprueban además is_admin().
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_capabilities()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('version',7,'atomic_product',true,'atomic_settings',true,'campaign_order',true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_save_product(p_id uuid,p_data jsonb,p_expected timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_id uuid; v_updated timestamptz; v_image integer; v_video integer; v_active boolean; v_url text; v_video_url text;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
 v_active := (p_data->>'is_active')::boolean;
 v_url := btrim(coalesce(p_data->>'primary_image',''));
 v_video_url := btrim(coalesce(p_data->>'video_url',''));
 IF length(btrim(coalesce(p_data->>'name','')))=0 OR length(p_data->>'name')>150
 OR coalesce(p_data->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
 OR (p_data->>'price')::numeric<=0 OR (p_data->>'price')::numeric>99999999.99
 OR trunc((p_data->>'price')::numeric,2)<>(p_data->>'price')::numeric
 OR (p_data->>'stock')::numeric<0 OR (p_data->>'stock')::numeric<>trunc((p_data->>'stock')::numeric)
 OR (p_data->>'stock')::numeric>1000000
 OR ((p_data->>'compare_price') IS NOT NULL AND ((p_data->>'compare_price')::numeric<=(p_data->>'price')::numeric OR trunc((p_data->>'compare_price')::numeric,2)<>(p_data->>'compare_price')::numeric))
 OR (v_url<>'' AND v_url !~ '^(https://[^/@]+/|/images/[A-Za-z0-9/_.-]+$)')
 OR v_url LIKE '%..%' OR v_url LIKE '%\%'
 OR (v_active AND (length(btrim(coalesce(p_data->>'description','')))=0 OR p_data->>'material_id' IS NULL OR v_url='' OR length(btrim(coalesce(p_data->>'image_alt','')))=0))
 THEN RAISE EXCEPTION 'INVALID_PRODUCT' USING ERRCODE='22023'; END IF;
 IF p_data->>'subcategory_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.subcategories WHERE id=(p_data->>'subcategory_id')::integer AND category_id=(p_data->>'category_id')::integer) THEN RAISE EXCEPTION 'INVALID_SUBCATEGORY' USING ERRCODE='22023'; END IF;
 IF v_video_url<>'' AND NOT (
 ((p_data->>'video_type')='instagram' AND v_video_url ~ '^https://(www\.)?instagram\.com/(p|reel|tv)/[A-Za-z0-9_-]+/?(\?.*)?$') OR
 ((p_data->>'video_type')='tiktok' AND v_video_url ~ '^https://(www\.)?tiktok\.com/@[A-Za-z0-9_.-]+/video/[0-9]+/?(\?.*)?$') OR
 ((p_data->>'video_type') IN ('upload','external') AND v_video_url ~* '^https://[^/@]+/.*\.(mp4|webm|ogg|mov|m4v)(\?.*)?$')
 ) THEN RAISE EXCEPTION 'INVALID_VIDEO' USING ERRCODE='22023'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT updated_at INTO v_updated FROM public.products WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE='22023'; END IF;
  IF p_expected IS NULL OR v_updated IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'CONCURRENT_EDIT' USING ERRCODE='40001'; END IF;
  v_id := p_id;
  UPDATE public.products SET name=p_data->>'name',slug=p_data->>'slug',description=nullif(p_data->>'description',''),price=(p_data->>'price')::numeric,compare_price=(p_data->>'compare_price')::numeric,stock=(p_data->>'stock')::integer,sku=nullif(p_data->>'sku',''),category_id=(p_data->>'category_id')::integer,subcategory_id=(p_data->>'subcategory_id')::integer,collection_id=(p_data->>'collection_id')::integer,material_id=(p_data->>'material_id')::integer,sizes_available=ARRAY(SELECT jsonb_array_elements_text(p_data->'sizes_available')),is_active=v_active,is_featured=(p_data->>'is_featured')::boolean WHERE id=v_id;
 ELSE
  INSERT INTO public.products(name,slug,description,price,compare_price,stock,sku,category_id,subcategory_id,collection_id,material_id,sizes_available,is_active,is_featured)
  VALUES(p_data->>'name',p_data->>'slug',nullif(p_data->>'description',''),(p_data->>'price')::numeric,(p_data->>'compare_price')::numeric,(p_data->>'stock')::integer,nullif(p_data->>'sku',''),(p_data->>'category_id')::integer,(p_data->>'subcategory_id')::integer,(p_data->>'collection_id')::integer,(p_data->>'material_id')::integer,ARRAY(SELECT jsonb_array_elements_text(p_data->'sizes_available')),v_active,(p_data->>'is_featured')::boolean) RETURNING id INTO v_id;
 END IF;
 SELECT id INTO v_image FROM public.product_images WHERE product_id=v_id ORDER BY sort_order,id LIMIT 1 FOR UPDATE;
 IF v_url='' THEN IF v_image IS NOT NULL THEN DELETE FROM public.product_images WHERE id=v_image; END IF;
 ELSIF v_image IS NULL THEN INSERT INTO public.product_images(product_id,url,alt_text,sort_order) VALUES(v_id,v_url,p_data->>'image_alt',0);
 ELSE UPDATE public.product_images SET url=v_url,alt_text=p_data->>'image_alt',sort_order=0 WHERE id=v_image; END IF;
 SELECT id INTO v_video FROM public.product_videos WHERE product_id=v_id ORDER BY sort_order,id LIMIT 1 FOR UPDATE;
 IF v_video_url='' THEN IF v_video IS NOT NULL THEN DELETE FROM public.product_videos WHERE id=v_video; END IF;
 ELSIF v_video IS NULL THEN INSERT INTO public.product_videos(product_id,video_type,title,url,poster_url,sort_order,is_active) VALUES(v_id,p_data->>'video_type',coalesce(nullif(p_data->>'video_title',''),p_data->>'name'),v_video_url,nullif(p_data->>'video_poster',''),0,true);
 ELSE UPDATE public.product_videos SET video_type=p_data->>'video_type',title=coalesce(nullif(p_data->>'video_title',''),p_data->>'name'),url=v_video_url,poster_url=nullif(p_data->>'video_poster',''),sort_order=0 WHERE id=v_video; END IF;
 RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_merge_storefront(p_section text,p_patch jsonb,p_expected timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_value jsonb; v_updated timestamptz; v_allowed text[]; v_product uuid;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(724007);
 SELECT value,updated_at INTO v_value,v_updated FROM public.site_settings WHERE key='storefront' FOR UPDATE;
 IF v_updated IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'CONCURRENT_EDIT' USING ERRCODE='40001'; END IF;
 IF p_section='experiencia' THEN
  v_allowed:=ARRAY['welcome_enabled','artisan_enabled','hero_autoplay','hero_interval','personalized_title','personalized_description','whatsapp_number'];
  IF (p_patch->>'hero_interval')::numeric NOT BETWEEN 6 AND 20 OR coalesce(p_patch->>'whatsapp_number','') !~ '^[0-9]{8,15}$' OR length(btrim(coalesce(p_patch->>'personalized_title','')))=0 OR length(btrim(coalesce(p_patch->>'personalized_description','')))=0 THEN RAISE EXCEPTION 'INVALID_SETTINGS' USING ERRCODE='22023'; END IF;
 ELSIF p_section='exclusivo' THEN
  v_allowed:=ARRAY['exclusive_enabled','exclusive_product_id','exclusive_title','exclusive_description'];
  IF length(btrim(coalesce(p_patch->>'exclusive_title','')))=0 OR length(btrim(coalesce(p_patch->>'exclusive_description','')))=0 THEN RAISE EXCEPTION 'INVALID_SETTINGS' USING ERRCODE='22023'; END IF;
  IF (p_patch->>'exclusive_enabled')::boolean THEN
   v_product:=(p_patch->>'exclusive_product_id')::uuid;
   IF NOT EXISTS(SELECT 1 FROM public.products p JOIN public.collections c ON c.id=p.collection_id WHERE p.id=v_product AND p.is_active AND c.is_active AND EXISTS(SELECT 1 FROM public.product_images i WHERE i.product_id=p.id AND i.url ~ '^(https://[^/@]+/|/images/[A-Za-z0-9/_.-]+$)')) THEN RAISE EXCEPTION 'EXCLUSIVE_NOT_ELIGIBLE' USING ERRCODE='22023'; END IF;
  END IF;
 ELSE RAISE EXCEPTION 'INVALID_SECTION' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE NOT(k=ANY(v_allowed))) OR EXISTS(SELECT 1 FROM unnest(v_allowed) k WHERE NOT(p_patch ? k)) THEN RAISE EXCEPTION 'INVALID_KEYS' USING ERRCODE='22023'; END IF;
 INSERT INTO public.site_settings(key,value,updated_at,updated_by) VALUES('storefront',coalesce(v_value,'{}'::jsonb)||p_patch,now(),auth.uid()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reorder_campaigns(p_ids integer[],p_expected integer[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_current integer[];
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(724008);
 PERFORM id FROM public.hero_slides ORDER BY id FOR UPDATE;
 SELECT array_agg(id ORDER BY sort_order,id) INTO v_current FROM public.hero_slides;
 IF v_current IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'CONCURRENT_EDIT' USING ERRCODE='40001'; END IF;
 IF cardinality(p_ids)<>cardinality(v_current) OR (SELECT count(DISTINCT i) FROM unnest(p_ids) i)<>cardinality(p_ids) OR EXISTS(SELECT 1 FROM unnest(p_ids) i WHERE NOT(i=ANY(v_current))) THEN RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE='22023'; END IF;
 UPDATE public.hero_slides h SET sort_order=r.position-1 FROM unnest(p_ids) WITH ORDINALITY r(id,position) WHERE h.id=r.id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_capabilities(),public.admin_save_product(uuid,jsonb,timestamptz),public.admin_merge_storefront(text,jsonb,timestamptz),public.admin_reorder_campaigns(integer[],integer[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_capabilities(),public.admin_save_product(uuid,jsonb,timestamptz),public.admin_merge_storefront(text,jsonb,timestamptz),public.admin_reorder_campaigns(integer[],integer[]) TO authenticated;
COMMIT;

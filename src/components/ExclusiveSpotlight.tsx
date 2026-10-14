"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "./StoreImage";
import { useStorefrontSettings } from "@/context/StorefrontContext";
import { supabase } from "@/utils/supabaseClient";
import { canShowExclusive } from "@/utils/storefront";
import { getPrimaryImage, normalizeProducts } from "@/data/catalog";
import { formatPrice } from "@/utils/format";
import type { Product } from "@/types/catalog";
import styles from "./ExclusiveSpotlight.module.css";
import {useImpression} from './analytics/AnalyticsProvider';
import {track} from '@/lib/analytics/client';

export default function ExclusiveSpotlight() {
  const { settings, loaded } = useStorefrontSettings();
  const [product, setProduct] = useState<Product | null>(null);
  const reduce = useReducedMotion();
  const impression=useImpression({name:'view_item_list',productId:product?.id||'',list:'exclusive',position:0},'exclusive:'+(product?.id||''));
  useEffect(() => {
    if (!loaded || !settings.exclusive_enabled || !settings.exclusive_product_id) return;
    let active = true;
    supabase.from("products").select("id, slug, name, description, sku, compare_price, price, stock, is_active, collection_id, collections(name, slug, is_active), materials(name, slug), product_images(url, alt_text, sort_order)").eq("id", settings.exclusive_product_id).eq("is_active", true).maybeSingle().then(({ data, error }) => {
      if (active) setProduct(!error && data ? normalizeProducts([data])[0] : null);
    });
    return () => { active = false; };
  }, [loaded, settings.exclusive_enabled, settings.exclusive_product_id]);
  if (!loaded || !canShowExclusive(settings, product) || !product) return null;
  const href = `/producto/${encodeURIComponent(product.slug)}`;
  const silver = product.materials?.slug?.startsWith("plata");
  const select=()=>track({name:'select_item',productId:product.id,list:'exclusive',position:0});
  return <section ref={impression} className={styles.section} data-analytics-location='exclusive' aria-label="Pieza exclusiva de colección">
    <motion.div className={styles.spotlight} initial={reduce ? false : {opacity:0, y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.2}} transition={{duration:.8}}>
      <Link href={href} className={`${styles.visual} ${silver ? styles.gold : ""}`} aria-label={`Ver ${product.name}`} onClick={select}><Image src={getPrimaryImage(product)} alt={product.product_images?.[0]?.alt_text || product.name} fill sizes="(max-width: 700px) 90vw, 40vw" /><span>PIEZA EXCLUSIVA</span></Link>
      <div className={styles.copy}><span className={styles.kicker}>COLECCIÓN · {product.collections?.name}</span><h2>{settings.exclusive_title}</h2><p>{settings.exclusive_description}</p><div className={styles.product}><h3>{product.name}</h3><span>{formatPrice(Number(product.price))}</span></div><Link href={href} className={styles.cta} onClick={select}>Descubrir esta pieza <ArrowUpRight size={17} /></Link></div>
    </motion.div>
  </section>;
}

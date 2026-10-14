import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { normalizeProduct } from "@/data/catalog";
import ProductDetailClient from "./ProductDetailClient";
import { isDemoProduct } from "@/lib/demo-product";

const getProduct = cache(async (slug: string) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("El catálogo no está configurado");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client
    .from("products")
    .select(
      "id, slug, name, description, price, compare_price, stock, sku, weight_grams, sizes_available, category_id, material_id, categories(name, slug), materials(name, slug), product_images(url, alt_text, sort_order)",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el catálogo");
  if (!data) return null;
  const videos = await client.from("product_videos")
    .select("id, product_id, video_type, title, url, poster_url, sort_order, is_active")
    .eq("product_id", data.id).eq("is_active", true).order("sort_order", { ascending: true });
  return normalizeProduct({ ...data, product_videos: videos.data || [] });
});
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product)
    return { title: "Pieza no disponible | Killaq", robots: { index: false } };
  return {
    title: `${product.name} | Killaq Joyería Fina`,
    ...(isDemoProduct(product.sku)
      ? { robots: { index: false, follow: false } }
      : {}),
    description:
      product.description?.slice(0, 160) ||
      `Descubre ${product.name}. Conoce sus materiales, disponibilidad y tallas en Killaq Joyería Fina.`,
  };
}
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  return <ProductDetailClient initialProduct={product} key={product.id} />;
}

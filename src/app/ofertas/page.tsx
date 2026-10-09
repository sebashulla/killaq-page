"use client";

import { useEffect, useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import SiteChrome from "@/components/SiteChrome";
import { getPrimaryImage, normalizeProducts } from "@/data/catalog";
import type { Product } from "@/types/catalog";
import { supabase } from "@/utils/supabaseClient";
import styles from "./page.module.css";

export default function OffersPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOffers = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("products")
        .select("id, slug, name, description, price, compare_price, stock, sizes_available, created_at, is_featured, categories(name, slug), materials(name, slug), product_images(url, alt_text, sort_order)")
        .eq("is_active", true)
        .not("compare_price", "is", null)
        .order("created_at", { ascending: false });

      setProducts(normalizeProducts(data));
      setLoading(false);
    };

    fetchOffers();
  }, []);

  const offers = useMemo(
    () => products.filter((product) => Number(product.compare_price) > Number(product.price)),
    [products]
  );

  return (
    <SiteChrome>
      <main className={styles.page}>
        <header className={styles.header}>
          <span>Oportunidades Killaq</span>
          <h1>Ofertas</h1>
          <p>
            Una selección de joyas con precios especiales para celebrar tu próxima historia.
          </p>
        </header>

        {loading ? (
          <section className={styles.emptyState}>Cargando ofertas publicadas...</section>
        ) : offers.length === 0 ? (
          <section className={styles.emptyState}>
            Pronto tendremos nuevas piezas con precios especiales. Mientras tanto, descubre nuestras colecciones.
          </section>
        ) : (
          <section className={styles.grid}>
            {offers.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                slug={product.slug}
                name={product.name}
                price={Number(product.price)}
                comparePrice={product.compare_price ? Number(product.compare_price) : null}
                imageUrl={getPrimaryImage(product)}
                categoryName={product.categories?.name}
                materialName={product.materials?.name}
                stock={product.stock}
                requiresSize={Boolean(product.sizes_available?.length)}
              />
            ))}
          </section>
        )}
      </main>
    </SiteChrome>
  );
}

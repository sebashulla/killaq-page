"use client";

import Image from "@/components/StoreImage";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import SiteChrome from "@/components/SiteChrome";
import VideoFrame from "@/components/VideoFrame";
import { useCart } from "@/context/CartContext";
import { getPrimaryImage, normalizeProducts } from "@/data/catalog";
import type { Product, ProductVideo } from "@/types/catalog";
import { formatPrice } from "@/utils/format";
import { supabase } from "@/utils/supabaseClient";
import styles from "./page.module.css";
import { isDemoProduct } from "@/lib/demo-product";
import LegalLinks from "@/components/LegalLinks";
import {
  useAnalytics,
  refreshAnalyticsContext,
} from "@/components/analytics/AnalyticsProvider";
import { track, trackOnce } from "@/lib/analytics/client";

export default function ProductDetailClient({
  initialProduct,
}: {
  initialProduct: Product;
}) {
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product>(initialProduct);
  const [related, setRelated] = useState<Product[]>([]);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const { items } = useCart();
  const analyticsState = useAnalytics();
  useEffect(() => {
    refreshAnalyticsContext();
    trackOnce("product:" + initialProduct.id, {
      name: "view_item",
      productId: initialProduct.id,
    });
  }, [initialProduct.id, analyticsState.active, analyticsState.navigation]);

  useEffect(() => {
    let active = true;
    const fetchDetails = async () => {
      const current = initialProduct;
      const [videos, relations] = await Promise.all([
        supabase
          .from("product_videos")
          .select(
            "id, product_id, video_type, title, url, poster_url, sort_order, is_active",
          )
          .eq("product_id", current.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        current.category_id
          ? supabase
              .from("products")
              .select(
                "id, slug, name, description, sku, price, compare_price, stock, sizes_available, is_featured, categories(name, slug), materials(name, slug), product_images(url, alt_text, sort_order)",
              )
              .eq("is_active", true)
              .eq("category_id", current.category_id)
              .neq("id", current.id)
              .limit(4)
          : Promise.resolve({ data: [] }),
      ]);
      if (!active) return;
      setProduct({
        ...current,
        product_videos: (videos.data || []) as ProductVideo[],
      });
      setRelated(normalizeProducts(relations.data));
    };
    void fetchDetails();
    return () => {
      active = false;
    };
  }, [initialProduct]);

  const primaryImage = useMemo(
    () => (product ? getPrimaryImage(product) : "/images/product-1.png"),
    [product],
  );
  const images = product?.product_images?.length
    ? product.product_images
    : [{ url: primaryImage }];
  const productVideos =
    product?.product_videos?.filter((video) => video.url) || [];
  const hasSizes = Boolean(product?.sizes_available?.length);
  const demo = isDemoProduct(product?.sku);
  const isSoldOut = demo || product?.stock === 0;
  const full = Boolean(
    product &&
    items
      .filter((item) => item.id === product.id)
      .reduce((sum, item) => sum + item.quantity, 0) >= product.stock,
  );

  return (
    <SiteChrome>
      <main className={styles.page}>
        <>
          <section className={styles.detail}>
            <div className={styles.gallery}>
              <div className={styles.mainImage}>
                <Image
                  src={selectedImage || primaryImage}
                  alt={product.name}
                  fill
                  className={styles.image}
                  sizes="(max-width: 900px) 100vw, 50vw"
                  loading="eager"
                />
              </div>
              <div className={styles.thumbs}>
                {images.slice(0, 4).map((image, index) => (
                  <button
                    type="button"
                    key={`${image.url}-${index}`}
                    className={styles.thumb}
                    aria-label={`Ver imagen ${index + 1} de ${product.name}`}
                    aria-pressed={(selectedImage || primaryImage) === image.url}
                    onClick={() => {
                      if ((selectedImage || primaryImage) !== image.url)
                        track({
                          name: "product_gallery_interaction",
                          productId: product.id,
                          index,
                        });
                      setSelectedImage(image.url);
                    }}
                  >
                    <Image
                      src={image.url}
                      alt={image.alt_text || product.name}
                      fill
                      className={styles.image}
                      sizes="90px"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.info}>
              <Link href="/colecciones" className={styles.backLink}>
                Volver al catálogo
              </Link>
              <p className={styles.meta}>
                {[product.categories?.name, product.materials?.name]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <h1>{product.name}</h1>
              <div className={styles.priceRow}>
                <span className={styles.price}>
                  {demo
                    ? "Muestra digital · sin venta"
                    : formatPrice(Number(product.price))}
                </span>
                {!demo &&
                  product.compare_price &&
                  Number(product.compare_price) > Number(product.price) && (
                    <span className={styles.comparePrice}>
                      {formatPrice(Number(product.compare_price))}
                    </span>
                  )}
              </div>
              <p className={styles.description}>
                {product.description ||
                  "Pieza seleccionada por Killaq Joyería Fina."}
              </p>

              {hasSizes && (
                <div className={styles.optionGroup}>
                  <span>Talla</span>
                  <div className={styles.sizeGrid}>
                    {product.sizes_available?.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={
                          selectedSize === size
                            ? styles.sizeActive
                            : styles.sizeButton
                        }
                        onClick={() => setSelectedSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.facts}>
                <div>
                  <span>Stock</span>
                  <strong>
                    {isSoldOut ? "Agotado" : `${product.stock} disponible(s)`}
                  </strong>
                </div>
                {product.sku && (
                  <div>
                    <span>SKU</span>
                    <strong>{product.sku}</strong>
                  </div>
                )}
                {product.weight_grams && (
                  <div>
                    <span>Peso</span>
                    <strong>{product.weight_grams} g</strong>
                  </div>
                )}
              </div>

              <button
                className={styles.primaryButton}
                type="button"
                disabled={isSoldOut || full || (hasSizes && !selectedSize)}
                onClick={() => {
                  const success = addItem({
                    id: product.id,
                    slug: product.slug,
                    name: product.name,
                    price: Number(product.price),
                    imageUrl: primaryImage,
                    size: selectedSize || undefined,
                    stock: product.stock,
                  });
                  setAdded(success);
                }}
              >
                {demo
                  ? "Referencia visual, no disponible para compra"
                  : isSoldOut
                    ? "Sin stock"
                    : full
                      ? "Stock disponible en tu carrito"
                      : hasSizes && !selectedSize
                        ? "Selecciona una talla"
                        : "Añadir al carrito"}
              </button>
              <LegalLinks />
              {added && (
                <p role="status" className={styles.description}>
                  Pieza añadida. <Link href="/carrito">Ver mi carrito →</Link>
                </p>
              )}
            </div>
          </section>

          {productVideos.length > 0 && (
            <section className={styles.productVideos}>
              <div className={styles.sectionHeader}>
                <span>Detalle en video</span>
                <h2>La pieza en movimiento</h2>
              </div>
              <div className={styles.videoGrid}>
                {productVideos.slice(0, 4).map((video) => (
                  <VideoFrame
                    key={video.id || video.url}
                    video={video}
                    compact
                  />
                ))}
              </div>
            </section>
          )}

          <section className={styles.related}>
            <div className={styles.sectionHeader}>
              <span>También podría gustarte</span>
              <h2>Piezas relacionadas</h2>
            </div>
            <div className={styles.relatedGrid}>
              {related.slice(0, 4).map((item, index) => (
                <ProductCard
                  key={item.id}
                  id={item.id}
                  slug={item.slug}
                  name={item.name}
                  sku={item.sku}
                  price={Number(item.price)}
                  comparePrice={
                    item.compare_price ? Number(item.compare_price) : null
                  }
                  imageUrl={getPrimaryImage(item)}
                  categoryName={item.categories?.name}
                  materialName={item.materials?.name}
                  stock={item.stock}
                  requiresSize={Boolean(item.sizes_available?.length)}
                  listId="related"
                  position={index}
                />
              ))}
            </div>
          </section>
        </>
      </main>
    </SiteChrome>
  );
}

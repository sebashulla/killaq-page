"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronDown, MessageCircle, ShoppingBag, Sparkles } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import ProductGallery from "@/components/ProductGallery";
import SiteChrome from "@/components/SiteChrome";
import { useCart } from "@/context/CartContext";
import { getPrimaryImage, normalizeProducts } from "@/data/catalog";
import type { Product } from "@/types/catalog";
import { formatPrice } from "@/utils/format";
import { supabase } from "@/utils/supabaseClient";
import { defaultStorefrontSettings, normalizeStorefrontSettings } from "@/utils/storefront";
import { isDemoProduct } from "@/lib/demo-product";
import LegalLinks from "@/components/LegalLinks";
import { useAnalytics, refreshAnalyticsContext } from "@/components/analytics/AnalyticsProvider";
import { track, trackOnce } from "@/lib/analytics/client";
import styles from "./page.module.css";

export default function ProductDetailClient({ initialProduct: product }: { initialProduct: Product }) {
  const { addItem, items } = useCart();
  const [related, setRelated] = useState<Product[]>([]);
  const [selectedSize, setSelectedSize] = useState("");
  const [added, setAdded] = useState(false);
  const [number, setNumber] = useState(defaultStorefrontSettings.whatsapp_number);
  const analyticsState = useAnalytics();
  useEffect(() => {
    refreshAnalyticsContext();
    trackOnce("product:" + product.id, { name: "view_item", productId: product.id });
  }, [product.id, analyticsState.active, analyticsState.navigation]);
  useEffect(() => {
    let active = true;
    void Promise.all([
      product.category_id ? supabase.from("products")
        .select("id, slug, name, description, sku, price, compare_price, stock, sizes_available, is_featured, categories(name, slug), materials(name, slug), product_images(url, alt_text, sort_order)")
        .eq("is_active", true).eq("category_id", product.category_id).neq("id", product.id).limit(4) : Promise.resolve({ data: [] }),
      supabase.from("site_settings").select("value").eq("key", "storefront").maybeSingle(),
    ]).then(([relations, settings]) => {
      if (!active) return;
      setRelated(normalizeProducts(relations.data).filter(item => !isDemoProduct(item.sku)));
      setNumber(normalizeStorefrontSettings(settings.data?.value).whatsapp_number);
    });
    return () => { active = false; };
  }, [product.id, product.category_id]);
  const primaryImage = getPrimaryImage(product);
  const images = product.product_images?.filter(image => image.url) || [];
  const videos = product.product_videos?.filter(video => video.url && video.is_active !== false) || [];
  const hasSizes = Boolean(product.sizes_available?.length);
  const demo = isDemoProduct(product.sku);
  const isSoldOut = product.stock === 0;
  const full = items.filter(item => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0) >= product.stock;
  const description = product.description || "Conoce los detalles de esta pieza y consúltanos lo que necesites antes de elegirla.";
  const excerpt = description.length > 180 ? description.slice(0, 180).replace(/\s+\S*$/, "") + "…" : description;
  const inquiry = new URLSearchParams({ text: `Hola, KILLAQ. Me gustaría recibir orientación sobre ${product.name}${selectedSize ? `, talla ${selectedSize}` : ""}. ${demo ? "Sé que es una muestra digital y no está a la venta." : "¿Podrían confirmarme sus detalles y disponibilidad?"}\nhttps://killaq-page.vercel.app/producto/${encodeURIComponent(product.slug)}` });
  return <SiteChrome><main className={styles.page}>
    <nav className={styles.breadcrumbs} aria-label="Ruta de navegación">
      <Link href="/colecciones"><ArrowLeft size={14} aria-hidden="true" /> Todas las joyas</Link>
      {product.categories && <><span aria-hidden="true">/</span><Link href={`/colecciones?category=${encodeURIComponent(product.categories.slug)}`}>{product.categories.name}</Link></>}
      <span aria-hidden="true">/</span><span aria-current="page">{demo ? "Muestra digital" : product.name}</span>
    </nav>
    <section className={styles.detail} aria-labelledby="piece-title">
      <ProductGallery name={product.name} images={images.length ? images : [{ url: primaryImage, alt_text: product.name }]} videos={videos} demo={demo}
        onSelect={index => track({ name: "product_gallery_interaction", productId: product.id, index })} />
      <div className={styles.info}>
        <div className={styles.overline}><span>{product.categories?.name || "Selección KILLAQ"}</span><span className={styles.status}>{demo ? "Muestra digital" : isSoldOut ? "Sin stock" : "Disponible"}</span></div>
        <h1 id="piece-title">{product.name}</h1>
        {!demo && <div className={styles.priceRow}><span className={styles.price}>{formatPrice(Number(product.price))}</span>
          {product.compare_price && Number(product.compare_price) > Number(product.price) && <span className={styles.comparePrice}>{formatPrice(Number(product.compare_price))}</span>}
          <span className={styles.currency}>PEN</span>
        </div>}
        {demo ? <div className={styles.demoNotice}><Sparkles size={20} strokeWidth={1.3} aria-hidden="true" /><div><strong>Una referencia para imaginar.</strong><p>Imagen creada con IA. No corresponde a una joya física ni está disponible para compra.</p></div></div> : <p className={styles.intro}>{excerpt}</p>}
        {hasSizes && !demo && <fieldset className={styles.options}><legend>Elige tu talla</legend><div className={styles.optionHeading}><p>{selectedSize ? `Talla seleccionada: ${selectedSize}` : "Selecciona una opción para continuar."}</p><Link href="/atencion-personalizada">¿Necesitas ayuda?</Link></div>
          <div className={styles.sizeGrid}>{product.sizes_available?.map(size => <button key={size} type="button" aria-pressed={selectedSize === size} className={styles.sizeButton} onClick={() => { setSelectedSize(size); setAdded(false); }}>{size}</button>)}</div>
        </fieldset>}
        <div className={styles.purchase}>
          {!demo && <p className={styles.availability}><span aria-hidden="true" />{isSoldOut ? "Por ahora, esta pieza no tiene stock." : `${product.stock} ${product.stock === 1 ? "pieza disponible" : "piezas disponibles"}`}<span className={styles.deliveryNote}>Envío por cotizar</span></p>}
          <button className={styles.primaryButton} type="button" disabled={demo || isSoldOut || full || (hasSizes && !selectedSize)}
            onClick={() => setAdded(addItem({ id: product.id, slug: product.slug, name: product.name, price: Number(product.price), imageUrl: primaryImage, size: selectedSize || undefined, stock: product.stock }))}>
            <ShoppingBag size={18} strokeWidth={1.4} aria-hidden="true" />
            {demo ? "Muestra digital · no disponible para compra" : isSoldOut ? "Sin stock" : full ? "Stock disponible en tu carrito" : hasSizes && !selectedSize ? "Selecciona una talla" : "Añadir al carrito"}
            {!demo && <ArrowUpRight size={18} aria-hidden="true" />}
          </button>
          <a className={styles.consultButton} href={`https://wa.me/${number}?${inquiry}`} target="_blank" rel="noopener noreferrer"
            onClick={() => { if (!demo) track({ name: "product_whatsapp_inquiry", productId: product.id, quantity: 1 }); }}>
            <MessageCircle size={18} strokeWidth={1.4} aria-hidden="true" />{demo ? "Conversar sobre un diseño" : "Consultar esta pieza"}<ArrowUpRight size={16} aria-hidden="true" />
          </a>
          {added && <p role="status" className={styles.added}>Pieza añadida. <Link href="/carrito">Ver mi carrito →</Link></p>}
          <p className={styles.purchaseNote}>{demo ? "Explora la referencia y cuéntanos qué te gustaría crear." : "El carrito prepara tu selección. El pago y la entrega se coordinan por WhatsApp."}</p>
        </div>
        <div className={styles.documents}>
          <details className={styles.disclosure}><summary>{demo ? "Acerca de esta muestra" : "Detalles de la pieza"}<ChevronDown size={17} aria-hidden="true" /></summary>
            <div className={styles.disclosureBody}><p className={styles.description}>{description}</p>
              <dl className={styles.facts}>
                {!demo && product.materials?.name && <div><dt>Material</dt><dd>{product.materials.name}</dd></div>}
                {product.weight_grams && !demo ? <div><dt>Peso</dt><dd>{product.weight_grams} g</dd></div> : null}
                {product.sku && <div><dt>Referencia</dt><dd>{product.sku}</dd></div>}
                {demo && <div><dt>Tipo de contenido</dt><dd>Referencia digital · imagen IA</dd></div>}
              </dl>
            </div>
          </details>
          {!demo && <details className={styles.disclosure}><summary>Entrega y atención<ChevronDown size={17} aria-hidden="true" /></summary><div className={styles.disclosureBody}><p>Antes de confirmar tu pedido, coordinamos por WhatsApp el destino, el costo y el plazo de entrega. El subtotal de la pieza no incluye un envío aún no cotizado.</p><Link href="/atencion-personalizada">Recibir atención personalizada <ArrowUpRight size={14} aria-hidden="true" /></Link></div></details>}
          <details className={styles.disclosure}><summary>{demo ? "¿Buscas una pieza hecha para ti?" : "Cambios y garantías"}<ChevronDown size={17} aria-hidden="true" /></summary><div className={styles.disclosureBody}><p>{demo ? "Conversemos sobre tu idea, medidas y materiales. La viabilidad, cotización y condiciones de una pieza real deben confirmarse antes de encargarla." : "Consulta las condiciones e información de atención antes de comprar. Los cambios por preferencia se distinguen de los derechos ante defectos o incumplimientos."}</p><Link href={demo ? "/atencion-personalizada" : "/cambios-y-devoluciones"}>{demo ? "Descubrir la atención personalizada" : "Consultar cambios y garantías"}<ArrowUpRight size={14} aria-hidden="true" /></Link></div></details>
        </div>
        <LegalLinks />
      </div>
    </section>
    {related.length > 0 && <section className={styles.related} aria-labelledby="related-title"><div className={styles.sectionHeader}><div><span>Continúa descubriendo</span><h2 id="related-title">Piezas que podrían acompañarte.</h2></div><Link href="/colecciones">Explorar la tienda <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
      <div className={styles.relatedGrid}>{related.slice(0, 4).map((item, index) => <ProductCard key={item.id} id={item.id} slug={item.slug} name={item.name} sku={item.sku} price={Number(item.price)} comparePrice={item.compare_price ? Number(item.compare_price) : null} imageUrl={getPrimaryImage(item)} categoryName={item.categories?.name} materialName={item.materials?.name} stock={item.stock} requiresSize={Boolean(item.sizes_available?.length)} listId="related" position={index} />)}</div>
    </section>}
  </main></SiteChrome>;
}

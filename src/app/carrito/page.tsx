"use client";

import Image from "@/components/StoreImage";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { availableQuantity } from "@/utils/cart";
import SiteChrome from "@/components/SiteChrome";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/utils/format";
import styles from "./page.module.css";
import LegalLinks from "@/components/LegalLinks";
import {useAnalytics,refreshAnalyticsContext} from '@/components/analytics/AnalyticsProvider';
import {trackOnce} from '@/lib/analytics/client';

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem, clearCart, refreshItems,ready:cartReady } = useCart();
  const ids = [...new Set(items.map(item => item.id))].sort().join(",");
  const [verifiedIds, setVerifiedIds] = useState("");
  const [verificationError, setVerificationError] = useState(false);
  const [retry, setRetry] = useState(0);
  const analyticsState=useAnalytics();
  useEffect(()=>{refreshAnalyticsContext();if(cartReady&&verifiedIds===ids&&!verificationError){const products=[...new Set(items.map(item=>item.id))].map(id=>({productId:id,quantity:items.filter(item=>item.id===id).reduce((sum,item)=>sum+item.quantity,0)}));trackOnce('cart',{name:'view_cart',items:products});}},[analyticsState.active,analyticsState.navigation,verifiedIds,ids,verificationError,items,cartReady]);
  useEffect(() => {
    if (!ids) return;
    let active = true;
    supabase.from("products").select("id, price, stock").eq("is_active", true).in("id", ids.split(",")).then(({ data, error }) => {
      if (!active) return;
      setVerificationError(Boolean(error));
      if (!error) { refreshItems(data || []); setVerifiedIds(ids); }
    });
    return () => { active = false; };
  }, [ids, retry, refreshItems]);
  const invalidStock = items.some(item => item.stock !== undefined && items.filter(entry => entry.id === item.id).reduce((sum, entry) => sum + entry.quantity, 0) > item.stock);
  const canCheckout = verifiedIds === ids && !verificationError && !invalidStock;

  return (
    <SiteChrome>
      <main className={styles.page}>
        <header className={styles.header}>
          <span>Compra</span>
          <h1>Carrito</h1>
          <p>Revisa tus piezas seleccionadas antes de coordinar el pedido con Killaq.</p>
        </header>

        <LegalLinks />
        {items.length === 0 ? (
          <section className={styles.empty}>
            <h2>Tu carrito está vacío</h2>
            <p>Explora el catálogo y añade las joyas que quieras cotizar o comprar.</p>
            <Link href="/colecciones" className={styles.primaryButton}>Ver catálogo</Link>
          </section>
        ) : (
          <section className={styles.cartLayout}>
            <div className={styles.items}>
              {items.map((item) => (
                <article key={`${item.id}-${item.size || "default"}`} className={styles.item}>
                  <div className={styles.imageBox}>
                    <Image src={item.imageUrl} alt={item.name} fill className={styles.image} sizes="110px" />
                  </div>
                  <div className={styles.itemInfo}>
                    <Link href={`/producto/${item.slug}`} className={styles.itemName}>{item.name}</Link>
                    {item.size && <span className={styles.itemMeta}>Talla {item.size}</span>}
                    <span className={styles.itemPrice}>{formatPrice(item.price)}</span>
                    {item.stock === 0 && <span className={styles.itemMeta}>Esta pieza ya no está disponible.</span>}
                    {item.stock !== undefined && item.stock > 0 && item.quantity > availableQuantity(items, item) && <span className={styles.itemMeta}>Ajusta la cantidad. Stock total: {item.stock}.</span>}
                  </div>
                  <div className={styles.quantity}>
                    <button type="button" aria-label={`Reducir cantidad de ${item.name}`} onClick={() => updateQuantity(item.id, item.quantity - 1, item.size)} disabled={item.quantity <= 1}>−</button>
                    <span>{item.quantity}</span>
                    <button type="button" aria-label={`Aumentar cantidad de ${item.name}`} disabled={item.quantity >= availableQuantity(items, item)} onClick={() => updateQuantity(item.id, item.quantity + 1, item.size)}>+</button>
                  </div>
                  <button className={styles.removeButton} type="button" onClick={() => removeItem(item.id, item.size)}>
                    Quitar
                  </button>
                </article>
              ))}
            </div>

            <aside className={styles.summary}>
              <h2>Resumen</h2>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <div className={styles.summaryRow}>
                <span>Envío</span>
                <strong>Por coordinar</strong>
              </div>
              <p className={styles.note}>
                Coordinaremos el pago y la entrega por WhatsApp. El envío se cotiza según tu destino.
                Las piezas se reservan cuando nuestro equipo confirma el pedido.
              </p>
              {verificationError && <p role="alert" className={styles.note}>No pudimos verificar la disponibilidad. <button type="button" onClick={() => { setVerifiedIds(""); setRetry(value => value + 1); }}>Reintentar</button></p>}
              {invalidStock && <p role="alert" className={styles.note}>Revisa las cantidades o retira las piezas sin disponibilidad para continuar.</p>}
              {!canCheckout && !invalidStock && !verificationError && <p role="status" className={styles.note}>Verificando precios y disponibilidad…</p>}
              {canCheckout && <a
                data-analytics-location='cart'
                data-analytics-products={JSON.stringify([...new Set(items.map(item=>item.id))].map(id=>({productId:id,quantity:items.filter(item=>item.id===id).reduce((sum,item)=>sum+item.quantity,0)})))}
                className={styles.primaryButton}
                target="_blank"
                rel="noopener noreferrer"
                href={`https://wa.me/51912964356?text=${encodeURIComponent(
                  `Hola Killaq, quiero consultar por mi carrito: ${items
                    .map((item) => `${item.quantity} x ${item.name}${item.size ? ` talla ${item.size}` : ""}`)
                    .join(", ")}. Subtotal: ${formatPrice(subtotal)}`
                )}`}
              >
                Coordinar por WhatsApp
              </a>}
              <button className={styles.secondaryButton} type="button" onClick={clearCart}>
                Vaciar carrito
              </button>
            </aside>
          </section>
        )}
      </main>
    </SiteChrome>
  );
}

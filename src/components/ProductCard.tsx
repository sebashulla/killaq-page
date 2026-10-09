"use client";
import Image from "./StoreImage";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/utils/format";
import styles from "./ProductCard.module.css";

interface ProductCardProps {
  id: string; slug: string; name: string; price: number; comparePrice?: number | null;
  imageUrl: string; materialName?: string; categoryName?: string; stock?: number; requiresSize?: boolean;
}
export default function ProductCard({ id, slug, name, price, comparePrice, imageUrl, materialName, categoryName, stock, requiresSize }: ProductCardProps) {
  const { addItem, items } = useCart();
  const [added, setAdded] = useState(false);
  const soldOut = stock !== undefined && stock <= 0;
  const inCart = items.filter(item => item.id === id).reduce((total, item) => total + item.quantity, 0);
  const full = stock !== undefined && inCart >= stock;
  const discount = comparePrice && comparePrice > price ? Math.round((1 - price / comparePrice) * 100) : 0;
  useEffect(() => { if (!added) return; const timer = window.setTimeout(() => setAdded(false), 2200); return () => window.clearTimeout(timer); }, [added]);
  return <article className={styles.card}>
    <Link href={`/producto/${slug}`} className={styles.imageWrapper}>
      <Image src={imageUrl} alt={name} fill className={styles.image} sizes="(max-width: 600px) 45vw, (max-width: 900px) 50vw, 25vw" />
      {soldOut ? <span className={styles.badge}>Agotado</span> : discount > 0 && <span className={styles.badge}>−{discount}%</span>}
      <span className={styles.inspect} aria-hidden="true"><ArrowUpRight size={18} /></span>
    </Link>
    <div className={styles.content}><p className={styles.meta}>{[categoryName, materialName].filter(Boolean).join(" · ")}</p><Link href={`/producto/${slug}`}><h3>{name}</h3></Link>
      <div className={styles.priceRow}><span>{formatPrice(price)}</span>{discount > 0 && <del>{formatPrice(comparePrice!)}</del>}</div>
      {requiresSize ? <Link className={styles.cartButton} href={`/producto/${slug}`}>Elegir talla <ArrowUpRight size={15} /></Link> : <button type="button" className={styles.cartButton} disabled={soldOut || full} onClick={() => { addItem({ id, slug, name, price, imageUrl, stock }); setAdded(true); }}>{added ? <Check size={15} /> : <Plus size={15} />}{soldOut ? "Sin stock" : full ? "Stock en tu carrito" : added ? "Añadido al carrito" : "Añadir al carrito"}</button>}
      <span className={styles.feedback} role="status">{added ? `${name} añadido al carrito` : ""}</span>
    </div>
  </article>;
}

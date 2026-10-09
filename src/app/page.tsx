"use client";
import Image from "@/components/StoreImage";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Gift, Gem, MessageCircle, PackageCheck, ArrowRight } from "lucide-react";
import BrandIntro from "@/components/BrandIntro";
import { BrandMark } from "@/components/Brand";
import HeroCarousel from "@/components/HeroCarousel";
import JewelrySketch from "@/components/JewelrySketch";
import ProductCard from "@/components/ProductCard";
import SiteChrome from "@/components/SiteChrome";
import VideoFrame from "@/components/VideoFrame";
import { fallbackCategories, getPrimaryImage, normalizeProducts } from "@/data/catalog";
import type { Category, Product, SocialVideo } from "@/types/catalog";
import { supabase } from "@/utils/supabaseClient";
import styles from "./page.module.css";

const categoryDescriptions: Record<string, string> = { anillos: "Una promesa en cada detalle", collares: "Cerca de lo que más quieres", aretes: "Luz que enmarca tu esencia", pulseras: "Historias que van contigo" };
const benefits = [ { icon: Gem, title: "Detalles que importan", text: "Te ayudamos a conocer los materiales y acabados de cada pieza." }, { icon: Gift, title: "Un regalo con intención", text: "Encuentra el detalle para celebrar a alguien especial. Incluyéndote a ti." }, { icon: MessageCircle, title: "Estamos para ti", text: "Asesoría cercana para elegir tu joya, talla y cuidados." }, { icon: PackageCheck, title: "Entrega coordinada", text: "Confirma disponibilidad, destino y envío con nuestro equipo." } ];

export default function Home() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [videos, setVideos] = useState<SocialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("products").select("id, slug, name, description, price, compare_price, stock, sizes_available, is_featured, categories(name, slug), materials(name, slug), product_images(url, alt_text, sort_order)").eq("is_active", true).order("is_featured", { ascending: false }).order("created_at", { ascending: false }).limit(4),
      supabase.from("categories").select("id, slug, name, description, image_url").eq("is_active", true).order("sort_order"),
      supabase.from("social_videos").select("id, platform, title, video_url, thumbnail_url, sort_order").eq("is_active", true).order("sort_order").limit(3),
    ]).then(([products, cats, social]) => {
      if (!active) return;
      setFailed(Boolean(products.error));
      setFeatured(normalizeProducts(products.data));
      if (cats.data?.length) setCategories(cats.data);
      if (social.data?.length) setVideos(social.data as SocialVideo[]);
      setLoading(false);
    }).catch(() => { if (active) { setFailed(true); setLoading(false); } });
    return () => { active = false; };
  }, []);
  return <><BrandIntro /><SiteChrome><main className={styles.main}>
    <HeroCarousel />
    <div className={styles.promiseBar}><span><Gem size={17} /> Oro y plata</span><span><Gift size={17} /> Regalos con significado</span><span><MessageCircle size={17} /> Atención personalizada</span><span className={styles.promisePlace}>DESDE PERÚ, CON INTENCIÓN <ArrowUpRight size={13} /></span></div>
    <section className={styles.section} id="colecciones">
      <div className={styles.sectionHeader}><div><span className={styles.kicker}>ELIGE TU FORMA DE BRILLAR</span><h2>Un universo de detalles.</h2></div><Link className={styles.textLink} href="/colecciones">Explorar la tienda <ArrowUpRight size={16} /></Link></div>
      <div className={styles.categoryGrid}>{categories.map((category, index) => <Link key={category.id} href={`/colecciones?category=${category.slug}`} className={styles.categoryCard}>
        <div className={styles.categoryVisual}><span className={styles.categoryNumber}>0{index + 1}</span>{category.image_url ? <Image src={category.image_url} alt={category.name} fill className={styles.categoryImage} sizes="(max-width: 600px) 45vw, 25vw" /> : <JewelrySketch kind={category.slug} />}<span className={styles.categoryExplore}><ArrowUpRight size={18} /></span></div>
        <h3>{category.name}</h3><p>{categoryDescriptions[category.slug] || "Una pieza para tu historia"}</p>
      </Link>)}</div>
    </section>
    <section className={styles.selection}>
      <div className={styles.sectionHeader}><div><span className={styles.kicker}>SELECCIÓN KILLAQ</span><h2>Tu próxima pieza favorita.</h2></div><Link href="/colecciones" className={styles.textLink}>Ver todas las joyas <ArrowUpRight size={16} /></Link></div>
      {loading ? <div className={styles.skeletonGrid} aria-label="Cargando joyas" aria-busy="true">{[1, 2, 3, 4].map(n => <div key={n} />)}</div> : featured.length ? <div className={styles.productGrid}>{featured.map(product => <ProductCard key={product.id} id={product.id} slug={product.slug} name={product.name} price={Number(product.price)} comparePrice={product.compare_price ? Number(product.compare_price) : null} imageUrl={getPrimaryImage(product)} categoryName={product.categories?.name} materialName={product.materials?.name} stock={product.stock} requiresSize={Boolean(product.sizes_available?.length)} />)}</div> : <div className={styles.catalogInvitation}><BrandMark className={styles.invitationMark} /><div><h3>{failed ? "Pronto volveremos a brillar." : "Estamos preparando algo especial."}</h3><p>{failed ? "No pudimos cargar las piezas en este momento. Nuestro equipo puede ayudarte a conocer la disponibilidad." : "Nuestra selección de joyas estará disponible pronto. Mientras tanto, cuéntanos qué pieza estás buscando."}</p></div><a href="https://wa.me/51912964356" target="_blank" rel="noopener noreferrer" className={styles.textLink}>Hablar con Killaq <ArrowUpRight size={16} /></a></div>}
    </section>
    <section className={styles.story}>
      <div className={styles.storyImage}><Image src="/images/hero-bg.png" alt="Detalle de un anillo de oro, imagen de campaña" fill sizes="(max-width: 700px) 100vw, 50vw" /><span>EL ARTE DE HACER QUE UN MOMENTO DURE.</span></div>
      <div className={styles.storyCopy}><BrandMark className={styles.storyMark} /><span className={styles.kicker}>LA ESENCIA KILLAQ</span><h2>No es solo una joya.<br /><em>Es lo que significa.</em></h2><p>Un regalo que dice gracias. Una promesa compartida. Ese pequeño recordatorio de quién eres.</p><p>Creemos en las piezas que se vuelven parte de tu vida. En el oro, la plata y los detalles que siguen contando tu historia con el paso del tiempo.</p><Link href="/nosotros" className={styles.textLink}>Conoce nuestro universo <ArrowRight size={17} /></Link></div>
    </section>
    <section className={styles.benefits}>{benefits.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={25} strokeWidth={1.2} /><h3>{title}</h3><p>{text}</p></article>)}</section>
    {videos.length > 0 && <section className={styles.section}><div className={styles.sectionHeader}><div><span className={styles.kicker}>MÁS CERCA DE CADA DETALLE</span><h2>El brillo, en movimiento.</h2></div></div><div className={styles.videoGrid}>{videos.map(video => <VideoFrame key={video.id || video.video_url} video={video} />)}</div></section>}
    <section className={styles.contactBand}><span className={styles.kicker}>HECHO PERSONAL</span><h2>La joya ideal empieza con una conversación.</h2><p className={styles.contactText}>De tu primera idea al último detalle, te acompañamos a elegir.</p><Link className={styles.contactButton} href="/atencion-personalizada">Descubre la atención personalizada <ArrowUpRight size={17} /></Link></section>
  </main></SiteChrome></>;
}

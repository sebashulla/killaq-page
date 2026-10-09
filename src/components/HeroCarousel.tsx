"use client";
import Image from "./StoreImage";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Play, Pause } from "lucide-react";
import { fallbackSlides } from "@/data/catalog";
import { supabase } from "@/utils/supabaseClient";
import { safeLink } from "@/utils/links";
import { isLegacyCampaign, resolveHeroBackground } from "@/utils/storefront";
import { useStorefrontSettings } from "@/context/StorefrontContext";
import type { HeroSlide } from "@/types/catalog";
import styles from "./HeroCarousel.module.css";

export default function HeroCarousel() {
  const [slides, setSlides] = useState<HeroSlide[]>(fallbackSlides);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  const reduce = useReducedMotion();
  const { settings } = useStorefrontSettings();
  const autoplay = playing ?? settings.hero_autoplay;
  useEffect(() => {
    let active = true;
    supabase.from("hero_slides").select("*").eq("is_active", true).order("sort_order", { ascending: true }).then(({ data }) => {
      if (!active) return;
      // Ignore only untouched starter content while migration 004 is pending.
      const campaigns = (data || []).filter(slide => slide.image_url && !isLegacyCampaign(slide));
      if (campaigns.length) { setSlides(campaigns); setCurrent(0); }
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!autoplay || hovered || reduce || slides.length < 2) return;
    const timer = window.setInterval(() => { if (!document.hidden) setCurrent(index => (index + 1) % slides.length); }, settings.hero_interval * 1000);
    return () => window.clearInterval(timer);
  }, [autoplay, hovered, reduce, slides.length, settings.hero_interval]);
  const slide = slides[current];
  const go = (direction: number) => setCurrent(index => (index + direction + slides.length) % slides.length);
  return <section className={styles.hero} aria-label="El universo Killaq" aria-roledescription="carrusel" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setHovered(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false); }}>
    <div className={styles.copy}>
      <span className={styles.eyebrow}><span /> JOYERÍA FINA · PERÚ</span>
      <div className={styles.copyFrame} aria-live={!autoplay ? "polite" : "off"}><AnimatePresence mode="wait" initial={false}><motion.div key={slide.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -6 }} transition={{ duration: reduce ? 0 : .45, ease: [.22, 1, .36, 1] }}>
        <h1>{slide.title}</h1>
        <p className={styles.description}>{slide.subtitle}</p>
        <div className={styles.ctas}><Link href={safeLink(slide.cta_url)} className={styles.primary}>{slide.cta_text}<ArrowUpRight size={17} /></Link><Link href="/nosotros" className={styles.secondary}>Nuestra esencia <ArrowRight size={16} /></Link></div>
      </motion.div></AnimatePresence></div>
      <div className={styles.bottom}>
        <div className={styles.pagination}><span>{String(current + 1).padStart(2, "0")}</span><div className={styles.paginationLine} /><small>{slides.length > 1 ? String(slides.length).padStart(2, "0") : "KILLAQ"}</small>{slides.length > 1 && <><button type="button" onClick={() => go(-1)} aria-label="Campaña anterior"><ArrowLeft size={15} /></button><button type="button" onClick={() => go(1)} aria-label="Siguiente campaña"><ArrowRight size={15} /></button><button type="button" onClick={() => setPlaying(!autoplay)} aria-label={autoplay ? "Pausar carrusel" : "Reanudar carrusel"}>{autoplay ? <Pause size={12} /> : <Play size={12} />}</button></>}</div>
        {settings.welcome_enabled && <button type="button" className={styles.replay} onClick={() => window.dispatchEvent(new Event("killaq:replay-intro"))}><Play size={11} /> Ver bienvenida</button>}
      </div>
    </div>
    <div className={styles.visual}>
      <AnimatePresence initial={false}>{[slide].map(item => {
        const campaign = item.image_url === "/images/killaq-ring-v2.png" || item.image_url === "/images/categories/collares-v1.webp";
        const background = resolveHeroBackground(item.background_style, item.jewelry_tone);
        const fit = item.image_fit || (campaign ? "contain" : "cover");
        return <motion.div key={item.id} className={`${styles.visualLayer} ${styles[background]} ${fit === "cover" ? styles.photo : ""}`} initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 1.25, ease: "easeInOut" }}>
          <div className={styles.orbit} /><div className={styles.orbitTwo} /><span className={styles.moon} aria-hidden="true">K</span>
          <motion.div className={styles.imageBox} initial={reduce ? false : { scale: 1.035 }} animate={{ scale: 1 }} transition={{ duration: 1.8, ease: [.22, 1, .36, 1] }}>
            <Image src={item.image_url} alt={item.image_alt || item.title} fill loading="eager" draggable={false} className={styles.image} sizes="(max-width: 700px) 90vw, 50vw" />
          </motion.div>
          <span className={styles.imageTag}>UNA JOYA. TU HISTORIA.</span>
          <div className={styles.imageCaption}><span>{campaign ? "Imaginario Killaq" : "Selección Killaq"}</span><small>{campaign ? "Imagen de campaña" : "Joyería fina"}</small><ArrowUpRight size={22} /></div>
        </motion.div>;
      })}</AnimatePresence>
    </div>
  </section>;
}

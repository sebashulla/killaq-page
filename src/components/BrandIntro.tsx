"use client";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./Brand";
import { useStorefrontSettings } from "@/context/StorefrontContext";
import styles from "./BrandIntro.module.css";

const SESSION_KEY = "killaq-welcome-v3";
export default function BrandIntro() {
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  const { settings, loaded } = useStorefrontSettings();
  const skipRef = useRef<HTMLButtonElement>(null);
  const finish = useCallback(() => {
    try { sessionStorage.setItem(SESSION_KEY, "seen"); } catch { /* Storage can be disabled. */ }
    setVisible(false);
  }, []);
  useEffect(() => {
    if (!loaded || !settings.welcome_enabled) return;
    const open = () => { if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setVisible(true); };
    const timer = window.setTimeout(() => {
      try { if (sessionStorage.getItem(SESSION_KEY)) return; } catch { /* Continue without storage. */ }
      open();
    }, 0);
    window.addEventListener("killaq:replay-intro", open);
    return () => { window.clearTimeout(timer); window.removeEventListener("killaq:replay-intro", open); };
  }, [loaded, settings.welcome_enabled]);
  useEffect(() => {
    if (!visible) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const storefront = document.querySelector<HTMLElement>("[data-storefront]");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (storefront) storefront.inert = true;
    skipRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(finish, reducedMotion ? 0 : 3600);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "Tab") { event.preventDefault(); skipRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (storefront) storefront.inert = false;
      if (previousFocus && previousFocus !== document.body) previousFocus.focus({ preventScroll: true });
    };
  }, [visible, reducedMotion, finish]);
  return <AnimatePresence>{visible && <motion.div
    className={styles.intro} role="dialog" aria-modal="true" aria-label="Bienvenida a Killaq"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: "-5%" }} transition={{ duration: .6 }}
  >
    <div className={styles.grain} />
    <motion.div className={styles.orbit} initial={{ scale: .6, opacity: 0 }} animate={{ scale: [.6, 1, 1.7], opacity: [0, .5, 0] }} transition={{ duration: 3.5 }} />
    <motion.div className={styles.wordmark} initial={{ opacity: 0, y: 18 }} animate={{ opacity: [0, 1, 1, 0], y: [18, 0, 0, -26] }} transition={{ duration: 2.2, times: [0, .25, .7, 1] }}>
      <BrandMark className={styles.mark} /><span>KILLAQ</span><small>JOYERÍA FINA · PERÚ</small>
    </motion.div>
    <motion.div className={styles.ring} initial={{ opacity: 0, scale: .72, rotate: -18 }} animate={{ opacity: [0, 1, 1], scale: [.72, 1, 1.08], rotate: [-18, 0, 5] }} transition={{ delay: 1.6, duration: 1.7 }}>
      <Image src="/images/killaq-ring-v2.png" alt="Anillo de oro, imagen de campaña Killaq" fill sizes="480px" className={styles.ringImage} loading="eager" />
    </motion.div>
    <motion.p className={styles.caption} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4 }}>Hay momentos que merecen quedarse.</motion.p>
    <button ref={skipRef} className={styles.skip} onClick={finish} type="button">Omitir bienvenida <span aria-hidden="true">↗</span></button>
    <motion.div className={styles.progress} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 3.6, ease: "linear" }} />
  </motion.div>}</AnimatePresence>;
}

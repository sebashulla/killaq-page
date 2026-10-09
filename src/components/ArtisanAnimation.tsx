"use client";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { useStorefrontSettings } from "@/context/StorefrontContext";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import styles from "./ArtisanAnimation.module.css";

const stages = [
  { name: "Boceto", text: "Una idea encuentra sus primeras líneas." },
  { name: "Forma", text: "El metal toma forma, detalle a detalle." },
  { name: "Engaste", text: "Cada elemento encuentra su lugar." },
  { name: "Acabado", text: "El pulido revela la luz de la pieza." },
];

export default function ArtisanAnimation() {
  const { settings, loaded } = useStorefrontSettings();
  const reduce = useMotionPreference();
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [run, setRun] = useState(0);
  const gradient = useId().replace(/:/g, "");
  const animated = settings.artisan_enabled && !reduce;
  const current = animated ? stage : 3;
  useEffect(() => {
    if (!loaded || !animated || !playing || stage >= 3) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) setStage(value => value + 1);
      else setRun(value => value + 1);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [loaded, animated, playing, stage, run]);
  const replay = () => { setStage(0); setPlaying(true); setRun(value => value + 1); };
  return <div className={styles.workshop}>
    <div className={styles.canvas} aria-label={`Proceso artesanal ilustrativo: ${stages[current].name}`}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.topline}><span>EL ARTE DEL DETALLE</span><span>ESTUDIO KILLAQ</span></div>
      <AnimatePresence mode="wait">
        {current < 3 ? <motion.svg key={`${current}-${run}`} className={styles.drawing} viewBox="0 0 440 400" fill="none" aria-hidden="true" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .35 }}>
          <defs><linearGradient id={gradient} x1="120" y1="150" x2="320" y2="310" gradientUnits="userSpaceOnUse"><stop stopColor="#f6e4b0" /><stop offset=".3" stopColor="#bd934b" /><stop offset=".55" stopColor="#f5dfa0" /><stop offset="1" stopColor="#9a712f" /></linearGradient></defs>
          {current === 0 && <g stroke="#ad9462" strokeWidth=".7" strokeDasharray="4 7" opacity=".5"><path d="M220 45v310M70 208h300" /><circle cx="220" cy="215" r="100" /><path d="M95 332h250M95 324v16m250-16v16" /></g>}
          <motion.ellipse cx="220" cy="229" rx="83" ry="91" transform="rotate(-26 220 229)" stroke={current === 0 ? "#d7b96e" : `url(#${gradient})`} strokeWidth={current === 0 ? 1.5 : 12} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.4 }} />
          <motion.ellipse cx="220" cy="229" rx="75" ry="84" transform="rotate(-26 220 229)" stroke="#f4df9e" strokeWidth="1" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: .7 }} transition={{ duration: 1.6 }} />
          <motion.path d="m181 100 39-17 40 17-15 43h-50l-14-43Zm0 0h79m-40-17-13 17 13 43 13-43-13-17m-25 60 12-43m38 43-12-43" stroke={current === 2 ? "#f9f5ea" : "#d7b96e"} strokeWidth="1.4" fill={current === 2 ? "#ffffff12" : "none"} initial={{ pathLength: 0, y: current === 2 ? -25 : 0, opacity: 0 }} animate={{ pathLength: 1, y: 0, opacity: 1 }} transition={{ duration: 1.2, delay: .2 }} />
          {current === 0 && <motion.g initial={{ x: -55, y: 70, opacity: 0 }} animate={{ x: [0, 35, 65], y: [0, 50, 100], opacity: [0, 1, 0] }} transition={{ duration: 2 }}><path d="m143 153 38-90 9 4-38 90-9-4Z" fill="#d7b96e" /><path d="m143 153-3 15 12-11" stroke="#f9f5ea" /></motion.g>}
          {current === 1 && <motion.g style={{ transformOrigin: "320px 260px" }} animate={{ rotate: [-10, 6, -10, 6, -10] }} transition={{ duration: 1.7 }}><path d="m324 215-19 79" stroke="#ac8952" strokeWidth="9" strokeLinecap="round" /><rect x="300" y="200" width="49" height="16" rx="2" fill="#e3d7bf" transform="rotate(14 324 208)" /></motion.g>}
          {current === 2 && <motion.g initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.7, delay: .4 }} stroke="#f9e1a3" strokeWidth="1.2"><path d="M280 90v22m-11-11h22M161 147v14m-7-7h14" /></motion.g>}
        </motion.svg> : <motion.div key="finished" className={styles.finished} initial={animated ? { opacity: 0, scale: .88 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ duration: animated ? .9 : 0 }}><Image src="/images/killaq-ring-v2.png" alt="Anillo de oro ilustrativo al finalizar la secuencia artesanal" fill sizes="(max-width: 700px) 90vw, 45vw" loading="eager" /><motion.span className={styles.glint} initial={animated ? { opacity: 0 } : false} animate={animated ? { opacity: [0, 1, 0], scale: [.8, 1.1, .8] } : { opacity: .6 }} transition={{ duration: animated ? 1.4 : 0, delay: animated ? .5 : 0 }}>✧</motion.span></motion.div>}
      </AnimatePresence>
      <div className={styles.caption}><span>0{current + 1} / {stages[current].name.toUpperCase()}</span><p>{stages[current].text}</p></div>
    </div>
    <div className={styles.controls}>
      <div className={styles.stages}>{stages.map((item, index) => <button key={item.name} type="button" aria-pressed={current === index} disabled={!animated} onClick={() => { setStage(index); setPlaying(false); }}><span>0{index + 1}</span>{item.name}</button>)}</div>
      {animated && <div className={styles.playback}>{stage < 3 && <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pausar proceso artesanal" : "Continuar proceso artesanal"}>{playing ? <Pause size={12} /> : <Play size={12} />}</button>}<button type="button" onClick={replay} aria-label="Repetir proceso artesanal"><RotateCcw size={13} /></button></div>}
    </div>
    <p className={styles.note}>Interpretación visual del proceso artesanal · imagen de campaña.</p>
  </div>;
}

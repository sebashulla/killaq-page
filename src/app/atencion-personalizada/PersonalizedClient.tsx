"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Gem, PencilLine, MessageCircle } from "lucide-react";
import SiteChrome from "@/components/SiteChrome";
import ArtisanAnimation from "@/components/ArtisanAnimation";
import { useStorefrontSettings } from "@/context/StorefrontContext";
import styles from "./page.module.css";

export default function PersonalizedClient() {
  const { settings } = useStorefrontSettings();
  const [piece, setPiece] = useState("Anillo");
  const [metal, setMetal] = useState("Quiero asesoría");
  const [idea, setIdea] = useState("");
  const message = `Hola Killaq, me gustaría recibir atención personalizada.\nPieza: ${piece}.\nMaterial: ${metal}.${idea.trim() ? `\nMi idea: ${idea.trim()}` : ""}`;
  const whatsapp = `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(message)}`;
  return <SiteChrome><main>
    <section className={styles.hero}>
      <div className={styles.copy}><span className={styles.kicker}>HECHO PARA TI · ATENCIÓN PERSONALIZADA</span><h1>{settings.personalized_title}</h1><p>{settings.personalized_description}</p><a className={styles.primary} href="#conversemos">Cuéntanos tu idea <ArrowUpRight size={17} /></a><div className={styles.signature}><span /><em>Lo especial empieza en los detalles.</em></div></div>
      <ArtisanAnimation />
    </section>
    <section className={styles.steps} aria-label="Cómo te acompañamos"><article><MessageCircle size={24} /><span>01 / ESCUCHAMOS</span><h2>Primero, tu historia.</h2><p>La ocasión, el estilo y lo que te gustaría expresar. Te ayudamos a ordenar tus ideas.</p></article><article><PencilLine size={24} /><span>02 / EXPLORAMOS</span><h2>Damos forma a la idea.</h2><p>Conoce las opciones de diseño, material, talla y acabados que podemos ofrecerte.</p></article><article><Gem size={24} /><span>03 / COORDINAMOS</span><h2>Cuidamos cada detalle.</h2><p>El equipo confirma contigo la viabilidad, el presupuesto y el plazo antes de iniciar el pedido.</p></article></section>
    <section id="conversemos" className={styles.consultation}><div className={styles.consultationCopy}><span className={styles.kicker}>TU PRIMER BOCETO ES UNA CONVERSACIÓN</span><h2>¿Qué tienes<br /><em>en mente?</em></h2><p>Una idea es suficiente para empezar. Comparte tus preferencias y continúa la conversación con nuestro equipo.</p><small>Los diseños a medida se confirman según disponibilidad y posibilidades del taller.</small><Link href="/colecciones">También puedes explorar nuestras piezas <ArrowUpRight size={15} /></Link></div><form className={styles.form} onSubmit={event => event.preventDefault()}><div className={styles.formRow}><label htmlFor="piece">La pieza que imaginas<select id="piece" value={piece} onChange={event => setPiece(event.target.value)}>{["Anillo", "Collar", "Aretes", "Pulsera", "Aún no lo sé"].map(item => <option key={item}>{item}</option>)}</select></label><label htmlFor="metal">Material<select id="metal" value={metal} onChange={event => setMetal(event.target.value)}>{["Quiero asesoría", "Oro amarillo", "Oro rosa", "Plata"].map(item => <option key={item}>{item}</option>)}</select></label></div><label htmlFor="idea">Tu idea <span>(opcional)</span><textarea id="idea" value={idea} onChange={event => setIdea(event.target.value)} maxLength={1000} rows={4} placeholder="Una ocasión, un estilo, un detalle que te gustaría incluir…" /></label><a href={whatsapp} target="_blank" rel="noopener noreferrer" className={styles.primary}>Conversar por WhatsApp <ArrowUpRight size={17} /></a><p className={styles.formNote}>Tus preferencias se incluyen en el mensaje. Podrás revisarlo antes de enviarlo en WhatsApp.</p></form></section>
    <section className={styles.questions}><span className={styles.kicker}>ANTES DE EMPEZAR</span><h2>Una atención sin dudas.</h2><details><summary>¿Puedo compartir una referencia o un boceto?</summary><p>Sí. Puedes enviar tus referencias durante la conversación por WhatsApp. El equipo revisará las opciones que se pueden trabajar.</p></details><details><summary>¿Cuánto tarda una pieza personalizada?</summary><p>Depende del diseño, el material y la disponibilidad. El equipo te confirma un plazo junto con el presupuesto antes de iniciar.</p></details><details><summary>¿También me ayudan a elegir una joya del catálogo?</summary><p>Por supuesto. Podemos orientarte sobre estilo, material y talla, tanto para un regalo como para una pieza para ti.</p></details></section>
  </main></SiteChrome>;
}

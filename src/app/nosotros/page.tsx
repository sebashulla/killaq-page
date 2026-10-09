import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/Brand";
import SiteChrome from "@/components/SiteChrome";
import styles from "./page.module.css";

export default function NosotrosPage() {
  return <SiteChrome><main className={styles.page}>
    <section className={styles.hero}><div className={styles.copy}><BrandMark className={styles.mark} /><span>EL UNIVERSO KILLAQ</span><h1>Hay historias que<br />se llevan puestas.</h1><p>Creemos que una joya puede guardar mucho más que brillo: una promesa, un recuerdo, una forma de ser tú.</p><p>Desde Perú, Killaq reúne piezas de oro y plata para acompañar esos momentos. Nuestra esencia está en elegir con intención y ayudarte a encontrar un detalle que tenga sentido para ti.</p><Link href="/colecciones" className={styles.link}>Encuentra tu próxima historia <ArrowUpRight size={17} /></Link></div><div className={styles.visual}><Image src="/images/killaq-ring-v2.png" alt="Anillo ilustrativo de la campaña Killaq" fill sizes="(max-width: 700px) 44vw, 50vw" loading="eager" /><small>IMAGINARIO KILLAQ · IMAGEN DE CAMPAÑA</small></div></section>
    <section className={styles.values}><article><span>01</span><h2>Elegir con intención</h2><p>Un detalle para cada historia. Buscamos diseños que puedas llevar hoy y seguir disfrutando con el paso del tiempo.</p></article><article><span>02</span><h2>Conocer tu pieza</h2><p>Te orientamos sobre materiales, tallas y cuidados para que elijas con información y confianza.</p></article><article><span>03</span><h2>Acompañarte de cerca</h2><p>De la primera pregunta a la entrega. Nuestro equipo te ayuda a elegir y coordinar cada detalle de tu pedido.</p></article></section>
    <section className={styles.questions}><span>ANTES DE ELEGIR</span><h2>Los detalles también cuentan.</h2><details><summary>¿Cómo compro una joya?</summary><p>Elige tus piezas, selecciona la talla cuando corresponda y agrégalas al carrito. Desde allí puedes coordinar disponibilidad, pago y entrega con Killaq por WhatsApp.</p></details><details><summary>¿Cómo encuentro mi talla?</summary><p>Consulta las tallas disponibles en la ficha de cada anillo. Si tienes dudas, escríbenos antes de comprar para recibir orientación sobre la medida.</p></details><details><summary>¿Cómo se coordina el envío?</summary><p>El equipo confirma las opciones de entrega, costo y plazo según tu destino antes de cerrar el pedido.</p></details><details><summary>¿Cómo cuido mi joya?</summary><p>Guárdala por separado, evita el contacto directo con perfumes y productos de limpieza, y consulta las indicaciones específicas de cuidado para el material de tu pieza.</p></details></section>
  </main></SiteChrome>;
}

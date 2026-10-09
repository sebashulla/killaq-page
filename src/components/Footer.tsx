import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Brand, { BrandMark } from "./Brand";
import FooterGroup from "./FooterGroup";
import styles from "./Footer.module.css";

export default function Footer() {
  return <footer className={styles.footer}>
    <div className={styles.content}>
      <div className={styles.brand}><Brand /><p>Joyas para llevar contigo<br />lo que más importa.</p><BrandMark className={styles.mark} /></div>
      <FooterGroup title="Explora" id="footer-explora"><Link href="/colecciones">Todas las joyas</Link><Link href="/colecciones?category=anillos">Anillos</Link><Link href="/colecciones?category=collares">Collares</Link><Link href="/colecciones?category=aretes">Aretes</Link><Link href="/colecciones?category=pulseras">Pulseras</Link><Link href="/colecciones?category=charms">Charms</Link></FooterGroup>
      <FooterGroup title="Tu experiencia" id="footer-experiencia"><Link href="/nosotros">El universo Killaq</Link><Link href="/atencion-personalizada">Atención personalizada</Link><Link href="/perfil">Mi cuenta</Link><Link href="/carrito">Mi carrito</Link><Link href="/libro-reclamaciones">Libro de reclamaciones</Link></FooterGroup>
      <div className={styles.column}><h3>Conversemos</h3><a href="https://wa.me/51912964356" target="_blank" rel="noopener noreferrer" className={styles.contact}>Asesoría por WhatsApp <ArrowUpRight size={15} /></a><a href="tel:+51912964356">+51 912 964 356</a><a href="mailto:contacto@killaq.pe">contacto@killaq.pe</a><span>Lima, Perú</span><p>Una elección especial merece<br />una atención personal.</p></div>
    </div>
    <div className={styles.bottom}><span>© {new Date().getFullYear()} Killaq Joyería Fina</span><span>DESDE PERÚ, CON INTENCIÓN.</span><span>Oro. Plata. Historias.</span></div>
  </footer>;
}

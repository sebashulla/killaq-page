import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import Brand, { BrandMark } from "./Brand";
import FooterGroup from "./FooterGroup";
import styles from "./Footer.module.css";
import PrivacyPreferences from './analytics/PrivacyPreferences';

export default function Footer() {
  return <footer className={styles.footer} data-analytics-location='footer'>
    <div className={styles.content}>
      <div className={styles.brand}><Brand /><p>Joyas para llevar contigo<br />lo que más importa.</p><BrandMark className={styles.mark} /></div>
      <FooterGroup title="Explora" id="footer-explora"><Link href="/colecciones">Todas las joyas</Link><Link href="/colecciones?category=anillos">Anillos</Link><Link href="/colecciones?category=collares">Collares</Link><Link href="/colecciones?category=aretes">Aretes</Link><Link href="/colecciones?category=pulseras">Pulseras</Link><Link href="/colecciones?category=charms">Charms</Link></FooterGroup>
      <FooterGroup title="Tu experiencia" id="footer-experiencia"><Link href="/nosotros">El universo Killaq</Link><Link href="/atencion-personalizada">Atención personalizada</Link><Link href="/perfil">Mi cuenta</Link><Link href="/carrito">Mi carrito</Link><Link href="/libro-reclamaciones">Libro de reclamaciones</Link></FooterGroup>
      <div className={styles.column}><h3>Conversemos</h3><a href="https://wa.me/51912964356" target="_blank" rel="noopener noreferrer" className={styles.contact}>Asesoría por WhatsApp <ArrowUpRight size={15} /></a><a href="tel:+51912964356">+51 912 964 356</a><a href="mailto:contacto@killaq.pe">contacto@killaq.pe</a><small>Correo pendiente de habilitación.</small><span>Lima, Perú</span><p>Una elección especial merece<br />una atención personal.</p></div>
    </div>
    <div className={styles.legalRow}><FooterGroup title="Información legal" id="footer-legal"><Link href="/terminos-y-condiciones">Términos y condiciones</Link><Link href="/cambios-y-devoluciones">Cambios, devoluciones y reembolsos</Link><Link href="/politica-de-privacidad">Política de privacidad</Link></FooterGroup><Link className={styles.bookAccess} href="/libro-reclamaciones"><BookOpen size={21} aria-hidden="true" /><span>Libro de reclamaciones<small>Un acceso directo para ser escuchado.</small></span><ArrowUpRight size={17} aria-hidden="true" /></Link></div>
    <div className={styles.bottom}><span>© {new Date().getFullYear()} Killaq Joyería Fina</span><span>DESDE PERÚ, CON INTENCIÓN.</span><span>Oro. Plata. Historias.</span><PrivacyPreferences /></div>
  </footer>;
}

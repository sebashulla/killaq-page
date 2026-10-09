import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import styles from "./page.module.css";
export default function ProductNotFound() {
  return <SiteChrome><main className={styles.page}><section className={styles.notFound}><h1>Esta pieza no está disponible.</h1><p>Descubre más historias en nuestra colección de joyas.</p><Link href="/colecciones" className={styles.primaryButton}>Explorar las joyas</Link></section></main></SiteChrome>;
}

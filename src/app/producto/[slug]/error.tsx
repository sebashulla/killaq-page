"use client";
import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import styles from "./page.module.css";
export default function ProductError({ retry }: { retry: () => void }) {
  return <SiteChrome><main className={styles.page}><section className={styles.notFound}><h1>Pronto volveremos a brillar.</h1><p>No pudimos cargar esta joya. Inténtalo nuevamente en unos momentos.</p><button className={styles.primaryButton} type="button" onClick={retry}>Volver a intentar</button><Link href="/colecciones">Explorar el catálogo</Link></section></main></SiteChrome>;
}

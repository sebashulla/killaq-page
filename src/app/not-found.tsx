import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <SiteChrome>
      <main className={styles.page}>
        <section className={styles.panel}>
          <span>Ruta no encontrada</span>
          <h1>Esta página no está disponible</h1>
          <p>
            La dirección puede haber cambiado o la pieza ya no está publicada. Puedes volver al
            catálogo para seguir explorando Killaq.
          </p>
          <div className={styles.actions}>
            <Link href="/colecciones" className={styles.primaryButton}>
              Ver catálogo
            </Link>
            <Link href="/" className={styles.secondaryButton}>
              Ir al inicio
            </Link>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}

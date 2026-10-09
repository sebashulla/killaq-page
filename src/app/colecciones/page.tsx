import { Suspense } from "react";
import SiteChrome from "@/components/SiteChrome";
import ColeccionesClient from "./ColeccionesClient";
import styles from "./page.module.css";

export default function ColeccionesPage() {
  return (
    <SiteChrome>
      <Suspense fallback={<div className={styles.loading}>Cargando catálogo...</div>}>
        <ColeccionesClient />
      </Suspense>
    </SiteChrome>
  );
}

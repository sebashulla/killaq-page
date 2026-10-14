import Link from "next/link";
import styles from "./LegalLinks.module.css";
export default function LegalLinks({ privacyOnly = false }: { privacyOnly?: boolean }) {
  return <nav className={styles.links} aria-label={privacyOnly ? "Información sobre datos personales" : "Información de compra"}>{!privacyOnly && <><Link href="/terminos-y-condiciones">Términos y condiciones</Link><Link href="/cambios-y-devoluciones">Cambios y garantías</Link></>}<Link href="/politica-de-privacidad">Política de privacidad</Link></nav>;
}

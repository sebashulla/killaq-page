import styles from "./Brand.module.css";

export function BrandMark({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M30 6a18 18 0 1 0 12 26A17 17 0 0 1 30 6Z" stroke="currentColor" strokeWidth="1.1" />
    <path d="m32 12 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" stroke="currentColor" strokeWidth=".8" />
  </svg>;
}
export default function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={styles.brand}>
    <span className={styles.name}>KILLAQ<span className={styles.star}>✧</span></span>
    {!compact && <span className={styles.tagline}>JOYERÍA FINA</span>}
  </span>;
}

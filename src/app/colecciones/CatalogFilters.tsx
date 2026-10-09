import Link from "next/link";
import type { Category, Material } from "@/types/catalog";
import styles from "./page.module.css";

interface Props {
  categories: Category[];
  materials: Material[];
  audienceLabels: Record<string, string>;
  selectedAudience: string;
  selectedCategory: string;
  selectedSubcategory: string;
  selectedMaterials: string[];
  category?: Category;
  availableStyles: readonly { slug: string; name: string }[];
  filterHref: (key: string, value: string) => string;
  toggleMaterial: (slug: string) => void;
}

export default function CatalogFilters(props: Props) {
  const { categories, materials, audienceLabels, selectedAudience, selectedCategory, selectedSubcategory, selectedMaterials, category, availableStyles, filterHref, toggleMaterial } = props;
  return <>
    <div className={styles.filterSection}>
      <h3 className={styles.filterTitle}>Tienda</h3>
      <div className={styles.filterList}>
        <Link href={filterHref("audience", "")} className={!selectedAudience ? styles.filterPillActive : styles.filterPill}>Toda la tienda</Link>
        {Object.entries(audienceLabels).map(([slug, label]) => <Link key={slug} href={filterHref("audience", slug)} className={selectedAudience === slug ? styles.filterPillActive : styles.filterPill}>{label}</Link>)}
      </div>
    </div>
    <div className={styles.filterSection}>
      <h3 className={styles.filterTitle}>Categorías</h3>
      <div className={styles.filterList}>
        <Link href={filterHref("category", "")} className={!selectedCategory ? styles.filterPillActive : styles.filterPill}>Todas</Link>
        {categories.map(item => <Link key={item.id} href={filterHref("category", item.slug)} className={selectedCategory === item.slug ? styles.filterPillActive : styles.filterPill}>{item.name}</Link>)}
      </div>
    </div>
    <div className={styles.filterSection}>
      <h3 className={styles.filterTitle}>{category ? `Estilos de ${category.name}` : "Subcategorías"}</h3>
      {category ? <div className={styles.filterList}><Link href={filterHref("subcategory", "")} className={!selectedSubcategory ? styles.filterPillActive : styles.filterPill}>Todos los estilos</Link>{availableStyles.map(item => <Link key={item.slug} href={filterHref("subcategory", item.slug)} className={selectedSubcategory === item.slug ? styles.filterPillActive : styles.filterPill} aria-current={selectedSubcategory === item.slug ? "page" : undefined}>{item.name}</Link>)}</div> : <p className={styles.filterHint}>Elige una categoría para explorar sus estilos.</p>}
    </div>
    <div className={styles.filterSection}>
      <h3 className={styles.filterTitle}>Material</h3>
      <div className={styles.filterList}>{materials.map(item => <label key={item.id} className={styles.checkboxRow}><input type="checkbox" checked={selectedMaterials.includes(item.slug)} onChange={() => toggleMaterial(item.slug)} />{item.name}</label>)}</div>
    </div>
  </>;
}

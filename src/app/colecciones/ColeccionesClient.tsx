"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import {
  fallbackCategories,
  fallbackMaterials,
  getPrimaryImage,
  normalizeProducts,
} from "@/data/catalog";
import type { Category, Material, Product } from "@/types/catalog";
import { supabase } from "@/utils/supabaseClient";
import styles from "./page.module.css";

type SortKey = "relevance" | "price-asc" | "price-desc" | "newest";

const audienceLabels: Record<string, string> = {
  hombres: "Hombres",
  mujeres: "Mujeres",
  personalizados: "Personalizados",
};

const audienceTerms: Record<string, string[]> = {
  hombres: ["hombre", "masculino", "caballero", "unisex"],
  mujeres: ["mujer", "femenino", "dama", "unisex"],
  personalizados: ["personalizado", "personalizada", "grabado", "inicial", "nombre", "charms"],
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getSearchableText(product: Product) {
  return normalizeText(
    [
      product.name,
      product.description,
      product.slug,
      product.categories?.name,
      product.categories?.slug,
      product.materials?.name,
      product.materials?.slug,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export default function ColeccionesClient() {
  const searchParams = useSearchParams();
  const selectedAudience = searchParams.get("audience") || "";
  const selectedCategory = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";
  const sortParam = searchParams.get("sort") || "relevance";
  const selectedSort: SortKey = ["price-asc", "price-desc", "newest"].includes(sortParam) ? sortParam as SortKey : "relevance";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [materials, setMaterials] = useState<Material[]>(fallbackMaterials);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [sortOverride, setSortOverride] = useState<{ source: SortKey; value: SortKey } | null>(null);
  const sort = sortOverride?.source === selectedSort ? sortOverride.value : selectedSort;
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterHref = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    return `/colecciones${next.size ? `?${next}` : ""}`;
  };

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoadingProducts(true);
      const [productsRes, categoriesRes, materialsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, slug, name, description, price, compare_price, stock, sizes_available, created_at, is_featured, categories(name, slug), materials(name, slug), product_images(url, alt_text, sort_order)")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("categories")
          .select("id, slug, name, description, image_url")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("materials")
          .select("id, slug, name, description")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      setProducts(normalizeProducts(productsRes.data));
      setCatalogError(Boolean(productsRes.error));
      if (categoriesRes.data?.length) setCategories(categoriesRes.data as Category[]);
      if (materialsRes.data?.length) setMaterials(materialsRes.data as Material[]);
      setLoadingProducts(false);
    };

    const timer = window.setTimeout(() => {
      fetchCatalog();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(search.trim());

    const baseFiltered = products.filter((product) => {
      const categoryMatch = !selectedCategory || product.categories?.slug === selectedCategory;
      const materialMatch =
        selectedMaterials.length === 0 ||
        Boolean(product.materials?.slug && selectedMaterials.includes(product.materials.slug));
      const searchMatch = !query || getSearchableText(product).includes(query);

      return categoryMatch && materialMatch && searchMatch;
    });

    const terms = audienceTerms[selectedAudience] || [];
    const audienceFiltered = terms.length
      ? baseFiltered.filter((product) => terms.some((term) => getSearchableText(product).includes(term)))
      : baseFiltered;
    const filtered = selectedAudience ? audienceFiltered : baseFiltered;

    return [...filtered].sort((a, b) => {
      if (sort === "price-asc") return Number(a.price) - Number(b.price);
      if (sort === "price-desc") return Number(b.price) - Number(a.price);
      if (sort === "newest") return (b.created_at || "").localeCompare(a.created_at || "");
      return Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
    });
  }, [products, search, selectedAudience, selectedCategory, selectedMaterials, sort]);

  const toggleMaterial = (slug: string) => {
    setSelectedMaterials((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]
    );
  };

  const pageTitle = selectedAudience
    ? `Colección ${audienceLabels[selectedAudience] || "Killaq"}`
    : "Colección Killaq";

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className={styles.kicker}>Catálogo</span>
        <h1 className={styles.title}>{pageTitle}</h1>
        <p className={styles.subtitle}>
          Encuentra el detalle que va contigo. Explora nuestras joyas por categoría, material y precio.
        </p>
      </header>

      <main className={styles.mainContent}>
        <aside className={styles.sidebar}>
          <button type="button" className={styles.filterToggle} aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={17} /> Filtros y materiales <ChevronDown size={17} /></button>
          <div id="catalog-filters" className={`${styles.filterGroups} ${filtersOpen ? styles.filterGroupsOpen : ""}`}>
          <div className={styles.filterSection}>
            <h3 className={styles.filterTitle}>Tienda</h3>
            <div className={styles.filterList}>
              <Link
                href={filterHref("audience", "")}
                className={!selectedAudience ? styles.filterPillActive : styles.filterPill}
              >
                Toda la tienda
              </Link>
              {Object.entries(audienceLabels).map(([slug, label]) => (
                <Link
                  key={slug}
                  href={filterHref("audience", slug)}
                  className={
                    selectedAudience === slug ? styles.filterPillActive : styles.filterPill
                  }
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className={styles.filterSection}>
            <h3 className={styles.filterTitle}>Categorías</h3>
            <div className={styles.filterList}>
              <Link
                href={filterHref("category", "")}
                className={!selectedCategory ? styles.filterPillActive : styles.filterPill}
              >
                Todas
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={filterHref("category", category.slug)}
                  className={
                    selectedCategory === category.slug ? styles.filterPillActive : styles.filterPill
                  }
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>

          <div className={styles.filterSection}>
            <h3 className={styles.filterTitle}>Material</h3>
            <div className={styles.filterList}>
              {materials.map((material) => (
                <label key={material.id} className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={selectedMaterials.includes(material.slug)}
                    onChange={() => toggleMaterial(material.slug)}
                  />
                  {material.name}
                </label>
              ))}
            </div>
          </div>
          </div>
        </aside>

        <section className={styles.productGridWrapper}>
          <div className={styles.toolbar}>
            <span className={styles.resultsCount}>
              {filteredProducts.length} {filteredProducts.length === 1 ? "resultado" : "resultados"}
            </span>
            <select
              className={styles.sortSelect}
              aria-label="Ordenar joyas"
              value={sort}
              onChange={(event) => setSortOverride({ source: selectedSort, value: event.target.value as SortKey })}
            >
              <option value="relevance">Más relevantes</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="newest">Recién llegados</option>
            </select>
          </div>

          {loadingProducts ? (
            <div className={styles.emptyState}>Cargando productos publicados...</div>
          ) : filteredProducts.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>{catalogError ? "No pudimos cargar las joyas" : products.length ? "No encontramos piezas para esta selección" : "Estamos preparando nuestra selección"}</h2>
              <p>{catalogError ? "Vuelve a intentarlo en unos momentos o consulta la disponibilidad con nuestro equipo." : products.length ? "Prueba otra categoría o material para descubrir más joyas." : "Pronto podrás descubrir nuestras joyas aquí. Mientras tanto, podemos ayudarte a encontrar tu próxima pieza."}</p>
              <Link href="/colecciones">Explorar todas las joyas</Link>{" · "}<a href="https://wa.me/51912964356" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a>
            </div>
          ) : (
            <div className={styles.productGrid}>
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  slug={product.slug}
                  name={product.name}
                  price={Number(product.price)}
                  comparePrice={product.compare_price ? Number(product.compare_price) : null}
                  imageUrl={getPrimaryImage(product)}
                  categoryName={product.categories?.name}
                  materialName={product.materials?.name}
                  stock={product.stock}
                  requiresSize={Boolean(product.sizes_available?.length)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

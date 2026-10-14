"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import CatalogFilters from "./CatalogFilters";
import ProductCard from "@/components/ProductCard";
import {
  fallbackCategories,
  fallbackMaterials,
  getPrimaryImage,
  normalizeProducts,
} from "@/data/catalog";
import type { Category, Material, Product, Subcategory } from "@/types/catalog";
import { categoryPresentation, presentCategories } from "@/data/taxonomy";
import { supabase } from "@/utils/supabaseClient";
import styles from "./page.module.css";
import {useAnalytics,refreshAnalyticsContext} from '@/components/analytics/AnalyticsProvider';
import {safeSearch} from '@/lib/analytics/core';
import {trackOnce} from '@/lib/analytics/client';

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
      product.subcategories?.name,
      product.subcategories?.slug,
      product.materials?.name,
      product.materials?.slug,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export default function ColeccionesClient() {
  const searchParams = useSearchParams();
  const analyticsState=useAnalytics();
  const navigationQuery=searchParams.toString();
  useEffect(()=>refreshAnalyticsContext(),[navigationQuery]);
  const selectedAudience = searchParams.get("audience") || "";
  const selectedCategory = searchParams.get("category") || "";
  const selectedSubcategory = searchParams.get("subcategory") || "";
  const search = searchParams.get("search") || "";
  const sortParam = searchParams.get("sort") || "relevance";
  const selectedSort: SortKey = ["price-asc", "price-desc", "newest"].includes(sortParam) ? sortParam as SortKey : "relevance";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [materials, setMaterials] = useState<Material[]>(fallbackMaterials);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [sortOverride, setSortOverride] = useState<{ source: SortKey; value: SortKey } | null>(null);
  const sort = sortOverride?.source === selectedSort ? sortOverride.value : selectedSort;
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterDialog = useRef<HTMLDialogElement>(null);
  const filterHref = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key === "category") next.delete("subcategory");
    return `/colecciones${next.size ? `?${next}` : ""}`;
  };

  useEffect(() => {
    if (!filtersOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 901px)");
    const closeOnDesktop = () => { if (desktop.matches) filterDialog.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => { document.body.style.overflow = previous; desktop.removeEventListener("change", closeOnDesktop); };
  }, [filtersOpen]);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoadingProducts(true);
      const [productsRes, categoriesRes, subcategoriesRes, materialsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, slug, name, description, sku, price, compare_price, stock, sizes_available, created_at, is_featured, categories(name, slug), subcategories(name, slug), materials(name, slug), product_images(url, alt_text, sort_order)")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("categories")
          .select("id, slug, name, description, image_url, is_active")
          .order("sort_order", { ascending: true }),
        supabase.from("subcategories").select("id, category_id, slug, name").eq("is_active",true).order("sort_order"),
        supabase
          .from("materials")
          .select("id, slug, name, description")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      setProducts(normalizeProducts(productsRes.data));
      setCatalogError(Boolean(productsRes.error));
      if (categoriesRes.data?.length) setCategories(presentCategories(categoriesRes.data as Category[]));
      if (materialsRes.data?.length) setMaterials(materialsRes.data as Material[]);
      setSubcategories(subcategoriesRes.data || []);
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
      const subcategoryMatch = !selectedSubcategory || product.subcategories?.slug === selectedSubcategory;
      const materialMatch =
        selectedMaterials.length === 0 ||
        Boolean(product.materials?.slug && selectedMaterials.includes(product.materials.slug));
      const searchMatch = !query || getSearchableText(product).includes(query);

      return categoryMatch && subcategoryMatch && materialMatch && searchMatch;
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
  }, [products, search, selectedAudience, selectedCategory, selectedSubcategory, selectedMaterials, sort]);

  const toggleMaterial = (slug: string) => {
    setSelectedMaterials((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]
    );
  };
  useEffect(()=>{if(!loadingProducts&&!catalogError&&search.trim())trackOnce('search',{name:'search',term:safeSearch(search),results:filteredProducts.length});},[analyticsState.active,analyticsState.navigation,loadingProducts,catalogError,search,filteredProducts.length]);

  const category = categories.find(item => item.slug === selectedCategory);
  const databaseStyles = subcategories.filter(item => item.category_id === category?.id);
  const availableStyles = databaseStyles.length ? databaseStyles : categoryPresentation(selectedCategory)?.subcategories || [];
  const style = availableStyles.find(item => item.slug === selectedSubcategory);
  const pageTitle = category ? `${category.name}${style ? ` · ${style.name}` : ""}` : selectedAudience
    ? `Colección ${audienceLabels[selectedAudience] || "Killaq"}`
    : "Colección Killaq";

  const filterProps = { categories, materials, audienceLabels, selectedAudience, selectedCategory, selectedSubcategory, selectedMaterials, category, availableStyles, filterHref, toggleMaterial };
  const applied: { key: string; label: string; href?: string; material?: string }[] = [
    ...(selectedAudience ? [{ key: "audience", label: `Tienda: ${audienceLabels[selectedAudience] || selectedAudience}`, href: filterHref("audience", "") }] : []),
    ...(selectedCategory ? [{ key: "category", label: `Categoría: ${category?.name || selectedCategory}`, href: filterHref("category", "") }] : []),
    ...(selectedSubcategory ? [{ key: "subcategory", label: `Estilo: ${style?.name || selectedSubcategory}`, href: filterHref("subcategory", "") }] : []),
    ...(search ? [{ key: "search", label: `Búsqueda: ${search}`, href: filterHref("search", "") }] : []),
    ...selectedMaterials.map(slug => ({ key: `material-${slug}`, label: `Material: ${materials.find(item => item.slug === slug)?.name || slug}`, material: slug })),
  ];
  const cleared = new URLSearchParams(searchParams.toString());
  for (const key of ["audience", "category", "subcategory", "search"]) cleared.delete(key);
  const clearHref = `/colecciones${cleared.size ? `?${cleared}` : ""}`;

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
          <div id="catalog-filters" className={styles.filterGroups}><CatalogFilters {...filterProps} /></div>
        </aside>

        <section className={styles.productGridWrapper}>
          <div className={styles.toolbar}>
            <span className={styles.resultsCount}>
              {filteredProducts.length} {filteredProducts.length === 1 ? "resultado" : "resultados"}
            </span>
            <button type="button" className={styles.filterToggle} aria-expanded={filtersOpen} aria-controls="catalog-filter-dialog" aria-haspopup="dialog" onClick={() => { filterDialog.current?.showModal(); setFiltersOpen(true); }}><SlidersHorizontal size={17} /> Filtros{applied.length ? ` (${applied.length})` : ""}</button>
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

          {applied.length > 0 && <div className={styles.appliedFilters} aria-label="Filtros aplicados">
            {applied.map(item => item.href ? <Link key={item.key} href={item.href} aria-label={`Quitar ${item.label}`} title={item.label}><span>{item.label}</span><X size={14} aria-hidden="true" /></Link> : <button key={item.key} type="button" onClick={() => toggleMaterial(item.material!)} aria-label={`Quitar ${item.label}`} title={item.label}><span>{item.label}</span><X size={14} aria-hidden="true" /></button>)}
            <Link href={clearHref} onClick={() => setSelectedMaterials([])} className={styles.clearFilters}>Limpiar filtros</Link>
          </div>}

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
              {filteredProducts.map((product,index) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  slug={product.slug}
                  name={product.name}
                  sku={product.sku}
                  price={Number(product.price)}
                  comparePrice={product.compare_price ? Number(product.compare_price) : null}
                  imageUrl={getPrimaryImage(product)}
                  categoryName={product.categories?.name}
                  materialName={product.materials?.name}
                  stock={product.stock}
                  requiresSize={Boolean(product.sizes_available?.length)}
                  listId='catalog' position={index}
                />
              ))}
            </div>
          )}
        </section>
      </main>
      <dialog ref={filterDialog} id="catalog-filter-dialog" aria-labelledby="catalog-filter-title" className={styles.filterDialog} onClose={() => setFiltersOpen(false)} onClick={event => { if (event.target !== event.currentTarget) return; const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close(); }}>
        <div className={styles.dialogHeader}><h2 id="catalog-filter-title">Filtrar joyas</h2><button type="button" onClick={() => filterDialog.current?.close()} aria-label="Cerrar filtros"><X size={20} /></button></div>
        <div className={styles.dialogBody}><CatalogFilters {...filterProps} /></div>
        <div className={styles.dialogFooter}><button type="button" onClick={() => filterDialog.current?.close()}>Ver {filteredProducts.length} {filteredProducts.length === 1 ? "resultado" : "resultados"}</button></div>
      </dialog>
    </div>
  );
}

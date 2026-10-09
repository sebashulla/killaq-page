import type { Category, HeroSlide, Material, Product } from "@/types/catalog";
import { presentCategories } from "./taxonomy";

export const fallbackCategories: Category[] = presentCategories(null);

export const fallbackMaterials: Material[] = [
  { id: 1, slug: "oro-18k", name: "Oro 18k" },
  { id: 2, slug: "oro-14k", name: "Oro 14k" },
  { id: 3, slug: "oro-rosa", name: "Oro rosa" },
  { id: 4, slug: "plata-950", name: "Plata 950" },
];

export const fallbackSlides: HeroSlide[] = [
  {
    id: 1,
    image_url: "/images/killaq-ring-v2.png",
    title: "El brillo de lo\nque permanece.",
    subtitle: "Hay detalles que dicen todo. Descubre joyas de oro y plata para llevar contigo lo que más importa.",
    cta_text: "Descubrir las joyas",
    cta_url: "/colecciones",
    image_alt: "Anillo de oro con gema, imagen ilustrativa de campaña Killaq",
    jewelry_tone: "gold",
    background_style: "black",
    image_fit: "contain",
  },
  {
    id: -2,
    image_url: "/images/categories/collares-v1.webp",
    title: "Un detalle tuyo.\nUn brillo único.",
    subtitle: "Cadenas y dijes que acompañan tu historia. Encuentra una forma de llevar cerca lo que más quieres.",
    cta_text: "Explorar collares",
    cta_url: "/colecciones?category=collares",
    image_alt: "Collar de oro con dije circular, imagen ilustrativa de campaña Killaq",
    jewelry_tone: "gold",
    background_style: "black",
    image_fit: "cover",
  },
];

export function getPrimaryImage(product: Product) {
  return product.product_images?.[0]?.url || "/images/product-placeholder.svg";
}

type MaybeArray<T> = T | T[] | null | undefined;

type ProductRow = Omit<Product, "categories" | "materials" | "subcategories" | "collections"> & {
  categories?: MaybeArray<Product["categories"]>;
  materials?: MaybeArray<Product["materials"]>;
  subcategories?: MaybeArray<Product["subcategories"]>;
  collections?: MaybeArray<Product["collections"]>;
};

function firstRelation<T>(value: MaybeArray<T>): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export function normalizeProduct(row: ProductRow): Product {
  return {
    ...row,
    categories: firstRelation(row.categories),
    materials: firstRelation(row.materials),
    subcategories: firstRelation(row.subcategories),
    collections: firstRelation(row.collections),
    product_images: row.product_images
      ? [...row.product_images].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      : null,
    product_videos: row.product_videos
      ? [...row.product_videos].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      : null,
  };
}

export function normalizeProducts(rows: ProductRow[] | null | undefined): Product[] {
  return (rows || []).map(normalizeProduct);
}

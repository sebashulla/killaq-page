import type { Category, HeroSlide, Material, Product } from "@/types/catalog";

export const fallbackCategories: Category[] = [
  { id: 1, slug: "anillos", name: "Anillos" },
  { id: 2, slug: "collares", name: "Collares" },
  { id: 3, slug: "aretes", name: "Aretes" },
  { id: 4, slug: "pulseras", name: "Pulseras" },
];

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
];

export function getPrimaryImage(product: Product) {
  return product.product_images?.[0]?.url || "/images/product-placeholder.svg";
}

type MaybeArray<T> = T | T[] | null | undefined;

type ProductRow = Omit<Product, "categories" | "materials"> & {
  categories?: MaybeArray<Product["categories"]>;
  materials?: MaybeArray<Product["materials"]>;
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

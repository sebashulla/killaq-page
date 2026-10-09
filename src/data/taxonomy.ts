import type { Category } from "@/types/catalog";

export const categoryDirectory = [
  { slug: "anillos", name: "Anillos", detail: "Una promesa en cada detalle", image: "/images/categories/anillos-v1.webp", tone: "black", subcategories: [{ slug: "anillos-compromiso", name: "Compromiso" }, { slug: "anillos-matrimonio", name: "Matrimonio" }, { slug: "anillos-moda", name: "Moda" }, { slug: "anillos-sellos", name: "Sellos" }] },
  { slug: "collares", name: "Collares", detail: "Cerca de lo que más quieres", image: "/images/categories/collares-v1.webp", tone: "black", subcategories: [{ slug: "collares-cadenas", name: "Cadenas" }, { slug: "collares-dijes", name: "Dijes" }, { slug: "collares-gargantillas", name: "Gargantillas" }] },
  { slug: "aretes", name: "Aretes", detail: "Luz que enmarca tu esencia", image: "/images/categories/aretes-v1.webp", tone: "gold", subcategories: [{ slug: "aretes-argollas", name: "Argollas" }, { slug: "aretes-broqueles", name: "Broqueles" }, { slug: "aretes-largos", name: "Largos" }] },
  { slug: "pulseras", name: "Pulseras", detail: "Historias que van contigo", image: "/images/categories/pulseras-v1.webp", tone: "black", subcategories: [{ slug: "pulseras-brazaletes", name: "Brazaletes" }, { slug: "pulseras-cadenas", name: "Cadenas" }, { slug: "pulseras-amuletos", name: "Amuletos" }] },
  { slug: "charms", name: "Charms", detail: "Pequeños símbolos, muy tuyos", image: "/images/categories/charms-v1.webp", tone: "black", subcategories: [{ slug: "charms-simbolos", name: "Símbolos" }, { slug: "charms-iniciales", name: "Iniciales" }, { slug: "charms-piedras", name: "Piedras" }] },
] as const;

export const categoryPresentation = (slug: string) => categoryDirectory.find(item => item.slug === slug);
export function presentCategories(rows: Category[] | null | undefined): Category[] {
  const source: Category[] = rows?.length ? rows : categoryDirectory.map((item, index) => ({ id: -(index + 1), name: item.name, slug: item.slug }));
  const categories = source.filter(item => item.is_active !== false).map(item => ({ ...item, image_url: item.image_url || categoryPresentation(item.slug)?.image }));
  // Keep Charms discoverable while migration 005 is pending. An explicitly hidden category stays hidden.
  if (rows?.length && !rows.some(item => item.slug === "charms")) {
    const charms = categoryDirectory[4];
    categories.push({ id: -5, slug: charms.slug, name: charms.name, image_url: charms.image });
  }
  return categories;
}

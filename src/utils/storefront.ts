export interface StorefrontSettings {
  welcome_enabled: boolean;
  artisan_enabled: boolean;
  hero_autoplay: boolean;
  hero_interval: number;
  personalized_title: string;
  personalized_description: string;
  whatsapp_number: string;
  exclusive_enabled: boolean;
  exclusive_product_id: string;
  exclusive_title: string;
  exclusive_description: string;
  catalog_version: number;
}

export const defaultStorefrontSettings: StorefrontSettings = {
  welcome_enabled: true,
  artisan_enabled: true,
  hero_autoplay: true,
  hero_interval: 9,
  personalized_title: "Una idea tuya.\nUna joya única.",
  personalized_description: "Hay piezas que empiezan con un recuerdo, un deseo o un boceto. Conversemos sobre la joya que imaginas y encontremos juntos cómo darle forma.",
  whatsapp_number: "51912964356",
  exclusive_enabled: false,
  exclusive_product_id: "",
  exclusive_title: "Una pieza fuera de lo habitual.",
  exclusive_description: "Diseño, intención y detalles que hacen de esta joya una elección especial.",
  catalog_version: 0,
};

export function normalizeStorefrontSettings(value: unknown): StorefrontSettings {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (key: keyof StorefrontSettings, max: number) => typeof data[key] === "string" && (data[key] as string).trim() ? (data[key] as string).trim().slice(0, max) : defaultStorefrontSettings[key] as string;
  return {
    welcome_enabled: typeof data.welcome_enabled === "boolean" ? data.welcome_enabled : true,
    artisan_enabled: typeof data.artisan_enabled === "boolean" ? data.artisan_enabled : true,
    hero_autoplay: typeof data.hero_autoplay === "boolean" ? data.hero_autoplay : true,
    hero_interval: typeof data.hero_interval === "number" && Number.isFinite(data.hero_interval) ? Math.min(20, Math.max(6, data.hero_interval)) : 9,
    personalized_title: text("personalized_title", 100),
    personalized_description: text("personalized_description", 500),
    whatsapp_number: /^\d{8,15}$/.test(String(data.whatsapp_number)) ? String(data.whatsapp_number) : defaultStorefrontSettings.whatsapp_number,
    exclusive_enabled: data.exclusive_enabled === true,
    exclusive_product_id: typeof data.exclusive_product_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.exclusive_product_id) ? data.exclusive_product_id : "",
    exclusive_title: text("exclusive_title", 100),
    exclusive_description: text("exclusive_description", 500),
    catalog_version: data.catalog_version === 5 ? 5 : 0,
  };
}

export function canShowExclusive(settings: Pick<StorefrontSettings, "exclusive_enabled" | "exclusive_product_id">, product: { id: string; is_active?: boolean; collection_id?: number | null; collections?: { is_active?: boolean } | null; product_images?: { url: string }[] | null } | null) {
  return Boolean(settings.exclusive_enabled && product && product.id === settings.exclusive_product_id && product.is_active === true && product.collection_id && product.collections?.is_active === true && product.product_images?.some(image => image.url?.trim()));
}

export type JewelryTone = "gold" | "silver";
export type HeroBackground = "auto" | "black" | "gold" | "white";
export function resolveHeroBackground(background?: HeroBackground, tone?: JewelryTone): Exclude<HeroBackground, "auto"> {
  return background === "black" || background === "gold" || background === "white" ? background : tone === "silver" ? "gold" : "black";
}

export function isLegacyCampaign(slide: { title: string; image_url: string; subtitle?: string | null; cta_text?: string; cta_url?: string; image_alt?: string | null }) {
  if (slide.cta_text !== "VER CATÁLOGO" || slide.image_alt) return false;
  return (slide.title === "Colección Matrimonio" && slide.subtitle === "Sella tu promesa con el brillo de nuestros diamantes exclusivos." && slide.cta_url === "/colecciones/matrimonio" && (slide.image_url === "/images/hero-bg.png" || slide.image_url.includes("/placeholder/"))) ||
    (slide.title === "Nueva Colección Eternidad" && slide.subtitle === "Descubre piezas únicas diseñadas para brillar eternamente." && slide.cta_url === "/colecciones/eternidad" && (slide.image_url === "/images/product-1.png" || slide.image_url.includes("/placeholder/")));
}

export interface StorefrontSettings {
  welcome_enabled: boolean;
  artisan_enabled: boolean;
  hero_autoplay: boolean;
  hero_interval: number;
  personalized_title: string;
  personalized_description: string;
  whatsapp_number: string;
}

export const defaultStorefrontSettings: StorefrontSettings = {
  welcome_enabled: true,
  artisan_enabled: true,
  hero_autoplay: false,
  hero_interval: 9,
  personalized_title: "Una idea tuya.\nUna joya única.",
  personalized_description: "Hay piezas que empiezan con un recuerdo, un deseo o un boceto. Conversemos sobre la joya que imaginas y encontremos juntos cómo darle forma.",
  whatsapp_number: "51912964356",
};

export function normalizeStorefrontSettings(value: unknown): StorefrontSettings {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (key: keyof StorefrontSettings, max: number) => typeof data[key] === "string" && (data[key] as string).trim() ? (data[key] as string).trim().slice(0, max) : defaultStorefrontSettings[key] as string;
  return {
    welcome_enabled: typeof data.welcome_enabled === "boolean" ? data.welcome_enabled : true,
    artisan_enabled: typeof data.artisan_enabled === "boolean" ? data.artisan_enabled : true,
    hero_autoplay: typeof data.hero_autoplay === "boolean" ? data.hero_autoplay : false,
    hero_interval: typeof data.hero_interval === "number" && Number.isFinite(data.hero_interval) ? Math.min(20, Math.max(6, data.hero_interval)) : 9,
    personalized_title: text("personalized_title", 100),
    personalized_description: text("personalized_description", 500),
    whatsapp_number: /^\d{8,15}$/.test(String(data.whatsapp_number)) ? String(data.whatsapp_number) : defaultStorefrontSettings.whatsapp_number,
  };
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

// Public contracts contain no credentials, user identity or free-text properties.
export const EVENT_NAMES = [
  "page_view",
  "view_item_list",
  "select_item",
  "view_item",
  "add_to_cart",
  "remove_from_cart",
  "view_cart",
  "search",
  "whatsapp_contact_click",
  "product_whatsapp_inquiry",
  "category_selected",
  "campaign_viewed",
  "campaign_selected",
  "product_gallery_interaction",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
export type Device = "mobile" | "tablet" | "desktop";
export type PageKind =
  "home" | "catalog" | "offers" | "story" | "personalized" | "product" | "cart";
export type ListId =
  "featured" | "catalog" | "offers" | "related" | "exclusive";
export const CATEGORIES = [
  "anillos",
  "collares",
  "aretes",
  "pulseras",
  "charms",
] as const;
export const LOCATIONS = [
  "header",
  "footer",
  "hero",
  "catalog",
  "product",
  "cart",
  "personalized",
  "home",
  "exclusive",
] as const;
export type Location = (typeof LOCATIONS)[number];
export type Traffic = { source: string; medium: string; campaign: string };
export type CommercialEvent =
  | { name: "page_view"; page: PageKind }
  | {
      name: "view_item_list" | "select_item";
      productId: string;
      list: ListId;
      position: number;
    }
  | { name: "view_item"; productId: string }
  | {
      name: "add_to_cart" | "remove_from_cart" | "product_whatsapp_inquiry";
      productId: string;
      quantity: number;
    }
  | { name: "view_cart"; items: { productId: string; quantity: number }[] }
  | { name: "search"; term: string; results: number }
  | { name: "whatsapp_contact_click"; location: Location }
  | {
      name: "category_selected";
      category: (typeof CATEGORIES)[number];
      location: Location;
    }
  | {
      name: "campaign_viewed" | "campaign_selected";
      campaignId: string;
      location: "hero";
    }
  | { name: "product_gallery_interaction"; productId: string; index: number };
export type EventEnvelope = {
  id: string;
  event: CommercialEvent;
  page: PageKind;
  device: Device;
  traffic?: Traffic;
};
export class AnalyticsError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AnalyticsError";
  }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validProductId = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);
export function pageKind(path: string): PageKind | null {
  if (path === "/") return "home";
  const pages: Record<string, PageKind> = {
    "/colecciones": "catalog",
    "/ofertas": "offers",
    "/nosotros": "story",
    "/atencion-personalizada": "personalized",
    "/carrito": "cart",
  };
  if (pages[path]) return pages[path];
  return /^\/producto\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) ? "product" : null;
}
// A finite vocabulary is intentionally used instead of storing or hashing raw queries.
const SEARCH_WORDS = new Set([
  "anillo",
  "anillos",
  "collar",
  "collares",
  "arete",
  "aretes",
  "pulsera",
  "pulseras",
  "charm",
  "charms",
  "oro",
  "plata",
  "dorado",
  "dorada",
  "dorados",
  "doradas",
  "amarillo",
  "rosa",
  "blanco",
  "blanca",
  "18k",
  "14k",
  "925",
  "compromiso",
  "matrimonio",
  "boda",
  "regalo",
  "regalos",
  "corazon",
  "estrella",
  "perla",
  "perlas",
  "diamante",
  "diamantes",
  "cadena",
  "cadenas",
  "inicial",
  "iniciales",
  "grabado",
  "grabados",
  "personalizado",
  "personalizados",
  "mujer",
  "hombre",
  "unisex",
  "solitario",
  "solitarios",
  "argolla",
  "argollas",
  "de",
  "para",
  "con",
  "y",
]);
export function safeSearch(value: string): string {
  const words = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .split(/\s+/);
  if (
    !words.length ||
    words.length > 5 ||
    !words.every((word) => SEARCH_WORDS.has(word))
  )
    return "termino-omitido";
  const contains = (terms: string[]) =>
    terms.some((term) => words.includes(term));
  const category = (
    [
      ["anillos", ["anillo", "anillos"]],
      ["collares", ["collar", "collares", "cadena", "cadenas"]],
      ["aretes", ["arete", "aretes"]],
      ["pulseras", ["pulsera", "pulseras"]],
      ["charms", ["charm", "charms"]],
    ] as [string, string[]][]
  ).find(([, terms]) => contains(terms))?.[0];
  const metal = contains(["oro", "18k", "14k"])
    ? "oro"
    : contains(["plata", "925"])
      ? "plata"
      : undefined;
  const stone = contains(["diamante", "diamantes"])
    ? "diamantes"
    : contains(["perla", "perlas"])
      ? "perlas"
      : undefined;
  const occasion = contains(["compromiso"])
    ? "compromiso"
    : contains(["matrimonio", "boda"])
      ? "matrimonio"
      : contains(["regalo", "regalos"])
        ? "regalos"
        : contains([
              "personalizado",
              "personalizados",
              "grabado",
              "grabados",
              "inicial",
              "iniciales",
            ])
          ? "personalizados"
          : undefined;
  // Canonical concepts, never the raw word sequence. Colors alone could be personal names.
  return (
    [category, metal, stone, occasion].filter(Boolean).join(" ") ||
    "termino-omitido"
  );
}
const SOURCES = new Set([
  "google",
  "bing",
  "instagram",
  "facebook",
  "tiktok",
  "pinterest",
  "youtube",
  "whatsapp",
  "email",
  "direct",
  "other",
]);
const MEDIUMS = new Set([
  "organic",
  "cpc",
  "social",
  "email",
  "referral",
  "direct",
  "other",
]);
export function safeTraffic(
  input: Partial<Traffic>,
  campaigns: string[],
): Traffic {
  return {
    source: SOURCES.has(input.source || "") ? input.source! : "other",
    medium: MEDIUMS.has(input.medium || "") ? input.medium! : "other",
    campaign: campaigns.includes(input.campaign || "")
      ? input.campaign!
      : "sin-campana",
  };
}
export function landingTraffic(
  url: string,
  referrer: string,
  campaigns: string[],
): Traffic {
  try {
    const parsed = new URL(url),
      utm = parsed.searchParams;
    if (utm.has("utm_source"))
      return safeTraffic(
        {
          source: utm.get("utm_source") || "",
          medium: utm.get("utm_medium") || "",
          campaign: utm.get("utm_campaign") || "",
        },
        campaigns,
      );
    let source = "direct";
    if (referrer) {
      const hostname = new URL(referrer).hostname;
      if (hostname !== parsed.hostname) {
        source = "other";
        for (const candidate of [
          "google",
          "bing",
          "instagram",
          "facebook",
          "tiktok",
          "pinterest",
          "youtube",
          "whatsapp",
        ])
          if (
            hostname === candidate + ".com" ||
            hostname.endsWith("." + candidate + ".com")
          ) {
            source = candidate;
            break;
          }
      }
    }
    return {
      source,
      medium:
        source === "direct"
          ? "direct"
          : source === "google" || source === "bing"
            ? "organic"
            : "referral",
      campaign: "sin-campana",
    };
  } catch {
    return { source: "other", medium: "other", campaign: "sin-campana" };
  }
}
const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
function integer(v: unknown, min: number, max: number) {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}
function exact(input: Record<string, unknown>, keys: string[]) {
  if (Object.keys(input).some((k) => !keys.includes(k)))
    throw new AnalyticsError(
      422,
      "El evento contiene propiedades no permitidas.",
    );
}
export function validateEnvelope(
  value: unknown,
  campaigns: string[],
): EventEnvelope {
  if (!record(value)) {
    throw new AnalyticsError(422, "Evento inválido.");
  }
  exact(value, ["id", "event", "page", "device", "traffic"]);
  if (
    !validProductId(value.id) ||
    ![
      "home",
      "catalog",
      "offers",
      "story",
      "personalized",
      "product",
      "cart",
    ].includes(String(value.page)) ||
    !["mobile", "tablet", "desktop"].includes(String(value.device)) ||
    !record(value.event)
  )
    throw new AnalyticsError(422, "Evento inválido.");
  const event = value.event,
    name = event.name;
  if (typeof name !== "string" || !EVENT_NAMES.includes(name as EventName))
    throw new AnalyticsError(422, "Este evento no está habilitado.");
  const keys: Record<EventName, string[]> = {
    page_view: ["page"],
    view_item_list: ["productId", "list", "position"],
    select_item: ["productId", "list", "position"],
    view_item: ["productId"],
    add_to_cart: ["productId", "quantity"],
    remove_from_cart: ["productId", "quantity"],
    view_cart: ["items"],
    search: ["term", "results"],
    whatsapp_contact_click: ["location"],
    product_whatsapp_inquiry: ["productId", "quantity"],
    category_selected: ["category", "location"],
    campaign_viewed: ["campaignId", "location"],
    campaign_selected: ["campaignId", "location"],
    product_gallery_interaction: ["productId", "index"],
  };
  exact(event, ["name", ...keys[name as EventName]]);
  if ("productId" in event && !validProductId(event.productId))
    throw new AnalyticsError(422, "Identificador de producto inválido.");
  if ("quantity" in event && !integer(event.quantity, 1, 1000))
    throw new AnalyticsError(422, "Cantidad inválida.");
  if (
    "list" in event &&
    (!["featured", "catalog", "offers", "related", "exclusive"].includes(
      String(event.list),
    ) ||
      !integer(event.position, 0, 10000))
  )
    throw new AnalyticsError(422, "Lista inválida.");
  if ("location" in event && !LOCATIONS.includes(event.location as Location))
    throw new AnalyticsError(422, "Ubicación inválida.");
  if (name === "page_view" && event.page !== value.page)
    throw new AnalyticsError(422, "Página inválida.");
  if (
    name === "category_selected" &&
    !CATEGORIES.includes(event.category as (typeof CATEGORIES)[number])
  )
    throw new AnalyticsError(422, "Categoría inválida.");
  if (
    name === "search" &&
    (typeof event.term !== "string" ||
      event.term !== safeSearch(event.term) ||
      !integer(event.results, 0, 100000))
  )
    throw new AnalyticsError(422, "La búsqueda no está anonimizada.");
  if (name === "product_gallery_interaction" && !integer(event.index, 0, 1000))
    throw new AnalyticsError(422, "Índice inválido.");
  if (name === "campaign_viewed" || name === "campaign_selected") {
    if (
      event.location !== "hero" ||
      typeof event.campaignId !== "string" ||
      !(
        /^[1-9]\d{0,8}$/.test(event.campaignId) ||
        ["reference:ring", "reference:necklace"].includes(event.campaignId)
      )
    )
      throw new AnalyticsError(422, "Campaña inválida.");
  }
  if (name === "view_cart") {
    if (!Array.isArray(event.items) || event.items.length > 100)
      throw new AnalyticsError(422, "Carrito inválido.");
    const ids = new Set<string>();
    for (const item of event.items) {
      if (
        !record(item) ||
        Object.keys(item).some((k) => !["productId", "quantity"].includes(k)) ||
        !validProductId(item.productId) ||
        !integer(item.quantity, 1, 1000) ||
        ids.has(String(item.productId))
      )
        throw new AnalyticsError(422, "Carrito inválido.");
      ids.add(String(item.productId));
    }
  }
  let traffic: Traffic | undefined;
  if (value.traffic !== undefined) {
    if (!record(value.traffic))
      throw new AnalyticsError(422, "Procedencia inválida.");
    exact(value.traffic, ["source", "medium", "campaign"]);
    traffic = safeTraffic(value.traffic as Partial<Traffic>, campaigns);
  }
  return {
    id: String(value.id).toLowerCase(),
    event: event as CommercialEvent,
    page: value.page as PageKind,
    device: value.device as Device,
    ...(traffic ? { traffic } : {}),
  };
}
export type Period = {
  from: string;
  to: string;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  days: number;
  device: Device | "all";
};
export const limaDay = (now = new Date()) =>
  new Date(now.getTime() - 5 * 3600000).toISOString().slice(0, 10);
export function shiftDay(day: string, amount: number) {
  return new Date(Date.parse(day + "T05:00:00Z") + amount * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(Date.parse(day + "T05:00:00Z")) &&
    new Date(day + "T05:00:00Z").toISOString().startsWith(day)
  );
}
export function periodFrom(params: URLSearchParams, now = new Date()): Period {
  const preset = params.get("days") || "30";
  let from = params.get("from") || "",
    to = params.get("to") || "";
  if (!from && !to) {
    if (!["7", "30", "90"].includes(preset))
      throw new AnalyticsError(400, "Selecciona 7, 30 o 90 días.");
    to = shiftDay(limaDay(now), -1);
    from = shiftDay(to, 1 - Number(preset));
  }
  if (!validDay(from) || !validDay(to) || from > to || to >= limaDay(now))
    throw new AnalyticsError(
      400,
      "Utiliza fechas válidas hasta ayer, según hora de Perú.",
    );
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (days > 90)
    throw new AnalyticsError(400, "El rango máximo es de 90 días.");
  const device = params.get("device") || "all";
  if (!["all", "mobile", "tablet", "desktop"].includes(device))
    throw new AnalyticsError(400, "Dispositivo inválido.");
  return {
    from,
    to,
    start: from + "T05:00:00Z",
    end: shiftDay(to, 1) + "T05:00:00Z",
    previousStart: shiftDay(from, -days) + "T05:00:00Z",
    previousEnd: from + "T05:00:00Z",
    days,
    device: device as Period["device"],
  };
}
export function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}
export function variation(
  current: number,
  previous: number,
  comparable: boolean,
): number | null {
  return comparable && previous > 0
    ? ((current - previous) / previous) * 100
    : null;
}
export const metricDefinitions = {
  visitors:
    "Identificadores aleatorios distintos en el periodo. No equivalen a personas; pueden cambiar al borrar cookies o cambiar de navegador.",
  sessions:
    "Identificador de sesión propio: termina tras 30 minutos sin eventos o a las 24 horas. Solo actividad consentida.",
  views:
    "Eventos view_item de fichas válidas; una vista por navegación y producto.",
  selections:
    "Eventos select_item de enlaces del catálogo. Un clic repetido puede ser una nueva selección.",
  adds: "Eventos add_to_cart tras un aumento efectivo de unidades. No equivale a unidades ni pedidos.",
  inquiries:
    "Clics explícitos de WhatsApp. No prueban envío de un mensaje ni una venta.",
  selectionRate:
    "Selecciones / impresiones válidas × 100, por eventos. Puede superar 100 % si se selecciona repetidamente.",
  addRate:
    "Sesiones con vista de ficha y añadido / sesiones con vista de ficha × 100.",
  inquiryRate:
    "Sesiones con vista de ficha y clic de WhatsApp / sesiones con vista de ficha × 100.",
};
export type Totals = {
  visitors: number;
  sessions: number;
  views: number;
  selections: number;
  adds: number;
  inquiries: number;
  impressions: number;
  events: number;
  viewSessions: number;
  addViewSessions: number;
  inquiryViewSessions: number;
};
export type ProductStats = {
  id: string;
  name: string;
  image: string;
  category: string;
  views: number;
  selections: number;
  adds: number;
  inquiries: number;
  impressions: number;
  viewSessions: number;
  addViewSessions: number;
  inquiryViewSessions: number;
};
export type Breakdown = {
  key: string;
  detail: string;
  events: number;
  selections: number;
  views: number;
  adds: number;
  inquiries: number;
  sessions: number;
  viewSessions: number;
  inquiryViewSessions: number;
};
export type AnalyticsReport = {
  period: Period;
  state: "unconfigured" | "disabled" | "ready" | "error";
  issues: string[];
  generatedAt: string;
  cacheSeconds: number;
  measurementStart: string | null;
  comparable: boolean;
  current: Totals | null;
  previous: Totals | null;
  daily: { date: string; views: number | null; inquiries: number | null }[];
  products: ProductStats[];
  categories: Breakdown[];
  campaigns: Breakdown[];
  ctas: Breakdown[];
  traffic: Breakdown[];
  devices: Breakdown[];
  searches: {
    term: string;
    events: number;
    noResults: number;
    sessions: number;
  }[];
  funnel: { steps: number[]; error: string | null };
  truncated: boolean;
  clarityUrl: string | null;
  captureEnabled: boolean;
};

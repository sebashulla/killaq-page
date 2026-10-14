export class AdminError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
export function imageUrl(value: unknown, required = false) {
  if (typeof value !== "string" || !value.trim()) {
    if (required)
      throw new AdminError(422, "Añade una imagen válida.", {
        image: "Añade una imagen.",
      });
    return "";
  }
  const input = value.trim();
  if (input.length > 2000 || input.startsWith("//") || input.includes("\\"))
    throw new AdminError(422, "URL de imagen inválida.");
  if (/^\/images\/[a-zA-Z0-9/_.-]+$/.test(input) && !input.includes(".."))
    return input;
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" || u.username || u.password) throw Error();
    return input;
  } catch {
    throw new AdminError(
      422,
      "La imagen debe usar HTTPS o un archivo de /images/.",
    );
  }
}
export function videoUrl(value: unknown, platform: unknown) {
  const input = String(value || "").trim();
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new AdminError(422, "Escribe un enlace de video completo.", {
      video_url: "Enlace inválido.",
    });
  }
  if (u.protocol !== "https:" || u.username || u.password)
    throw new AdminError(422, "Los videos requieren un enlace HTTPS seguro.");
  const ig =
    ["instagram.com", "www.instagram.com"].includes(u.hostname) &&
    /^\/(p|reel|tv)\/[\w-]+\/?$/.test(u.pathname);
  const tt =
    ["www.tiktok.com", "tiktok.com"].includes(u.hostname) &&
    /^\/@[\w.-]+\/video\/\d+\/?$/.test(u.pathname);
  const direct = /\.(mp4|webm|ogg|mov|m4v)$/i.test(u.pathname);
  if (
    (platform === "instagram" && !ig) ||
    (platform === "tiktok" && !tt) ||
    (["upload", "external"].includes(String(platform)) && !direct) ||
    !["instagram", "tiktok", "upload", "external"].includes(String(platform))
  )
    throw new AdminError(
      422,
      "Usa un reel/publicación de Instagram, video de TikTok o archivo directo MP4/WebM/MOV. No se admiten páginas externas como iframe.",
      { video_url: "El enlace no corresponde al proveedor elegido." },
    );
  return input;
}
function text(
  data: Record<string, unknown>,
  key: string,
  max: number,
  required = false,
) {
  if (typeof data[key] !== "string" || String(data[key]).length > max)
    throw new AdminError(422, `Revisa ${key}.`);
  const value = String(data[key]).trim();
  if (required && !value)
    throw new AdminError(422, "Completa los campos obligatorios.", {
      [key]: "Este campo es obligatorio.",
    });
  return value;
}
function int(v: unknown, key: string, max = 1000000) {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0 || v > max)
    throw new AdminError(422, "Revisa las cantidades.", {
      [key]: "Utiliza un entero entre 0 y " + max + ".",
    });
  return v;
}
function bool(v: unknown) {
  if (typeof v !== "boolean") throw new AdminError(422, "Estado inválido.");
  return v;
}
function ref(v: unknown) {
  if (v === null || v === "") return null;
  const n = int(v, "clasificacion");
  if (n === 0) throw new AdminError(422, "Referencia inválida.");
  return n;
}
function productImage(value: unknown) {
  try {
    return imageUrl(value);
  } catch (error) {
    throw new AdminError(422, (error as Error).message, {
      primary_image: "Usa HTTPS o una imagen válida de /images/.",
    });
  }
}
export function validateProduct(data: Record<string, unknown>) {
  const name = text(data, "name", 150, true),
    slug = text(data, "slug", 170, true),
    description = text(data, "description", 6000),
    image = productImage(data.primary_image);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new AdminError(422, "Revisa la dirección del producto.", {
      slug: "Solo letras minúsculas, números y guiones.",
    });
  const price = data.price,
    compare = data.compare_price;
  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price <= 0 ||
    price > 99999999.99 ||
    (Math.round(price * 100) !== price * 100 &&
      Math.abs(Math.round(price * 100) - price * 100) > 0.00001)
  )
    throw new AdminError(422, "Revisa el precio.", {
      price: "Precio positivo con hasta dos decimales.",
    });
  if (
    compare !== null &&
    (typeof compare !== "number" ||
      !Number.isFinite(compare) ||
      compare <= price ||
      compare > 99999999.99 ||
      Math.abs(Math.round(compare * 100) - compare * 100) > 0.00001)
  )
    throw new AdminError(422, "Revisa el precio anterior.", {
      compare_price:
        "Debe superar el precio actual y usar hasta dos decimales.",
    });
  const is_active = bool(data.is_active),
    material_id = ref(data.material_id);
  if (
    is_active &&
    (!description ||
      !material_id ||
      !image ||
      !String(data.image_alt || "").trim())
  )
    throw new AdminError(
      422,
      "Para publicar, completa descripción, material, fotografía y su descripción accesible.",
      { is_active: "La pieza todavía no está lista para publicarse." },
    );
  const video = String(data.video_url || "").trim();
  if (video) videoUrl(video, data.video_type);
  const sizes = text(data, "sizes_available", 300)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    String(data.sku || "").startsWith("KILLAQ-DEMO-") &&
    (data.stock !== 0 ||
      (data.compare_price !== null &&
        data.compare_price !== "" &&
        data.compare_price !== undefined))
  )
    throw new AdminError(
      422,
      "Las muestras digitales deben tener stock 0 y no ofrecer promociones.",
      { stock: "Una muestra digital no está disponible para compra." },
    );
  return {
    name,
    slug,
    description: description || null,
    price,
    compare_price: compare,
    stock: int(data.stock, "stock"),
    sku: text(data, "sku", 80) || null,
    category_id: ref(data.category_id),
    subcategory_id: ref(data.subcategory_id),
    collection_id: ref(data.collection_id),
    material_id,
    sizes_available: [...new Set(sizes)],
    is_active,
    is_featured: bool(data.is_featured),
    primary_image: image,
    image_alt: text(data, "image_alt", 300),
    video_url: video,
    video_type: data.video_type || "upload",
    video_title: text(data, "video_title", 150),
    video_poster: imageUrl(data.video_poster),
  };
}
export function validateResource(
  resource: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (resource === "productos") return validateProduct(data);
  if (resource === "colecciones") {
    const name = text(data, "name", 90, true),
      slug = text(data, "slug", 120, true);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      throw new AdminError(422, "Slug inválido.");
    return {
      name,
      slug,
      description: text(data, "description", 1500) || null,
      image_url: imageUrl(data.image_url) || null,
      sort_order: int(data.sort_order, "sort_order"),
      is_active: bool(data.is_active),
    };
  }
  if (resource === "videos") {
    if (!["instagram", "tiktok", "external"].includes(String(data.platform)))
      throw new AdminError(422, "Proveedor inválido.");
    return {
      title: text(data, "title", 150, true),
      platform: data.platform,
      video_url: videoUrl(data.video_url, data.platform),
      thumbnail_url: imageUrl(data.thumbnail_url) || null,
      sort_order: int(data.sort_order, "sort_order"),
      is_active: bool(data.is_active),
    };
  }
  if (resource === "campanas") {
    const cta_url = text(data, "cta_url", 2000, true);
    if (
      !/^\/(?!\/)[a-zA-Z0-9/?&=_#%-]*$/.test(cta_url) ||
      cta_url.includes("..")
    )
      throw new AdminError(
        422,
        "El botón debe enlazar a una ruta de la tienda.",
      );
    if (
      !["gold", "silver"].includes(String(data.jewelry_tone)) ||
      !["auto", "black", "gold", "white"].includes(
        String(data.background_style),
      ) ||
      !["contain", "cover"].includes(String(data.image_fit))
    )
      throw new AdminError(422, "Revisa la presentación de la campaña.");
    return {
      title: text(data, "title", 150, true),
      subtitle: text(data, "subtitle", 500) || null,
      cta_text: text(data, "cta_text", 80, true),
      cta_url,
      image_url: imageUrl(data.image_url, true),
      image_alt: text(data, "image_alt", 300, true),
      jewelry_tone: data.jewelry_tone,
      background_style: data.background_style,
      image_fit: data.image_fit,
      sort_order: int(data.sort_order, "sort_order"),
      is_active: bool(data.is_active),
    };
  }
  throw new AdminError(404, "Sección no disponible.");
}
export function validateSettings(
  section: unknown,
  data: Record<string, unknown>,
) {
  if (section === "experiencia") {
    const interval = data.hero_interval;
    if (
      typeof interval !== "number" ||
      !Number.isFinite(interval) ||
      interval < 6 ||
      interval > 20
    )
      throw new AdminError(
        422,
        "El intervalo debe estar entre 6 y 20 segundos.",
      );
    const phone = text(data, "whatsapp_number", 15, true);
    if (!/^\d{8,15}$/.test(phone))
      throw new AdminError(
        422,
        "Escribe el número con código de país, sin espacios ni +.",
      );
    return {
      welcome_enabled: bool(data.welcome_enabled),
      artisan_enabled: bool(data.artisan_enabled),
      hero_autoplay: bool(data.hero_autoplay),
      hero_interval: interval,
      personalized_title: text(data, "personalized_title", 100, true),
      personalized_description: text(
        data,
        "personalized_description",
        500,
        true,
      ),
      whatsapp_number: phone,
    };
  }
  if (section === "exclusivo") {
    const id = text(data, "exclusive_product_id", 36);
    if (id && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))
      throw new AdminError(422, "Selecciona una pieza válida.");
    return {
      exclusive_enabled: bool(data.exclusive_enabled),
      exclusive_product_id: id,
      exclusive_title: text(data, "exclusive_title", 100, true),
      exclusive_description: text(data, "exclusive_description", 500, true),
    };
  }
  throw new AdminError(422, "Configuración desconocida.");
}

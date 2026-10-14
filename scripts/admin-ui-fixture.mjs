// UI-only Supabase simulation. Binds loopback and uses fictitious records.
// Atomic SQL and RLS are tested independently in test-admin.mjs against PGlite.
import { createServer } from "node:http";
import { categoryDirectory } from "../src/data/taxonomy.ts";
import { randomUUID } from "node:crypto";
const admin = "00000000-0000-0000-0000-000000000001",
  customer = "00000000-0000-0000-0000-000000000002";
const encode = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
const token =
  encode({ alg: "HS256", typ: "JWT" }) +
  "." +
  encode({
    sub: admin,
    exp: Math.floor(Date.now() / 1000) + 86400,
    role: "authenticated",
    aud: "authenticated",
  }) +
  ".local-fixture";
const user = (id) => ({
  id,
  email: id === admin ? "admin@killaq.test" : "customer@killaq.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-10-09T00:00:00Z",
});
let data,
  failTable = "";
function reset() {
  const categories = categoryDirectory.map((c, i) => ({
    id: i + 1,
    slug: c.slug,
    name: c.name,
    is_active: true,
    image_url: c.image,
    sort_order: i,
  }));
  let subId = 1;
  const subcategories = categoryDirectory.flatMap((c, i) =>
    c.subcategories.map((s) => ({
      id: subId++,
      category_id: i + 1,
      slug: s.slug,
      name: s.name,
      is_active: true,
    })),
  );
  const collections = [
    {
      id: 1,
      slug: "coleccion-prueba",
      name: "Colección de prueba",
      is_active: true,
      description: "",
      image_url: "",
      sort_order: 0,
    },
  ];
  const images = [
    {
      id: 1,
      product_id: "00000000-0000-0000-0000-000000000011",
      url: "/images/categories/anillos-v1.webp",
      alt_text: "Imagen de prueba local",
      sort_order: 0,
    },
    {
      id: 2,
      product_id: "00000000-0000-0000-0000-000000000011",
      url: "/images/killaq-ring-v2.png",
      alt_text: "Segunda imagen de prueba local",
      sort_order: 1,
    },
  ];
  data = {
    profiles: [
      { id: admin, role: "admin" },
      { id: customer, role: "customer" },
    ],
    categories,
    subcategories,
    collections,
    product_images: images,
    products: [
      {
        id: "00000000-0000-0000-0000-000000000011",
        slug: "pieza-prueba",
        name: "Pieza de prueba local",
        description: "Solo para verificar la interfaz, fuera de producción.",
        price: 150,
        compare_price: null,
        stock: 3,
        sizes_available: ["6", "7", "8"],
        weight_grams: 3,
        category_id: 1,
        subcategory_id: 1,
        collection_id: 1,
        material_id: 1,
        sku: null,
        is_active: true,
        is_featured: false,
        created_at: "2026-10-09T12:00:00Z",
        updated_at: "2026-10-09T12:00:00Z",
      },
    ],
    materials: [{ id: 1, name: "Oro 18k", slug: "oro-18k", is_active: true }],
    site_settings: [
      {
        key: "storefront",
        value: {
          welcome_enabled: false,
          artisan_enabled: true,
          hero_autoplay: true,
          hero_interval: 9,
          exclusive_enabled: false,
          exclusive_product_id: "",
          catalog_version: 5,
        },
        updated_at: "2026-10-09T12:00:00Z",
      },
    ],
    hero_slides: [],
    social_videos: [],
    product_videos: [],
    complaints_book: [],
    complaint_events: [],
  };
  failTable = "";
}
reset();
function expanded(table, row) {
  if (table !== "products") return row;
  return {
    ...row,
    categories: data.categories.find((c) => c.id === row.category_id),
    collections: data.collections.find((c) => c.id === row.collection_id),
    materials: data.materials.find((c) => c.id === row.material_id),
    subcategories: data.subcategories.find((c) => c.id === row.subcategory_id),
    product_images: data.product_images
      .filter((i) => i.product_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  };
}
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,HEAD,OPTIONS",
  );
  res.setHeader("Access-Control-Expose-Headers", "Content-Range");
  res.setHeader("Content-Type", "application/json");
  const send = (status, value) => {
    res.statusCode = status;
    res.end(req.method === "HEAD" ? "" : JSON.stringify(value));
  };
  if (req.method === "OPTIONS") return send(204, {});
  const url = new URL(req.url, "http://127.0.0.1:3100");
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  if (url.pathname === "/__reset") {
    reset();
    return send(200, { reset: true });
  }
  if (url.pathname === "/__empty-catalog") {
    data.products = [];
    data.product_images = [];
    data.collections = [];
    failTable = "complaints_book";
    return send(200, { empty: true });
  }
  if (url.pathname === "/__fail") {
    failTable = body.table || "";
    return send(200, {});
  }
  if (url.pathname === "/__seed-product-gallery") {
    const product = data.products[0];
    data.product_images.push(...["/images/categories/collares-v1.webp", "/images/categories/aretes-v1.webp", "/images/categories/pulseras-v1.webp"].map((url, index) => ({ id: index + 3, product_id: product.id, url, alt_text: `Fotografía de prueba ${index + 3}`, sort_order: index + 2 })));
    data.product_videos = [
      { id: 1, product_id: product.id, video_type: "upload", title: "Video sintético de prueba", url: "https://media.example.test/piece.webm", poster_url: "/images/categories/anillos-v1.webp", sort_order: 0, is_active: true },
      { id: 2, product_id: product.id, video_type: "external", title: "Video inactivo", url: "https://media.example.test/inactive.webm", sort_order: 1, is_active: false },
    ];
    const id = "00000000-0000-0000-0000-000000000013";
    data.products.push({ ...product, id, slug: "muestra-prueba", name: "Muestra digital de prueba", sku: "KILLAQ-DEMO-QA", stock: 0, category_id: null });
    data.product_images.push({ ...data.product_images[0], id: 99, product_id: id });
    return send(200, { seeded: true });
  }
  if (url.pathname === "/__seed-campaigns") {
    data.hero_slides = [
      {
        id: 1,
        title: "Campaña QA uno",
        subtitle: "Referencia local",
        image_url: "/images/killaq-ring-v2.png",
        image_alt: "Anillo de referencia QA",
        cta_text: "Ver piezas",
        cta_url: "/colecciones",
        jewelry_tone: "gold",
        background_style: "black",
        image_fit: "contain",
        sort_order: 0,
        is_active: true,
      },
      {
        id: 2,
        title: "Campaña QA dos",
        subtitle: "Segunda referencia local",
        image_url: "/images/categories/collares-v1.webp",
        image_alt: "Collar de referencia QA",
        cta_text: "Ver collares",
        cta_url: "/colecciones",
        jewelry_tone: "gold",
        background_style: "black",
        image_fit: "contain",
        sort_order: 1,
        is_active: true,
      },
    ];
    return send(200, {});
  }
  if (url.pathname === "/auth/v1/token")
    return send(200, {
      access_token: token,
      refresh_token: "local-fixture-refresh",
      token_type: "bearer",
      expires_in: 86400,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      user: user(admin),
    });
  if (url.pathname === "/auth/v1/user") {
    const bearer = req.headers.authorization?.replace("Bearer ", "");
    if (bearer !== token && bearer !== "customer-token")
      return send(401, { message: "Invalid token" });
    return send(200, user(bearer === "customer-token" ? customer : admin));
  }
  if (url.pathname === "/auth/v1/logout") return send(200, {});
  const rpc = url.pathname.split("/rpc/")[1];
  if (rpc) {
    if (req.headers.authorization !== "Bearer " + token)
      return send(403, { code: "42501", message: "Admin required" });
    if (rpc === "admin_capabilities") return send(200, { version: 7 });
    if (rpc === "admin_merge_storefront") {
      const row = data.site_settings[0];
      if (row.updated_at !== body.p_expected)
        return send(409, { code: "40001", message: "Concurrent edit" });
      Object.assign(row.value, body.p_patch);
      row.updated_at = new Date().toISOString();
      return send(200, null);
    }
    if (rpc === "admin_reorder_campaigns") {
      if (
        JSON.stringify(
          data.hero_slides
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((r) => r.id),
        ) !== JSON.stringify(body.p_expected)
      )
        return send(409, { code: "40001" });
      body.p_ids.forEach((id, i) => {
        data.hero_slides.find((r) => r.id === id).sort_order = i;
      });
      return send(200, null);
    }
    if (rpc === "admin_save_product") {
      const old = data.products.find((r) => r.id === body.p_id);
      if (old && old.updated_at !== body.p_expected)
        return send(409, { code: "40001" });
      const id = body.p_id || randomUUID();
      const payload = { ...body.p_data };
      for (const key of [
        "primary_image",
        "image_alt",
        "video_url",
        "video_type",
        "video_title",
        "video_poster",
      ])
        delete payload[key];
      const row = {
        ...payload,
        id,
        updated_at: new Date().toISOString(),
        created_at: old?.created_at || new Date().toISOString(),
      };
      if (old) Object.assign(old, row);
      else data.products.push(row);
      const image = data.product_images
        .filter((i) => i.product_id === id)
        .sort((a, b) => a.sort_order - b.sort_order)[0];
      if (body.p_data.primary_image) {
        const next = {
          product_id: id,
          url: body.p_data.primary_image,
          alt_text: body.p_data.image_alt,
          sort_order: 0,
        };
        if (image) Object.assign(image, next);
        else
          data.product_images.push({
            ...next,
            id: data.product_images.length + 1,
          });
      }
      return send(200, id);
    }
    return send(404, { code: "PGRST202" });
  }
  const table = url.pathname.split("/rest/v1/")[1];
  if (!data[table]) return send(404, { code: "PGRST205" });
  if (failTable === table)
    return send(503, { code: "XX000", message: "Isolated failure" });
  let rows = data[table].map((row) => expanded(table, row));
  for (const [key, value] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    if (value.startsWith("eq."))
      rows = rows.filter((r) => String(r[key]) === value.slice(3));
    if (value.startsWith("neq."))
      rows = rows.filter((r) => String(r[key]) !== value.slice(4));
    if (value.startsWith("ilike."))
      rows = rows.filter((r) =>
        String(r[key] || "")
          .toLowerCase()
          .includes(value.slice(6).replaceAll("%", "").toLowerCase()),
      );
    if (value.startsWith("in.("))
      rows = rows.filter((r) =>
        value.slice(4, -1).split(",").includes(String(r[key])),
      );
    if (value === "is.null")
      rows = rows.filter((r) =>
        key === "product_images" ? !r.product_images.length : r[key] == null,
      );
    if (value === "not.is.null") rows = rows.filter((r) => r[key] != null);
    if (value.startsWith("gt."))
      rows = rows.filter((r) => r[key] > Number(value.slice(3)));
    if (value.startsWith("lte."))
      rows = rows.filter((r) => r[key] <= value.slice(4));
  }
  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    if (req.headers.authorization !== "Bearer " + token)
      return send(403, { code: "42501" });
    if (req.method === "POST") {
      const row = {
        ...body,
        id: data[table].reduce((m, r) => Math.max(m, r.id || 0), 0) + 1,
      };
      data[table].push(row);
      rows = [row];
    }
    if (req.method === "PATCH") {
      const ids = rows.map((r) => r.id);
      data[table]
        .filter((r) => ids.includes(r.id))
        .forEach((r) => Object.assign(r, body));
      rows = data[table].filter((r) => ids.includes(r.id));
    }
    if (req.method === "DELETE") {
      const ids = rows.map((r) => r.id);
      data[table] = data[table].filter((r) => !ids.includes(r.id));
    }
  }
  const total = rows.length;
  const order = url.searchParams.get("order") || "";
  rows.sort((a, b) => {
    for (const part of order.split(",")) {
      const [key, direction] = part.split(".");
      if (a[key] !== b[key])
        return (a[key] > b[key] ? 1 : -1) * (direction === "desc" ? -1 : 1);
    }
    return 0;
  });
  const offset = Number(url.searchParams.get("offset") || 0),
    limit = Number(url.searchParams.get("limit") || total);
  rows = rows.slice(offset, offset + limit);
  res.setHeader(
    "Content-Range",
    `${rows.length ? offset + "-" + (offset + rows.length - 1) : "*"}/${total}`,
  );
  return send(
    200,
    (req.headers.accept || "").includes("vnd.pgrst.object")
      ? rows[0] || null
      : rows,
  );
});
server.listen(3100, "127.0.0.1", () =>
  console.log("Admin UI fixture on loopback :3100. No remote database."),
);

import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { fixture, admin, customer } from "./complaints-fixture.mjs";
const output = new URL("../artifacts/admin-tests/", import.meta.url);
await mkdir(output, { recursive: true });
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, passed: true });
}
const source = await readFile(
  new URL("../src/lib/admin/validation.ts", import.meta.url),
  "utf8",
);
await writeFile(
  new URL("validation.mjs", output),
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
);
const {
  validateProduct,
  validateResource,
  validateSettings,
  imageUrl,
  videoUrl,
} = await import(new URL("validation.mjs", output));
const product = {
  name: "Joya ficticia QA",
  slug: "joya-ficticia-qa",
  description: "Pieza ficticia para pruebas aisladas.",
  price: 120.5,
  compare_price: null,
  stock: 2,
  sku: "",
  category_id: 1,
  subcategory_id: 1,
  collection_id: null,
  material_id: 1,
  sizes_available: "6, 7, 6",
  is_active: true,
  is_featured: false,
  primary_image: "/images/killaq-ring-v2.png",
  image_alt: "Joya ficticia QA",
  video_type: "upload",
  video_url: "",
  video_title: "",
  video_poster: "",
};
await check("Validación de producto real y tallas únicas", () =>
  assert.deepEqual(validateProduct(product).sizes_available, ["6", "7"]),
);
await check("Precio y stock inválidos rechazados", () => {
  for (const patch of [
    { price: 0 },
    { price: NaN },
    { price: 1.234 },
    { stock: -1 },
    { stock: 1.5 },
    { compare_price: 100 },
  ])
    assert.throws(() => validateProduct({ ...product, ...patch }));
});
await check("No se publica producto incompleto", () => {
  for (const patch of [
    { description: "" },
    { primary_image: "" },
    { material_id: null },
    { image_alt: "" },
  ])
    assert.throws(() => validateProduct({ ...product, ...patch }));
  assert.equal(
    validateProduct({ ...product, is_active: false, description: "" })
      .is_active,
    false,
  );
  assert.equal(validateProduct({ ...product, sku: "KILLAQ-DEMO-QA", stock: 0 }).stock, 0);
  assert.throws(() => validateProduct({ ...product, sku: "KILLAQ-DEMO-QA", stock: 1 }));
  assert.throws(() => validateProduct({ ...product, sku: "KILLAQ-DEMO-QA", stock: 0, compare_price: 150 }));
});
await check("Imágenes y proveedores seguros", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "http://example.test/a.png",
    "//example.test/a",
    "/images/../secret",
  ])
    assert.throws(() => imageUrl(url));
  for (const [url, platform] of [
    ["https://instagram.com.evil.test/reel/abc", "instagram"],
    ["https://evil.test/instagram.com/reel/abc", "instagram"],
    ["https://example.test/embed", "external"],
    ["javascript:alert(1)", "external"],
  ])
    assert.throws(() => videoUrl(url, platform));
  assert.equal(
    videoUrl("https://www.instagram.com/reel/abc/", "instagram"),
    "https://www.instagram.com/reel/abc/",
  );
  assert.ok(videoUrl("https://example.test/jewel.mp4", "external"));
});
await check("Destinos de campañas y parámetros de marca", () => {
  assert.throws(() =>
    validateResource("campanas", {
      title: "QA",
      subtitle: "",
      cta_text: "Ver",
      cta_url: "javascript:alert(1)",
      image_url: product.primary_image,
      image_alt: "QA",
      jewelry_tone: "gold",
      background_style: "black",
      image_fit: "contain",
      sort_order: 0,
      is_active: false,
    }),
  );
  assert.throws(() => validateSettings("experiencia", { hero_interval: 2 }));
});
const db = new PGlite();
try {
  await db.exec(
    `CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text);INSERT INTO auth.users VALUES('${admin}'),('${customer}');INSERT INTO profiles VALUES('${admin}','admin'),('${customer}','customer');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin')$$;CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.updated_at=now();RETURN NEW;END;$$;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text);GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`,
  );
  const base = await readFile(
    new URL("../src/sql/killaq_schema.sql", import.meta.url),
    "utf8",
  );
  const catalog = base
    .slice(
      base.indexOf("CREATE TABLE public.categories"),
      base.indexOf("-- 8. CARRITO"),
    )
    .replaceAll("uuid_generate_v4()", "gen_random_uuid()");
  await db.exec(
    catalog.slice(
      0,
      catalog.lastIndexOf(
        "-- =============================================================",
      ),
    ),
  );
  const policies = base.slice(
    base.indexOf("ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY"),
    base.indexOf("ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY"),
  );
  await db.exec(policies);
  for (const name of [
    "001_restore_media.sql",
    "004_brand_and_storefront.sql",
    "005_categories_and_exclusive_showcase.sql",
    "007_admin_operations.sql",
    "007_admin_operations.sql",
  ])
    await db.exec(
      await readFile(new URL("../src/sql/" + name, import.meta.url), "utf8"),
    );
  await db.exec(
    "GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon,authenticated;GRANT INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;",
  );
  async function role(name, id) {
    await db.exec(`RESET ROLE;SET ROLE ${name};`);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      id || "",
    ]);
  }
  const save = (id, data, expected = null) =>
    db.query(
      "SELECT public.admin_save_product($1::uuid,$2::jsonb,$3::timestamptz) AS id",
      [id, data, expected],
    );
  await check("007 idempotente y sin productos sintéticos", async () =>
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM products")).rows[0].n,
      0,
    ),
  );
  await check("RPC bloqueado para anon y cliente", async () => {
    await role("anon");
    await assert.rejects(() => save(null, validateProduct(product)));
    await role("authenticated", customer);
    await assert.rejects(() => save(null, validateProduct(product)));
    await assert.rejects(() =>
      db.query(
        "INSERT INTO products(name,slug,price) VALUES('QA','no-permitido',1)",
      ),
    );
  });
  await role("authenticated", admin);
  await check("Producto, imagen y publicación atómicos", async () => {
    const id = (await save(null, validateProduct(product))).rows[0].id;
    assert.ok(id);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM product_images WHERE product_id=$1",
          [id],
        )
      ).rows[0].n,
      1,
    );
  });
  const original = (
    await db.query(
      "SELECT id,updated_at::text AS expected FROM products LIMIT 1",
    )
  ).rows[0];
  await check("Edición concurrente rechazada sin sobrescribir", async () => {
    await save(
      original.id,
      validateProduct({ ...product, stock: 5 }),
      original.expected,
    );
    await assert.rejects(() =>
      save(
        original.id,
        validateProduct({ ...product, stock: 8 }),
        original.expected,
      ),
    );
    assert.equal(
      (await db.query("SELECT stock FROM products WHERE id=$1", [original.id]))
        .rows[0].stock,
      5,
    );
  });
  await check("Subcategoría incorrecta rechazada en SQL", async () => {
    await assert.rejects(() =>
      save(
        null,
        validateProduct({
          ...product,
          slug: "subcategoria-qa",
          category_id: 2,
        }),
      ),
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM products WHERE slug='subcategoria-qa'",
        )
      ).rows[0].n,
      0,
    );
  });
  await db.exec(
    "RESET ROLE;CREATE FUNCTION qa_image_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.url='https://example.test/failure.png' THEN RAISE EXCEPTION 'QA_IMAGE_FAILURE';END IF;RETURN NEW;END;$$;CREATE TRIGGER qa_fail_image BEFORE INSERT ON product_images FOR EACH ROW EXECUTE FUNCTION qa_image_failure();",
  );
  await role("authenticated", admin);
  await check(
    "Fallo de multimedia revierte publicación y producto",
    async () => {
      await assert.rejects(() =>
        save(
          null,
          validateProduct({
            ...product,
            slug: "fallo-qa",
            primary_image: "https://example.test/failure.png",
          }),
        ),
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM products WHERE slug='fallo-qa'",
          )
        ).rows[0].n,
        0,
      );
    },
  );
  const settings = (
    await db.query(
      "SELECT value,updated_at::text AS expected FROM site_settings WHERE key='storefront'",
    )
  ).rows[0];
  const patch = {
    welcome_enabled: false,
    artisan_enabled: true,
    hero_autoplay: false,
    hero_interval: 12,
    personalized_title: "Título ficticio QA",
    personalized_description: "Descripción ficticia QA",
    whatsapp_number: "51999999999",
  };
  await check(
    "Configuración fusiona solo su sección y evita conflictos",
    async () => {
      await db.query(
        "SELECT admin_merge_storefront($1,$2::jsonb,$3::timestamptz)",
        ["experiencia", patch, settings.expected],
      );
      const row = (
        await db.query("SELECT value FROM site_settings WHERE key='storefront'")
      ).rows[0];
      assert.equal(row.value.catalog_version, 5);
      assert.equal(row.value.hero_interval, 12);
      await assert.rejects(() =>
        db.query(
          "SELECT admin_merge_storefront($1,$2::jsonb,$3::timestamptz)",
          ["experiencia", patch, settings.expected],
        ),
      );
    },
  );
  await check("Exclusiva inválida no activa bloque", async () => {
    const expected = (
      await db.query(
        "SELECT updated_at::text AS expected FROM site_settings WHERE key='storefront'",
      )
    ).rows[0].expected;
    await assert.rejects(() =>
      db.query("SELECT admin_merge_storefront($1,$2::jsonb,$3::timestamptz)", [
        "exclusivo",
        {
          exclusive_enabled: true,
          exclusive_product_id: original.id,
          exclusive_title: "QA",
          exclusive_description: "QA",
        },
        expected,
      ]),
    );
  });
  await check("Orden accesible persiste y rechaza lista obsoleta", async () => {
    const ids = (
      await db.query("SELECT id FROM hero_slides ORDER BY sort_order,id")
    ).rows.map((r) => r.id);
    const reversed = [...ids].reverse();
    await db.query(
      "SELECT admin_reorder_campaigns($1::integer[],$2::integer[])",
      [reversed, ids],
    );
    assert.deepEqual(
      (
        await db.query("SELECT id FROM hero_slides ORDER BY sort_order,id")
      ).rows.map((r) => r.id),
      reversed,
    );
    await assert.rejects(() =>
      db.query("SELECT admin_reorder_campaigns($1::integer[],$2::integer[])", [
        ids,
        ids,
      ]),
    );
  });
} finally {
  await db.close();
}
const f = await fixture();
try {
  process.env.NEXT_PUBLIC_SUPABASE_URL = f.origin;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "isolated-anon";
  let code = ts
    .transpileModule(
      await readFile(
        new URL("../src/lib/admin/server.ts", import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      },
    )
    .outputText.replace(/import ['"]server-only['"];?\s*/g, "")
    .replace(/from ['"]\.\/validation['"]/g, 'from "./validation.mjs"')
    .replace(/from ['"]\.\.\/complaints\/core['"]/g, 'from "./core.mjs"');
  await writeFile(new URL("server.mjs", output), code);
  await writeFile(
    new URL("core.mjs", output),
    ts.transpileModule(
      await readFile(
        new URL("../src/lib/complaints/core.ts", import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
  );
  const { authorizeAdmin } = await import(new URL("server.mjs", output));
  const req = (token) =>
    new Request("http://localhost/api/admin/settings", {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
  await check("Servidor verifica sesión y rol, no solo interfaz", async () => {
    for (const token of [undefined, "expired-token", "customer-token"])
      await assert.rejects(() => authorizeAdmin(req(token)));
    assert.equal((await authorizeAdmin(req("admin-token"))).user.id, admin);
  });
} finally {
  await f.close();
}
await writeFile(
  new URL("results.json", output),
  JSON.stringify(results, null, 2),
);
console.log(
  `${results.length} pruebas de validación, autorización, RLS y SQL atómico superadas. Base PGlite aislada; sin escrituras remotas.`,
);

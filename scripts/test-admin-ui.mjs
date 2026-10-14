import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const origin = "http://localhost:3001",
  fixture = "http://127.0.0.1:3100";
const output = "artifacts/admin-2/after";
await mkdir(output, { recursive: true });
const quick = process.argv[2] === "interactions";
const previous = quick
  ? JSON.parse(await readFile(output + "/partial-results.json", "utf8"))
  : { views: [], public: [] };
const browser = await chromium.launch();
const results = [
    ...new Map(
      previous.views.map((item) => [item.name + ":" + item.width, item]),
    ).values(),
  ],
  comparisons = previous.public;
async function context(width) {
  const c = await browser.newContext({
    viewport: { width, height: 960 },
    reducedMotion: "reduce",
  });
  await c.addInitScript(() =>
    sessionStorage.setItem("killaq-welcome-v3", "seen"),
  );
  return c;
}
async function go(page, route) {
  await page.goto(origin + route, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}
async function login(page) {
  await go(page, "/login");
  await page.getByLabel("Correo electrónico").fill("admin@killaq.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("local-test-password");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.waitForTimeout(500);
}
async function audit(page, name, width) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  await page.screenshot({
    path: `${output}/${name}-${width}.png`,
    fullPage: true,
    animations: "disabled",
  });
  const old = results.findIndex(
    (item) => item.name === name && item.width === width,
  );
  if (old >= 0) results.splice(old, 1);
  results.push({
    name,
    width,
    violations: axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  });
  expect(results.at(-1).violations).toEqual([]);
}
try {
  await fetch(fixture + "/__reset", { method: "POST" });
  for (const width of quick ? [] : [393, 1440, 1920]) {
    const c = await context(width),
      p = await c.newPage();
    for (const route of ["/", "/colecciones", "/atencion-personalizada"]) {
      await go(p, route);
      const name = `public-${route.replaceAll("/", "") || "home"}-${width}.png`;
      await p.screenshot({
        path: output + "/" + name,
        fullPage: true,
        animations: "disabled",
      });
      const a = await sharp("artifacts/admin-2/before/" + name)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true }),
        b = await sharp(output + "/" + name)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
      const dimensions =
        a.info.width === b.info.width && a.info.height === b.info.height;
      let changed = 0;
      if (dimensions)
        for (let i = 0; i < a.data.length; i += 4)
          if (
            a.data[i] !== b.data[i] ||
            a.data[i + 1] !== b.data[i + 1] ||
            a.data[i + 2] !== b.data[i + 2] ||
            a.data[i + 3] !== b.data[i + 3]
          )
            changed++;
      comparisons.push({
        name,
        sameSize: dimensions,
        changedPixels: dimensions ? changed : null,
      });
    }
    await c.close();
  }
  await writeFile(
    `${output}/public-comparison.json`,
    JSON.stringify(comparisons, null, 2),
  );
  await fetch(fixture + "/__seed-campaigns", { method: "POST" });
  const routes = [
    "/admin",
    "/admin/productos",
    "/admin/colecciones",
    "/admin/carrusel",
    "/admin/videos",
    "/admin/experiencia",
    "/admin/exclusivos",
    "/admin/reclamaciones",
    "/admin/configuracion/negocio",
    "/admin/configuracion/legal",
    "/admin/configuracion/operativa",
  ];
  for (const width of quick
    ? []
    : [320, 360, 393, 430, 768, 820, 1024, 1440, 1920]) {
    const c = await context(width),
      p = await c.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await login(p);
    for (const route of routes) {
      await go(p, route);
      await audit(
        p,
        route.replace("/admin", "admin").replaceAll("/", "-"),
        width,
      );
      expect(errors).toEqual([]);
    }
    await go(p, "/admin/productos");
    await p
      .getByRole("button", { name: "Añadir producto", exact: true })
      .click();
    await audit(p, "product-editor", width);
    await p.getByRole("button", { name: "Volver al catálogo" }).click();
    await go(p, "/admin/carrusel");
    await p
      .getByRole("button", { name: "Editar", exact: true })
      .first()
      .click();
    await audit(p, "campaign-editor", width);
    await c.close();
  }
  const c = await context(393),
    p = await c.newPage();
  await login(p);
  await go(p, "/admin");
  await p.getByLabel("Abrir menú de administración").click();
  await expect(p.getByRole("dialog")).toBeVisible();
  await audit(p, "drawer", 393);
  await p.keyboard.press("Escape");
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await expect(p.getByLabel("Abrir menú de administración")).toBeFocused();
  await go(p, "/admin/productos");
  await p.getByRole("button", { name: "Añadir producto", exact: true }).click();
  await p.getByLabel("Nombre de la pieza").fill("Joya ficticia UI");
  await p.getByLabel("Precio (S/)", { exact: true }).fill("150");
  await p.getByLabel("Unidades disponibles").fill("2");
  await p.getByRole("button", { name: "Guardar producto" }).click();
  await expect(
    p.getByText("Pieza y archivos guardados correctamente."),
  ).toBeVisible();
  await expect(p.getByText("Joya ficticia UI", { exact: true })).toBeVisible();
  await p.getByRole("button", { name: "Añadir producto", exact: true }).click();
  await p.getByLabel("Nombre de la pieza").fill("Cambio sin guardar");
  p.once("dialog", (d) => d.dismiss());
  await p.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(p.getByLabel("Nombre de la pieza")).toHaveValue(
    "Cambio sin guardar",
  );
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "Cancelar", exact: true }).click();
  await p.getByLabel("Buscar por nombre").fill("Joya ficticia UI");
  await p.getByLabel("Buscar productos", { exact: true }).click();
  await expect(
    p.getByText("Pieza de prueba local", { exact: true }),
  ).toHaveCount(0);
  await expect(p.getByText("Joya ficticia UI", { exact: true })).toBeVisible();
  await go(p, "/admin/videos");
  await p
    .getByRole("button", { name: "Añadir video", exact: true })
    .first()
    .click();
  await p.getByLabel("Título", { exact: true }).fill("Video ficticio QA");
  await p
    .getByLabel("URL del video")
    .fill("https://instagram.com.evil.test/reel/unsafe");
  await p.getByRole("button", { name: "Guardar video" }).click();
  await expect(
    p.getByText("El enlace no corresponde al proveedor elegido."),
  ).toBeVisible();
  await expect(p.locator("iframe")).toHaveCount(0);
  await p
    .getByLabel("URL del video")
    .fill("https://www.instagram.com/reel/qa/");
  await p.getByRole("button", { name: "Previsualizar video" }).click();
  await expect(p.locator("iframe")).toHaveCount(0);
  await p.getByRole("button", { name: "Guardar video" }).click();
  await expect(p.getByText("Cambios guardados correctamente.")).toBeVisible();
  await go(p, "/admin/carrusel");
  await p.getByLabel("Bajar campaña Campaña QA uno").click();
  await expect(p.getByText("Orden de campañas guardado.")).toBeVisible();
  await go(p, "/admin/carrusel");
  await expect(p.locator("article h2").first()).toHaveText("Campaña QA dos");
  await go(p, "/admin/experiencia");
  await p.getByLabel("Intervalo de rotación (segundos)").fill("13");
  await p.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(
    p.getByText("Configuración guardada. La tienda utilizará estos cambios."),
  ).toBeVisible();
  await go(p, "/admin/experiencia");
  await expect(p.getByLabel("Intervalo de rotación (segundos)")).toHaveValue(
    "13",
  );
  await fetch(fixture + "/__fail", {
    method: "POST",
    body: JSON.stringify({ table: "products" }),
  });
  await go(p, "/admin");
  await expect(
    p.getByText("No disponible; revisa Supabase y las migraciones.").first(),
  ).toBeVisible();
  await expect(p.getByText("S/ 0.00", { exact: true })).toHaveCount(0);
  await fetch(fixture + "/__fail", { method: "POST", body: "{}" });
  await c.close();
  const guest = await context(393),
    g = await guest.newPage();
  await go(g, "/admin/productos");
  await expect(g).toHaveURL(/\/login/);
  await expect(
    g.getByRole("navigation", { name: "Administración" }),
  ).toHaveCount(0);
  await guest.close();
  for (const route of [
    "/api/admin/dashboard",
    "/api/admin/configuracion",
    "/api/admin/settings",
    "/api/admin/catalogo/productos",
  ]) {
    expect((await fetch(origin + route)).status).toBe(401);
    expect(
      (
        await fetch(origin + route, {
          headers: { Authorization: "Bearer customer-token" },
        })
      ).status,
    ).toBe(403);
  }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      { views: results, public: comparisons, interactions: "passed" },
      null,
      2,
    ),
  );
  console.log(
    `${results.length} admin views: no overflow or axe violations. CRUD, drawer, dirty guard, failures and authorization passed. Public comparison saved.`,
  );
} finally {
  await browser.close();
  await fetch(fixture + "/__reset", { method: "POST" });
  await writeFile(
    `${output}/partial-results.json`,
    JSON.stringify({ views: results, public: comparisons }, null, 2),
  );
}

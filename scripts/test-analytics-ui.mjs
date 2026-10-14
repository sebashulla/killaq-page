// Requires .vercel/ui-preview on 3001 and scripts/admin-ui-fixture.mjs on 3100.
// Provider capture/query is intercepted only in these browser contexts. No production writes.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch(),
  output = "artifacts/analytics/after",
  results = { views: [], public: [], checks: [] };
await mkdir(output, { recursive: true });
const origin = "http://localhost:3001",
  main = "http://localhost:3000",
  fixture = "http://127.0.0.1:3100",
  pid = "00000000-0000-0000-0000-000000000011";
const tabs = [
  "Resumen",
  "Productos",
  "Recorrido",
  "Canales y dispositivos",
  "Búsquedas",
  "Medición y privacidad",
];
const shift = (day, n) =>
  new Date(Date.parse(day + "T05:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
function report(url, empty = false) {
  const params = new URL(url).searchParams,
    days = Number(params.get("days") || 30),
    to = params.get("to") || shift(today, -1),
    from = params.get("from") || shift(to, 1 - days),
    number = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const total = {
    visitors: 10,
    sessions: 12,
    views: 8,
    selections: 8,
    adds: 3,
    inquiries: 2,
    impressions: 16,
    events: 60,
    viewSessions: 7,
    addViewSessions: 3,
    inquiryViewSessions: 2,
  };
  const segment = {
    detail: "",
    events: 39,
    selections: 8,
    views: 8,
    adds: 3,
    inquiries: 2,
    sessions: 12,
    viewSessions: 7,
    inquiryViewSessions: 2,
  };
  return {
    period: {
      from,
      to,
      start: from + "T05:00:00Z",
      end: shift(to, 1) + "T05:00:00Z",
      previousStart: shift(from, -number) + "T05:00:00Z",
      previousEnd: from + "T05:00:00Z",
      days: number,
      device: params.get("device") || "all",
    },
    state: empty ? "unconfigured" : "ready",
    issues: empty
      ? ["Prueba local: proveedor sin credenciales; captura desactivada."]
      : [
          "Datos ficticios aislados para verificar la interfaz; captura real desactivada.",
        ],
    generatedAt: new Date().toISOString(),
    cacheSeconds: 60,
    measurementStart: empty ? null : "2026-01-01",
    comparable: !empty,
    captureEnabled: false,
    current: empty ? null : total,
    previous: empty
      ? null
      : {
          ...total,
          visitors: 8,
          sessions: 9,
          views: 6,
          selections: 6,
          adds: 2,
          inquiries: 1,
          impressions: 10,
          events: 48,
          viewSessions: 5,
          addViewSessions: 2,
          inquiryViewSessions: 1,
        },
    daily: empty
      ? []
      : Array.from({ length: number }, (_, i) => ({
          date: shift(from, i),
          views: i === number - 1 ? 8 : 0,
          inquiries: i === number - 1 ? 2 : 0,
        })),
    products: empty
      ? []
      : [
          {
            id: pid,
            name: "Pieza de prueba local",
            image: "/images/categories/anillos-v1.webp",
            category: "anillos",
            views: 8,
            selections: 8,
            adds: 3,
            inquiries: 2,
            impressions: 16,
            viewSessions: 7,
            addViewSessions: 3,
            inquiryViewSessions: 2,
          },
        ],
    categories: empty ? [] : [{ ...segment, key: "anillos" }],
    campaigns: empty
      ? []
      : [{ ...segment, key: "reference:ring", events: 2, selections: 2 }],
    ctas: empty
      ? []
      : [
          {
            ...segment,
            key: "cart",
            events: 5,
            selections: 0,
            views: 0,
            viewSessions: 0,
            inquiryViewSessions: 0,
          },
        ],
    traffic: empty
      ? []
      : [
          {
            ...segment,
            key: "instagram",
            detail: "social · joyas",
            events: 60,
          },
        ],
    devices: empty
      ? []
      : [
          {
            ...segment,
            key: "mobile",
            events: 42,
            views: 6,
            selections: 6,
            adds: 2,
            inquiries: 1,
            viewSessions: 5,
            inquiryViewSessions: 1,
          },
          {
            ...segment,
            key: "desktop",
            events: 18,
            views: 2,
            selections: 2,
            adds: 1,
            inquiries: 1,
            sessions: 4,
            viewSessions: 2,
            inquiryViewSessions: 1,
          },
        ],
    searches: empty
      ? []
      : [
          { term: "anillos oro", events: 5, noResults: 1, sessions: 5 },
          { term: "termino-omitido", events: 5, noResults: 3, sessions: 5 },
        ],
    funnel: { steps: empty ? [] : [12, 8, 7, 3, 2], error: null },
    truncated: false,
    clarityUrl: null,
  };
}
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
async function go(page, path) {
  await page.goto(origin + path, { waitUntil: "networkidle" });
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
  await page.waitForURL("**/admin");
}
async function audit(page, name, width) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
  const violations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }));
  await page.screenshot({
    path: `${output}/${name}-${width}.png`,
    fullPage: true,
    animations: "disabled",
  });
  results.views.push({ name, width, violations });
  expect(violations).toEqual([]);
}
try {
  await fetch(fixture + "/__reset", { method: "POST" });
  for (const width of [320, 360, 393, 430, 768, 820, 1024, 1440, 1920]) {
    const c = await context(width),
      p = await c.newPage();
    let empty = false;
    await p.route("**/api/admin/estadisticas?*", (route) =>
      route.fulfill({
        status: 200,
        json: report(route.request().url(), empty),
      }),
    );
    await login(p);
    await go(p, "/admin/estadisticas");
    await expect(
      p.getByRole("button", { name: "Aplicar filtros" }),
    ).toBeEnabled();
    for (const tab of tabs) {
      await p.getByRole("button", { name: tab, exact: true }).click();
      await audit(
        p,
        "statistics-" + tab.toLowerCase().replaceAll(" ", "-"),
        width,
      );
    }
    empty = true;
    await p.getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(
      p.getByText("La medición aún necesita configuración."),
    ).toBeVisible();
    await p.getByRole("button", { name: "Resumen", exact: true }).click();
    await audit(p, "statistics-unconfigured", width);
    await c.close();
  }
  results.checks.push(
    "63 estadísticas/estados en nueve anchos sin overflow ni hallazgos axe.",
  );
  // Controls, rankings and honest sales availability.
  {
    const c = await context(1440),
      p = await c.newPage();
    const requests = [];
    await p.route("**/api/admin/estadisticas?*", (route) => {
      requests.push(route.request().url());
      return route.fulfill({ json: report(route.request().url()) });
    });
    await login(p);
    await go(p, "/admin/estadisticas");
    await p.getByLabel("Periodo").selectOption("7");
    await p.getByLabel("Dispositivo").selectOption("mobile");
    await p.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect.poll(() => requests.at(-1)).toContain("days=7");
    expect(requests.at(-1)).toContain("device=mobile");
    await p.getByLabel("Periodo").selectOption("custom");
    await p.getByLabel("Desde", { exact: true }).fill(shift(today, -12));
    await p.getByLabel("Hasta", { exact: true }).fill(shift(today, -2));
    await p.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect.poll(() => requests.at(-1)).toContain("from=");
    await p.getByRole("button", { name: "Productos", exact: true }).click();
    await p.getByLabel("Ranking").selectOption("interest");
    await expect(
      p.getByText("Pieza de prueba local", { exact: true }),
    ).toBeVisible();
    await p.getByLabel("Buscar pieza").fill("no existe");
    await expect(
      p.getByText("Sin piezas medidas en esta selección"),
    ).toBeVisible();
    await p.getByLabel("Ranking").selectOption("sales");
    await expect(
      p.getByText("El ranking de ventas aún no está disponible"),
    ).toBeVisible();
    await c.close();
    results.checks.push(
      "Filtros 7 días/dispositivo/rango, búsqueda, ranking de interés y ventas sin fuente.",
    );
  }
  // Consenting human browser simulation. Outgoing WhatsApp navigation is blocked.
  {
    const c = await context(393);
    await c.addInitScript(() =>
      Object.defineProperty(navigator, "webdriver", { get: () => false }),
    );
    let decision = "unset";
    const events = [],
      thirdParty = [];
    await c.route("https://wa.me/**", (route) => route.abort());
    await c.route("**/api/analytics/preferences", async (route) => {
      if (route.request().method() === "POST")
        decision = route.request().postDataJSON().decision;
      await route.fulfill({
        json: {
          enabled: true,
          decision,
          version: "qa-v1",
          campaigns: ["joyas"],
        },
      });
    });
    await c.route("**/api/analytics/events", async (route) => {
      expect(route.request().headers().referer).toBe(origin + "/");
      const payload = route.request().postDataJSON();
      events.push(...payload.events);
      await route.fulfill({ json: { accepted: payload.events.length } });
    });
    c.on("request", (req) => {
      if (/posthog|clarity/.test(req.url())) thirdParty.push(req.url());
    });
    const p = await c.newPage();
    await go(p, "/colecciones");
    await p.waitForTimeout(1200);
    expect(events).toHaveLength(0);
    await p
      .getByRole("button", { name: "Rechazar analítica", exact: true })
      .click();
    await p.waitForTimeout(350);
    expect(events).toHaveLength(0);
    await p
      .getByRole("button", { name: "Preferencias de privacidad", exact: true })
      .click();
    await expect(p.getByRole("dialog")).toBeVisible();
    await p
      .getByRole("button", { name: "Aceptar analítica", exact: true })
      .click();
    await expect(p.getByRole("dialog")).not.toBeVisible();
    await p.locator('article[class*="card"]').first().scrollIntoViewIfNeeded();
    await p.waitForTimeout(1400);
    expect(
      events.filter((e) => e.event.name === "view_item_list"),
    ).toHaveLength(1);
    expect(events.filter((e) => e.event.name === "page_view")).toHaveLength(1);
    await p
      .getByRole("link", { name: "Pieza de prueba local", exact: true })
      .first()
      .click();
    await p.waitForURL("**/producto/pieza-prueba");
    await p.waitForTimeout(400);
    expect(events.filter((e) => e.event.name === "select_item")).toHaveLength(
      1,
    );
    expect(events.filter((e) => e.event.name === "view_item")).toHaveLength(1);
    await p
      .getByRole("button", {
        name: "Ver imagen 2 de Pieza de prueba local",
        exact: true,
      })
      .click();
    await p
      .getByRole("button", {
        name: "Ver imagen 2 de Pieza de prueba local",
        exact: true,
      })
      .click();
    await p.getByRole("button", { name: "6", exact: true }).click();
    for (let i = 0; i < 3; i++)
      await p
        .getByRole("button", { name: "Añadir al carrito", exact: true })
        .click();
    await expect(
      p.getByRole("button", { name: "Stock disponible en tu carrito" }),
    ).toBeDisabled();
    await p.waitForTimeout(400);
    expect(events.filter((e) => e.event.name === "add_to_cart")).toHaveLength(
      3,
    );
    expect(
      events.filter((e) => e.event.name === "product_gallery_interaction"),
    ).toHaveLength(1);
    await p.getByRole("link", { name: /Ver mi carrito/ }).click();
    await p.waitForURL("**/carrito");
    await expect(
      p.getByRole("link", { name: "Coordinar por WhatsApp" }),
    ).toBeVisible();
    await p.getByRole("link", { name: "Coordinar por WhatsApp" }).click();
    await p.waitForTimeout(400);
    expect(events.filter((e) => e.event.name === "view_cart")).toHaveLength(1);
    expect(
      events.filter((e) => e.event.name === "whatsapp_contact_click"),
    ).toHaveLength(1);
    expect(
      events.filter((e) => e.event.name === "product_whatsapp_inquiry"),
    ).toHaveLength(1);
    expect(
      events.some((e) => ["purchase", "begin_checkout"].includes(e.event.name)),
    ).toBe(false);
    await p
      .getByRole("button", {
        name: "Reducir cantidad de Pieza de prueba local",
      })
      .click();
    await p.getByRole("button", { name: "Quitar", exact: true }).click();
    await p.waitForTimeout(400);
    expect(
      events
        .filter((e) => e.event.name === "remove_from_cart")
        .map((e) => e.event.quantity),
    ).toEqual([1, 2]);
    await go(
      p,
      "/colecciones?search=qa%40example.test%20%2B1%20202%20555%200100",
    );
    await p.waitForTimeout(450);
    expect(events.findLast((e) => e.event.name === "search").event.term).toBe(
      "termino-omitido",
    );
    expect(JSON.stringify(events)).not.toMatch(/qa@example|202 555 0100/);
    await go(p, "/colecciones?search=oro");
    await p.waitForTimeout(450);
    expect(events.findLast((e) => e.event.name === "search").event.term).toBe(
      "oro",
    );
    const second = await c.newPage();
    await go(second, "/atencion-personalizada");
    await second
      .getByLabel("Tu idea")
      .fill("Mensaje ficticio privado qa@example.test +1 202 555 0100");
    await second.getByRole("link", { name: "Conversar por WhatsApp" }).click();
    await second.waitForTimeout(400);
    expect(JSON.stringify(events)).not.toMatch(
      /Mensaje ficticio|qa@example|202 555 0100/,
    );
    expect(events.at(-1).event.name).toBe("whatsapp_contact_click");
    await p.getByRole("button", { name: "Preferencias de privacidad" }).click();
    await p.getByRole("button", { name: "Retirar autorización" }).click();
    const count = events.length;
    await second.getByRole("link", { name: "Conversar por WhatsApp" }).click();
    await second.waitForTimeout(450);
    expect(events.length).toBe(count);
    expect(thirdParty).toHaveLength(0);
    await writeFile(
      `${output}/captured-events.json`,
      JSON.stringify(events, null, 2),
    );
    await c.close();
    results.checks.push(
      "Consentimiento, impresión 50 %/1 s, clic, vista única, galería, stock, carrito, consulta por pieza, retirada, búsquedas y ausencia de PII/SDK externo.",
    );
  }
  // Default webdriver and administrator exclusion even if the fixture pretends tracking is configured.
  {
    const c = await context(1440),
      p = await c.newPage();
    let count = 0;
    await p.route("**/api/analytics/preferences", (r) =>
      r.fulfill({
        json: {
          enabled: true,
          decision: "granted",
          version: "qa-v1",
          campaigns: [],
        },
      }),
    );
    await p.route("**/api/analytics/events", (r) => {
      count++;
      return r.fulfill({ json: { accepted: 0 } });
    });
    await go(p, "/colecciones");
    await p.waitForTimeout(1300);
    expect(count).toBe(0);
    await c.close();
  }
  {
    const c = await context(1440);
    await c.addInitScript(() =>
      Object.defineProperty(navigator, "webdriver", { get: () => false }),
    );
    const p = await c.newPage();
    let count = 0;
    await p.route("**/api/analytics/preferences", (r) =>
      r.fulfill({
        json: {
          enabled: true,
          decision: "granted",
          version: "qa-v1",
          campaigns: [],
        },
      }),
    );
    await p.route("**/api/analytics/events", (r) => {
      count++;
      return r.fulfill({ json: { accepted: 0 } });
    });
    await login(p);
    await go(p, "/colecciones");
    await p.waitForTimeout(1300);
    expect(count).toBe(0);
    await go(p, "/libro-reclamaciones");
    await p.waitForTimeout(400);
    expect(count).toBe(0);
    await c.close();
    results.checks.push(
      "Bots de pruebas, administración y ruta de reclamaciones excluidos.",
    );
  }
  expect((await fetch(origin + "/api/admin/estadisticas")).status).toBe(401);
  expect(
    (
      await fetch(origin + "/api/admin/estadisticas", {
        headers: { Authorization: "Bearer customer-token" },
      })
    ).status,
  ).toBe(403);
  expect(
    (await fetch(origin + "/api/analytics/preferences").then((r) => r.json()))
      .enabled,
  ).toBe(false);
  // Public regressions against baseline captured before instrumentation. Current real capture is disabled.
  for (const width of [393, 1440, 1920]) {
    const c = await context(width),
      p = await c.newPage();
    for (const [name, path] of [
      ["home", "/"],
      ["catalog", "/colecciones"],
      ["personalized", "/atencion-personalizada"],
    ]) {
      await p.goto(main + path, { waitUntil: "networkidle" });
      await p.evaluate(() => document.fonts.ready);
      await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      const after = `${output}/public-${name}-${width}.png`;
      await p.screenshot({
        path: after,
        fullPage: true,
        animations: "disabled",
      });
      const before = `artifacts/analytics/before/${name}-${width}.png`;
      const a = await sharp(before).raw().toBuffer({ resolveWithObject: true }),
        b = await sharp(after).raw().toBuffer({ resolveWithObject: true });
      const sameSize =
        a.info.width === b.info.width && a.info.height === b.info.height;
      let changedPixels = 0;
      if (sameSize)
        for (let i = 0; i < a.data.length; i += a.info.channels) {
          if (
            a.data
              .subarray(i, i + a.info.channels)
              .compare(b.data.subarray(i, i + a.info.channels)) !== 0
          )
            changedPixels++;
        }
      else changedPixels = -1;
      results.public.push({ name, width, sameSize, changedPixels });
      expect(sameSize).toBe(true);
      expect(changedPixels).toBe(0);
    }
    await c.close();
  }
  results.checks.push(
    "401/403 reales y nueve comparaciones públicas sin diferencias.",
  );
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    `${results.views.length} views and all analytics UI/privacy/authorization/regression flows passed.`,
  );
} finally {
  await browser.close();
  await fetch(fixture + "/__reset", { method: "POST" });
  await writeFile(
    `${output}/partial-results.json`,
    JSON.stringify(results, null, 2),
  );
}

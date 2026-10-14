import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { compileModules, fixture, fakeConfig } from "./complaints-fixture.mjs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
const origin = process.argv[2] || "http://localhost:3001";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
  throw Error("UI tests only run on an isolated localhost preview.");
const output = new URL("../artifacts/legal-ui/", import.meta.url);
await mkdir(output, { recursive: true });
const compiled = await compileModules(),
  f = await fixture();
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: f.origin,
  SUPABASE_SECRET_KEY: "isolated-server-key",
  COMPLAINTS_HASH_SECRET: "isolated-test-secret-never-for-production",
  COMPLAINTS_TEAM_EMAIL: "team@example.invalid",
  COMPLAINTS_FROM_EMAIL: "test@example.invalid",
  RESEND_API_KEY: "isolated-mail-key",
  KILLAQ_LEGAL_CONFIG: JSON.stringify(fakeConfig),
});
const actualFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url === "https://api.resend.com/emails")
    return f.state.mailFailed
      ? Response.json({ error: "isolated failure" }, { status: 500 })
      : Response.json({ id: randomUUID() });
  if (!url.startsWith(f.origin))
    throw Error("Remote network prohibited in backend UI tests");
  return actualFetch(input, init);
};
const service = await import(new URL("server.mjs", compiled));
const browser = await chromium.launch();
const results = [];
async function context(width) {
  const c = await browser.newContext({
    viewport: { width, height: 950 },
    reducedMotion: "reduce",
  });
  await c.addInitScript(() => {
    sessionStorage.setItem("killaq-welcome-v3", "seen");
    window.print = () => {
      window.__printCalled = true;
    };
  });
  return c;
}
async function go(page, route) {
  await page.goto(origin + route, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}
try {
  for (const width of process.argv[3] === "interactions"
    ? []
    : [320, 390, 768, 1024, 1440]) {
    const c = await context(width),
      page = await c.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of [
      "/terminos-y-condiciones",
      "/cambios-y-devoluciones",
      "/politica-de-privacidad",
      "/libro-reclamaciones",
    ]) {
      await go(page, route);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      const violations = audit.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      }));
      await page.screenshot({
        path: fileURLToPath(new URL(`${route.slice(1)}-${width}.png`, output)),
        fullPage: true,
        animations: "disabled",
      });
      results.push({
        route,
        width,
        overflow: false,
        violations,
        errors: [...errors],
      });
      if (violations.length) throw Error(JSON.stringify(results.at(-1)));
      expect(errors).toEqual([]);
      const book = page.locator('footer a[href="/libro-reclamaciones"]').last();
      await expect(book).toBeVisible();
      if (width < 768) {
        await expect(
          page.getByRole("button", { name: "Información legal", exact: true }),
        ).toHaveAttribute("aria-expanded", "false");
        await book.focus();
        await expect(book).toBeFocused();
      }
      await page
        .locator('nav[aria-label="Índice del documento"] a')
        .first()
        .click();
      expect(new URL(page.url()).hash).not.toEqual("");
      console.log("PASS responsive/axe:", route, width);
    }
    await c.close();
  }
  const c = await context(390),
    page = await c.newPage();
  let submissions = 0;
  await page.route("**/api/reclamaciones", async (route) => {
    submissions++;
    try {
      const receipt = await service.submitComplaint(
        new Request("http://localhost/api/reclamaciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: route.request().postData(),
        }),
      );
      await route.fulfill({ status: 200, json: receipt });
    } catch (error) {
      const response = service.errorResponse(error);
      await route.fulfill({
        status: response.status,
        json: await response.json(),
      });
    }
  });
  await go(page, "/qa-book");
  const formAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(formAudit.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Registrar hoja de reclamación", exact: true })
    .click();
  expect(submissions).toBe(0);
  await expect(page.locator('input[name="full_name"]')).toBeFocused();
  await page
    .locator('input[name="full_name"]')
    .fill("Consumidor ficticio en navegador");
  await page.locator('input[name="document_number"]').fill("0000000");
  await page.locator('input[name="email"]').fill("qa@example.invalid");
  await page
    .getByLabel("Descripción de los hechos *", { exact: true })
    .fill("Caso ficticio de navegador, sin pedido real.");
  await page.getByLabel("Tipo de solicitud *").selectOption("queja");
  await page
    .getByRole("button", { name: "Registrar hoja de reclamación", exact: true })
    .click();
  await expect(page.locator('main [role="alert"]')).toContainText("documento");
  await page.locator('input[name="document_number"]').fill("00000000");
  f.state.failDatabase = true;
  await page
    .getByRole("button", { name: "Registrar hoja de reclamación", exact: true })
    .click();
  await expect(page.locator('main [role="alert"]')).toContainText(
    "No pudimos confirmar",
  );
  await expect(
    page.getByText("Hoja registrada:", { exact: false }),
  ).toHaveCount(0);
  f.state.failDatabase = false;
  f.state.mailFailed = true;
  await page
    .getByRole("button", { name: "Registrar hoja de reclamación", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hoja registrada:", exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("correo de constancia sigue pendiente", { exact: false }),
  ).toBeVisible();
  const record = (
    await f.db.query(
      "SELECT id,claim_type FROM complaints_book WHERE full_name='Consumidor ficticio en navegador'",
    )
  ).rows[0];
  expect(record.claim_type).toBe("queja");
  expect((await service.processOutbox(record.id)).failed).toBe(2);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar hoja", exact: true })
    .click();
  const download = await downloadPromise;
  const file = new URL("hoja-ficticia.html", output);
  await download.saveAs(fileURLToPath(file));
  const text = await readFile(file, "utf8");
  expect(text).toContain("Consumidor ficticio en navegador");
  expect(text).toContain("LIBRO DE RECLAMACIONES");
  const popupPromise = c.waitForEvent("page");
  await page
    .getByRole("button", { name: "Imprimir / guardar PDF", exact: true })
    .click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await expect
    .poll(() => popup.evaluate(() => window.__printCalled))
    .toBe(true);
  await popup.close();
  await page.screenshot({
    path: fileURLToPath(new URL("constancia-movil.png", output)),
    fullPage: true,
  });
  results.push({
    scenario:
      "Guest form: required fields, both errors, persisted queja, failed mail, download and print",
    passed: true,
  });
  await c.close();
  const a = await context(768),
    adminPage = await a.newPage();
  await go(adminPage, "/login");
  await adminPage.locator('input[type="email"]').fill("qa@example.invalid");
  await adminPage.locator('input[type="password"]').fill("isolated-password");
  await adminPage.locator('form button[type="submit"]').click();
  await adminPage.waitForURL("**/admin");
  await adminPage.route("**/api/admin/reclamaciones**", async (route) => {
    const url = new URL(route.request().url());
    const req = new Request("http://localhost" + url.pathname + url.search, {
      method: route.request().method(),
      headers: {
        Authorization: "Bearer admin-token",
        "Content-Type": "application/json",
      },
      ...(route.request().method() === "POST"
        ? { body: route.request().postData() }
        : {}),
    });
    try {
      const id = url.pathname.split("/").at(-1);
      const result = url.pathname.endsWith("/procesar")
        ? await service.processOutbox()
        : id === "reclamaciones"
          ? await service.listComplaints(req)
          : req.method === "POST"
            ? await service.recordAction(req, id)
            : await service.complaintDetail(req, id);
      await route.fulfill({ status: 200, json: result });
    } catch (error) {
      const response = service.errorResponse(error);
      await route.fulfill({
        status: response.status,
        json: await response.json(),
      });
    }
  });
  await go(adminPage, "/admin/reclamaciones");
  await adminPage
    .getByRole("button", { name: `Abrir ${record.id}`, exact: true })
    .click();
  await expect(
    adminPage.getByRole("heading", {
      name: "Información original · inmutable",
    }),
  ).toBeVisible();
  await adminPage
    .getByRole("button", { name: "Registrar actuación", exact: true })
    .click();
  await adminPage
    .getByLabel("Contenido de la actuación", { exact: true })
    .fill("Nota interna ficticia de navegador");
  await adminPage.locator("form button[type=submit]").click();
  await adminPage
    .getByRole("button", { name: "Línea de tiempo", exact: true })
    .click();
  await expect(
    adminPage.getByText("Nota interna ficticia de navegador", { exact: true }),
  ).toBeVisible();
  expect(
    await adminPage.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(768);
  await adminPage.screenshot({
    path: fileURLToPath(new URL("admin-tablet.png", output)),
    fullPage: true,
  });
  results.push({
    scenario:
      "Authorized admin lists, opens and appends an internal action in isolated fixture",
    passed: true,
  });
  await a.close();
  const k = await context(390),
    keyboardPage = await k.newPage();
  await go(keyboardPage, "/cambios-y-devoluciones");
  const legalToggle = keyboardPage.getByRole("button", {
    name: "Información legal",
    exact: true,
  });
  await legalToggle.focus();
  await keyboardPage.keyboard.press("Space");
  await expect(legalToggle).toHaveAttribute("aria-expanded", "true");
  await keyboardPage
    .getByRole("link", { name: "Términos y condiciones", exact: true })
    .last()
    .focus();
  await keyboardPage.keyboard.press("Enter");
  await keyboardPage.waitForURL("**/terminos-y-condiciones");
  const bookLink = keyboardPage
    .locator('footer a[href="/libro-reclamaciones"]')
    .last();
  await bookLink.focus();
  await keyboardPage.keyboard.press("Enter");
  await keyboardPage.waitForURL("**/libro-reclamaciones");
  results.push({
    scenario:
      "Footer groups, legal links and direct Book navigation by keyboard",
    passed: true,
  });
  let externalRequests = 0;
  await keyboardPage.route("https://www.instagram.com/**", (route) => {
    externalRequests++;
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: '<html lang="es"><title>Video ficticio</title><body>Video simulado, sin conexión externa</body></html>',
    });
  });
  await go(keyboardPage, "/qa-media");
  expect(await keyboardPage.locator("iframe").count()).toBe(0);
  expect(externalRequests).toBe(0);
  expect(
    await keyboardPage.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await keyboardPage
    .getByRole("button", { name: "Activar video externo", exact: true })
    .click();
  await expect(keyboardPage.locator("iframe")).toHaveCount(1);
  await expect.poll(() => externalRequests).toBe(1);
  await keyboardPage
    .getByRole("button", { name: "Cerrar video externo", exact: true })
    .click();
  await expect(keyboardPage.locator("iframe")).toHaveCount(0);
  results.push({
    scenario:
      "External media makes no connection until activation and can be closed",
    passed: true,
  });
  await k.close();
  console.log(
    "PASS: responsive routes, guest submission/download/print, admin, keyboard and opt-in external media",
  );
} finally {
  await writeFile(
    new URL("results.json", output),
    JSON.stringify(results, null, 2),
  );
  globalThis.fetch = actualFetch;
  await browser.close();
  await f.close();
}

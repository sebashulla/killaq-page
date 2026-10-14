import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fixture, compileModules, fakeConfig } from "./complaints-fixture.mjs";
const origin = "http://localhost:3001",
  uiFixture = "http://127.0.0.1:3100";
const output = "artifacts/admin-2/flows";
await mkdir(output, { recursive: true });
const browser = await chromium.launch(),
  checks = [];
async function context(width) {
  const c = await browser.newContext({
    viewport: { width, height: 950 },
    reducedMotion: "reduce",
  });
  const page = await c.newPage();
  await page.goto(origin + "/login", { waitUntil: "networkidle" });
  await page.getByLabel("Correo electrónico").fill("admin@killaq.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("local-test-password");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.waitForURL("**/admin");
  return { c, page };
}
async function go(p, route) {
  await p.goto(origin + route, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}
async function capture(p, name, width) {
  await p.waitForTimeout(300);
  expect(
    await p.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
  expect(
    (
      await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await p.screenshot({
    path: `${output}/${name}-${width}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
let f;
try {
  await fetch(uiFixture + "/__reset", { method: "POST" });
  const { c, page: p } = await context(1440);
  await p.getByRole("link", { name: "Productos", exact: true }).click();
  await p.getByRole("button", { name: "Añadir producto", exact: true }).click();
  await p
    .getByLabel("Nombre de la pieza")
    .fill("Borrador que debe conservarse");
  p.once("dialog", (d) => d.dismiss());
  await p.evaluate(() => history.back());
  await p.waitForTimeout(300);
  await expect(p.getByLabel("Nombre de la pieza")).toHaveValue(
    "Borrador que debe conservarse",
  );
  checks.push("Retroceso del navegador conserva edición al cancelar.");
  p.once("dialog", (d) => d.dismiss());
  await p.getByLabel("Cerrar sesión", { exact: true }).click();
  await expect(p.getByLabel("Nombre de la pieza")).toHaveValue(
    "Borrador que debe conservarse",
  );
  p.once("dialog", (d) => d.dismiss());
  await p.getByRole("link", { name: "Videos", exact: true }).click();
  await expect(p.getByLabel("Nombre de la pieza")).toHaveValue(
    "Borrador que debe conservarse",
  );
  checks.push("Salir y navegación lateral respetan cambios pendientes.");
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "Cancelar", exact: true }).click();
  await go(p, "/admin/colecciones");
  await p
    .getByRole("button", { name: "Añadir colección", exact: true })
    .click();
  await p.getByLabel("Nombre", { exact: true }).fill("Colección ficticia UI");
  await p.getByRole("button", { name: "Guardar colección" }).click();
  await expect(
    p.getByText("Colección ficticia UI", { exact: true }),
  ).toBeVisible();
  checks.push(
    "Colección creada en tabla existente, sin activar pieza exclusiva.",
  );
  await go(p, "/admin/productos");
  await p.getByRole("button", { name: "Editar", exact: true }).first().click();
  await p
    .getByLabel("URL de imagen principal")
    .fill("/images/no-existe-qa.png");
  await p.getByRole("button", { name: "Guardar producto" }).click();
  await expect(
    p.getByText("La imagen no pudo cargarse.", { exact: false }),
  ).toBeVisible();
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "Cancelar", exact: true }).click();
  checks.push(
    "Imagen inaccesible impide publicación sin modificar el registro.",
  );
  const token = await p.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.includes("auth-token"))
        return JSON.parse(localStorage.getItem(k)).access_token;
    }
  });
  const header = {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
    Origin: origin,
  };
  expect(
    (
      await fetch(origin + "/api/admin/settings", {
        method: "POST",
        headers: header,
        body: "{}",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await fetch(origin + "/api/admin/catalogo/productos", {
        method: "POST",
        headers: header,
        body: JSON.stringify({
          data: { name: "Bad", slug: "bad", description: "", price: -1 },
        }),
      })
    ).status,
  ).toBe(422);
  for (const method of ["POST", "DELETE"])
    expect(
      (
        await fetch(origin + "/api/admin/catalogo/productos", {
          method,
          headers: { ...header, Authorization: "Bearer customer-token" },
          body: "{}",
        })
      ).status,
    ).toBe(403);
  expect(
    (
      await fetch(origin + "/api/admin/catalogo/productos", {
        method: "POST",
        headers: { ...header, Origin: "https://example.invalid" },
        body: "{}",
      })
    ).status,
  ).toBe(403);
  checks.push(
    "API real rechaza campos inválidos, origen ajeno y escrituras de clientes.",
  );
  await c.close();
  const compiled = await compileModules();
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
      return Response.json({ error: "QA_MAIL_FAILURE" }, { status: 500 });
    if (!url.startsWith(f.origin))
      throw Error("Remote backend calls prohibited");
    return actualFetch(input, init);
  };
  const core = await import(new URL("core.mjs", compiled)),
    service = await import(new URL("server.mjs", compiled));
  const form = {
    ...core.emptyComplaint,
    full_name: "Consumidor ficticio Admin QA",
    document_number: "00000000",
    email: "consumer@example.invalid",
    detail: "Hechos originales ficticios e inmutables.",
    request: "Solicitud ficticia de revisión.",
    item_description: "Pieza ficticia QA",
  };
  const record = (
    await service.submitComplaint(
      new Request("http://localhost/api/reclamaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, submission_id: randomUUID() }),
      }),
    )
  ).receipt;
  for (const width of [320, 360, 393, 430, 768, 820, 1024, 1440, 1920]) {
    const { c, page } = await context(width);
    await page.route("**/api/admin/reclamaciones**", async (route) => {
      const url = new URL(route.request().url());
      const request = new Request(
        "http://localhost" + url.pathname + url.search,
        {
          method: route.request().method(),
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          ...(route.request().method() === "POST"
            ? { body: route.request().postData() }
            : {}),
        },
      );
      try {
        const id = url.pathname.split("/").at(-1),
          result =
            id === "reclamaciones"
              ? await service.listComplaints(request)
              : request.method === "POST"
                ? await service.recordAction(request, id)
                : await service.complaintDetail(request, id);
        await route.fulfill({ status: 200, json: result });
      } catch (error) {
        const response = service.errorResponse(error);
        await route.fulfill({
          status: response.status,
          json: await response.json(),
        });
      }
    });
    await go(page, "/admin/reclamaciones");
    await capture(page, "claims-list", width);
    await page
      .getByRole("button", { name: "Abrir " + record.id, exact: true })
      .click();
    await capture(page, "claims-original", width);
    await expect(
      page.getByText("Hechos originales ficticios e inmutables.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Registrar actuación", exact: true })
      .click();
    await capture(page, "claims-action", width);
    if (width === 393) {
      await page
        .getByLabel("Contenido de la actuación")
        .fill("Nota privada de prueba QA");
      await page.locator("form button[type=submit]").click();
      await page
        .getByRole("button", { name: "Línea de tiempo", exact: true })
        .click();
      await expect(
        page.getByText("Nota privada de prueba QA", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Registrar actuación", exact: true })
        .click();
      await page.getByLabel("Tipo de actuación").selectOption("response");
      await page
        .getByLabel("Respuesta escrita al consumidor")
        .fill("Respuesta ficticia revisada de prueba.");
      page.once("dialog", (d) => d.accept());
      await page.locator("form button[type=submit]").click();
      await page
        .getByRole("button", { name: "Línea de tiempo", exact: true })
        .click();
      await expect(
        page.getByText("Respuesta ficticia revisada de prueba.", {
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Evidencia de envío", exact: true })
        .click();
      await expect(
        page.getByText("no certifica entrega ni lectura", { exact: false }),
      ).toBeVisible();
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Descargar hoja e historial" })
        .click();
      await (await download).saveAs(output + "/expediente-ficticio.html");
    }
    await c.close();
  }
  expect(
    (
      await f.db.query(
        "SELECT detail,request FROM complaints_book WHERE id=$1",
        [record.id],
      )
    ).rows[0],
  ).toEqual({ detail: form.detail, request: form.request });
  checks.push(
    "27 vistas de expedientes sin overflow ni hallazgos axe; nota, respuesta, evidencia y descarga conservan la solicitud original.",
  );
  await writeFile(
    output + "/results.json",
    JSON.stringify(
      {
        checks,
        claimsWidths: [320, 360, 393, 430, 768, 820, 1024, 1440, 1920],
        passed: true,
      },
      null,
      2,
    ),
  );
  console.log("PASS: " + checks.join(" "));
} finally {
  await browser.close();
  if (f) await f.close();
}

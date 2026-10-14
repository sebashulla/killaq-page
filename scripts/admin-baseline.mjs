import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const dir = "artifacts/admin-2/before";
await mkdir(dir, { recursive: true });
const results = [];
for (const width of [393, 1440, 1920]) {
  const context = await browser.newContext({
    viewport: { width, height: 960 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() =>
    sessionStorage.setItem("killaq-welcome-v3", "seen"),
  );
  const page = await context.newPage();
  for (const route of ["/", "/colecciones", "/atencion-personalizada"]) {
    await page.goto("http://localhost:3001" + route, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: "nextjs-portal{display:none!important}",
    });
    await page.screenshot({
      path: `${dir}/public-${route.replaceAll("/", "") || "home"}-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.goto("http://localhost:3001/login", { waitUntil: "networkidle" });
  await page.getByLabel("Correo electrónico").fill("admin@killaq.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("local-test-password");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.waitForTimeout(800);
  for (const route of [
    "/admin",
    "/admin/productos",
    "/admin/carrusel",
    "/admin/videos",
    "/admin/experiencia",
    "/admin/exclusivos",
    "/admin/reclamaciones",
  ]) {
    await page.goto("http://localhost:3001" + route, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: "nextjs-portal{display:none!important}",
    });
    await page.screenshot({
      path: `${dir}/${route.split("/").at(-1)}-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    results.push({
      route,
      width,
      scrollWidth: await page.evaluate(
        () => document.documentElement.scrollWidth,
      ),
    });
  }
  await context.close();
}
await writeFile(`${dir}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
console.log("Baseline: 21 admin + 9 public captures. Isolated data only.");

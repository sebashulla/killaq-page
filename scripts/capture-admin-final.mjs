import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch(),
  output = "artifacts/admin-2/final",
  results = [];
await mkdir(output, { recursive: true });
async function go(p, path) {
  await p.goto("http://localhost:3001" + path, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}
try {
  await fetch("http://127.0.0.1:3100/__empty-catalog", { method: "POST" });
  for (const width of [320, 360, 393, 430, 768, 820, 1024, 1440, 1920]) {
    const c = await browser.newContext({
        viewport: { width, height: 960 },
        reducedMotion: "reduce",
      }),
      p = await c.newPage();
    await go(p, "/login");
    await p.getByLabel("Correo electrónico").fill("admin@killaq.test");
    await p
      .getByLabel("Contraseña", { exact: true })
      .fill("local-test-password");
    await p
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await p.waitForURL("**/admin");
    for (const path of ["/admin", "/admin/productos"]) {
      await go(p, path);
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
        path: `${output}/${path === "/admin" ? "dashboard-empty" : "products-empty"}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      results.push({ path, width, empty: true, passed: true });
    }
    await c.close();
  }
  await fetch("http://127.0.0.1:3100/__reset", { method: "POST" });
  await fetch("http://127.0.0.1:3100/__seed-campaigns", { method: "POST" });
  for (const width of [393, 1440]) {
    const c = await browser.newContext({
        viewport: { width, height: 960 },
        reducedMotion: "reduce",
      }),
      p = await c.newPage();
    await go(p, "/login");
    await p.getByLabel("Correo electrónico").fill("admin@killaq.test");
    await p
      .getByLabel("Contraseña", { exact: true })
      .fill("local-test-password");
    await p
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await p.waitForURL("**/admin");
    for (const path of [
      "/admin",
      "/admin/productos",
      "/admin/carrusel",
      "/admin/experiencia",
      "/admin/exclusivos",
      "/admin/reclamaciones",
      "/admin/configuracion/legal",
    ]) {
      await go(p, path);
      await p.screenshot({
        path: `${output}/${path.replaceAll("/", "-").slice(1)}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
    await go(p, "/admin/productos");
    await p.getByRole("button", { name: "Editar", exact: true }).click();
    await p.screenshot({
      path: `${output}/product-editor-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await c.close();
  }
  await writeFile(output + "/results.json", JSON.stringify(results, null, 2));
  console.log(
    "18 empty-catalog views passed; final desktop/mobile captures refreshed.",
  );
} finally {
  await browser.close();
  await fetch("http://127.0.0.1:3100/__reset", { method: "POST" });
}

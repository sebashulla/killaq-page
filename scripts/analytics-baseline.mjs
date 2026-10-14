import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch();
await mkdir("artifacts/analytics/before", { recursive: true });
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    if (
      (
        await fetch("http://localhost:3000/", {
          signal: AbortSignal.timeout(1000),
        })
      ).ok
    )
      break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
try {
  for (const width of [393, 1440, 1920]) {
    const context = await browser.newContext({
      viewport: { width, height: 960 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      sessionStorage.setItem("killaq-welcome-v3", "seen"),
    );
    const page = await context.newPage();
    for (const [name, path] of [
      ["home", "/"],
      ["catalog", "/colecciones"],
      ["personalized", "/atencion-personalizada"],
    ]) {
      await page.goto("http://localhost:3000" + path, {
        waitUntil: "networkidle",
      });
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({
        content: "nextjs-portal{display:none!important}",
      });
      await page.screenshot({
        path: `artifacts/analytics/before/${name}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
    await context.close();
  }
  console.log("Nine public baseline captures saved.");
} finally {
  await browser.close();
}

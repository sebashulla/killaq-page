import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { periodFrom } from "../artifacts/analytics-tests/core.mjs";
import { emptyTotals } from "../artifacts/analytics-tests/queries.mjs";
const browser = await chromium.launch(),
  directory = "artifacts/analytics/coverage",
  checks = [];
await mkdir(directory, { recursive: true });
const period = periodFrom(new URLSearchParams({ days: "7" }));
try {
  for (const width of [320, 360, 393, 430, 768, 820, 1024, 1440, 1920]) {
    const context = await browser.newContext({
        viewport: { width, height: 960 },
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    let missing = false;
    await page.route("**/api/admin/estadisticas?*", (route) =>
      route.fulfill({
        json: {
          period,
          state: "ready",
          issues: [],
          generatedAt: new Date().toISOString(),
          cacheSeconds: 60,
          measurementStart: period.to,
          comparable: false,
          current: missing
            ? null
            : {
                ...emptyTotals(),
                visitors: 1,
                sessions: 1,
                views: 1,
                events: 2,
                viewSessions: 1,
              },
          previous: null,
          daily: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.parse(period.from) + i * 86400000)
              .toISOString()
              .slice(0, 10),
            views: !missing && i === 6 ? 1 : null,
            inquiries: !missing && i === 6 ? 0 : null,
          })),
          products: [],
          categories: [],
          campaigns: [],
          ctas: [],
          traffic: [],
          devices: [],
          searches: [],
          funnel: { steps: [], error: null },
          truncated: false,
          clarityUrl: null,
          captureEnabled: false,
        },
      }),
    );
    await page.goto("http://localhost:3001/login", {
      waitUntil: "networkidle",
    });
    await page.getByLabel("Correo electrónico").fill("admin@killaq.test");
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("local-test-password");
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await page.waitForURL("**/admin");
    await page.goto("http://localhost:3001/admin/estadisticas", {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: "nextjs-portal{display:none!important}",
    });
    await expect(
      page.getByText("La cobertura comienza el", { exact: false }),
    ).toBeVisible();
    await expect(page.locator('svg[role="img"] circle')).toHaveCount(2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `${directory}/first-measured-day-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    missing = true;
    await page.getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(
      page.getByText("No hay cobertura medida en este periodo.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.locator('svg[role="img"] circle')).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `${directory}/no-coverage-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    checks.push({ width, partial: true, missing: true, passed: true });
    await context.close();
  }
  await writeFile(directory + "/results.json", JSON.stringify(checks, null, 2));
  console.log("Nine first-day and nine missing-coverage states passed.");
  const context = await browser.newContext({
      viewport: { width: 393, height: 960 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  let decision = "granted",
    captures = 0;
  await page.route("**/api/analytics/preferences", async (route) => {
    if (route.request().method() === "POST")
      decision = route.request().postDataJSON().decision;
    await route.fulfill({
      json: { enabled: false, decision, version: "qa-disabled", campaigns: [] },
    });
  });
  await page.route("**/api/analytics/events", (route) => {
    captures++;
    return route.fulfill({ json: { accepted: 0 } });
  });
  await page.goto("http://localhost:3001/colecciones", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("button", { name: "Preferencias de privacidad" })
    .click();
  await expect(
    page.getByRole("button", { name: "Aceptar analítica" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Retirar autorización" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(decision).toBe("denied");
  expect(captures).toBe(0);
  await context.close();
  console.log("Withdrawal remains available while capture is disabled.");
} finally {
  await browser.close();
}

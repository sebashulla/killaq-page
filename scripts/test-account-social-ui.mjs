// Synthetic browser Auth fixtures. Every Supabase Auth request is intercepted;
// no test email/password/account is sent to production.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const origin = process.env.ACCOUNT_UI_ORIGIN || "http://localhost:3000";
const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]+\s*=/.test(line))
    .map((line) => {
      const at = line.indexOf("=");
      return [
        line.slice(0, at).trim(),
        line
          .slice(at + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ""),
      ];
    }),
);
const authOrigin = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
const browser = await chromium.launch(),
  results = [];
const user = {
  id: "00000000-0000-0000-0000-000000000012",
  email: "account-qa@example.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const token =
  encode({ alg: "HS256", typ: "JWT" }) +
  "." +
  encode({
    sub: user.id,
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }) +
  ".fixture";
await mkdir("artifacts/recovery-social", { recursive: true });
async function context(width, mode = "guest") {
  const c = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    }),
    state = { mode, recoveries: [], updates: [], signouts: 0 };
  await c.route(authOrigin + "/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      payload = request.postDataJSON();
    if (url.pathname === "/auth/v1/recover") {
      state.recoveries.push({ payload, url: url.href });
      return route.fulfill({
        status:
          state.mode === "rate-limit"
            ? 429
            : state.mode === "mail-failure"
              ? 500
              : 200,
        json:
          state.mode === "rate-limit"
            ? { code: "over_email_send_rate_limit", message: "Fixture limit" }
            : state.mode === "mail-failure"
              ? { code: "unexpected_failure", message: "Fixture SMTP failure" }
              : {},
      });
    }
    if (url.pathname === "/auth/v1/user") {
      if (request.method() === "PUT") {
        state.updates.push(payload);
        if (state.mode === "update-failure")
          return route.fulfill({
            status: 422,
            headers: { "X-Supabase-Api-Version": "2024-01-01", "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "X-Supabase-Api-Version" },
            json: { code: "weak_password", message: "Fixture rejected" },
          });
        return route.fulfill({ json: user });
      }
      return route.fulfill({
        status: state.mode === "guest" ? 401 : 200,
        json:
          state.mode === "guest"
            ? { code: "bad_jwt", message: "Fixture guest" }
            : user,
      });
    }
    if (url.pathname === "/auth/v1/logout") {
      state.signouts++;
      return route.fulfill({ json: {} });
    }
    if (url.pathname === "/auth/v1/token")
      return route.fulfill({
        status: 400,
        json: { code: "refresh_token_not_found", message: "Fixture expired" },
      });
    if (url.pathname.startsWith("/rest/v1/"))
      return route.fulfill({
        json: url.pathname.endsWith("/profiles")
          ? { role: "customer", id: user.id }
          : [],
      });
    return route.fulfill({
      status: 400,
      json: { message: "Unrecognized synthetic request blocked" },
    });
  });
  await c.route("https://www.instagram.com/**", (r) => r.abort());
  await c.route("https://www.tiktok.com/**", (r) => r.abort());
  if (!["guest", "rate-limit", "mail-failure"].includes(mode)) {
    const key =
      "sb-" + new URL(authOrigin).hostname.split(".")[0] + "-auth-token";
    await c.addInitScript(
      ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
      {
        key,
        session: {
          access_token: token,
          refresh_token: "fixture-refresh",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user,
        },
      },
    );
  }
  return { c, state };
}
async function audit(p, width, label) {
  await p.evaluate(() => document.fonts.ready);
  expect(
    await p.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
  const violations = (
    await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
  ).violations;
  expect(violations.map((v) => v.id)).toEqual([]);
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await p.screenshot({
    path: `artifacts/recovery-social/${label}-${width}.png`,
    fullPage: true,
  });
  results.push({ label, width, violations: 0, overflow: false });
}
try {
  for (const width of [320, 393, 768, 820, 1440]) {
    const { c, state } = await context(width),
      p = await c.newPage();
    await p.goto(origin + "/login");
    await p.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
    await expect(
      p.getByRole("heading", { name: "Vuelve a tu cuenta." }),
    ).toBeVisible();
    await audit(p, width, "recovery");
    await p
      .getByLabel("Correo electrónico de tu cuenta")
      .fill("unknown-qa@example.test");
    await p
      .getByRole("button", { name: "Enviar enlace de recuperación" })
      .click();
    await expect(
      p.getByRole("status").filter({ hasText: "La solicitud fue aceptada" }),
    ).toBeVisible();
    expect(state.recoveries).toHaveLength(1);
    expect(state.recoveries[0].payload.email).toBe("unknown-qa@example.test");
    expect(
      new URL(state.recoveries[0].url).searchParams.get("redirect_to"),
    ).toBe(origin + "/actualizar-contrasena");
    await expect(
      p.getByRole("button", { name: /Puedes solicitar otro/ }),
    ).toBeDisabled();
    await p.goto(origin + "/actualizar-contrasena");
    await expect(
      p.getByText("Necesitas un enlace válido", { exact: false }),
    ).toBeVisible();
    expect(
      await p.getByRole("button", { name: "Guardar nueva contraseña" }).count(),
    ).toBe(0);
    await audit(p, width, "invalid-link");
    await c.close();
    const signed = await context(width, "valid"),
      q = await signed.c.newPage();
    await q.goto(origin + "/actualizar-contrasena");
    await expect(
      q.getByRole("button", { name: "Guardar nueva contraseña" }),
    ).toBeEnabled();
    await audit(q, width, "new-password");
    await q
      .getByLabel("Nueva contraseña", { exact: true })
      .fill("Fixture-password!");
    await q
      .getByLabel("Repetir contraseña", { exact: true })
      .fill("Different-fixture!");
    await q.getByRole("button", { name: "Guardar nueva contraseña" }).click();
    await expect(q.locator("p[role=alert]")).toHaveText(
      "Las contraseñas no coinciden.",
    );
    expect(signed.state.updates).toHaveLength(0);
    await q
      .getByLabel("Repetir contraseña", { exact: true })
      .fill("Fixture-password!");
    await q.getByRole("button", { name: "Guardar nueva contraseña" }).click();
    await expect(
      q.getByRole("status").filter({ hasText: "Tu contraseña se actualizó" }),
    ).toBeVisible();
    expect(signed.state.updates.map((update) => update.password)).toEqual([
      "Fixture-password!",
    ]);
    await expect.poll(() => signed.state.signouts).toBe(1);
    await signed.c.close();
  }
  for (const mode of ["rate-limit", "mail-failure", "update-failure"]) {
    const { c, state } = await context(393, mode),
      p = await c.newPage();
    if (mode === "update-failure") {
      await p.goto(origin + "/actualizar-contrasena");
      await p
        .getByLabel("Nueva contraseña", { exact: true })
        .fill("Fixture-password!");
      await p
        .getByLabel("Repetir contraseña", { exact: true })
        .fill("Fixture-password!");
      await p.getByRole("button", { name: "Guardar nueva contraseña" }).click();
      await expect(p.locator("p[role=alert]")).toHaveText(
        "Utiliza una contraseña más segura.",
      );
      expect(state.signouts).toBe(0);
    } else {
      await p.goto(origin + "/recuperar-contrasena");
      await p
        .getByLabel("Correo electrónico de tu cuenta")
        .fill("account-qa@example.test");
      await p
        .getByRole("button", { name: "Enviar enlace de recuperación" })
        .click();
      await expect(p.locator("p[role=alert]")).toBeVisible();
      expect(
        await p
          .getByText("La solicitud fue aceptada", { exact: false })
          .count(),
      ).toBe(0);
    }
    await c.close();
    results.push({ label: mode, passed: true });
  }
  // Real public read only: owner-selected published links; external frames are blocked here.
  for (const width of [320, 393, 820, 1440]) {
    const { c } = await context(width),
      p = await c.newPage();
    await p.goto(origin + "/");
    const wall = p.locator('section[aria-labelledby="killaq-social-title"]');
    await expect(
      wall.getByRole("link", { name: "Abrir en TikTok" }),
    ).toHaveCount(3);
    await expect(
      wall.getByRole("link", { name: "Abrir en Instagram" }),
    ).toHaveCount(3);
    expect(await wall.locator("iframe").count()).toBe(0);
    await wall
      .getByRole("button", { name: "Activar publicación externa", exact: true })
      .first()
      .click();
    await expect(wall.locator("iframe").first()).toHaveAttribute(
      "src",
      "https://www.instagram.com/p/DXN94fWjQKx/embed",
    );
    await wall
      .getByRole("button", { name: "Cerrar publicación externa" })
      .click();
    expect(await wall.locator("iframe").count()).toBe(0);
    await wall
      .getByRole("button", { name: "Activar video externo", exact: true })
      .first()
      .click();
    await expect(wall.locator("iframe").first()).toHaveAttribute(
      "src",
      "https://www.tiktok.com/embed/v2/7687753618568629522",
    );
    await wall.getByRole("button", { name: "Cerrar video externo" }).click();
    expect(
      await p.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await wall.screenshot({
      path: `artifacts/recovery-social/social-wall-${width}.png`,
    });
    results.push({
      label: "social-wall",
      width,
      externalOptIn: true,
      posts: 6,
      overflow: false,
    });
    await c.close();
  }
  await writeFile(
    "artifacts/recovery-social/ui-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    `${results.length} browser states passed: recovery/update/errors/responsive/social opt-in; synthetic Auth only.`,
  );
} finally {
  await browser.close();
}

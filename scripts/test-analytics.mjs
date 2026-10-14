// All transport is intercepted. This test cannot send events, purchases or queries to a real provider.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import ts from "typescript";
const output = new URL("../artifacts/analytics-tests/", import.meta.url);
await mkdir(output, { recursive: true });
const modules = {
  core: "src/lib/analytics/core.ts",
  client: "src/lib/analytics/client.ts",
  queries: "src/lib/analytics/queries.ts",
  server: "src/lib/analytics/server.ts",
  report: "src/lib/analytics/report.ts",
  "legal-config": "src/lib/legal-config.ts",
  "legal-documents": "src/lib/legal-documents.ts",
  "complaints-core": "src/lib/complaints/core.ts",
  "admin-server": "src/lib/admin/server.ts",
  "admin-validation": "src/lib/admin/validation.ts",
  "stats-route": "src/app/api/admin/estadisticas/route.ts",
  "events-route": "src/app/api/analytics/events/route.ts",
  "preferences-route": "src/app/api/analytics/preferences/route.ts",
};
const replacements = {
  "./core": "./core.mjs",
  "./server": "./server.mjs",
  "./queries": "./queries.mjs",
  "../legal-config": "./legal-config.mjs",
  "../legal-documents": "./legal-documents.mjs",
  "./complaints/core": "./complaints-core.mjs",
  "../complaints/core": "./complaints-core.mjs",
  "./validation": "./admin-validation.mjs",
  "@/lib/admin/server": "./admin-server.mjs",
  "@/lib/admin/validation": "./admin-validation.mjs",
  "@/lib/analytics/server": "./server.mjs",
  "@/lib/analytics/report": "./report.mjs",
};
for (const [name, path] of Object.entries(modules)) {
  const source = await readFile(new URL("../" + path, import.meta.url), "utf8");
  let code = ts
    .transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    })
    .outputText.replace(/import ["']server-only["'];?/g, "");
  for (const [from, to] of Object.entries(replacements))
    code = code
      .replaceAll('"' + from + '"', '"' + to + '"')
      .replaceAll("'" + from + "'", "'" + to + "'");
  await writeFile(new URL(name + ".mjs", output), code);
}
const core = await import(new URL("core.mjs", output)),
  { AnalyticsEngine, hasLocalDenial, rememberLocalDenial, LOCAL_DENIAL_KEY } =
    await import(new URL("client.mjs", output)),
  queries = await import(new URL("queries.mjs", output)),
  server = await import(new URL("server.mjs", output)),
  statsRoute = await import(new URL("stats-route.mjs", output)),
  eventsRoute = await import(new URL("events-route.mjs", output));
const tests = [];
async function check(name, fn) {
  await fn();
  tests.push({ name, passed: true });
}
const pid = "11111111-1111-4111-8111-111111111111",
  adminId = "22222222-2222-4222-8222-222222222222",
  customerId = "33333333-3333-4333-8333-333333333333";
const now = Date.parse("2026-10-13T15:00:00Z"),
  environment = { ...process.env },
  nativeFetch = globalThis.fetch;
const legal = {
  brand: "KILLAQ TEST",
  ruc: "10714330573",
  legalName: "Proveedor ficticio de QA",
  address: "Domicilio ficticio de prueba",
  email: "qa@example.test",
  privacyEmail: "privacy@example.test",
  identityVerified: true,
  approved: true,
  effectiveDate: "2026-10-13",
};
for (const key of [
  "territory",
  "payments",
  "invoices",
  "deliveries",
  "personalized",
  "voluntaryReturns",
  "refunds",
  "retention",
  "transfers",
  "dataBanks",
])
  legal[key] = "Condición ficticia para una prueba aislada";
legal.processors = "PostHog (solo fixture)";
Object.assign(process.env, {
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  ANALYTICS_ENABLED: "true",
  ANALYTICS_PRIVACY_APPROVED: "true",
  ANALYTICS_RETENTION_APPROVED: "true",
  ANALYTICS_HASH_SECRET: "isolated-test-signature-secret-123456789",
  ANALYTICS_PUBLIC_HOST: "analytics.test",
  ANALYTICS_MEASUREMENT_START: "2026-01-01",
  POSTHOG_REGION: "eu",
  POSTHOG_PROJECT_KEY: "phc_test_not_real",
  POSTHOG_PROJECT_ID: "123",
  POSTHOG_PERSONAL_API_KEY: "phx_test_not_real",
  NEXT_PUBLIC_SUPABASE_URL: "https://fixture.test",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-public-key",
  KILLAQ_LEGAL_CONFIG: JSON.stringify(legal),
});
let forwarded = [],
  queryCalls = 0,
  providerFails = false,
  queryFails = false,
  funnelFails = false;
const rows = [
  ["summary", "current", "", 10, 12, 8, 4, 3, 2, 16, 40],
  ["summary", "previous", "", 8, 9, 6, 2, 2, 1, 10, 30],
  ["sessions", "current", "", 7, 3, 2, 0, 0, 0, 0, 0],
  ["sessions", "previous", "", 5, 2, 1, 0, 0, 0, 0, 0],
  ["product", pid, "anillos", 8, 4, 3, 2, 16, 7, 3, 2],
  ["daily", "2026-10-12", "", 8, 2, 0, 0, 0, 0, 0, 0],
  ["search", "anillos oro", "", 5, 1, 5, 0, 0, 0, 0, 0],
  ["campaign", "1", "", 2, 2, 4, 1, 1, 3, 3, 1],
];
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init),
    url = new URL(request.url),
    authorization = request.headers.get("authorization");
  if (url.hostname === "eu.i.posthog.com") {
    assert.equal(url.pathname, "/batch/");
    if (providerFails) return json({ error: "fixture failure" }, 503);
    const body = await request.json();
    forwarded.push(body);
    await new Promise((r) => setTimeout(r, 20));
    return json({ status: 1 });
  }
  if (url.hostname === "eu.posthog.com") {
    queryCalls++;
    assert.equal(authorization, "Bearer phx_test_not_real");
    const body = await request.json();
    assert.equal(body.query.kind, "HogQLQuery");
    if (queryFails) return json({ error: "fixture query failure" }, 503);
    if (body.query.query.includes("arrayFold")) {
      if (funnelFails) return json({ error: "fixture funnel failure" }, 503);
      return json({ results: [[12, 8, 7, 3, 2]] });
    }
    return json({ results: rows });
  }
  if (url.hostname === "fixture.test") {
    if (url.pathname === "/auth/v1/user") {
      const id =
        authorization === "Bearer admin-token"
          ? adminId
          : authorization === "Bearer customer-token"
            ? customerId
            : null;
      return id
        ? json({
            id,
            email: "account@example.test",
            aud: "authenticated",
            role: "authenticated",
            app_metadata: {},
            user_metadata: {},
          })
        : json({ message: "invalid fixture token" }, 401);
    }
    if (url.pathname === "/rest/v1/profiles")
      return json({
        role: authorization === "Bearer admin-token" ? "admin" : "customer",
      });
    if (url.pathname === "/rest/v1/products")
      return json(
        (url.searchParams.get("id") || "").includes(pid)
          ? [
              {
                id: pid,
                name: "Pieza ficticia aislada",
                price: 150,
                category_id: 1,
                collection_id: 1,
                categories: { name: "Anillos", slug: "anillos" },
                product_images: [
                  { url: "/images/categories/anillos-v1.webp", sort_order: 0 },
                ],
              },
            ]
          : [],
      );
    if (url.pathname === "/rest/v1/hero_slides")
      return json([{ id: 1, title: "Campaña ficticia" }]);
  }
  throw new Error("External request blocked by test: " + url.origin);
};
const request = (path, body, cookies = "", extras = {}) =>
  new Request("https://analytics.test" + path, {
    method: "POST",
    headers: {
      Origin: "https://analytics.test",
      "Content-Type": "application/json",
      Referer: "https://analytics.test/colecciones",
      Cookie: cookies,
      "User-Agent": "Mozilla/5.0 Chrome/140.0",
      ...extras,
    },
    body: JSON.stringify(body),
  });
function jar(response, existing = "") {
  const values = new Map(
    existing
      .split("; ")
      .filter(Boolean)
      .map((pair) => {
        const at = pair.indexOf("=");
        return [pair.slice(0, at), pair.slice(at + 1)];
      }),
  );
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(";")[0],
      at = pair.indexOf("=");
    if (header.includes("Max-Age=0")) values.delete(pair.slice(0, at));
    else values.set(pair.slice(0, at), pair.slice(at + 1));
  }
  return [...values].map(([key, value]) => key + "=" + value).join("; ");
}
const envelope = (event, patch = {}) => ({
  id: randomUUID(),
  event,
  page: "catalog",
  device: "mobile",
  ...patch,
});
let cookies = "";
try {
  await check(
    "Sensitive routes excluded by exact public route allowlist",
    () => {
      for (const path of [
        "/admin",
        "/admin/estadisticas",
        "/login",
        "/perfil",
        "/libro-reclamaciones",
        "/politica-de-privacidad",
        "/producto/id?x=1",
      ])
        assert.equal(core.pageKind(path), null);
      assert.equal(core.pageKind("/producto/anillo-prueba"), "product");
    },
  );
  await check(
    "Raw PII, arbitrary properties, purchases and checkout are rejected",
    () => {
      for (const event of [
        { name: "purchase", transaction_id: "x" },
        { name: "begin_checkout" },
        { name: "search", term: "Persona QA +1 202 555 0100", results: 0 },
        { name: "view_item", productId: pid, phone: "+1 202 555 0100" },
        {
          name: "whatsapp_contact_click",
          location: "footer",
          message: "private",
        },
      ])
        assert.throws(() => core.validateEnvelope(envelope(event), []));
      assert.equal(core.safeSearch("anillo ORO"), "anillos oro");
      assert.equal(core.safeSearch("Rosa Blanca"), "termino-omitido");
      assert.equal(core.safeSearch("oro rosa"), "oro");
      assert.equal(core.safeSearch("anillos oro"), "anillos oro");
      assert.equal(core.safeSearch("mi@email.test"), "termino-omitido");
    },
  );
  await check(
    "Traffic sanitization never preserves URL or free UTM campaign",
    () => {
      assert.deepEqual(
        core.landingTraffic(
          "https://shop.test/?utm_source=instagram&utm_medium=social&utm_campaign=correo_personal",
          "",
          ["joyas"],
        ),
        { source: "instagram", medium: "social", campaign: "sin-campana" },
      );
      assert.equal(
        core.landingTraffic(
          "https://shop.test/?utm_source=google&utm_campaign=joyas",
          "",
          ["joyas"],
        ).campaign,
        "joyas",
      );
      assert.equal(
        core.safeTraffic(
          { source: "user@email.test", medium: "private", campaign: "person" },
          [],
        ).source,
        "other",
      );
    },
  );
  await check(
    "Lima boundaries use complete days, equal prior period and validated inputs",
    () => {
      const p = core.periodFrom(
        new URLSearchParams({ days: "7" }),
        new Date(now),
      );
      assert.equal(p.from, "2026-10-06");
      assert.equal(p.to, "2026-10-12");
      assert.equal(p.start, "2026-10-06T05:00:00Z");
      assert.equal(p.previousStart, "2026-09-29T05:00:00Z");
      assert.throws(() =>
        core.periodFrom(
          new URLSearchParams({ from: "2026-02-30", to: "2026-03-03" }),
          new Date(now),
        ),
      );
      assert.throws(() =>
        core.periodFrom(
          new URLSearchParams({ device: "mobile' OR 1=1" }),
          new Date(now),
        ),
      );
      assert.throws(() =>
        core.periodFrom(
          new URLSearchParams({ from: "2026-10-13", to: "2026-10-13" }),
          new Date(now),
        ),
      );
      assert.throws(() =>
        core.periodFrom(new URLSearchParams({ days: "365" }), new Date(now)),
      );
    },
  );
  await check(
    "Rates use matching sessions, zero denominator and baseline are null",
    () => {
      assert.equal(core.rate(3, 7), (3 / 7) * 100);
      assert.equal(core.rate(1, 0), null);
      assert.equal(core.variation(10, 0, true), null);
      assert.equal(core.variation(10, 5, false), null);
      assert.equal(core.variation(10, 5, true), 100);
    },
  );
  await check(
    "Aggregate parsing preserves missing coverage and suppresses small search groups",
    () => {
      const p = core.periodFrom(
        new URLSearchParams({ days: "7" }),
        new Date(now),
      );
      const data = queries.parseAggregates(
        [
          ...rows,
          ["search", "plata", "", 4, 0, 4, 0, 0, 0, 0, 0],
          ["search", "qa@example.test", "", 5, 0, 5, 0, 0, 0, 0, 0],
        ],
        p,
        "2026-10-09",
      );
      assert.equal(data.daily[0].views, null);
      assert.equal(data.daily[3].views, 0);
      assert.equal(data.current.inquiryViewSessions, 2);
      assert.equal(data.searches.length, 1);
      assert.throws(() =>
        queries.parseAggregates(
          [["sessions", "current", "", 1, 3, 0, 0, 0, 0, 0, 0]],
          p,
          "2026-01-01",
        ),
      );
      assert.throws(() => queries.parseFunnel([[3, 5, 1, 1, 1]]));
    },
  );
  await check(
    "SQL scopes environment/version and uses distinct matching sessions, ordered sequence, no PII",
    () => {
      const p = core.periodFrom(
        new URLSearchParams({ days: "30", device: "mobile" }),
        new Date(now),
      );
      const sql = queries.aggregateQuery(p, "2026-01-01"),
        funnel = queries.funnelQuery(p, "2026-01-01");
      assert.match(sql, /killaq_environment = 'production'/);
      assert.match(sql, /uniqExact\(sid\)/);
      assert.match(sql, /viewed > 0 AND added > 0/);
      assert.match(sql, /HAVING uniqExact\(sid\) >= 5/);
      assert.match(sql, /GROUP BY pid,sid/);
      assert.match(funnel, /arrayFold/);
      assert.doesNotMatch(
        sql,
        /email|phone|document|purchase|begin_checkout|current_url/,
      );
    },
  );
  await check(
    "Engine does not capture before opt-in; navigation and StrictMode calls deduplicate",
    async () => {
      const batches = [],
        engine = new AnalyticsEngine(async (b) => batches.push(b));
      engine.navigate("https://shop.test/colecciones");
      engine.track({ name: "view_item", productId: pid });
      assert.equal(batches.length, 0);
      engine.configure({
        enabled: true,
        decision: "granted",
        version: "v1",
        campaigns: [],
      });
      engine.configure({
        enabled: true,
        decision: "granted",
        version: "v1",
        campaigns: [],
      });
      engine.navigate("https://shop.test/colecciones");
      engine.trackOnce("item", { name: "view_item", productId: pid });
      engine.trackOnce("item", { name: "view_item", productId: pid });
      await engine.flush();
      assert.equal(
        batches.flat().filter((e) => e.event.name === "page_view").length,
        1,
      );
      assert.equal(
        batches.flat().filter((e) => e.event.name === "view_item").length,
        1,
      );
      engine.navigate("https://shop.test/colecciones?category=anillos");
      engine.trackOnce("item", { name: "view_item", productId: pid });
      await engine.flush();
      assert.equal(
        batches.flat().filter((e) => e.event.name === "view_item").length,
        2,
      );
      engine.stopLocally();
    },
  );
  await check(
    "Internal and sensitive navigation clears pending queue; withdrawal stops events and local preference expires",
    async () => {
      const stored = new Map();
      const storage = {
        getItem: (key) => stored.get(key) ?? null,
        setItem: (key, value) => stored.set(key, value),
        removeItem: (key) => stored.delete(key),
      };
      assert.equal(hasLocalDenial(storage, now), false);
      rememberLocalDenial(storage, now);
      assert.equal(hasLocalDenial(storage, now + 180 * 86400000 - 1), true);
      assert.equal(hasLocalDenial(storage, now + 180 * 86400000), false);
      assert.equal(stored.has(LOCAL_DENIAL_KEY), false);
      storage.setItem(LOCAL_DENIAL_KEY, JSON.stringify({ expires: "invalid" }));
      assert.equal(hasLocalDenial(storage, now), false);
      assert.equal(stored.has(LOCAL_DENIAL_KEY), false);
      const batches = [],
        engine = new AnalyticsEngine(async (b) => batches.push(b));
      engine.navigate("https://shop.test/colecciones");
      engine.configure({
        enabled: true,
        decision: "granted",
        version: "v1",
        campaigns: [],
      });
      engine.navigate("https://shop.test/admin", "", true);
      await engine.flush();
      assert.equal(batches.length, 0);
      engine.navigate("https://shop.test/colecciones", "", true);
      assert.equal(engine.track({ name: "view_item", productId: pid }), false);
      engine.navigate("https://shop.test/colecciones", "", false);
      engine.stopLocally();
      assert.equal(engine.track({ name: "view_item", productId: pid }), false);
    },
  );
  await check(
    "Cookie signatures cannot be altered, reused after expiry or policy version change",
    () => {
      const signed = server.sign({
        version: "v1",
        exp: now + 1000,
        visitorId: pid,
      });
      assert.equal(server.unsign(signed, "v1", now).visitorId, pid);
      assert.equal(server.unsign(signed + "x", "v1", now), null);
      assert.equal(server.unsign(signed, "v2", now), null);
      assert.equal(server.unsign(signed, "v1", now + 1001), null);
    },
  );
  await check(
    "Production, privacy, retention and complete legal config are required before grant",
    async () => {
      const c = server.analyticsConfig();
      assert.equal(server.captureEnabled(c), true);
      assert.equal(server.captureEnabled({ ...c, production: false }), false);
      assert.equal(server.captureEnabled({ ...c, privacy: false }), false);
      await assert.rejects(
        server.savePreference(
          request("/api/analytics/preferences", {
            decision: "granted",
            version: c.version,
          }),
          { ...c, privacy: false },
          now,
        ),
      );
      const response = await server.savePreference(
        request("/api/analytics/preferences", {
          decision: "granted",
          version: c.version,
        }),
        c,
        now,
      );
      cookies = jar(response);
      assert.equal(
        server.consentState(
          new Request("https://analytics.test/", {
            headers: { Cookie: cookies },
          }),
          c,
          now,
        ),
        "granted",
      );
      assert.match(cookies, /killaq-analytics-visitor=/);
      assert.ok(
        response.headers
          .getSetCookie()
          .every(
            (h) =>
              h.includes("HttpOnly") &&
              h.includes("SameSite=Lax") &&
              h.includes("Secure"),
          ),
      );
    },
  );
  await check(
    "Visitor identifiers rotate after expiration only with an existing valid opt-in",
    () => {
      const c = server.analyticsConfig();
      const preferenceOnly = cookies
        .split("; ")
        .find((value) => value.startsWith("killaq-analytics-preference="));
      const request = new Request(
        "https://analytics.test/api/analytics/preferences",
        { headers: { Cookie: preferenceOnly } },
      );
      const renewed = server.preference(request, c);
      assert.ok(
        renewed.headers
          .getSetCookie()
          .some((header) => header.startsWith("killaq-analytics-visitor=")),
      );
      assert.equal(
        server
          .preference(request, { ...c, enabled: false })
          .headers.getSetCookie().length,
        0,
      );
      assert.equal(
        server.preference(new Request(request.url), c).headers.getSetCookie()
          .length,
        0,
      );
    },
  );
  await check(
    "Valid existing product forwards only approved anonymous properties, without account identity",
    async () => {
      const response = await server.receiveEvents(
        request(
          "/api/analytics/events",
          { events: [envelope({ name: "view_item", productId: pid })] },
          cookies,
        ),
        server.analyticsConfig(),
        now,
      );
      assert.equal((await response.json()).accepted, 1);
      const batch = forwarded.at(-1).batch;
      assert.equal(batch[0].properties.product_id, pid);
      assert.equal(batch[0].properties.$process_person_profile, false);
      assert.equal(batch[0].properties.$geoip_disable, true);
      assert.equal(batch[0].properties.$ip, null);
      assert.equal(
        batch[0].properties.consent_version,
        server.analyticsConfig().version,
      );
      assert.equal(
        batch[0].properties.consent_granted_at,
        new Date(now).toISOString(),
      );
      assert.notEqual(batch[0].properties.distinct_id, adminId);
      assert.ok(batch[0].uuid);
      assert.doesNotMatch(
        JSON.stringify(batch),
        /email|phone|document|message|current_url|202 555 0100/,
      );
      cookies = jar(response, cookies);
    },
  );
  await check(
    "Concurrent duplicate submissions forward once; confirmed retry does not forward again",
    async () => {
      const e = envelope({
          name: "select_item",
          productId: pid,
          list: "catalog",
          position: 0,
        }),
        before = forwarded.length;
      const responses = await Promise.all([
        server.receiveEvents(
          request("/api/analytics/events", { events: [e] }, cookies),
          server.analyticsConfig(),
          now,
        ),
        server.receiveEvents(
          request("/api/analytics/events", { events: [e] }, cookies),
          server.analyticsConfig(),
          now,
        ),
      ]);
      assert.equal(forwarded.length - before, 1);
      assert.equal(
        (await responses[0].json()).accepted +
          (await responses[1].json()).accepted,
        1,
      );
      const retry = await server.receiveEvents(
        request("/api/analytics/events", { events: [e] }, cookies),
        server.analyticsConfig(),
        now,
      );
      assert.equal((await retry.json()).duplicate, true);
    },
  );
  await check(
    "Unknown products, bad origin, missing consent and sensitive referrer are rejected",
    async () => {
      for (const [body, cookie, headers] of [
        [
          {
            events: [envelope({ name: "view_item", productId: randomUUID() })],
          },
          cookies,
          {},
        ],
        [
          { events: [envelope({ name: "view_item", productId: pid })] },
          cookies,
          { Origin: "https://evil.test" },
        ],
        [{ events: [envelope({ name: "view_item", productId: pid })] }, "", {}],
        [
          { events: [envelope({ name: "view_item", productId: pid })] },
          cookies,
          { Referer: "https://analytics.test/libro-reclamaciones" },
        ],
      ])
        await assert.rejects(
          server.receiveEvents(
            request("/api/analytics/events", body, cookie, headers),
            server.analyticsConfig(),
            now,
          ),
        );
    },
  );
  await check(
    "Known bots and authenticated administrators are excluded on the server",
    async () => {
      const body = {
          events: [envelope({ name: "view_item", productId: pid })],
        },
        before = forwarded.length;
      for (const headers of [
        { "User-Agent": "HeadlessChrome Playwright" },
        { Authorization: "Bearer admin-token" },
      ]) {
        const response = await server.receiveEvents(
          request("/api/analytics/events", body, cookies, headers),
          server.analyticsConfig(),
          now,
        );
        assert.equal((await response.json()).excluded, true);
      }
      assert.equal(forwarded.length, before);
    },
  );
  await check(
    "Provider failure is not acknowledged as capture, and reservation is released",
    async () => {
      providerFails = true;
      const body = {
        events: [
          envelope({ name: "add_to_cart", productId: pid, quantity: 1 }),
        ],
      };
      await assert.rejects(
        server.receiveEvents(
          request("/api/analytics/events", body, cookies),
          server.analyticsConfig(),
          now,
        ),
      );
      providerFails = false;
      assert.equal(
        (
          await (
            await server.receiveEvents(
              request("/api/analytics/events", body, cookies),
              server.analyticsConfig(),
              now,
            )
          ).json()
        ).accepted,
        1,
      );
    },
  );
  await check(
    "Withdrawal removes identifiers, future capture is blocked, no purchase event can be sent",
    async () => {
      const denied = await server.savePreference(
        request("/api/analytics/preferences", {
          decision: "denied",
          version: server.analyticsConfig().version,
        }),
        server.analyticsConfig(),
        now,
      );
      const revoked = jar(denied, cookies);
      assert.doesNotMatch(revoked, /analytics-visitor|analytics-session/);
      await assert.rejects(
        server.receiveEvents(
          request(
            "/api/analytics/events",
            { events: [envelope({ name: "view_item", productId: pid })] },
            revoked,
          ),
          server.analyticsConfig(),
          now,
        ),
      );
      const response = await eventsRoute.POST(
        request(
          "/api/analytics/events",
          { events: [envelope({ name: "purchase", transaction_id: "fake" })] },
          cookies,
        ),
      );
      assert.notEqual(response.status, 200);
    },
  );
  await check(
    "Admin endpoint returns 401/403 before querying provider, including a warmed cache",
    async () => {
      const before = queryCalls;
      for (const [token, status] of [
        ["", 401],
        ["bad-token", 401],
        ["customer-token", 403],
      ]) {
        const response = await statsRoute.GET(
          new Request("https://analytics.test/api/admin/estadisticas?days=7", {
            headers: token ? { Authorization: "Bearer " + token } : {},
          }),
        );
        assert.equal(response.status, status);
      }
      assert.equal(queryCalls, before);
    },
  );
  await check(
    "Authorized aggregated report, server-only key and bounded cache are functional",
    async () => {
      const request = new Request(
        "https://analytics.test/api/admin/estadisticas?from=2026-10-06&to=2026-10-12",
        { headers: { Authorization: "Bearer admin-token" } },
      );
      const response = await statsRoute.GET(request);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.state, "ready");
      assert.equal(data.current.views, 8);
      assert.equal(data.current.inquiries, 2);
      assert.equal(data.products[0].name, "Pieza ficticia aislada");
      assert.equal(data.campaigns[0].detail, "Campaña ficticia");
      assert.deepEqual(data.funnel.steps, [12, 8, 7, 3, 2]);
      assert.equal(data.comparable, true);
      assert.equal(data.cacheSeconds, 60);
      assert.doesNotMatch(
        JSON.stringify(data),
        /phx_test|phc_test|visitorId|account@example/,
      );
      const count = queryCalls;
      assert.equal((await statsRoute.GET(request)).status, 200);
      assert.equal(queryCalls, count);
      assert.equal(
        (
          await statsRoute.GET(
            new Request(request.url, {
              headers: { Authorization: "Bearer customer-token" },
            }),
          )
        ).status,
        403,
      );
      assert.match(response.headers.get("Cache-Control"), /private.*no-store/);
    },
  );
  await check(
    "Provider errors and unavailable credentials never become zero metrics",
    async () => {
      queryFails = true;
      const response = await statsRoute.GET(
        new Request(
          "https://analytics.test/api/admin/estadisticas?from=2026-10-05&to=2026-10-11",
          { headers: { Authorization: "Bearer admin-token" } },
        ),
      );
      assert.equal(response.status, 503);
      queryFails = false;
      const key = process.env.POSTHOG_PERSONAL_API_KEY;
      delete process.env.POSTHOG_PERSONAL_API_KEY;
      const missing = await statsRoute.GET(
        new Request("https://analytics.test/api/admin/estadisticas?days=7", {
          headers: { Authorization: "Bearer admin-token" },
        }),
      );
      const data = await missing.json();
      assert.equal(data.state, "unconfigured");
      assert.equal(data.current, null);
      process.env.POSTHOG_PERSONAL_API_KEY = key;
    },
  );
  await check(
    "Ordered funnel failure leaves aggregates intact and is explicitly reported",
    async () => {
      funnelFails = true;
      const response = await statsRoute.GET(
        new Request(
          "https://analytics.test/api/admin/estadisticas?from=2026-10-04&to=2026-10-10",
          { headers: { Authorization: "Bearer admin-token" } },
        ),
      );
      const data = await response.json();
      assert.equal(data.current.views, 8);
      assert.equal(data.funnel.steps.length, 0);
      assert.ok(data.funnel.error);
      funnelFails = false;
    },
  );
  await writeFile(
    new URL("results.json", output),
    JSON.stringify(tests, null, 2),
  );
  console.log(
    `${tests.length} analytics checks passed; all provider and database transport isolated.`,
  );
} finally {
  globalThis.fetch = nativeFetch;
  for (const key of Object.keys(process.env))
    if (!(key in environment)) delete process.env[key];
  Object.assign(process.env, environment);
}

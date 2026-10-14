import "server-only";
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { legalConfig, policiesReady } from "../legal-config";
import { documentContent } from "../legal-documents";
import {
  AnalyticsError,
  pageKind,
  safeTraffic,
  validDay,
  validateEnvelope,
  validProductId,
  limaDay,
  type EventEnvelope,
  type Traffic,
} from "./core";

const PREFERENCE = "killaq-analytics-preference",
  VISITOR = "killaq-analytics-visitor",
  SESSION = "killaq-analytics-session";
const MINUTE = 60000,
  DAY = 86400000;
export function analyticsConfig() {
  const legal = legalConfig(),
    region = process.env.POSTHOG_REGION === "eu" ? "eu" : "us";
  const regionValid = ["eu", "us"].includes(process.env.POSTHOG_REGION || "");
  const project = process.env.POSTHOG_PROJECT_ID || "",
    started = process.env.ANALYTICS_MEASUREMENT_START || "";
  const campaigns = (process.env.ANALYTICS_UTM_CAMPAIGNS || "")
    .split(",")
    .filter((s) => /^[a-z][a-z0-9_-]{0,39}$/.test(s));
  const production =
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV === "production";
  const enabled = process.env.ANALYTICS_ENABLED === "true";
  const privacy =
    process.env.ANALYTICS_PRIVACY_APPROVED === "true" &&
    process.env.ANALYTICS_RETENTION_APPROVED === "true" &&
    policiesReady(legal) &&
    legal.effectiveDate <= limaDay() &&
    /posthog/i.test(legal.processors);
  const captureReady = Boolean(
    regionValid &&
    process.env.POSTHOG_PROJECT_KEY &&
    (process.env.ANALYTICS_HASH_SECRET || "").length >= 32 &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const queryReady = Boolean(
    regionValid &&
    /^[1-9]\d{0,9}$/.test(project) &&
    process.env.POSTHOG_PERSONAL_API_KEY &&
    validDay(started),
  );
  const host = process.env.ANALYTICS_PUBLIC_HOST || "killaq-page.vercel.app";
  const clarity = process.env.CLARITY_PROJECT_ID || "";
  const noticeHash = createHash("sha256")
    .update(JSON.stringify(documentContent("privacy", legal)))
    .digest("hex")
    .slice(0, 16);
  return {
    production,
    enabled,
    privacy,
    captureReady,
    queryReady,
    regionValid,
    campaigns,
    project,
    started: validDay(started) ? started : null,
    host,
    version:
      "analytics-v1-" + (legal.effectiveDate || "pending") + "-" + noticeHash,
    captureHost: `https://${region}.i.posthog.com`,
    queryHost: `https://${region}.posthog.com`,
    clarityUrl: /^[a-z0-9]{5,30}$/i.test(clarity)
      ? `https://clarity.microsoft.com/projects/view/${clarity}/heatmaps`
      : null,
  };
}
export function captureEnabled(c = analyticsConfig()) {
  return (
    c.production &&
    c.enabled &&
    c.privacy &&
    c.captureReady &&
    Boolean(c.started && c.started <= limaDay())
  );
}
export function configurationIssues(c = analyticsConfig()) {
  const issues: string[] = [];
  if (!c.regionValid)
    issues.push(
      "Configura POSTHOG_REGION como eu o us, de acuerdo con el proyecto y las transferencias revisadas. No se adopta una región implícita.",
    );
  if (!c.queryReady)
    issues.push(
      "Faltan el proyecto, la clave privada de consulta o la fecha real de inicio de medición en PostHog.",
    );
  if (!c.enabled) issues.push("La captura está desactivada.");
  if (!c.privacy)
    issues.push(
      "Faltan la política de privacidad revisada, PostHog entre los encargados y la aprobación del tratamiento, transferencias y conservación.",
    );
  if (!c.captureReady)
    issues.push("Faltan la clave de captura o el secreto de firma de cookies.");
  if (!c.production)
    issues.push(
      "Desarrollo y despliegues de prueba se excluyen de la captura.",
    );
  if (c.started && c.started > limaDay())
    issues.push(
      "La fecha declarada de inicio todavía no llegó. La captura permanece detenida.",
    );
  return issues;
}
type Signed = { version: string; exp: number; [key: string]: unknown };
export function sign(value: Signed) {
  const encoded = Buffer.from(JSON.stringify(value)).toString("base64url");
  return (
    encoded +
    "." +
    createHmac("sha256", process.env.ANALYTICS_HASH_SECRET || "")
      .update(encoded)
      .digest("base64url")
  );
}
export function unsign(
  value: string | undefined,
  version: string,
  now = Date.now(),
): Signed | null {
  if (
    !value ||
    (process.env.ANALYTICS_HASH_SECRET || "").length < 32 ||
    value.length > 3000
  )
    return null;
  try {
    const [data, signature, ...extra] = value.split(".");
    if (extra.length || !data || !signature) return null;
    const expected = createHmac("sha256", process.env.ANALYTICS_HASH_SECRET!)
      .update(data)
      .digest();
    const received = Buffer.from(signature, "base64url");
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      return null;
    const result = JSON.parse(
      Buffer.from(data, "base64url").toString(),
    ) as Signed;
    return result.version === version &&
      typeof result.exp === "number" &&
      result.exp > now
      ? result
      : null;
  } catch {
    return null;
  }
}
function cookieValues(request: Request) {
  const values: Record<string, string> = {};
  for (const pair of (request.headers.get("cookie") || "").split(";")) {
    const index = pair.indexOf("=");
    if (index > 0)
      values[pair.slice(0, index).trim()] = pair.slice(index + 1).trim();
  }
  return values;
}
export function consentState(
  request: Request,
  c = analyticsConfig(),
  now = Date.now(),
) {
  const record = unsign(cookieValues(request)[PREFERENCE], c.version, now);
  return record?.decision === "granted"
    ? "granted"
    : record?.decision === "denied"
      ? "denied"
      : "unset";
}
export function analyticsResponse(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export function analyticsFailure(error: unknown) {
  return analyticsResponse(
    {
      error:
        error instanceof AnalyticsError
          ? error.message
          : "La medición no está disponible.",
    },
    error instanceof AnalyticsError ? error.status : 503,
  );
}
function cookie(
  response: Response,
  name: string,
  value: string,
  seconds: number,
) {
  response.headers.append(
    "Set-Cookie",
    `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}
export function assertOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new AnalyticsError(403, "Origen no permitido.");
}
async function body(request: Request) {
  assertOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AnalyticsError(415, "Formato inválido.");
  const reader = request.body?.getReader();
  if (!reader) throw new AnalyticsError(400, "Solicitud vacía.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > 16000) {
      await reader.cancel();
      throw new AnalyticsError(413, "Solicitud demasiado extensa.");
    }
    chunks.push(chunk.value);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new AnalyticsError(400, "Solicitud inválida.");
  }
}
const limits = new Map<string, { minute: number; count: number }>();
export function limited(key: string, max: number, now = Date.now()) {
  const minute = Math.floor(now / MINUTE),
    record = limits.get(key);
  if (record?.minute === minute) {
    record.count++;
    if (record.count > max)
      throw new AnalyticsError(
        429,
        "Demasiadas solicitudes. Intenta nuevamente en un minuto.",
      );
  } else limits.set(key, { minute, count: 1 });
  if (limits.size > 2000)
    for (const [k, v] of limits) if (v.minute < minute) limits.delete(k);
  if (limits.size > 3000) limits.delete(limits.keys().next().value!);
}
function requestKey(request: Request) {
  const ip = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    : "local";
  return createHmac("sha256", process.env.ANALYTICS_HASH_SECRET || "disabled")
    .update(ip)
    .digest("hex");
}
export function preference(request: Request, c = analyticsConfig()) {
  const decision = consentState(request, c);
  const response = analyticsResponse({
    enabled: captureEnabled(c),
    decision,
    version: c.version,
    campaigns: c.campaigns,
  });
  // A still-valid opt-in may outlive the anonymous visitor cookie. Rotate the ID without identifying an account.
  if (
    decision === "granted" &&
    captureEnabled(c) &&
    new URL(request.url).host === c.host &&
    !unsign(cookieValues(request)[VISITOR], c.version)
  ) {
    cookie(
      response,
      VISITOR,
      sign({
        version: c.version,
        visitorId: randomUUID(),
        exp: Date.now() + 90 * DAY,
      }),
      90 * 86400,
    );
    cookie(response, SESSION, "", 0);
  }
  return response;
}
export async function savePreference(
  request: Request,
  c = analyticsConfig(),
  now = Date.now(),
) {
  const input = await body(request);
  limited("preferences:" + requestKey(request), 30, now);
  if (
    Object.keys(input).some((k) => !["decision", "version"].includes(k)) ||
    !["granted", "denied"].includes(String(input.decision))
  )
    throw new AnalyticsError(422, "Preferencia inválida.");
  if (
    input.decision === "granted" &&
    (!captureEnabled(c) ||
      new URL(request.url).host !== c.host ||
      input.version !== c.version)
  )
    throw new AnalyticsError(503, "La analítica aún no está habilitada.");
  const response = analyticsResponse({
    decision: input.decision,
    enabled: captureEnabled(c),
    version: c.version,
  });
  // Preference is necessary storage; denied creates no analytics identity.
  if ((process.env.ANALYTICS_HASH_SECRET || "").length >= 32)
    cookie(
      response,
      PREFERENCE,
      sign({
        version: c.version,
        decision: input.decision,
        grantedAt: input.decision === "granted" ? now : null,
        exp: now + 180 * DAY,
      }),
      180 * 86400,
    );
  else cookie(response, PREFERENCE, "", 0);
  cookie(response, VISITOR, "", 0);
  cookie(response, SESSION, "", 0);
  if (input.decision === "granted") {
    cookie(
      response,
      VISITOR,
      sign({
        version: c.version,
        visitorId: randomUUID(),
        exp: now + 90 * DAY,
      }),
      90 * 86400,
    );
    cookie(
      response,
      SESSION,
      sign({
        version: c.version,
        sessionId: randomUUID(),
        born: now,
        last: now,
        exp: now + 30 * MINUTE,
      }),
      30 * 60,
    );
  }
  return response;
}
const seen = new Map<string, number>();
const bots =
  /bot\b|crawler|spider|headless|playwright|lighthouse|curl|wget|python-requests|selenium/i;
export async function receiveEvents(
  request: Request,
  c = analyticsConfig(),
  now = Date.now(),
) {
  assertOrigin(request);
  if (!captureEnabled(c) || new URL(request.url).host !== c.host)
    throw new AnalyticsError(503, "La captura está desactivada.");
  if (consentState(request, c, now) !== "granted")
    throw new AnalyticsError(403, "Se necesita autorización de analítica.");
  const consent = unsign(cookieValues(request)[PREFERENCE], c.version, now)!;
  if (bots.test(request.headers.get("user-agent") || ""))
    return analyticsResponse({ excluded: true });
  const referer = request.headers.get("referer");
  let allowedPage = false;
  try {
    allowedPage = Boolean(
      referer &&
      new URL(referer).origin === new URL(request.url).origin &&
      pageKind(new URL(referer).pathname),
    );
  } catch {}
  if (!allowedPage)
    throw new AnalyticsError(403, "Esta página se excluye de la medición.");
  const input = await body(request);
  if (
    Object.keys(input).some((k) => k !== "events") ||
    !Array.isArray(input.events) ||
    !input.events.length ||
    input.events.length > 20
  )
    throw new AnalyticsError(422, "Lote inválido.");
  const envelopes = input.events.map((v) => validateEnvelope(v, c.campaigns));
  if (new Set(envelopes.map((e) => e.id)).size !== envelopes.length)
    throw new AnalyticsError(
      422,
      "El lote contiene identificadores duplicados.",
    );
  const values = cookieValues(request),
    visitor = unsign(values[VISITOR], c.version, now);
  if (!visitor || !validProductId(visitor.visitorId))
    throw new AnalyticsError(403, "Renueva tu preferencia de privacidad.");
  limited("events:" + requestKey(request), 120, now);
  limited("visitor:" + String(visitor.visitorId), 90, now);
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (\S+)$/)?.[1];
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (url, init) =>
          fetch(url, { ...init, signal: AbortSignal.timeout(8000) }),
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      },
    },
  );
  if (token) {
    const auth = await db.auth.getUser(token);
    if (auth.error || !auth.data.user)
      return analyticsResponse({ excluded: true });
    const profile = await db
      .from("profiles")
      .select("role")
      .eq("id", auth.data.user.id)
      .maybeSingle();
    if (profile.error || profile.data?.role === "admin")
      return analyticsResponse({ excluded: true });
  }
  let fresh = envelopes.filter(
    (e) => !seen.has(String(visitor.visitorId) + ":" + e.id),
  );
  if (!fresh.length) return analyticsResponse({ accepted: 0, duplicate: true });
  const ids = [
    ...new Set(
      fresh.flatMap((e) =>
        "productId" in e.event
          ? [e.event.productId]
          : e.event.name === "view_cart"
            ? e.event.items.map((item) => item.productId)
            : [],
      ),
    ),
  ];
  const products = ids.length
    ? await db
        .from("products")
        .select("id,price,category_id,collection_id,categories(slug)")
        .eq("is_active", true)
        .in("id", ids)
    : { data: [], error: null };
  if (products.error)
    throw new AnalyticsError(503, "No se pudieron validar las piezas.");
  const catalogue = new Map((products.data || []).map((p) => [p.id, p]));
  if (ids.some((id) => !catalogue.has(id)))
    throw new AnalyticsError(
      422,
      "La pieza no está disponible en el catálogo.",
    );
  const campaignIds = [
    ...new Set(
      fresh.flatMap((e) =>
        "campaignId" in e.event && !e.event.campaignId.startsWith("reference:")
          ? [Number(e.event.campaignId)]
          : [],
      ),
    ),
  ];
  if (campaignIds.length) {
    const campaigns = await db
      .from("hero_slides")
      .select("id")
      .eq("is_active", true)
      .in("id", campaignIds);
    if (campaigns.error)
      throw new AnalyticsError(503, "No se pudo verificar la campaña.");
    if (campaignIds.some((id) => !campaigns.data?.some((c) => c.id === id)))
      throw new AnalyticsError(422, "Campaña no disponible.");
  }
  // Reserve after validation, before the network call, so concurrent local retries do not both forward.
  fresh = fresh.filter((entry) => {
    const key = String(visitor.visitorId) + ":" + entry.id;
    if (seen.has(key)) return false;
    seen.set(key, now);
    return true;
  });
  if (!fresh.length) return analyticsResponse({ accepted: 0, duplicate: true });
  let session = unsign(values[SESSION], c.version, now);
  if (
    !session ||
    !validProductId(session.sessionId) ||
    typeof session.born !== "number" ||
    now - session.born >= DAY
  )
    session = {
      version: c.version,
      sessionId: randomUUID(),
      born: now,
      last: now,
      exp: now + 30 * MINUTE,
    };
  const traffic =
    session.traffic && typeof session.traffic === "object"
      ? safeTraffic(session.traffic as Traffic, c.campaigns)
      : fresh[0].traffic || {
          source: "direct",
          medium: "direct",
          campaign: "sin-campana",
        };
  let attributed = typeof session.campaign === "string" ? session.campaign : "";
  const batch = fresh.map((entry, index) => {
    const e = entry.event;
    if (e.name === "campaign_selected") attributed = e.campaignId;
    const product = "productId" in e ? catalogue.get(e.productId) : undefined;
    const category = product
      ? (Array.isArray(product.categories)
          ? product.categories[0]?.slug
          : (product.categories as { slug?: string } | null)?.slug) ||
        "sin-categoria"
      : e.name === "category_selected"
        ? e.category
        : "";
    const props: Record<string, unknown> = {
      distinct_id: visitor.visitorId,
      $process_person_profile: false,
      $geoip_disable: true,
      $ip: null,
      $session_id: session.sessionId,
      killaq_schema: 1,
      killaq_environment: "production",
      consent_version: c.version,
      consent_granted_at:
        typeof consent.grantedAt === "number"
          ? new Date(consent.grantedAt).toISOString()
          : null,
      page: entry.page,
      device: entry.device,
      traffic_source: traffic.source,
      traffic_medium: traffic.medium,
      utm_campaign: traffic.campaign,
      attributed_campaign: attributed,
      currency: "PEN",
    };
    if (product) {
      props.product_id = product.id;
      props.category_slug = category;
      props.collection_id = product.collection_id || null;
      props.items = [
        {
          item_id: product.id,
          item_category: category,
          quantity: "quantity" in e ? e.quantity : 1,
        },
      ];
    }
    if ("list" in e) {
      props.item_list_id = e.list;
      props.position = e.position;
    }
    if (e.name === "add_to_cart" || e.name === "remove_from_cart")
      props.cta_location = entry.page === "offers" ? "catalog" : entry.page;
    if (e.name === "view_cart")
      props.items = e.items.map((item) => ({
        item_id: item.productId,
        quantity: item.quantity,
      }));
    if (e.name === "search") {
      props.search_term = e.term;
      props.result_count = e.results;
    }
    if ("location" in e) props.cta_location = e.location;
    if ("campaignId" in e) props.campaign_id = e.campaignId;
    if (e.name === "category_selected") props.category_slug = e.category;
    if (e.name === "product_gallery_interaction") props.media_index = e.index;
    return {
      uuid: entry.id,
      event: e.name,
      properties: props,
      timestamp: new Date(now + index).toISOString(),
    };
  });
  try {
    const response = await fetch(c.captureHost + "/batch/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: process.env.POSTHOG_PROJECT_KEY, batch }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok)
      throw new AnalyticsError(503, "PostHog no aceptó el lote.");
    const acknowledgement: unknown = await response.json();
    if (
      acknowledgement !== 1 &&
      (!(acknowledgement && typeof acknowledgement === "object") ||
        (acknowledgement as { status?: unknown }).status !== 1)
    )
      throw new AnalyticsError(503, "No se confirmó la aceptación del lote.");
  } catch (error) {
    for (const entry of fresh)
      seen.delete(String(visitor.visitorId) + ":" + entry.id);
    throw error;
  }
  for (const [key, time] of seen)
    if (now - time > DAY || seen.size > 10000) seen.delete(key);
  const result = analyticsResponse({
    accepted: fresh.length,
    notice:
      "Aceptado por el proveedor; la disponibilidad en informes puede demorarse.",
  });
  cookie(
    result,
    SESSION,
    sign({
      ...session,
      last: now,
      exp: now + 30 * MINUTE,
      traffic,
      campaign: attributed,
    }),
    30 * 60,
  );
  return result;
}
export function productIds(envelopes: EventEnvelope[]) {
  return [
    ...new Set(
      envelopes.flatMap((e) =>
        "productId" in e.event ? [e.event.productId] : [],
      ),
    ),
  ];
}

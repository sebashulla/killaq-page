import "server-only";
import {
  AnalyticsError,
  periodFrom,
  validProductId,
  type AnalyticsReport,
} from "./core";
import {
  analyticsConfig,
  captureEnabled,
  configurationIssues,
  limited,
} from "./server";
import {
  aggregateQuery,
  funnelQuery,
  parseAggregates,
  parseFunnel,
} from "./queries";
import type { authorizeAdmin } from "../admin/server";
type Admin = Awaited<ReturnType<typeof authorizeAdmin>>;
const cache = new Map<string, { expires: number; report: AnalyticsReport }>(),
  pending = new Map<string, Promise<AnalyticsReport>>();
async function query(sql: string, c: ReturnType<typeof analyticsConfig>) {
  const response = await fetch(
    `${c.queryHost}/api/projects/${c.project}/query/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`,
      },
      body: JSON.stringify({
        query: { kind: "HogQLQuery", query: sql },
        name: "KILLAQ · estadísticas agregadas",
        refresh: "blocking",
      }),
      signal: AbortSignal.timeout(18000),
      cache: "no-store",
      redirect: "error",
    },
  );
  if (!response.ok)
    throw new AnalyticsError(
      response.status === 429 ? 429 : 503,
      response.status === 429
        ? "PostHog alcanzó su límite de consultas. Reintenta más tarde."
        : "No se pudieron consultar los agregados de PostHog. Revisa proyecto, región, permisos y presupuesto de lectura.",
    );
  const data = await response.json();
  if (
    data.error ||
    (data.is_cached === false && data.results === undefined) ||
    !Array.isArray(data.results)
  )
    throw new AnalyticsError(503, "PostHog no completó la consulta.");
  return data.results as unknown;
}
export async function analyticsReport(
  request: Request,
  admin: Admin,
): Promise<AnalyticsReport> {
  const c = analyticsConfig(),
    period = periodFrom(new URL(request.url).searchParams);
  const base: AnalyticsReport = {
    period,
    state: "unconfigured",
    issues: configurationIssues(c),
    generatedAt: new Date().toISOString(),
    cacheSeconds: 60,
    measurementStart: c.started,
    comparable: false,
    current: null,
    previous: null,
    daily: [],
    products: [],
    categories: [],
    campaigns: [],
    ctas: [],
    traffic: [],
    devices: [],
    searches: [],
    funnel: { steps: [], error: null },
    truncated: false,
    clarityUrl: c.clarityUrl,
    captureEnabled: captureEnabled(c),
  };
  if (!c.queryReady || !c.started) return base;
  limited("queries:" + admin.user.id, 12);
  // Role was verified before this cache. Project and schema are part of the key.
  const key = [
      c.queryHost,
      c.project,
      c.started,
      "v1",
      period.from,
      period.to,
      period.device,
    ].join("|"),
    hit = cache.get(key);
  if (hit && hit.expires > Date.now())
    return {
      ...hit.report,
      captureEnabled: base.captureEnabled,
      issues: [...new Set([...base.issues, ...hit.report.issues])],
    };
  const existing = pending.get(key);
  if (existing) return existing;
  const load = async () => {
    const aggregates = parseAggregates(
      await query(aggregateQuery(period, c.started!), c),
      period,
      c.started!,
    );
    const ids = aggregates.products.map((p) => p.id).filter(validProductId);
    const campaignIds = aggregates.campaigns
      .map((row) => row.key)
      .filter((id) => /^[1-9]\d{0,8}$/.test(id))
      .map(Number);
    const [metadata, campaignMetadata] = await Promise.all([
      ids.length
        ? admin.db
            .from("products")
            .select(
              "id,name,categories(name,slug),product_images(url,sort_order)",
            )
            .in("id", ids)
        : Promise.resolve({ data: [], error: null }),
      campaignIds.length
        ? admin.db.from("hero_slides").select("id,title").in("id", campaignIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const issues = [...base.issues];
    if (campaignMetadata.error)
      issues.push(
        "No se pudieron consultar los títulos actuales de las campañas. Sus conteos permanecen identificados por ID.",
      );
    for (const row of aggregates.campaigns) {
      const campaign = campaignMetadata.data?.find(
        (item) => String(item.id) === row.key,
      );
      if (campaign) row.detail = campaign.title;
    }
    if (metadata.error)
      issues.push(
        "Los conteos están disponibles, pero no se pudieron consultar las fotografías y nombres actuales del catálogo.",
      );
    for (const p of aggregates.products) {
      const product = metadata.data?.find((item) => item.id === p.id);
      if (product) {
        p.name = product.name;
        const category = Array.isArray(product.categories)
          ? product.categories[0]
          : product.categories;
        if (category?.slug) p.category = category.slug;
        const images = [...(product.product_images || [])].sort(
          (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
        );
        p.image = images[0]?.url || p.image;
      }
    }
    let funnel: AnalyticsReport["funnel"];
    try {
      funnel = {
        steps: parseFunnel(await query(funnelQuery(period, c.started!), c)),
        error: null,
      };
    } catch {
      funnel = {
        steps: [],
        error:
          "La consulta del recorrido ordenado no está disponible. Los conteos generales no se presentan como un embudo secuencial.",
      };
    }
    if (period.from < c.started!)
      issues.push(
        `Cobertura parcial: la medición comienza el ${c.started}. Los días anteriores no se rellenan con ceros.`,
      );
    const report: AnalyticsReport = {
      ...base,
      ...aggregates,
      issues,
      state: "ready",
      comparable:
        period.previousStart >= c.started! + "T05:00:00Z" &&
        Boolean(aggregates.previous?.events && aggregates.current?.events),
      funnel,
      generatedAt: new Date().toISOString(),
    };
    cache.set(key, { expires: Date.now() + 60000, report });
    if (cache.size > 30) cache.delete(cache.keys().next().value!);
    return report;
  };
  const operation = load();
  pending.set(key, operation);
  try {
    return await operation;
  } finally {
    pending.delete(key);
  }
}

import {
  EVENT_NAMES,
  AnalyticsError,
  shiftDay,
  safeSearch,
  type Period,
  type Totals,
  type AnalyticsReport,
  type Breakdown,
  type ProductStats,
} from "./core";

// All variable SQL values originate from validated dates or finite enums, never query text.
const sqlDate = (iso: string) =>
  `toDateTime('${iso.replace("T", " ").replace("Z", "")}', 'UTC')`;
export function baseQuery(period: Period, measurementStart: string) {
  const start =
    measurementStart + "T05:00:00Z" > period.previousStart
      ? measurementStart + "T05:00:00Z"
      : period.previousStart;
  return `SELECT event, timestamp, distinct_id, properties.$session_id AS sid,
 properties.product_id AS pid, properties.category_slug AS category,
 properties.campaign_id AS campaign, properties.attributed_campaign AS attributed,
 properties.cta_location AS location, properties.device AS device,
 properties.traffic_source AS source, properties.traffic_medium AS medium,
 properties.utm_campaign AS utm, properties.search_term AS term, properties.result_count AS results,
 if(timestamp >= ${sqlDate(period.start)}, 'current', 'previous') AS period
 FROM events WHERE timestamp >= ${sqlDate(start)} AND timestamp < ${sqlDate(period.end)}
 AND properties.killaq_schema = 1 AND properties.killaq_environment = 'production'
 AND properties.$session_id IS NOT NULL AND event IN (${EVENT_NAMES.map((e) => `'${e}'`).join(",")})
 ${period.device === "all" ? "" : `AND properties.device = '${period.device}'`}`;
}
const inquiries = "event = 'whatsapp_contact_click'";
const productInquiries = "event = 'product_whatsapp_inquiry'";
const numbers = (values: string[]) =>
  [...values, ...Array(Math.max(0, 8 - values.length)).fill("0")]
    .map((value, i) => `${value} AS n${i + 1}`)
    .join(", ");
export function aggregateQuery(period: Period, measurementStart: string) {
  const base = baseQuery(period, measurementStart);
  const sessionFlags = `SELECT period,sid,max(event = 'view_item') AS viewed,max(event = 'add_to_cart') AS added,max(${inquiries}) AS inquiry FROM base GROUP BY period,sid`;
  const group = (
    kind: string,
    key: string,
    detail: string,
    condition: string,
    exposure = "count()",
    inquiry = productInquiries,
  ) => `SELECT '${kind}' AS kind, k AS key, d AS detail, ${numbers(["sum(exposures)", "sum(selections)", "sum(views)", "sum(adds)", "sum(inquiries)", "count()", "countIf(viewed > 0)", "countIf(viewed > 0 AND consulted > 0)"])}
 FROM (SELECT ${key} AS k, ${detail} AS d, sid, ${exposure} AS exposures,countIf(event='select_item') AS selections,countIf(event='view_item') AS views,countIf(event='add_to_cart') AS adds,countIf(${inquiry}) AS inquiries,max(event='view_item') AS viewed,max(${inquiry}) AS consulted
 FROM base WHERE period='current' AND (${condition}) GROUP BY k,d,sid) GROUP BY k,d`;
  const product = `SELECT 'product' AS kind,pid AS key,any(category) AS detail,${numbers(["sum(views)", "sum(selections)", "sum(adds)", "sum(inquiries)", "sum(impressions)", "countIf(views > 0)", "countIf(views > 0 AND adds > 0)", "countIf(views > 0 AND inquiries > 0)"])}
 FROM (SELECT pid,any(category) AS category,sid,countIf(event='view_item') AS views,countIf(event='select_item') AS selections,countIf(event='add_to_cart') AS adds,countIf(${productInquiries}) AS inquiries,countIf(event='view_item_list') AS impressions FROM base WHERE period='current' AND pid IS NOT NULL AND pid != '' GROUP BY pid,sid) GROUP BY pid ORDER BY n1 DESC LIMIT 1001`;
  const segments = [
    `SELECT 'summary' AS kind,period AS key,'' AS detail,${numbers(["uniqExact(distinct_id)", "uniqExact(sid)", "countIf(event='view_item')", "countIf(event='select_item')", "countIf(event='add_to_cart')", `countIf(${inquiries})`, "countIf(event='view_item_list')", "count()"])} FROM base GROUP BY period`,
    `SELECT 'sessions' AS kind,period AS key,'' AS detail,${numbers(["countIf(viewed > 0)", "countIf(viewed > 0 AND added > 0)", "countIf(viewed > 0 AND inquiry > 0)"])} FROM (${sessionFlags}) GROUP BY period`,
    `SELECT 'daily' AS kind,toString(toDate(toTimeZone(timestamp,'America/Lima'))) AS key,'' AS detail,${numbers(["countIf(event='view_item')", `countIf(${inquiries})`])} FROM base WHERE period='current' GROUP BY key`,
    product,
    group(
      "category",
      "category",
      "''",
      "category IS NOT NULL AND category != ''",
    ),
    group(
      "campaign",
      "if(campaign IS NOT NULL AND campaign != '',campaign,attributed)",
      "''",
      "(campaign IS NOT NULL AND campaign != '') OR (attributed IS NOT NULL AND attributed != '')",
      "countIf(event='campaign_viewed')",
      inquiries,
    ),
    group(
      "cta",
      "location",
      "''",
      "location IS NOT NULL AND location != '' AND event IN ('whatsapp_contact_click','campaign_selected','category_selected','add_to_cart')",
      "count()",
      inquiries,
    ),
    group(
      "traffic",
      "source",
      "concat(medium, ' · ', utm)",
      "source IS NOT NULL",
      "count()",
      inquiries,
    ),
    group("device", "device", "''", "device IS NOT NULL", "count()", inquiries),
    `SELECT 'search' AS kind,term AS key,'' AS detail,${numbers(["count()", "countIf(results = 0)", "uniqExact(sid)"])} FROM base WHERE period='current' AND event='search' GROUP BY term HAVING uniqExact(sid) >= 5`,
  ];
  return `WITH base AS (${base}) SELECT * FROM (${segments.map((s) => `(${s})`).join("\nUNION ALL\n")}) LIMIT 5000`;
}
export function funnelQuery(period: Period, measurementStart: string) {
  // Greedy ordered subsequence, within one real session; skipped stages are not fabricated.
  // arrayFold/arraySort are supported HogQL functions. IDs are never returned by this query.
  const stages = [
    "view_item_list",
    "select_item",
    "view_item",
    "add_to_cart",
    "whatsapp_contact_click",
  ];
  const advance = stages.reduceRight(
    (tail, name, index) =>
      `if(acc = ${index} AND step.2 = '${name}', toInt64(${index + 1}), ${tail})`,
    "acc",
  );
  return `WITH base AS (${baseQuery(period, measurementStart)}) SELECT ${stages.map((_, index) => `countIf(level >= ${index + 1}) AS step_${index + 1}`).join(", ")} FROM (SELECT sid,arrayFold((acc,step) -> ${advance},arraySort(step -> step.1,groupArray((timestamp,event))),toInt64(0)) AS level FROM base WHERE period='current' GROUP BY sid)`;
}
function count(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+(\.\d+)?$/.test(value)
        ? Number(value)
        : NaN;
  if (
    !Number.isFinite(number) ||
    number < 0 ||
    number > 1e12 ||
    !Number.isInteger(number)
  )
    throw new AnalyticsError(503, "El proveedor devolvió agregados inválidos.");
  return number;
}
export function emptyTotals(): Totals {
  return {
    visitors: 0,
    sessions: 0,
    views: 0,
    selections: 0,
    adds: 0,
    inquiries: 0,
    impressions: 0,
    events: 0,
    viewSessions: 0,
    addViewSessions: 0,
    inquiryViewSessions: 0,
  };
}
export function parseAggregates(
  rows: unknown,
  period: Period,
  measurementStart: string,
) {
  if (!Array.isArray(rows) || rows.length > 5000)
    throw new AnalyticsError(
      503,
      "El proveedor devolvió una consulta inválida.",
    );
  const current = emptyTotals(),
    previous = emptyTotals();
  const products: ProductStats[] = [],
    categories: Breakdown[] = [],
    campaigns: Breakdown[] = [],
    ctas: Breakdown[] = [],
    traffic: Breakdown[] = [],
    devices: Breakdown[] = [],
    searches: AnalyticsReport["searches"] = [];
  const days = new Map<string, { views: number; inquiries: number }>();
  for (const row of rows) {
    if (
      !Array.isArray(row) ||
      row.length !== 11 ||
      typeof row[0] !== "string" ||
      typeof row[1] !== "string" ||
      typeof row[2] !== "string"
    )
      throw new AnalyticsError(503, "Respuesta agregada inválida.");
    const [kind, key, detail] = row as [string, string, string, ...unknown[]],
      n = row.slice(3).map(count);
    if (kind === "summary" || kind === "sessions") {
      if (!["current", "previous"].includes(key))
        throw new AnalyticsError(503, "Periodo agregado inválido.");
      const target = key === "current" ? current : previous;
      if (kind === "summary")
        Object.assign(target, {
          visitors: n[0],
          sessions: n[1],
          views: n[2],
          selections: n[3],
          adds: n[4],
          inquiries: n[5],
          impressions: n[6],
          events: n[7],
        });
      else
        Object.assign(target, {
          viewSessions: n[0],
          addViewSessions: n[1],
          inquiryViewSessions: n[2],
        });
    } else if (kind === "daily")
      days.set(key, { views: n[0], inquiries: n[1] });
    else if (kind === "product")
      products.push({
        id: key,
        name: "Pieza retirada del catálogo",
        image: "/images/product-placeholder.svg",
        category: detail,
        views: n[0],
        selections: n[1],
        adds: n[2],
        inquiries: n[3],
        impressions: n[4],
        viewSessions: n[5],
        addViewSessions: n[6],
        inquiryViewSessions: n[7],
      });
    else if (kind === "search") {
      if (n[2] >= 5 && safeSearch(key) === key)
        searches.push({
          term: key,
          events: n[0],
          noResults: n[1],
          sessions: n[2],
        });
    } else {
      const destinations: Record<string, Breakdown[]> = {
        category: categories,
        campaign: campaigns,
        cta: ctas,
        traffic,
        device: devices,
      };
      if (!destinations[kind])
        throw new AnalyticsError(503, "Dimensión no permitida.");
      destinations[kind].push({
        key,
        detail,
        events: n[0],
        selections: n[1],
        views: n[2],
        adds: n[3],
        inquiries: n[4],
        sessions: n[5],
        viewSessions: n[6],
        inquiryViewSessions: n[7],
      });
    }
  }
  for (const total of [current, previous])
    if (
      total.addViewSessions > total.viewSessions ||
      total.inquiryViewSessions > total.viewSessions
    )
      throw new AnalyticsError(
        503,
        "Denominadores incompatibles en la respuesta.",
      );
  const daily = Array.from({ length: period.days }, (_, i) => {
    const date = shiftDay(period.from, i),
      observation = days.get(date);
    return {
      date,
      views: date < measurementStart ? null : observation?.views || 0,
      inquiries: date < measurementStart ? null : observation?.inquiries || 0,
    };
  });
  return {
    current: period.to < measurementStart ? null : current,
    previous:
      period.previousEnd <= measurementStart + "T05:00:00Z" ? null : previous,
    daily,
    products: products.slice(0, 1000),
    categories,
    campaigns,
    ctas,
    traffic,
    devices,
    searches,
    truncated: products.length > 1000 || rows.length >= 5000,
  };
}
export function parseFunnel(rows: unknown): number[] {
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    !Array.isArray(rows[0]) ||
    rows[0].length !== 5
  )
    throw new AnalyticsError(503, "El embudo no está disponible.");
  const steps = rows[0].map(count);
  if (steps.some((v, i) => i > 0 && v > steps[i - 1]))
    throw new AnalyticsError(503, "El embudo contiene etapas incompatibles.");
  return steps;
}

"use client";
import {
  cloneElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import Link from "next/link";
import { RefreshCw, ArrowUpRight, ChartNoAxesCombined } from "lucide-react";
import StoreImage from "@/components/StoreImage";
import { adminApi } from "@/lib/admin/client";
import {
  Empty as AdminEmpty,
  Field as AdminField,
  Loading as AdminLoading,
  Notice,
  Section,
} from "@/components/admin/AdminUI";
import ui from "@/components/admin/AdminUI.module.css";
import { Metric, TrendChart, Funnel } from "@/components/analytics/AdminCharts";
import s from "@/components/analytics/statistics.module.css";
import {
  limaDay,
  shiftDay,
  rate,
  variation,
  metricDefinitions,
  type AnalyticsReport,
  type Breakdown,
  type Device,
} from "@/lib/analytics/core";
type Tab =
  "overview" | "products" | "journey" | "channels" | "searches" | "privacy";
function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  return (
    <AdminField label={label}>
      {(id) => cloneElement(children, { id })}
    </AdminField>
  );
}
function Empty({ title, description }: { title: string; description: string }) {
  return <AdminEmpty title={title}>{description}</AdminEmpty>;
}
function Loading({ text }: { text: string }) {
  return <AdminLoading>{text}</AdminLoading>;
}
const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Resumen" },
  { id: "products", label: "Productos" },
  { id: "journey", label: "Recorrido" },
  { id: "channels", label: "Canales y dispositivos" },
  { id: "searches", label: "Búsquedas" },
  { id: "privacy", label: "Medición y privacidad" },
];
const names: Record<string, string> = {
  anillos: "Anillos",
  collares: "Collares",
  aretes: "Aretes",
  pulseras: "Pulseras",
  charms: "Charms",
  mobile: "Móvil",
  tablet: "Tablet",
  desktop: "Escritorio",
  hero: "Portada",
  footer: "Footer",
  header: "Encabezado",
  catalog: "Catálogo",
  cart: "Carrito",
  product: "Ficha",
  personalized: "Atención personalizada",
  home: "Inicio",
  exclusive: "Pieza exclusiva",
  "reference:ring": "Imaginario Killaq · anillo",
  "reference:necklace": "Imaginario Killaq · collar",
};
function displayRate(n: number, d: number) {
  const value = rate(n, d);
  return value === null ? "—" : value.toFixed(1) + " %";
}
function dateLabel(day: string) {
  return new Date(day + "T12:00:00Z").toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Lima",
  });
}
function BreakdownTable({
  rows,
  title,
  campaign = false,
}: {
  rows: Breakdown[];
  title: string;
  campaign?: boolean;
}) {
  if (!rows.length)
    return (
      <Empty
        title="Aún no hay actividad disponible"
        description="No hay agregados para esta dimensión y el periodo seleccionado."
      />
    );
  return (
    <div
      className={s.tableRegion}
      tabIndex={0}
      role="region"
      aria-label={title}
    >
      <table>
        <thead>
          <tr>
            <th>{title}</th>
            <th>{campaign ? "Exposiciones" : "Eventos"}</th>
            <th>Selecciones</th>
            <th>Vistas</th>
            <th>Añadidos</th>
            <th>Consultas</th>
            <th>Sesiones</th>
            <th>Tasa de consulta¹</th>
          </tr>
        </thead>
        <tbody>
          {[...rows]
            .sort(
              (a, b) =>
                b.inquiries - a.inquiries ||
                b.views - a.views ||
                b.events - a.events,
            )
            .map((row) => (
              <tr key={row.key + ":" + row.detail}>
                <td>
                  <strong>
                    {names[row.key] ||
                      (campaign && /^\d+$/.test(row.key)
                        ? `Campaña #${row.key}`
                        : row.key)}
                  </strong>
                  {row.detail && <small>{row.detail}</small>}
                </td>
                <td>{row.events}</td>
                <td>{row.selections}</td>
                <td>{row.views}</td>
                <td>{row.adds}</td>
                <td>{row.inquiries}</td>
                <td>{row.sessions}</td>
                <td>
                  {displayRate(row.inquiryViewSessions, row.viewSessions)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
export default function StatisticsPage() {
  const [days, setDays] = useState("30"),
    [from, setFrom] = useState(shiftDay(limaDay(), -30)),
    [to, setTo] = useState(shiftDay(limaDay(), -1)),
    [device, setDevice] = useState<Device | "all">("all");
  const [report, setReport] = useState<AnalyticsReport | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [tab, setTab] = useState<Tab>("overview"),
    [ranking, setRanking] = useState<"views" | "interest" | "sales">("views"),
    [category, setCategory] = useState(""),
    [search, setSearch] = useState("");
  const generation = useRef(0);
  async function load(params: URLSearchParams) {
    const id = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const value = await adminApi<AnalyticsReport>(
        "/api/admin/estadisticas?" + params,
      );
      if (id === generation.current) setReport(value);
    } catch (err) {
      if (id === generation.current) {
        setReport(null);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron consultar las estadísticas.",
        );
      }
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    const requests = generation;
    const timer = setTimeout(
      () => void load(new URLSearchParams({ days: "30" })),
      0,
    );
    return () => {
      clearTimeout(timer);
      requests.current++;
    };
  }, []);
  const parameters = () =>
    new URLSearchParams(
      days === "custom" ? { from, to, device } : { days, device },
    );
  const current = report?.current,
    previous = report?.previous;
  const products = useMemo(
    () =>
      [...(report?.products || [])]
        .filter(
          (p) =>
            (!category || p.category === category) &&
            p.name.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          ranking === "interest"
            ? b.inquiries - a.inquiries || b.adds - a.adds || b.views - a.views
            : b.views - a.views || b.selections - a.selections,
        ),
    [report, category, search, ranking],
  );
  const definitions = Object.entries(metricDefinitions);
  return (
    <div className={s.page}>
      <div className={ui.toolbar}>
        <div>
          <p className={ui.eyebrow}>Inteligencia comercial</p>
          <h2 className={ui.contentTitle}>
            Interés que se convierte
            <br className={s.desktopBreak} /> en conversación.
          </h2>
          <p className={ui.help}>
            Observa qué piezas atraen atención y qué recorridos generan
            consultas.
          </p>
        </div>
        <button
          className={ui.secondary}
          disabled={busy}
          onClick={() => void load(parameters())}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>
      <form
        className={s.period}
        onSubmit={(event) => {
          event.preventDefault();
          void load(parameters());
        }}
      >
        <Field label="Periodo">
          <select
            value={days}
            onChange={(event) => setDays(event.target.value)}
          >
            <option value="7">Últimos 7 días completos</option>
            <option value="30">Últimos 30 días completos</option>
            <option value="90">Últimos 90 días completos</option>
            <option value="custom">Rango personalizado</option>
          </select>
        </Field>
        {days === "custom" && (
          <>
            <Field label="Desde">
              <input
                type="date"
                required
                value={from}
                max={shiftDay(limaDay(), -1)}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
            <Field label="Hasta">
              <input
                type="date"
                required
                value={to}
                min={from}
                max={shiftDay(limaDay(), -1)}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
          </>
        )}
        <Field label="Dispositivo">
          <select
            value={device}
            onChange={(event) =>
              setDevice(event.target.value as Device | "all")
            }
          >
            <option value="all">Todos</option>
            <option value="mobile">Móvil</option>
            <option value="tablet">Tablet</option>
            <option value="desktop">Escritorio</option>
          </select>
        </Field>
        <button className={ui.primary} disabled={busy}>
          Aplicar filtros
        </button>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      {busy && <Loading text="Consultando la fuente de estadísticas…" />}
      {report && (
        <div className={s.sourceLine}>
          <span>
            {dateLabel(report.period.from)} — {dateLabel(report.period.to)} ·
            hora de Perú
          </span>
          <span>
            PostHog ·{" "}
            {report.state === "ready"
              ? "agregados consultados"
              : "sin fuente disponible"}{" "}
            ·{" "}
            {report.captureEnabled
              ? "captura autorizada"
              : "captura desactivada"}
          </span>
        </div>
      )}
      {!busy && report && report.state !== "ready" && (
        <Notice>
          <strong>La medición aún necesita configuración.</strong>
          <p>
            No se presentan visitas, ventas ni conversiones de ejemplo. Puedes
            revisar el alcance y los pendientes en «Medición y privacidad».
          </p>
          <Link href="/admin/configuracion/operativa">
            Ver configuración operativa →
          </Link>
        </Notice>
      )}
      {report?.measurementStart &&
        report.period.from < report.measurementStart &&
        report.state === "ready" && (
          <Notice>
            La cobertura comienza el {dateLabel(report.measurementStart)}. Las
            cifras representan solo la actividad recibida; los días anteriores
            no se rellenan con ceros.
          </Notice>
        )}
      <nav className={s.tabs} aria-label="Vistas de estadísticas">
        {tabs.map((item) => (
          <button
            type="button"
            key={item.id}
            className={tab === item.id ? s.activeTab : ""}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {tab === "overview" && (
        <>
          <div className={s.metrics}>
            {(
              [
                "visitors",
                "sessions",
                "views",
                "selections",
                "adds",
                "inquiries",
              ] as const
            ).map((key, index) => (
              <Metric
                key={key}
                label={
                  [
                    "Visitantes medidos",
                    "Sesiones medidas",
                    "Vistas de joyas",
                    "Selecciones de fichas",
                    "Añadidos al carrito",
                    "Consultas iniciadas",
                  ][index]
                }
                value={current?.[key] ?? null}
                definition={metricDefinitions[key]}
                change={
                  current && previous
                    ? variation(
                        current[key],
                        previous[key],
                        Boolean(report?.comparable),
                      )
                    : null
                }
              />
            ))}
          </div>
          <Section
            title="Evolución del interés"
            description="Eventos diarios. Una consulta es un clic en WhatsApp, no un mensaje enviado."
          >
            <TrendChart daily={report?.daily || []} />
          </Section>
          <div className={s.rates}>
            <article>
              <span>Selección de catálogo</span>
              <strong>
                {current
                  ? displayRate(current.selections, current.impressions)
                  : "—"}
              </strong>
              <small>Selecciones / impresiones válidas, por eventos</small>
            </article>
            <article>
              <span>Añadido en sesiones con ficha</span>
              <strong>
                {current
                  ? displayRate(current.addViewSessions, current.viewSessions)
                  : "—"}
              </strong>
              <small>Sesiones con vista y añadido / sesiones con vista</small>
            </article>
            <article>
              <span>Consulta en sesiones con ficha</span>
              <strong>
                {current
                  ? displayRate(
                      current.inquiryViewSessions,
                      current.viewSessions,
                    )
                  : "—"}
              </strong>
              <small>Sesiones con vista y consulta / sesiones con vista</small>
            </article>
          </div>
          <Notice>
            Pedidos y ventas confirmados:{" "}
            <strong>fuente transaccional no disponible.</strong> El proceso
            actual coordina por WhatsApp; estos clics no confirman pago ni
            pedido.
          </Notice>
          {report?.current?.events === 0 && (
            <Empty
              title="La fuente está conectada, todavía sin actividad"
              description="El cero corresponde a la consulta de este periodo. No hay productos ficticios ni ventas de demostración."
            />
          )}
          {report?.comparable === false && report.state === "ready" && (
            <p className={s.note}>
              Sin variación porcentual: falta cobertura comparable o actividad
              en ambos periodos. No se utiliza una base cero como crecimiento
              del 100 %.
            </p>
          )}
        </>
      )}
      {tab === "products" && (
        <Section
          title="Qué joyas despiertan interés"
          description="Nombres y fotografías actuales del catálogo; los conteos pertenecen al periodo consultado."
        >
          <div className={s.productControls}>
            <Field label="Ranking">
              <select
                value={ranking}
                onChange={(event) =>
                  setRanking(event.target.value as typeof ranking)
                }
              >
                <option value="views">Visualizaciones</option>
                <option value="interest">Interés comercial</option>
                <option value="sales">Ventas confirmadas</option>
              </select>
            </Field>
            <Field label="Categoría">
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">Todas las categorías</option>
                {[
                  ...new Set(report?.products.map((p) => p.category) || []),
                ].map((c) => (
                  <option key={c} value={c}>
                    {names[c] || c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Buscar pieza">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre de la joya"
              />
            </Field>
          </div>
          {ranking === "sales" ? (
            <Empty
              title="El ranking de ventas aún no está disponible"
              description="Se habilitará con pedidos confirmados por un backend comercial y transacciones únicas. Las consultas no se convierten en ventas."
            />
          ) : !products.length ? (
            <Empty
              title="Sin piezas medidas en esta selección"
              description="Las joyas aparecerán cuando haya actividad consentida y la fuente esté conectada."
            />
          ) : (
            <>
              <p className={s.note}>
                {ranking === "interest"
                  ? "Orden: consultas por pieza, después añadidos y visualizaciones."
                  : "Orden: vistas de ficha, después selecciones."}{" "}
                La tasa usa sesiones con consulta y vista de esa pieza /
                sesiones con vista de esa pieza.
              </p>
              <div
                className={s.tableRegion}
                tabIndex={0}
                role="region"
                aria-label="Productos por interés"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Pieza</th>
                      <th>Categoría</th>
                      <th>Vistas</th>
                      <th>Selecciones</th>
                      <th>Añadidos</th>
                      <th>Consultas</th>
                      <th>Ventas</th>
                      <th>Tasa de consulta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className={s.product}>
                            <div className={s.thumb}>
                              <StoreImage
                                src={p.image}
                                alt=""
                                fill
                                sizes="48px"
                              />
                            </div>
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td>{names[p.category] || p.category}</td>
                        <td>{p.views}</td>
                        <td>{p.selections}</td>
                        <td>{p.adds}</td>
                        <td>{p.inquiries}</td>
                        <td>
                          <span title="Fuente transaccional no disponible">
                            —
                          </span>
                        </td>
                        <td>
                          {displayRate(p.inquiryViewSessions, p.viewSessions)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {report?.truncated && (
            <Notice>
              La consulta alcanzó su límite de agregados. Reduce el periodo
              antes de interpretar un ranking como completo.
            </Notice>
          )}
        </Section>
      )}
      {tab === "journey" && (
        <>
          <Section
            title="Del descubrimiento a la consulta"
            description="Recorrido ordenado por sesión. Puede incluir distintas piezas; no presupone que todos los compradores sigan estos pasos."
          >
            <Funnel
              steps={report?.funnel.steps || []}
              error={report?.funnel.error || null}
            />
            <p className={s.note}>
              El recorrido admite eventos intermedios. Una sesión termina tras
              30 minutos sin eventos o a las 24 horas. Las entradas directas a
              fichas y los añadidos rápidos pueden saltarse etapas y quedan
              fuera de esta secuencia, aunque cuentan en el resumen.
            </p>
          </Section>
          <Notice>
            Checkout electrónico y venta confirmada: no habilitados en el flujo
            actual. WhatsApp se muestra como una consulta separada y no como{" "}
            <code>begin_checkout</code> ni <code>purchase</code>.
          </Notice>
        </>
      )}
      {tab === "channels" && (
        <>
          <Section
            title="Categorías"
            description="Actividad vinculada a clasificación de productos y selecciones de categorías."
          >
            <BreakdownTable rows={report?.categories || []} title="Categoría" />
          </Section>
          <Section
            title="Campañas de portada"
            description="Exposición geométrica y selección. Los eventos posteriores se atribuyen a la última campaña seleccionada en la misma sesión; no prueban causalidad."
          >
            <BreakdownTable
              rows={report?.campaigns || []}
              title="Campaña"
              campaign
            />
          </Section>
          <Section
            title="Puntos de contacto"
            description="Acciones en CTA: WhatsApp, selección de campañas/categorías y añadidos efectivos al carrito."
          >
            <BreakdownTable
              rows={report?.ctas || []}
              title="Ubicación del CTA"
            />
          </Section>
          <Section
            title="Procedencia y UTM"
            description="Primera procedencia observada de la sesión, con fuentes y medios permitidos. Solo campañas UTM previamente autorizadas; no se guardan URL ni referencias completas."
          >
            <BreakdownTable rows={report?.traffic || []} title="Fuente" />
          </Section>
          <Section
            title="Navegación por dispositivo"
            description="Clasificación por ancho de la ventana al medir: móvil ≤700 px, tablet 701–1100 px, escritorio >1100 px. No identifica el equipo físico."
          >
            <BreakdownTable rows={report?.devices || []} title="Dispositivo" />
          </Section>
          <p className={s.note}>
            ¹ Tasa de consulta = sesiones con vista y consulta dentro de la
            dimensión / sesiones con vista dentro de la dimensión. «—» indica
            que no existe denominador. Las consultas de categorías son por
            pieza; fuentes y dispositivos cuentan clics generales de WhatsApp.
          </p>
        </>
      )}
      {tab === "searches" && (
        <Section
          title="Qué buscan los visitantes"
          description="Conceptos canónicos de categoría, metal, piedra y ocasión. Las consultas desconocidas o con posibles datos personales se agrupan como término omitido, sin guardar el texto ni un hash."
        >
          {!report?.searches.length ? (
            <Empty
              title="Sin búsquedas agregadas publicables"
              description="Cada término o grupo necesita al menos cinco sesiones distintas. La ausencia de filas no prueba que no hubo búsquedas."
            />
          ) : (
            <div
              className={s.tableRegion}
              tabIndex={0}
              role="region"
              aria-label="Búsquedas agregadas"
            >
              <table>
                <thead>
                  <tr>
                    <th>Búsqueda protegida</th>
                    <th>Búsquedas</th>
                    <th>Sin resultados</th>
                    <th>Sesiones</th>
                    <th>Sin resultados / búsquedas</th>
                  </tr>
                </thead>
                <tbody>
                  {[...report.searches]
                    .sort((a, b) => b.events - a.events)
                    .map((row) => (
                      <tr key={row.term}>
                        <td>
                          {row.term === "termino-omitido"
                            ? "Término omitido por privacidad"
                            : row.term}
                        </td>
                        <td>{row.events}</td>
                        <td>{row.noResults}</td>
                        <td>{row.sessions}</td>
                        <td>{displayRate(row.noResults, row.events)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={s.note}>
            «Sin resultados» corresponde al catálogo cargado correctamente y a
            los filtros vigentes. No se registra como cero un fallo de la
            consulta de productos.
          </p>
        </Section>
      )}
      {tab === "privacy" && (
        <>
          <Section title="Estado real de la medición">
            <ul className={s.checklist}>
              {(report?.issues || ["No se pudo consultar el estado."]).map(
                (issue) => (
                  <li key={issue}>{issue}</li>
                ),
              )}
            </ul>
            <p className={s.note}>
              Inicio declarado:{" "}
              {report?.measurementStart
                ? dateLabel(report.measurementStart)
                : "pendiente"}
              . Agregados conservados en caché del servidor durante 60 segundos;
              cada lectura verifica sesión y rol. Se consultan hasta 90 días por
              rango y hasta 180 días al comparar.
            </p>
            <Notice>
              Las estimaciones solo incluyen visitantes que autorizan la
              medición y cuyos eventos llegan al proveedor. Se excluyen
              administración, desarrollo, pruebas y bots reconocidos; estos
              controles no detectan todo el tráfico automatizado.
            </Notice>
          </Section>
          <Section title="Qué significa cada indicador">
            <dl className={s.definitions}>
              {definitions.map(([key, value]) => (
                <div key={key}>
                  <dt>
                    {
                      (
                        {
                          visitors: "Visitantes",
                          sessions: "Sesiones",
                          views: "Vistas",
                          selections: "Selecciones",
                          adds: "Añadidos",
                          inquiries: "Consultas",
                          selectionRate: "Tasa de selección",
                          addRate: "Tasa de añadido",
                          inquiryRate: "Tasa de consulta",
                        } as Record<string, string>
                      )[key]
                    }
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Section>
          <Section title="Mapas de calor, opcionales">
            <p>
              No se cargan scripts ni grabaciones de Clarity. Su proyecto
              requiere una revisión independiente de consentimiento,
              enmascaramiento, transferencias, conservación y exclusión de áreas
              sensibles.
            </p>
            {report?.clarityUrl ? (
              <a
                className={ui.secondary}
                href={report.clarityUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir Clarity <ArrowUpRight size={16} />
              </a>
            ) : (
              <Empty
                title="Clarity no está conectado"
                description="Puedes añadir el identificador de un proyecto revisado para acceder a su panel privado. Esto no instala su seguimiento."
              />
            )}
          </Section>
          <p className={s.note}>
            <ChartNoAxesCombined size={16} /> No se duplica la captura en
            Supabase, GA4 o Vercel Web Analytics. No hay grabaciones,
            autocaptura de formularios ni identidad de cuenta enviada a PostHog.
          </p>
        </>
      )}
      {report && (
        <p className={s.timestamp}>
          Última consulta:{" "}
          {new Date(report.generatedAt).toLocaleString("es-PE", {
            timeZone: "America/Lima",
          })}{" "}
          · las consultas nuevas pueden tardar en aparecer.
        </p>
      )}
    </div>
  );
}

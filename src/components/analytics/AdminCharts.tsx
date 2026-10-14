"use client";
import { rate, type AnalyticsReport } from "@/lib/analytics/core";
import s from "./statistics.module.css";
export function Metric({
  label,
  value,
  definition,
  change,
}: {
  label: string;
  value: number | null;
  definition: string;
  change: number | null;
}) {
  return (
    <article className={s.metric}>
      <span>{label}</span>
      <strong>{value === null ? "—" : value.toLocaleString("es-PE")}</strong>
      <small>{definition}</small>
      {change !== null && (
        <span className={s.change}>
          {change > 0 ? "+" : ""}
          {change.toFixed(1)} % <small>vs. periodo anterior</small>
        </span>
      )}
    </article>
  );
}
export function TrendChart({ daily }: { daily: AnalyticsReport["daily"] }) {
  if (!daily.length)
    return (
      <div className={s.empty}>
        Conecta la fuente para observar la evolución diaria. No se muestran
        series de ejemplo.
      </div>
    );
  if (daily.every((point) => point.views === null && point.inquiries === null))
    return (
      <div className={s.empty}>
        No hay cobertura medida en este periodo. La ausencia de medición no se
        muestra como cero.
      </div>
    );
  const max = Math.max(
      1,
      ...daily.flatMap((p) => [p.views || 0, p.inquiries || 0]),
    ),
    x = (i: number) =>
      daily.length <= 1 ? 400 : 20 + (i * 760) / (daily.length - 1),
    y = (n: number) => 210 - (n / max) * 190;
  const path = (key: "views" | "inquiries") => {
    let drawing = "",
      start = true;
    for (let i = 0; i < daily.length; i++) {
      const value = daily[i][key];
      if (value === null) {
        start = true;
        continue;
      }
      drawing += `${start ? "M" : "L"}${x(i)},${y(value)} `;
      start = false;
    }
    return drawing;
  };
  const label = (day: string) =>
    new Date(day + "T12:00:00Z").toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      timeZone: "America/Lima",
    });
  return (
    <>
      <div className={s.legend}>
        <span>
          <i className={s.views} />
          Vistas de fichas
        </span>
        <span>
          <i className={s.inquiries} />
          Consultas por WhatsApp
        </span>
      </div>
      <div className={s.chartArea}>
        <div className={s.yAxis}>
          <span>{max.toLocaleString("es-PE")}</span>
          <span>{Math.round(max / 2).toLocaleString("es-PE")}</span>
          <span>0</span>
        </div>
        <svg
          className={s.chart}
          viewBox="0 0 800 230"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Evolución de vistas y consultas desde ${daily[0].date} hasta ${daily.at(-1)!.date}. Datos exactos en la tabla diaria.`}
        >
          <line x1="20" y1="20" x2="780" y2="20" stroke="#e5ddd0" />
          <line x1="20" y1="115" x2="780" y2="115" stroke="#e5ddd0" />
          <line x1="20" y1="210" x2="780" y2="210" stroke="#d2c6b4" />
          <path
            d={path("views")}
            fill="none"
            stroke="#466674"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path("inquiries")}
            fill="none"
            stroke="#955438"
            strokeWidth="2.5"
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
          {(["views", "inquiries"] as const).flatMap((key) =>
            daily.map((point, index) => {
              const value = point[key],
                isolated =
                  (index === 0 || daily[index - 1][key] === null) &&
                  (index === daily.length - 1 ||
                    daily[index + 1][key] === null);
              return value !== null && isolated ? (
                <circle
                  key={key + point.date}
                  cx={x(index)}
                  cy={y(value)}
                  r="4"
                  fill={key === "views" ? "#466674" : "#955438"}
                  stroke={key === "views" ? "#466674" : "#955438"}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                >
                  <title>
                    {point.date}: {value}{" "}
                    {key === "views" ? "vistas" : "consultas"}
                  </title>
                </circle>
              ) : null;
            }),
          )}
        </svg>
      </div>
      <div className={s.xAxis}>
        <span>{label(daily[0].date)}</span>
        <span>{label(daily[Math.floor(daily.length / 2)].date)}</span>
        <span>{label(daily.at(-1)!.date)}</span>
      </div>
      <details className={s.details}>
        <summary>Ver datos diarios</summary>
        <div
          className={s.tableRegion}
          tabIndex={0}
          role="region"
          aria-label="Datos diarios"
        >
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vistas</th>
                <th>Consultas</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((p) => (
                <tr key={p.date}>
                  <td>{label(p.date)}</td>
                  <td>{p.views === null ? "Sin cobertura" : p.views}</td>
                  <td>
                    {p.inquiries === null ? "Sin cobertura" : p.inquiries}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
export function Funnel({
  steps,
  error,
}: {
  steps: number[];
  error: string | null;
}) {
  const labels = [
    "Exposición en catálogo",
    "Selección de producto",
    "Vista de ficha",
    "Añadido al carrito",
    "Consulta por WhatsApp",
  ];
  if (!steps.length)
    return (
      <div className={s.empty}>
        {error ||
          "El recorrido ordenado estará disponible cuando haya una fuente de eventos conectada."}
      </div>
    );
  return (
    <ol className={s.funnel}>
      {labels.map((label, i) => (
        <li key={label}>
          <div>
            <span>
              {String(i + 1).padStart(2, "0")} · {label}
            </span>
            <strong>{steps[i].toLocaleString("es-PE")} sesiones</strong>
          </div>
          <div className={s.bar}>
            <span style={{ width: `${rate(steps[i], steps[0]) || 0}%` }} />
          </div>
          <small>
            {i === 0
              ? "Base del recorrido"
              : steps[i - 1] > 0
                ? `${(rate(steps[i], steps[i - 1]) || 0).toFixed(1)} % de la etapa anterior`
                : "Sin base para calcular tasa"}
          </small>
        </li>
      ))}
    </ol>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Images,
  Video,
  BookOpen,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { adminApi } from "@/lib/admin/client";
import {
  Loading,
  Notice,
  Section,
  adminStyles as s,
} from "@/components/admin/AdminUI";
type Metric = { value: number | null; error: string | null };
type Dashboard = {
  published: Metric;
  drafts: Metric;
  soldOut: Metric;
  lowStock: Metric;
  complaints: Metric;
  noImage: Metric;
  collections: Metric;
  withImage: Metric;
  withInventory: Metric;
  associated: Metric;
  recent:
    | { id: string; name: string; is_active: boolean; updated_at: string }[]
    | null;
  deadlines: { id: number; due_date: string }[] | null;
  checkedAt: string;
  today: string;
};
export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      setData(await adminApi<Dashboard>("/api/admin/dashboard"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <div className={s.toolbar}>
        <div>
          <p className={s.eyebrow}>Centro de operaciones</p>
          <h2 className={s.contentTitle}>Cada detalle, bajo control.</h2>
          <p className={s.help}>
            Catálogo, contenido y atención al consumidor en un solo lugar.
          </p>
        </div>
        <button className={s.secondary} onClick={load} disabled={busy}>
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!data && busy && <Loading />}
      <div className={s.actions}>
        <Link className={s.primary} href="/admin/productos?nuevo=1">
          <Plus size={16} />
          Añadir producto
        </Link>
        <Link className={s.secondary} href="/admin/carrusel">
          <Images size={16} />
          Campañas
        </Link>
        <Link className={s.secondary} href="/admin/videos?nuevo=1">
          <Video size={16} />
          Añadir video
        </Link>
        <Link className={s.secondary} href="/admin/reclamaciones">
          <BookOpen size={16} />
          Reclamaciones
        </Link>
        <Link className={s.secondary} href="/">
          <ArrowUpRight size={16} />
          Ver tienda
        </Link>
      </div>
      <div className={s.metricGrid}>
        {[
          ["Publicados", "published", "Piezas visibles en tienda"],
          ["Borradores", "drafts", "Piezas todavía ocultas"],
          ["Agotados", "soldOut", "Publicados sin unidades"],
          [
            "Reclamos pendientes",
            "complaints",
            "Reclamos y quejas sin respuesta",
          ],
        ].map(([label, key, help]) => {
          const metric = data?.[key as keyof Dashboard] as Metric | undefined;
          return (
            <div className={s.metric} key={key}>
              <p>{label}</p>
              <strong>{metric?.value ?? "—"}</strong>
              <small>
                {metric?.error || (!data ? "Pendiente de consulta" : help)}
              </small>
            </div>
          );
        })}
      </div>
      {data?.published.value === 0 && (
        <section className={s.onboarding}>
          <p className={s.eyebrow}>El siguiente paso</p>
          <h2>Prepara tu primera colección.</h2>
          <p className={s.help}>
            Empieza con una pieza real. Guardarla como borrador te permite
            completar los detalles antes de publicarla.
          </p>
          <div className={s.steps}>
            {[
              [
                "01",
                "Carga una pieza",
                "/admin/productos?nuevo=1",
                data.drafts.value !== null && data.drafts.value > 0,
              ],
              [
                "02",
                "Añade su fotografía",
                "/admin/productos",
                data.withImage?.value !== null &&
                  (data.withImage?.value || 0) > 0,
              ],
              [
                "03",
                "Confirma precio y stock",
                "/admin/productos",
                data.withInventory?.value !== null &&
                  (data.withInventory?.value || 0) > 0,
              ],
              [
                "04",
                "Asocia una colección",
                "/admin/colecciones",
                data.associated?.value !== null &&
                  (data.associated?.value || 0) > 0,
              ],
              ["05", "Revisa y publica", "/admin/productos", false],
            ].map(([n, label, url, done]) => (
              <Link key={String(n)} href={String(url)}>
                <span>
                  {n} · {done ? "Hay registros" : "Por preparar"}
                </span>
                {label}
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className={s.split}>
        <Section title="Atención requerida">
          <ul className={s.list}>
            <li>
              <div>
                Productos sin fotografía
                <small>
                  {data?.noImage.error ||
                    "Completa una imagen real antes de publicar."}
                </small>
              </div>
              <Link href="/admin/productos?stock=noimage">
                {data?.noImage.value ?? "—"} · Revisar
              </Link>
            </li>
            <li>
              <div>
                Stock bajo
                <small>Entre 1 y 3 unidades en piezas publicadas.</small>
              </div>
              <Link href="/admin/productos?stock=low">
                {data?.lowStock.value ?? "—"} · Revisar
              </Link>
            </li>
            <li>
              <div>
                Productos agotados
                <small>
                  Revisa disponibilidad y comunicaciones comerciales.
                </small>
              </div>
              <Link href="/admin/productos?stock=empty">
                {data?.soldOut.value ?? "—"} · Revisar
              </Link>
            </li>
            <li>
              <div>
                Libro y documentos legales
                <small>
                  Identificación, migraciones, correo y avisos requieren
                  verificación.
                </small>
              </div>
              <Link href="/admin/configuracion/legal">Ver estado</Link>
            </li>
          </ul>
          {data?.deadlines === null && (
            <Notice>
              Los vencimientos no están disponibles. Revisa la migración 006.
            </Notice>
          )}
          {data?.deadlines?.map((row) => (
            <p
              key={row.id}
              className={row.due_date < data.today ? s.overdue : s.help}
            >
              <Link href="/admin/reclamaciones">Hoja {row.id}</Link> · límite{" "}
              {row.due_date}
              {row.due_date < data.today ? " · vencida" : ""}
            </p>
          ))}
        </Section>
        <Section
          title="Actividad del catálogo"
          description="Últimas modificaciones registradas en Supabase. No incluye un historial editorial completo."
        >
          {data?.recent?.length ? (
            <ul className={s.list}>
              {data.recent.map((p) => (
                <li key={p.id}>
                  <div>
                    <Link href="/admin/productos">{p.name}</Link>
                    <small>
                      {p.is_active ? "Publicado" : "Borrador"} · última
                      modificación
                    </small>
                  </div>
                  <time className={s.help}>
                    {new Date(p.updated_at).toLocaleDateString("es-PE", {
                      timeZone: "America/Lima",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.help}>
              {data?.recent === null
                ? "No se pudo consultar la actividad."
                : "Aún no hay actividad de productos para mostrar."}
            </p>
          )}
          <Notice>
            Ventas y pedidos: sin una fuente operativa validada. Las consultas
            por WhatsApp todavía no constituyen un sistema de cobro o gestión de
            pedidos.
          </Notice>
        </Section>
      </div>
      {data && (
        <p className={s.statusLine}>
          Datos consultados:{" "}
          {new Date(data.checkedAt).toLocaleString("es-PE", {
            timeZone: "America/Lima",
          })}
          . {busy ? "Actualizando…" : ""}
        </p>
      )}
    </>
  );
}

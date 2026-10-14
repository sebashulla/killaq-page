"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Play,
  Image as ImageIcon,
} from "lucide-react";
import Link from "next/link";
import Image from "@/components/StoreImage";
import VideoFrame from "@/components/VideoFrame";
import { slugify } from "@/utils/format";
import { resolveHeroBackground } from "@/utils/storefront";
import { adminApi, verifyPreviewImage } from "@/lib/admin/client";
import { validateResource, videoUrl } from "@/lib/admin/validation";
import {
  Empty,
  Field,
  Loading,
  Notice,
  Status,
  Section,
  useDirtyGuard,
  adminStyles as s,
} from "./AdminUI";
type Resource = "campanas" | "videos" | "colecciones";
type Form = Record<string, string | number | boolean>;
type Row = Form & { id: number };
const defaults: Record<Resource, Form> = {
  campanas: {
    title: "",
    subtitle: "",
    cta_text: "Ver catálogo",
    cta_url: "/colecciones",
    image_url: "",
    image_alt: "",
    jewelry_tone: "gold",
    background_style: "auto",
    image_fit: "contain",
    sort_order: 0,
    is_active: false,
  },
  videos: {
    title: "",
    platform: "instagram",
    video_url: "",
    thumbnail_url: "",
    sort_order: 0,
    is_active: false,
  },
  colecciones: {
    name: "",
    slug: "",
    description: "",
    image_url: "",
    sort_order: 0,
    is_active: true,
  },
};
const labels: Record<
  Resource,
  { singular: string; empty: string; help: string }
> = {
  campanas: {
    singular: "campaña",
    empty: "Tu portada empieza con una campaña.",
    help: "Gestiona imágenes, mensajes, fondos y el orden de aparición en la pasarela.",
  },
  videos: {
    singular: "video",
    empty: "Muestra el detalle en movimiento.",
    help: "Gestiona publicaciones y reels de Instagram, videos de TikTok y archivos directos. La portada muestra tres activos por red, según su orden: 0 aparece primero. Reemplaza la selección cuando publiques novedades; la actualización automática requiere conectar las API oficiales.",
  },
  colecciones: {
    singular: "colección",
    empty: "Una historia para tus piezas.",
    help: "Crea colecciones reales y asígnalas desde Productos. Una colección inactiva no puede habilitar una pieza exclusiva.",
  },
};
export default function ContentManager({ resource }: { resource: Resource }) {
  const [rows, setRows] = useState<Row[]>([]),
    [total, setTotal] = useState<number | null>(null),
    [page, setPage] = useState(0),
    [q, setQ] = useState(""),
    [active, setActive] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [editor, setEditor] = useState(false),
    [editing, setEditing] = useState<Row | null>(null),
    [form, setForm] = useState<Form>(defaults[resource]),
    [initial, setInitial] = useState(JSON.stringify(defaults[resource])),
    [busy, setBusy] = useState(false),
    [fields, setFields] = useState<Record<string, string>>({}),
    [mobilePreview, setMobilePreview] = useState(false),
    [videoPreview, setVideoPreview] = useState(false);
  const generation = useRef(0);
  const dirty = editor && initial !== JSON.stringify(form);
  useDirtyGuard(dirty);
  const label = labels[resource];
  const load = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    try {
      const result = await adminApi<{ rows: Row[]; total: number }>(
        "/api/admin/catalogo/" +
          resource +
          "?" +
          new URLSearchParams({ page: String(page), q, active }),
      );
      if (version !== generation.current) return;
      setRows(result.rows);
      setTotal(result.total);
      setError("");
    } catch (e) {
      if (version === generation.current) {
        setError((e as Error).message);
        setTotal(null);
      }
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [resource, page, q, active]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("nuevo"))
        setEditor(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  function open(row?: Row) {
    const next = row
      ? Object.fromEntries(
          Object.keys(defaults[resource]).map((key) => [
            key,
            row[key] ?? defaults[resource][key],
          ]),
        )
      : defaults[resource];
    setForm(next);
    setInitial(JSON.stringify(next));
    setEditing(row || null);
    setEditor(true);
    setError("");
    setFields({});
    setVideoPreview(false);
    window.scrollTo({ top: 0 });
  }
  function change(key: string, value: string | number | boolean) {
    setForm({ ...form, [key]: value });
    setFields({ ...fields, [key]: "" });
    setVideoPreview(false);
  }
  function close() {
    if (busy) return;
    if (dirty && !confirm("¿Descartar los cambios sin guardar?")) return;
    setEditor(false);
    setError("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setFields({});
    try {
      validateResource(resource, form);
      setBusy(true);
      if (resource === "campanas" && form.is_active)
        await verifyPreviewImage(String(form.image_url));
      await adminApi("/api/admin/catalogo/" + resource, {
        id: editing?.id || null,
        data: form,
      });
      setEditor(false);
      setNotice("Cambios guardados correctamente.");
      await load();
    } catch (e) {
      setError((e as Error).message);
      setFields(
        (e as Error & { fields?: Record<string, string> }).fields || {},
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: Row) {
    if (
      !confirm(
        `¿Eliminar «${row.title || row.name}»? ${resource === "colecciones" ? "Las piezas asociadas conservarán sus datos y quedarán sin esta colección." : "La eliminación no se puede deshacer."}`,
      )
    )
      return;
    setBusy(true);
    try {
      await adminApi(
        "/api/admin/catalogo/" + resource,
        { id: row.id },
        "DELETE",
      );
      setNotice("Registro eliminado.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reorder(index: number, direction: number) {
    setBusy(true);
    try {
      const expected = rows.map((r) => r.id),
        ids = [...expected];
      [ids[index], ids[index + direction]] = [
        ids[index + direction],
        ids[index],
      ];
      await adminApi("/api/admin/campanas/orden", { ids, expected });
      setNotice("Orden de campañas guardado.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const field = (
    key: string,
    title: string,
    help?: string,
    multiline = false,
  ) => (
    <Field label={title} help={help} error={fields[key]}>
      {(id) =>
        multiline ? (
          <textarea
            id={id}
            value={String(form[key] ?? "")}
            maxLength={
              key === "description" ? 1500 : key === "subtitle" ? 500 : 150
            }
            aria-invalid={Boolean(fields[key])}
            onChange={(e) => change(key, e.target.value)}
          />
        ) : (
          <input
            id={id}
            value={String(form[key] ?? "")}
            type={key === "sort_order" ? "number" : "text"}
            min={key === "sort_order" ? 0 : undefined}
            step={key === "sort_order" ? 1 : undefined}
            aria-invalid={Boolean(fields[key])}
            onChange={(e) => {
              change(
                key,
                key === "sort_order" ? Number(e.target.value) : e.target.value,
              );
              if (key === "name" && !editing)
                setForm((old) => ({
                  ...old,
                  name: e.target.value,
                  slug: slugify(e.target.value),
                }));
            }}
          />
        )
      }
    </Field>
  );
  const select = (key: string, title: string, options: [string, string][]) => (
    <Field label={title}>
      {(id) => (
        <select
          id={id}
          value={String(form[key])}
          onChange={(e) => change(key, e.target.value)}
        >
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
  const image = String(form.image_url || form.thumbnail_url || "");
  const background =
    resource === "campanas"
      ? resolveHeroBackground(
          form.background_style as "auto" | "black" | "gold" | "white",
          form.jewelry_tone as "gold" | "silver",
        )
      : "black";
  if (editor)
    return (
      <div className={s.editor}>
        <div className={s.toolbar}>
          <div>
            <p className={s.eyebrow}>Edición de contenido</p>
            <h2 className={s.contentTitle}>
              {editing ? "Editar" : "Añadir"} {label.singular}
            </h2>
          </div>
          <button className={s.secondary} onClick={close} disabled={busy}>
            <ArrowLeft size={16} />
            Volver
          </button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <form onSubmit={save}>
          <div className={s.editorColumns}>
            <div>
              <Section title="Información principal">
                {resource === "colecciones" ? (
                  <>
                    <div className={s.grid}>
                      {field("name", "Nombre")}
                      {field("slug", "Dirección URL")}
                    </div>
                    {field("description", "Descripción", undefined, true)}
                  </>
                ) : (
                  <>
                    {field(
                      "title",
                      "Título",
                      undefined,
                      resource === "campanas",
                    )}
                    {resource === "campanas" &&
                      field("subtitle", "Descripción", undefined, true)}
                  </>
                )}
              </Section>
              <Section
                title={
                  resource === "videos"
                    ? "Video y portada"
                    : "Imagen y presentación"
                }
              >
                {resource === "videos" ? (
                  <>
                    {select("platform", "Proveedor", [
                      ["instagram", "Instagram"],
                      ["tiktok", "TikTok"],
                      ["external", "Archivo HTTPS directo"],
                    ])}
                    {field(
                      "video_url",
                      "URL del video",
                      "Reel/publicación de Instagram, video de TikTok o archivo MP4/WebM/MOV. No se admiten iframes arbitrarios.",
                    )}
                    {field("thumbnail_url", "Imagen previa · opcional")}
                    <button
                      type="button"
                      className={s.secondary}
                      onClick={() => {
                        try {
                          videoUrl(form.video_url, form.platform);
                          setVideoPreview(true);
                          setError("");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Play size={16} />
                      Previsualizar video
                    </button>
                  </>
                ) : (
                  <>
                    {field(
                      "image_url",
                      "URL de imagen",
                      "HTTPS o archivo de /images/.",
                    )}
                    {resource === "campanas" && (
                      <>
                        {field("image_alt", "Descripción accesible")}
                        <div className={s.grid}>
                          {select("jewelry_tone", "Color de la joya", [
                            ["gold", "Dorada"],
                            ["silver", "Plateada"],
                          ])}
                          {select("background_style", "Fondo", [
                            ["auto", "Automático"],
                            ["black", "Negro"],
                            ["gold", "Dorado"],
                            ["white", "Blanco cálido"],
                          ])}
                        </div>
                        {select("image_fit", "Encuadre", [
                          ["contain", "Pieza completa"],
                          ["cover", "Cubrir el área"],
                        ])}
                        <p className={s.help}>
                          El fondo incorporado en una fotografía se conserva.
                          Usa una imagen transparente para mostrar el fondo
                          seleccionado.
                        </p>
                      </>
                    )}
                  </>
                )}
              </Section>
              {resource === "campanas" && (
                <Section title="Acción de la campaña">
                  <div className={s.grid}>
                    {field("cta_text", "Texto del botón")}
                    {field(
                      "cta_url",
                      "Destino del botón",
                      "Enlace interno de la tienda, por ejemplo /colecciones.",
                    )}
                  </div>
                </Section>
              )}
              <Section title="Orden y visibilidad">
                <div className={s.grid}>
                  {field("sort_order", "Orden de aparición")}
                  <Field label="Estado de publicación">
                    {(id) => (
                      <select
                        id={id}
                        value={form.is_active ? "true" : "false"}
                        onChange={(e) =>
                          change("is_active", e.target.value === "true")
                        }
                      >
                        <option value="false">Oculto</option>
                        <option value="true">
                          {resource === "colecciones"
                            ? "Colección activa"
                            : "Publicado"}
                        </option>
                      </select>
                    )}
                  </Field>
                </div>
              </Section>
            </div>
            <aside className={s.preview}>
              <p className={s.eyebrow}>Vista previa contextual</p>
              {resource === "campanas" && (
                <div className={s.tabs}>
                  <button
                    type="button"
                    className={s.secondary}
                    aria-pressed={!mobilePreview}
                    onClick={() => setMobilePreview(false)}
                  >
                    Escritorio
                  </button>
                  <button
                    type="button"
                    className={s.secondary}
                    aria-pressed={mobilePreview}
                    onClick={() => setMobilePreview(true)}
                  >
                    Móvil
                  </button>
                </div>
              )}
              <div
                style={{
                  maxWidth: mobilePreview ? 230 : undefined,
                  margin: "auto",
                }}
              >
                {videoPreview ? (
                  <VideoFrame
                    video={{
                      title: String(form.title),
                      video_url: String(form.video_url),
                      platform: form.platform as
                        "instagram" | "tiktok" | "external",
                      thumbnail_url: String(form.thumbnail_url || ""),
                    }}
                  />
                ) : (
                  <div
                    className={s.previewImage}
                    style={{
                      background:
                        background === "gold"
                          ? "#c4a05a"
                          : background === "white"
                            ? "#f5f0e7"
                            : "#111",
                      borderRadius: resource === "campanas" ? "45% 45% 0 0" : 0,
                    }}
                  >
                    {image && (
                      <Image
                        src={image}
                        alt={String(
                          form.image_alt ||
                            form.title ||
                            form.name ||
                            "Vista previa",
                        )}
                        fill
                        sizes="400px"
                        style={{
                          objectFit:
                            form.image_fit === "cover" ? "cover" : "contain",
                        }}
                      />
                    )}
                  </div>
                )}
                <h3>
                  {String(form.title || form.name || "Título de tu contenido")}
                </h3>
                <p>{String(form.subtitle || form.description || label.help)}</p>
                <Status active={Boolean(form.is_active)}>
                  {form.is_active
                    ? "Publicado al guardar"
                    : "Oculto al guardar"}
                </Status>
                <p className={s.noMotion}>
                  Vista previa de encuadre y contenido; no replica la pasarela
                  completa ni modifica la tienda.
                </p>
              </div>
            </aside>
          </div>
          <div className={s.saveBar}>
            <span>
              {dirty
                ? "Cambios sin guardar"
                : "El contenido se publica solo al guardar su estado activo."}
            </span>
            <div className={s.actions}>
              <button
                type="button"
                className={s.secondary}
                onClick={close}
                disabled={busy}
              >
                Cancelar
              </button>
              <button type="submit" className={s.primary} disabled={busy}>
                {busy ? "Guardando…" : "Guardar " + label.singular}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  const canReorder =
    resource === "campanas" &&
    page === 0 &&
    !q &&
    !active &&
    total === rows.length;
  return (
    <>
      <div className={s.toolbar}>
        <p className={s.help}>{label.help}</p>
        <button className={s.primary} onClick={() => open()}>
          <Plus size={16} />
          Añadir {label.singular}
        </button>
      </div>
      {resource === "campanas" && (
        <p className={s.statusLine}>
          La primera campaña activa se muestra al entrar.{" "}
          <Link href="/admin/experiencia">
            Configurar rotación y animaciones →
          </Link>
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      <div className={s.grid}>
        <Field label="Buscar">
          {(id) => (
            <input
              id={id}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar por título o nombre"
            />
          )}
        </Field>
        <Field label="Visibilidad">
          {(id) => (
            <select
              id={id}
              value={active}
              onChange={(e) => {
                setActive(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos los estados</option>
              <option value="true">Activos</option>
              <option value="false">Ocultos</option>
            </select>
          )}
        </Field>
      </div>
      {loading ? (
        <Loading />
      ) : total !== null && !rows.length ? (
        <Empty
          title={q || active ? "No hay coincidencias" : label.empty}
          action={
            <button className={s.primary} onClick={() => open()}>
              Añadir {label.singular}
            </button>
          }
        >
          {q || active ? "Ajusta la búsqueda o los filtros." : label.help}
        </Empty>
      ) : (
        <div className={s.cards}>
          {rows.map((row, index) => (
            <article className={s.card} key={row.id}>
              <div
                className={s.cardImage}
                style={
                  resource === "campanas"
                    ? {
                        background:
                          resolveHeroBackground(
                            row.background_style as never,
                            row.jewelry_tone as never,
                          ) === "gold"
                            ? "#c4a05a"
                            : resolveHeroBackground(
                                  row.background_style as never,
                                  row.jewelry_tone as never,
                                ) === "white"
                              ? "#f5f0e7"
                              : "#111",
                      }
                    : undefined
                }
              >
                {row.image_url || row.thumbnail_url ? (
                  <Image
                    src={String(row.image_url || row.thumbnail_url)}
                    alt={String(row.image_alt || row.title || row.name)}
                    fill
                    sizes="500px"
                    style={{
                      objectFit:
                        row.image_fit === "cover" ? "cover" : "contain",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: "grid",
                      placeItems: "center",
                      height: "100%",
                      color: "#d7b96e",
                    }}
                  >
                    {resource === "videos" ? (
                      <Play size={38} aria-label="Sin imagen previa" />
                    ) : (
                      <ImageIcon size={38} aria-label="Sin imagen" />
                    )}
                  </div>
                )}
              </div>
              <div className={s.cardBody}>
                <div className={s.toolbar} style={{ marginBottom: 8 }}>
                  <span className={s.eyebrow}>
                    Orden {String(row.sort_order)}
                  </span>
                  <Status active={Boolean(row.is_active)}>
                    {row.is_active ? "Activo" : "Oculto"}
                  </Status>
                </div>
                <h2 style={{ whiteSpace: "pre-line" }}>
                  {String(row.title || row.name)}
                </h2>
                <p>
                  {String(
                    row.subtitle ||
                      row.description ||
                      (resource === "videos"
                        ? row.platform
                        : "Sin descripción"),
                  )}
                </p>
              </div>
              <div className={s.cardFooter}>
                <div className={s.actions}>
                  <button className={s.secondary} onClick={() => open(row)}>
                    Editar
                  </button>
                  <button
                    className={s.danger}
                    onClick={() => remove(row)}
                    disabled={busy}
                  >
                    Eliminar
                  </button>
                </div>
                {resource === "campanas" && (
                  <div className={s.actions}>
                    <button
                      className={s.iconButton}
                      disabled={!canReorder || index === 0 || busy}
                      onClick={() => reorder(index, -1)}
                      aria-label={`Subir campaña ${row.title}`}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className={s.iconButton}
                      disabled={
                        !canReorder || index === rows.length - 1 || busy
                      }
                      onClick={() => reorder(index, 1)}
                      aria-label={`Bajar campaña ${row.title}`}
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {resource === "campanas" && !canReorder && rows.length > 0 && (
        <p className={s.statusLine}>
          Para mover con flechas, muestra todas las campañas sin filtros (hasta
          20). Puedes editar el orden numérico de cada campaña cuando haya más.
        </p>
      )}
      {total !== null && total > 0 && (
        <div className={s.pagination}>
          <span>
            {total} registros · página {page + 1}
          </span>
          <div className={s.actions}>
            <button
              className={s.secondary}
              disabled={page === 0 || loading}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <button
              className={s.secondary}
              disabled={(page + 1) * 20 >= total || loading}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </>
  );
}

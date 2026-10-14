"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, ArrowLeft, Search } from "lucide-react";
import Image from "@/components/StoreImage";
import { supabase } from "@/utils/supabaseClient";
import { slugify } from "@/utils/format";
import { adminApi, verifyPreviewImage } from "@/lib/admin/client";
import { validateProduct } from "@/lib/admin/validation";
import {
  Field,
  Section,
  Notice,
  Empty,
  Loading,
  Status,
  useDirtyGuard,
  adminStyles as s,
} from "@/components/admin/AdminUI";
import type { ProductImage, ProductVideo } from "@/types/catalog";
type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_price: number | null;
  stock: number;
  sku: string | null;
  category_id: number | null;
  subcategory_id: number | null;
  collection_id: number | null;
  material_id: number | null;
  sizes_available: string[] | null;
  is_featured: boolean;
  is_active: boolean;
  updated_at: string;
  categories: { name: string } | null;
  collections: { name: string } | null;
  product_images: ProductImage[];
  product_videos: ProductVideo[];
};
type Meta = {
  categories: { id: number; name: string }[];
  materials: { id: number; name: string }[];
  subcategories: { id: number; name: string; category_id: number }[];
  collections: { id: number; name: string; is_active: boolean }[];
};
const blank = {
  name: "",
  slug: "",
  description: "",
  price: 0,
  compare_price: null as number | null,
  stock: 0,
  sku: "",
  category_id: null as number | null,
  subcategory_id: null as number | null,
  collection_id: null as number | null,
  material_id: null as number | null,
  sizes_available: "",
  is_featured: false,
  is_active: false,
  primary_image: "",
  image_alt: "",
  video_type: "upload",
  video_url: "",
  video_title: "",
  video_poster: "",
};
export default function Products() {
  const [rows, setRows] = useState<Product[]>([]),
    [total, setTotal] = useState<number | null>(null),
    [page, setPage] = useState(0),
    [q, setQ] = useState(""),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(""),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState("updated"),
    [stock, setStock] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null),
    [error, setError] = useState(""),
    [warning, setWarning] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [editor, setEditor] = useState(false),
    [editing, setEditing] = useState<Product | null>(null),
    [form, setForm] = useState(blank),
    [initial, setInitial] = useState(JSON.stringify(blank)),
    [fields, setFields] = useState<Record<string, string>>({}),
    [videoFile, setVideoFile] = useState<File | null>(null);
  const generation = useRef(0);
  const dirty = editor && (JSON.stringify(form) !== initial || !!videoFile);
  useDirtyGuard(dirty);
  const load = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    try {
      const result = await adminApi<{
        rows: Product[];
        total: number;
        videoError: string;
      }>(
        "/api/admin/catalogo/productos?" +
          new URLSearchParams({
            page: String(page),
            q: query,
            active,
            category,
            sort,
            stock,
          }),
      );
      if (version !== generation.current) return;
      setRows(result.rows);
      setTotal(result.total);
      setWarning(result.videoError);
      setError("");
    } catch (e) {
      if (version === generation.current) {
        setError((e as Error).message);
        setTotal(null);
      }
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [page, query, active, category, sort, stock]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    let valid = true;
    adminApi<Meta>("/api/admin/settings")
      .then((data) => {
        if (valid) setMeta(data);
      })
      .catch((e) => {
        if (valid) setWarning("Clasificación no disponible: " + e.message);
      });
    const p = new URLSearchParams(window.location.search);
    const timer = setTimeout(() => {
      if (p.get("nuevo")) setEditor(true);
      setStock(p.get("stock") || "");
    }, 0);
    return () => {
      valid = false;
      clearTimeout(timer);
    };
  }, []);
  function change<K extends keyof typeof blank>(
    key: K,
    value: (typeof blank)[K],
  ) {
    setForm((old) => ({ ...old, [key]: value }));
    setFields((old) => ({ ...old, [key]: "" }));
    setNotice("");
  }
  function open(product?: Product) {
    const image = product?.product_images
        ?.slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0],
      video = product?.product_videos
        ?.slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0];
    const next = product
      ? {
          ...blank,
          ...product,
          description: product.description || "",
          sku: product.sku || "",
          price: Number(product.price),
          compare_price:
            product.compare_price === null
              ? null
              : Number(product.compare_price),
          sizes_available: product.sizes_available?.join(", ") || "",
          primary_image: image?.url || "",
          image_alt: image?.alt_text || "",
          video_type: video?.video_type || "upload",
          video_url: video?.url || "",
          video_title: video?.title || "",
          video_poster: video?.poster_url || "",
        }
      : blank;
    setForm(next);
    setInitial(JSON.stringify(next));
    setEditing(product || null);
    setEditor(true);
    setVideoFile(null);
    setError("");
    setFields({});
    window.scrollTo({ top: 0 });
  }
  function close() {
    if (saving) return;
    if (dirty && !confirm("¿Descartar los cambios sin guardar de esta pieza?"))
      return;
    setEditor(false);
    setVideoFile(null);
    setError("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setFields({});
    let uploadedPath = "";
    try {
      validateProduct({ ...form, ...(videoFile ? { video_url: "" } : {}) });
      if (
        videoFile &&
        (!["video/mp4", "video/webm", "video/quicktime"].includes(
          videoFile.type,
        ) ||
          videoFile.size > 100 * 1024 * 1024)
      )
        throw new Error("Usa MP4, WebM o MOV de hasta 100 MB.");
      setSaving(true);
      if (form.is_active) await verifyPreviewImage(form.primary_image);
      let payload = { ...form };
      if (videoFile) {
        uploadedPath = `products/${editing?.id || crypto.randomUUID()}/${crypto.randomUUID()}-${videoFile.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
        const result = await supabase.storage
          .from("product-videos")
          .upload(uploadedPath, videoFile, { upsert: false });
        if (result.error)
          throw new Error(
            "No se pudo subir el archivo. Verifica la migración 001 y el bucket.",
          );
        const { data } = supabase.storage
          .from("product-videos")
          .getPublicUrl(uploadedPath);
        payload = {
          ...payload,
          video_url: data.publicUrl,
          video_type: "upload",
        };
      }
      await adminApi("/api/admin/catalogo/productos", {
        id: editing?.id || null,
        expected: editing?.updated_at || null,
        data: payload,
      });
      setEditor(false);
      setVideoFile(null);
      setNotice("Pieza y archivos guardados correctamente.");
      await load();
    } catch (e) {
      setError((e as Error).message);
      setFields(
        (e as Error & { fields?: Record<string, string> }).fields || {},
      );
      if (uploadedPath) {
        const cleanup = await supabase.storage
          .from("product-videos")
          .remove([uploadedPath]);
        if (cleanup.error)
          setError(
            (e as Error).message +
              " El video subido quedó pendiente de limpieza en el bucket.",
          );
      }
    } finally {
      setSaving(false);
    }
  }
  async function remove(product: Product) {
    if (
      !confirm(
        `¿Eliminar «${product.name}» y sus referencias multimedia? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setSaving(true);
    try {
      await adminApi(
        "/api/admin/catalogo/productos",
        { id: product.id },
        "DELETE",
      );
      setNotice("Producto eliminado.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const input = (
    key: keyof typeof blank,
    label: string,
    type = "text",
    help?: string,
  ) => (
    <Field label={label} help={help} error={fields[key]}>
      {(id) => (
        <input
          id={id}
          type={type}
          value={String(form[key] ?? "")}
          aria-invalid={Boolean(fields[key])}
          onChange={(e) =>
            change(
              key,
              (type === "number"
                ? e.target.value === "" && key === "compare_price"
                  ? null
                  : Number(e.target.value)
                : e.target.value) as never,
            )
          }
          step={key === "stock" ? 1 : type === "number" ? ".01" : undefined}
          min={type === "number" ? 0 : undefined}
        />
      )}
    </Field>
  );
  if (editor)
    return (
      <div className={s.editor}>
        <div className={s.toolbar}>
          <div>
            <p className={s.eyebrow}>
              {editing ? "Edición de catálogo" : "Nueva joya"}
            </p>
            <h2 className={s.contentTitle}>
              {editing?.name || "Da forma a tu próxima pieza."}
            </h2>
          </div>
          <button className={s.secondary} onClick={close} disabled={saving}>
            <ArrowLeft size={16} />
            Volver al catálogo
          </button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {warning && <Notice>{warning}</Notice>}
        <form onSubmit={save}>
          <div className={s.editorColumns}>
            <div>
              <Section title="01 · Información general">
                <div className={s.grid}>
                  <Field label="Nombre de la pieza" error={fields.name}>
                    {(id) => (
                      <input
                        id={id}
                        value={form.name}
                        maxLength={150}
                        aria-invalid={Boolean(fields.name)}
                        onChange={(e) => {
                          change("name", e.target.value);
                          if (!editing) change("slug", slugify(e.target.value));
                        }}
                      />
                    )}
                  </Field>
                  {input("slug", "Dirección URL")}
                </div>
                <Field
                  label="Descripción de la pieza"
                  help="Confirma composición, pureza, piedras, acabado, medidas y cuidados. No publiques garantías o certificaciones sin respaldo."
                  error={fields.description}
                >
                  {(id) => (
                    <textarea
                      id={id}
                      value={form.description}
                      maxLength={6000}
                      rows={5}
                      onChange={(e) => change("description", e.target.value)}
                    />
                  )}
                </Field>
              </Section>
              <Section title="02 · Precio y datos comerciales">
                <div className={s.grid}>
                  {input("price", "Precio (S/)", "number")}
                  {input(
                    "compare_price",
                    "Precio anterior (S/)",
                    "number",
                    "Opcional. Debe superar al precio actual y corresponder a una promoción real.",
                  )}
                </div>
              </Section>
              <Section title="03 · Material, características e inventario">
                <div className={s.grid}>
                  <Field label="Material confirmado" error={fields.material_id}>
                    {(id) => (
                      <select
                        id={id}
                        value={form.material_id || ""}
                        onChange={(e) =>
                          change(
                            "material_id",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">Selecciona un material</option>
                        {meta?.materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  {input(
                    "sizes_available",
                    "Tallas disponibles",
                    "text",
                    "Separa las tallas por comas. Deja vacío si no aplica.",
                  )}
                  {input("stock", "Unidades disponibles", "number")}
                  {input(
                    "sku",
                    "SKU",
                    "text",
                    "Código interno único, opcional.",
                  )}
                </div>
              </Section>
              <Section
                title="04 · Fotografías y multimedia"
                description="Edita la imagen principal. Las fotografías secundarias existentes se conservan sin reordenarlas."
              >
                {input(
                  "primary_image",
                  "URL de imagen principal",
                  "text",
                  "HTTPS o archivo de /images/. Usa la fotografía del producto vendido.",
                )}
                {input("image_alt", "Descripción accesible de la imagen")}
                <details>
                  <summary className={s.secondary}>
                    Video de la pieza · opcional
                  </summary>
                  <div style={{ marginTop: 16 }}>
                    <div className={s.grid}>
                      <Field label="Proveedor de video">
                        {(id) => (
                          <select
                            id={id}
                            value={form.video_type}
                            onChange={(e) =>
                              change("video_type", e.target.value)
                            }
                          >
                            <option value="upload">Archivo subido</option>
                            <option value="instagram">Instagram</option>
                            <option value="tiktok">TikTok</option>
                            <option value="external">
                              Archivo HTTPS externo
                            </option>
                          </select>
                        )}
                      </Field>
                      {input("video_title", "Título del video")}
                    </div>
                    {form.video_type === "upload" && (
                      <Field
                        label="Subir archivo"
                        help="MP4, WebM o MOV · máximo 100 MB. Requiere el bucket del SQL 001."
                      >
                        {(id) => (
                          <input
                            id={id}
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime"
                            onChange={(e) =>
                              setVideoFile(e.target.files?.[0] || null)
                            }
                          />
                        )}
                      </Field>
                    )}
                    {input(
                      "video_url",
                      "Enlace del video",
                      "text",
                      "Solo proveedores implementados o archivos directos. No se admiten páginas arbitrarias como iframe.",
                    )}
                    {input("video_poster", "Imagen previa del video")}
                  </div>
                </details>
              </Section>
              <Section title="05 · Colecciones y clasificación">
                <div className={s.grid}>
                  <Field label="Categoría">
                    {(id) => (
                      <select
                        id={id}
                        value={form.category_id || ""}
                        onChange={(e) => {
                          change(
                            "category_id",
                            e.target.value ? Number(e.target.value) : null,
                          );
                          change("subcategory_id", null);
                        }}
                      >
                        <option value="">Sin categoría</option>
                        {meta?.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label="Subcategoría">
                    {(id) => (
                      <select
                        id={id}
                        disabled={!form.category_id}
                        value={form.subcategory_id || ""}
                        onChange={(e) =>
                          change(
                            "subcategory_id",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">Sin subcategoría</option>
                        {meta?.subcategories
                          .filter((c) => c.category_id === form.category_id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </Field>
                  <Field label="Colección">
                    {(id) => (
                      <select
                        id={id}
                        value={form.collection_id || ""}
                        onChange={(e) =>
                          change(
                            "collection_id",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">Sin colección</option>
                        {meta?.collections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {!c.is_active ? " · inactiva" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
              </Section>
            </div>
            <aside className={s.preview}>
              <p className={s.eyebrow}>Vista previa de catálogo</p>
              <div className={s.previewImage}>
                {form.primary_image && (
                  <Image
                    src={form.primary_image}
                    alt={form.image_alt || "Vista previa"}
                    fill
                    sizes="400px"
                  />
                )}
              </div>
              <h3>{form.name || "Nombre de la pieza"}</h3>
              <p>
                S/ {Number(form.price).toFixed(2)} · {form.stock} unidades
              </p>
              <p>
                {form.description ||
                  "Completa la información confirmada de esta joya."}
              </p>
              <Section title="06 · Publicación">
                <Field label="Visibilidad" error={fields.is_active}>
                  {(id) => (
                    <select
                      id={id}
                      value={form.is_active ? "true" : "false"}
                      onChange={(e) =>
                        change("is_active", e.target.value === "true")
                      }
                    >
                      <option value="false">Borrador · oculto</option>
                      <option value="true">Publicado en tienda</option>
                    </select>
                  )}
                </Field>
                <label className={s.check}>
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) => change("is_featured", e.target.checked)}
                  />
                  Destacar en inicio
                </label>
                <p className={s.help}>
                  Publicar requiere precio, descripción, material, imagen y
                  texto accesible válidos.
                </p>
              </Section>
            </aside>
          </div>
          <div className={s.saveBar}>
            <span>
              {dirty
                ? "Cambios sin guardar"
                : "Revisa la pieza antes de guardar."}
            </span>
            <div className={s.actions}>
              <button
                className={s.secondary}
                type="button"
                onClick={close}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className={s.primary}
                type="submit"
                disabled={saving || !meta}
              >
                {saving ? "Guardando…" : "Guardar producto"}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  return (
    <>
      <div className={s.toolbar}>
        <p className={s.help}>
          Piezas reales, información precisa y publicación bajo tu control.
        </p>
        <button className={s.primary} onClick={() => open()}>
          <Plus size={16} />
          Añadir producto
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      {warning && <Notice>{warning}</Notice>}
      <div className={s.filters}>
        <Field label="Buscar por nombre">
          {(id) => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(q);
                setPage(0);
              }}
              className={s.actions}
            >
              <input
                id={id}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Busca una joya"
                style={{ flex: 1, width: 0 }}
              />
              <button className={s.iconButton} aria-label="Buscar productos">
                <Search size={16} />
              </button>
            </form>
          )}
        </Field>
        <Field label="Publicación">
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
              <option value="true">Publicados</option>
              <option value="false">Borradores</option>
            </select>
          )}
        </Field>
        <Field label="Categoría">
          {(id) => (
            <select
              id={id}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Todas</option>
              {meta?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Ordenar">
          {(id) => (
            <select
              id={id}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(0);
              }}
            >
              <option value="updated">Última actualización</option>
              <option value="name">Nombre A–Z</option>
              <option value="price">Precio ascendente</option>
            </select>
          )}
        </Field>
      </div>
      {stock && (
        <div className={s.toolbar}>
          <p className={s.help}>
            Filtro de atención:{" "}
            {stock === "empty"
              ? "Agotados"
              : stock === "low"
                ? "Stock bajo"
                : "Sin fotografía"}
          </p>
          <button
            className={s.secondary}
            onClick={() => {
              setStock("");
              setPage(0);
            }}
          >
            Quitar filtro
          </button>
        </div>
      )}
      {loading ? (
        <Loading />
      ) : total !== null && rows.length === 0 ? (
        <Empty
          title={
            query || active || category || stock
              ? "No hay coincidencias"
              : "Añade tu primera joya."
          }
          action={
            <button className={s.primary} onClick={() => open()}>
              Añadir mi primera joya
            </button>
          }
        >
          {query || active || category || stock
            ? "Prueba con otro nombre o ajusta los filtros."
            : "Carga sus datos y fotografías, confirma precio y stock, y guárdala como borrador hasta que esté lista."}
        </Empty>
      ) : rows.length > 0 ? (
        <>
          <div
            className={s.tableWrap}
            role="region"
            aria-label="Catálogo de productos"
            tabIndex={0}
          >
            <table className={s.table}>
              <thead>
                <tr>
                  {[
                    "Pieza",
                    "Colección",
                    "Categoría",
                    "Precio",
                    "Stock",
                    "Estado",
                    "Actualización",
                    "Acciones",
                  ].map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className={s.nameCell}>
                        <div className={s.thumb}>
                          {p.product_images?.[0] && (
                            <Image
                              src={p.product_images[0].url}
                              alt={p.name}
                              fill
                              sizes="60px"
                            />
                          )}
                        </div>
                        <div>
                          <strong>{p.name}</strong>
                          <small>{p.sku || "Sin SKU"}</small>
                        </div>
                      </div>
                    </td>
                    <td>{p.collections?.name || "Sin colección"}</td>
                    <td>{p.categories?.name || "Sin categoría"}</td>
                    <td>S/ {Number(p.price).toFixed(2)}</td>
                    <td>
                      {p.stock}
                      <small>
                        {p.stock === 0
                          ? "Agotado"
                          : p.stock <= 3
                            ? "Stock bajo"
                            : ""}
                      </small>
                    </td>
                    <td>
                      <Status active={p.is_active}>
                        {p.is_active ? "Publicado" : "Borrador"}
                      </Status>
                    </td>
                    <td>
                      {p.updated_at
                        ? new Date(p.updated_at).toLocaleDateString("es-PE", {
                            timeZone: "America/Lima",
                          })
                        : "No disponible"}
                    </td>
                    <td>
                      <div className={s.actions}>
                        <button className={s.secondary} onClick={() => open(p)}>
                          Editar
                        </button>
                        <button
                          className={s.danger}
                          disabled={saving}
                          onClick={() => remove(p)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={s.pagination}>
            <span>
              {total ?? "—"} piezas · página {page + 1}
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
                disabled={total === null || (page + 1) * 20 >= total || loading}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

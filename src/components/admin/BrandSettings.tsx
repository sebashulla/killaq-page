"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "@/components/StoreImage";
import { adminApi } from "@/lib/admin/client";
import {
  normalizeStorefrontSettings,
  defaultStorefrontSettings,
  canShowExclusive,
  type StorefrontSettings,
} from "@/utils/storefront";
import { imageUrl } from "@/lib/admin/validation";
import { useStorefrontSettings } from "@/context/StorefrontContext";
import { getPrimaryImage, normalizeProducts } from "@/data/catalog";
import type { Product } from "@/types/catalog";
import {
  Section,
  Field,
  Notice,
  Empty,
  Loading,
  ActionLink,
  Status,
  useDirtyGuard,
  adminStyles as s,
} from "./AdminUI";
type SettingsResult = {
  settings: { value: unknown; updated_at: string } | null;
};
export default function BrandSettings({
  exclusive = false,
}: {
  exclusive?: boolean;
}) {
  const [form, setForm] = useState<StorefrontSettings>(
      defaultStorefrontSettings,
    ),
    [initial, setInitial] = useState(""),
    [expected, setExpected] = useState<string | null>(null),
    [loaded, setLoaded] = useState(false),
    [products, setProducts] = useState<Product[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false);
  const { reload } = useStorefrontSettings();
  useDirtyGuard(loaded && initial !== JSON.stringify(form));
  const load = useCallback(async () => {
    try {
      const result = await adminApi<SettingsResult>("/api/admin/settings");
      const next = normalizeStorefrontSettings(result.settings?.value);
      setForm(next);
      setInitial(JSON.stringify(next));
      setExpected(result.settings?.updated_at || null);
      if (exclusive) {
        const all: Product[] = [];
        let page = 0,
          total = 0;
        do {
          const result = await adminApi<{ rows: Product[]; total: number }>(
            "/api/admin/catalogo/productos?active=true&page=" + page,
          );
          all.push(...normalizeProducts(result.rows));
          total = result.total;
          page++;
        } while (all.length < total && page < 100);
        if (all.length < total)
          setNotice(
            "Se cargaron las primeras 2000 piezas publicadas. Revisa el catálogo antes de elegir una pieza fuera de esta lista.",
          );
        setProducts(
          all.filter(
            (p) =>
              p.collections?.is_active === true &&
              p.product_images?.some((i) => {
                try {
                  return !!imageUrl(i.url);
                } catch {
                  return false;
                }
              }),
          ),
        );
      }
      setLoaded(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [exclusive]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  function update<K extends keyof StorefrontSettings>(
    key: K,
    value: StorefrontSettings[K],
  ) {
    setForm({ ...form, [key]: value });
    setNotice("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const keys = exclusive
        ? [
            "exclusive_enabled",
            "exclusive_product_id",
            "exclusive_title",
            "exclusive_description",
          ]
        : [
            "welcome_enabled",
            "artisan_enabled",
            "hero_autoplay",
            "hero_interval",
            "personalized_title",
            "personalized_description",
            "whatsapp_number",
          ];
      const data = Object.fromEntries(
        keys.map((k) => [k, form[k as keyof StorefrontSettings]]),
      );
      await adminApi("/api/admin/settings", {
        section: exclusive ? "exclusivo" : "experiencia",
        expected,
        data,
      });
      await reload();
      await load();
      setNotice("Configuración guardada. La tienda utilizará estos cambios.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const selected =
    products.find((p) => p.id === form.exclusive_product_id) || null;
  const visible = canShowExclusive(form, selected);
  return (
    <div className={s.editor}>
      <div className={s.toolbar}>
        <p className={s.help}>
          {exclusive
            ? "Destaca una pieza real de una colección activa. La regla de elegibilidad se verifica también en la base."
            : "Edita textos y movimiento sin alterar las campañas ni la dirección visual de la tienda."}
        </p>
        <ActionLink href={exclusive ? "/" : "/atencion-personalizada"}>
          Ver página
        </ActionLink>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      {!loaded && !error && <Loading />}
      {loaded && (
        <form onSubmit={save}>
          <div className={s.editorColumns}>
            <div>
              {exclusive ? (
                <>
                  <Section title="01 · Pieza y visibilidad">
                    <label className={s.check}>
                      <input
                        type="checkbox"
                        checked={form.exclusive_enabled}
                        disabled={!products.length && !form.exclusive_enabled}
                        onChange={(e) =>
                          update("exclusive_enabled", e.target.checked)
                        }
                      />
                      Mostrar apartado exclusivo en inicio
                    </label>
                    {!products.length && (
                      <Empty
                        title="Primero prepara una pieza de colección."
                        action={
                          <div className={s.actions}>
                            <ActionLink href="/admin/productos">
                              Ir a Productos
                            </ActionLink>
                            <ActionLink href="/admin/colecciones">
                              Gestionar colecciones
                            </ActionLink>
                          </div>
                        }
                      >
                        Publica una joya con una imagen válida y asígnala a una
                        colección activa. El apartado permanecerá oculto hasta
                        cumplir estas condiciones.
                      </Empty>
                    )}
                    <Field label="Modelo exclusivo">
                      {(id) => (
                        <select
                          id={id}
                          value={form.exclusive_product_id}
                          onChange={(e) =>
                            update("exclusive_product_id", e.target.value)
                          }
                        >
                          <option value="">Selecciona una pieza válida</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {p.collections?.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                    <div className={s.cards}>
                      {products.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          className={`${s.card} ${p.id === form.exclusive_product_id ? s.selected : ""}`}
                          aria-pressed={p.id === form.exclusive_product_id}
                          onClick={() => update("exclusive_product_id", p.id)}
                        >
                          <div className={s.cardImage}>
                            <Image
                              src={getPrimaryImage(p)}
                              alt={p.name}
                              fill
                              sizes="300px"
                            />
                          </div>
                          <div className={s.cardBody}>
                            <h2>{p.name}</h2>
                            <p>
                              {p.collections?.name} · S/{" "}
                              {Number(p.price).toFixed(2)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                    {form.exclusive_product_id && !selected && (
                      <Notice>
                        La pieza guardada ya no cumple las condiciones. El
                        apartado permanece oculto. Elige otra pieza o
                        desactívalo.
                      </Notice>
                    )}
                  </Section>
                  <Section title="02 · Contenido del apartado">
                    <Field label="Título del apartado">
                      {(id) => (
                        <input
                          id={id}
                          maxLength={100}
                          value={form.exclusive_title}
                          onChange={(e) =>
                            update("exclusive_title", e.target.value)
                          }
                        />
                      )}
                    </Field>
                    <Field label="Descripción del apartado">
                      {(id) => (
                        <textarea
                          id={id}
                          maxLength={500}
                          value={form.exclusive_description}
                          onChange={(e) =>
                            update("exclusive_description", e.target.value)
                          }
                        />
                      )}
                    </Field>
                  </Section>
                </>
              ) : (
                <>
                  <Section title="01 · Movimiento y portada">
                    <label className={s.check}>
                      <input
                        type="checkbox"
                        checked={form.welcome_enabled}
                        onChange={(e) =>
                          update("welcome_enabled", e.target.checked)
                        }
                      />
                      Bienvenida de KILLAQ al entrar
                    </label>
                    <label className={s.check}>
                      <input
                        type="checkbox"
                        checked={form.artisan_enabled}
                        onChange={(e) =>
                          update("artisan_enabled", e.target.checked)
                        }
                      />
                      Animación del proceso artesanal
                    </label>
                    <label className={s.check}>
                      <input
                        type="checkbox"
                        checked={form.hero_autoplay}
                        onChange={(e) =>
                          update("hero_autoplay", e.target.checked)
                        }
                      />
                      Rotación automática de campañas
                    </label>
                    <div className={s.grid}>
                      <Field
                        label="Intervalo de rotación (segundos)"
                        help="Entre 6 y 20 segundos. Con rotación desactivada, el visitante puede avanzar manualmente."
                      >
                        {(id) => (
                          <input
                            id={id}
                            type="number"
                            min={6}
                            max={20}
                            value={form.hero_interval}
                            onChange={(e) =>
                              update("hero_interval", Number(e.target.value))
                            }
                          />
                        )}
                      </Field>
                    </div>
                    <p className={s.help}>
                      Se respetan las preferencias de movimiento reducido: sin
                      bienvenida automática ni rotación, y con la pieza
                      artesanal terminada.
                    </p>
                    <ActionLink href="/admin/carrusel">
                      Gestionar campañas
                    </ActionLink>
                  </Section>
                  <Section title="02 · Atención personalizada">
                    <Field
                      label="Título de la página"
                      help="Un salto de línea divide la composición editorial."
                    >
                      {(id) => (
                        <textarea
                          id={id}
                          maxLength={100}
                          value={form.personalized_title}
                          onChange={(e) =>
                            update("personalized_title", e.target.value)
                          }
                        />
                      )}
                    </Field>
                    <Field label="Descripción">
                      {(id) => (
                        <textarea
                          id={id}
                          maxLength={500}
                          value={form.personalized_description}
                          onChange={(e) =>
                            update("personalized_description", e.target.value)
                          }
                        />
                      )}
                    </Field>
                    <Field
                      label="WhatsApp de consultas personalizadas"
                      help="Código de país y número, sin + ni espacios. Este teléfono corresponde a esta página de consultas."
                    >
                      {(id) => (
                        <input
                          id={id}
                          type="tel"
                          value={form.whatsapp_number}
                          onChange={(e) =>
                            update("whatsapp_number", e.target.value)
                          }
                        />
                      )}
                    </Field>
                  </Section>
                </>
              )}
            </div>
            <aside className={s.preview}>
              <p className={s.eyebrow}>Vista previa contextual</p>
              <div className={s.previewImage}>
                {exclusive && selected ? (
                  <Image
                    src={getPrimaryImage(selected)}
                    alt={selected.name}
                    fill
                    sizes="400px"
                  />
                ) : (
                  <Image
                    src="/images/killaq-ring-v2.png"
                    alt="Referencia de campaña; no representa un producto del catálogo"
                    fill
                    sizes="400px"
                  />
                )}
              </div>
              <h3>
                {exclusive ? form.exclusive_title : form.personalized_title}
              </h3>
              <p>
                {exclusive
                  ? form.exclusive_description
                  : form.personalized_description}
              </p>
              {exclusive ? (
                <>
                  <Status active={visible}>
                    {visible ? "Elegible para mostrarse" : "Apartado oculto"}
                  </Status>
                  <p>{selected?.name || "Selecciona una pieza elegible."}</p>
                </>
              ) : (
                <>
                  <p>
                    Rotación:{" "}
                    {form.hero_autoplay
                      ? `cada ${form.hero_interval} segundos`
                      : "desactivada"}
                  </p>
                  <p>
                    Bienvenida:{" "}
                    {form.welcome_enabled ? "habilitada" : "desactivada"} ·
                    Taller: {form.artisan_enabled ? "animado" : "estático"}
                  </p>
                </>
              )}
              <p className={s.noMotion}>
                La vista previa no escribe en la tienda. Los cambios se aplican
                al guardar.
              </p>
            </aside>
          </div>
          <div className={s.saveBar}>
            <span>
              {initial !== JSON.stringify(form)
                ? "Cambios sin guardar"
                : "Configuración actual cargada."}
            </span>
            <div className={s.actions}>
              <button
                type="button"
                className={s.secondary}
                disabled={saving}
                onClick={() => {
                  if (
                    initial !== JSON.stringify(form) &&
                    !confirm("¿Descartar los cambios?")
                  )
                    return;
                  setForm(JSON.parse(initial));
                  setError("");
                }}
              >
                Descartar
              </button>
              <button className={s.primary} type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar configuración"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

"use client";

import Image from "@/components/StoreImage";
import { safeLink } from "@/utils/links";
import { resolveHeroBackground, type JewelryTone, type HeroBackground } from "@/utils/storefront";
import type { HeroSlide } from "@/types/catalog";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import styles from "../crud.module.css";

interface Slide extends HeroSlide {
  sort_order: number;
  is_active: boolean;
}

const emptySlide: Omit<Slide, "id"> = {
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
  is_active: true,
};

export default function CarruselAdmin() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [form, setForm] = useState(emptySlide);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [schemaReady, setSchemaReady] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const fetchSlides = async () => {
    const { data, error: loadError } = await supabase
      .from("hero_slides")
      .select("*")
      .order("sort_order", { ascending: true });
    setSlides((data || []) as Slide[]);
    if (loadError) setError("No se pudieron cargar las campañas. Verifica tu conexión y permisos.");
    const { error: schemaError } = await supabase.from("hero_slides").select("background_style").limit(1);
    setSchemaReady(!schemaError);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchSlides();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!showModal) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const controls = () => Array.from(modalRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, select, textarea, a[href]") || []);
    controls()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modalRef.current?.getAttribute("aria-busy") !== "true") setShowModal(false);
      if (event.key === "Tab") {
        const elements = controls(); const first = elements[0]; const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => { window.removeEventListener("keydown", keyboard); previousFocus?.focus({ preventScroll: true }); };
  }, [showModal]);

  const openCreate = () => {
    setError("");
    setEditingSlide(null);
    setForm(emptySlide);
    setShowModal(true);
  };

  const openEdit = (slide: Slide) => {
    setError("");
    setEditingSlide(slide);
    setForm({
      title: slide.title,
      subtitle: slide.subtitle || "",
      cta_text: slide.cta_text,
      cta_url: slide.cta_url,
      image_url: slide.image_url,
      image_alt: slide.image_alt || "",
      jewelry_tone: slide.jewelry_tone || "gold",
      background_style: slide.background_style || "auto",
      image_fit: slide.image_fit || "cover",
      sort_order: slide.sort_order,
      is_active: slide.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setError("");
    if (!form.title.trim() || !form.image_url.trim() || !form.cta_text.trim() || safeLink(form.cta_url, "") === "") { setError("Completa el título, imagen y botón. El enlace debe comenzar con / o https://."); return; }
    setSaving(true);
    try {
      const { error: saveError } = editingSlide
        ? await supabase.from("hero_slides").update(form).eq("id", editingSlide.id)
        : await supabase.from("hero_slides").insert(form);
      if (saveError) { setError("No se pudo guardar la campaña. Revisa tus permisos y el SQL 004, e inténtalo nuevamente."); return; }
      setShowModal(false); await fetchSlides();
    } catch { setError("No se pudo conectar con Supabase. Inténtalo nuevamente."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Seguro que quieres eliminar este slide?")) return;
    const { error: deleteError } = await supabase.from("hero_slides").delete().eq("id", id);
    if (deleteError) { setError("No se pudo eliminar la campaña."); return; }
    fetchSlides();
  };

  return (
    <>
      {error && !showModal && <p role="alert" className={styles.formError}>{error}</p>}
      <div className={styles.toolbar}>
        <p className={styles.helperText}>
          Gestiona imágenes, mensajes y fondos de portada. Oro sobre negro y plata sobre dorado con el fondo automático.
        </p>
        <button className={styles.addButton} onClick={openCreate} type="button">
          Nuevo slide
        </button>
      </div>
      {!schemaReady && <p className={styles.formError} role="status">Para guardar los nuevos fondos ejecuta el archivo 004_brand_and_storefront.sql en Supabase.</p>}
      <p className={styles.helperText}>La primera campaña activa aparece al entrar. <Link href="/admin/experiencia" className={styles.inlineHint}>Configurar rotación y animaciones →</Link></p>

      {slides.length === 0 ? (
        <div className={styles.emptyState}>No hay slides configurados. Añade el primero.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Título</th>
                <th>Subtítulo</th>
                <th>Orden</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {slides.map((slide) => (
                <tr key={slide.id}>
                  <td>
                    {slide.image_url ? (
                      <div className={styles.thumbnailBox}>
                        <Image src={slide.image_url} alt={slide.title} fill className={styles.thumbnailImage} sizes="60px" />
                      </div>
                    ) : (
                      <span className={styles.muted}>Sin imagen</span>
                    )}
                  </td>
                  <td>{slide.title}</td>
                  <td>{slide.subtitle || "Sin subtítulo"}</td>
                  <td>{slide.sort_order}</td>
                  <td>
                    <span className={slide.is_active ? styles.badgeActive : styles.badgeInactive}>
                      {slide.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionGroup}>
                      <button className={styles.editBtn} onClick={() => openEdit(slide)} type="button">
                        Editar
                      </button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(slide.id)} type="button">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => { if (!saving) setShowModal(false); }}>
          <div ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-busy={saving} aria-labelledby="campaign-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="campaign-title" className={styles.modalTitle}>{editingSlide ? "Editar campaña" : "Nueva campaña"}</h2>
            {error && <p role="alert" className={styles.formError}>{error}</p>}

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="slide-title">Título</label>
              <textarea id="slide-title"
                className={styles.formTextarea} maxLength={150}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Ej: Colección Matrimonio"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="slide-subtitle">Subtítulo</label>
              <textarea id="slide-subtitle"
                className={styles.formTextarea} maxLength={500}
                value={form.subtitle || ""}
                onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
                placeholder="Mensaje corto para el hero"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="slide-image">URL de imagen</label>
              <input id="slide-image"
                className={styles.formInput}
                value={form.image_url}
                onChange={(event) => setForm({ ...form, image_url: event.target.value })}
                placeholder="https://res.cloudinary.com/... o /images/hero-bg.png"
              />
            </div>
            <div className={styles.formGroup}><label className={styles.formLabel} htmlFor="image-alt">Descripción accesible de imagen</label><input id="image-alt" className={styles.formInput} value={form.image_alt || ""} onChange={event => setForm({ ...form, image_alt: event.target.value })} placeholder="Ej: anillo de oro amarillo con gema redonda" /></div>
            <div className={styles.formRow}><div className={styles.formGroup}><label className={styles.formLabel} htmlFor="jewelry-tone">Color de la joya</label><select id="jewelry-tone" className={styles.formSelect} value={form.jewelry_tone} onChange={event => setForm({ ...form, jewelry_tone: event.target.value as JewelryTone })}><option value="gold">Dorada</option><option value="silver">Plateada</option></select></div><div className={styles.formGroup}><label className={styles.formLabel} htmlFor="hero-background">Fondo</label><select id="hero-background" className={styles.formSelect} value={form.background_style} onChange={event => setForm({ ...form, background_style: event.target.value as HeroBackground })}><option value="auto">Automático según la joya</option><option value="black">Negro</option><option value="gold">Dorado</option><option value="white">Blanco cálido</option></select></div></div>
            <div className={styles.formGroup}><label className={styles.formLabel} htmlFor="image-fit">Presentación de imagen</label><select id="image-fit" className={styles.formSelect} value={form.image_fit} onChange={event => setForm({ ...form, image_fit: event.target.value as "contain" | "cover" })}><option value="contain">Pieza completa · PNG transparente recomendado</option><option value="cover">Fotografía que cubre el área</option></select><small className={styles.helperText}>Una imagen con fondo incorporado conservará ese fondo. Usa un PNG transparente para aplicar el negro o dorado detrás de la joya.</small></div>
            {form.image_url && <div className={`${styles.campaignPreview} ${styles[`preview${resolveHeroBackground(form.background_style, form.jewelry_tone)}`]}`}><Image src={form.image_url} alt={form.image_alt || "Vista previa de campaña"} fill sizes="500px" style={{ objectFit: form.image_fit || "contain" }} /><span>Vista previa del fondo y encuadre</span></div>}

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="slide-cta-text">Texto del botón</label>
                <input id="slide-cta-text"
                  className={styles.formInput}
                  value={form.cta_text}
                  onChange={(event) => setForm({ ...form, cta_text: event.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="slide-cta-url">URL del botón</label>
                <input id="slide-cta-url"
                  className={styles.formInput}
                  value={form.cta_url}
                  onChange={(event) => setForm({ ...form, cta_url: event.target.value })}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="slide-order">Orden</label>
                <input id="slide-order"
                  className={styles.formInput}
                  type="number"
                  value={form.sort_order}
                  onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) || 0 })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="slide-active">Estado</label>
                <select id="slide-active"
                  className={styles.formSelect}
                  value={form.is_active ? "true" : "false"}
                  onChange={(event) => setForm({ ...form, is_active: event.target.value === "true" })}
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} disabled={saving} onClick={() => setShowModal(false)} type="button">
                Cancelar
              </button>
              <button className={styles.saveBtn} disabled={!schemaReady || saving || !form.title || !form.image_url} onClick={handleSave} type="button">
                {saving ? "Guardando..." : "Guardar slide"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

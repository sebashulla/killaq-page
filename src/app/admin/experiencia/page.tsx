"use client";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { defaultStorefrontSettings, normalizeStorefrontSettings } from "@/utils/storefront";
import { useStorefrontSettings } from "@/context/StorefrontContext";
import styles from "../crud.module.css";

export default function ExperienceAdmin() {
  const { settings, loaded, reload } = useStorefrontSettings();
  const [draft, setDraft] = useState<typeof settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const form = draft ?? settings;
  const set = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => { setDraft({ ...form, [key]: value }); setMessage(""); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    if (!/^\d{8,15}$/.test(form.whatsapp_number)) { setError("Escribe el teléfono con código de país, sin + ni espacios. Ejemplo: 51912964356."); return; }
    if (!form.personalized_title.trim() || !form.personalized_description.trim()) { setError("Completa el título y la descripción."); return; }
    if (!Number.isFinite(form.hero_interval) || form.hero_interval < 6 || form.hero_interval > 20) { setError("El intervalo debe estar entre 6 y 20 segundos."); return; }
    setSaving(true);
    try {
      const {data:previous,error:readError} = await supabase.from("site_settings").select("value").eq("key","storefront").maybeSingle();
      if (readError) { setError("No se pudo cargar la configuración actual. Vuelve a intentarlo."); return; }
      const clean = normalizeStorefrontSettings({...normalizeStorefrontSettings(previous?.value),welcome_enabled:form.welcome_enabled,artisan_enabled:form.artisan_enabled,hero_autoplay:form.hero_autoplay,hero_interval:form.hero_interval,personalized_title:form.personalized_title,personalized_description:form.personalized_description,whatsapp_number:form.whatsapp_number});
      const { data: { user } } = await supabase.auth.getUser();
      const { error: saveError } = await supabase.from("site_settings").upsert({ key: "storefront", value: clean, description: "Bienvenida, portada y atención personalizada de Killaq", updated_by: user?.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (saveError) { setError("No se pudo guardar. Verifica tu acceso de administrador y que hayas ejecutado 004_brand_and_storefront.sql."); return; }
      await reload(); setDraft(null); setMessage("Configuración guardada. La tienda utilizará estos cambios.");
    } catch { setError("No se pudo conectar con Supabase. Inténtalo nuevamente."); }
    finally { setSaving(false); }
  };
  if (!loaded) return <p className={styles.helperText}>Cargando configuración…</p>;
  return <form onSubmit={save} className={styles.settingsForm}>
    <div className={styles.toolbar}><p className={styles.helperText}>Controla las animaciones y el contenido de atención personalizada. Requiere el SQL 004.</p><Link href="/atencion-personalizada" className={styles.editBtn}>Ver página</Link></div>
    {error && <p className={styles.formError} role="alert">{error}</p>}{message && <p className={styles.successMessage} role="status">{message}</p>}
    <section className={styles.formSection}><h2 className={styles.formSectionTitle}>Movimiento y portada</h2>
      <label className={styles.checkLabel}><input type="checkbox" checked={form.welcome_enabled} onChange={event => set("welcome_enabled", event.target.checked)} /> Mostrar bienvenida de Killaq al entrar</label>
      <label className={styles.checkLabel}><input type="checkbox" checked={form.artisan_enabled} onChange={event => set("artisan_enabled", event.target.checked)} /> Animar el proceso artesanal en «Hecho para ti»</label>
      <label className={styles.checkLabel}><input type="checkbox" checked={form.hero_autoplay} onChange={event => set("hero_autoplay", event.target.checked)} /> Cambiar automáticamente las campañas de portada</label>
      <p className={styles.helperText}>Con la rotación desactivada se mantiene la primera campaña. Si hay varias, el visitante puede recorrerlas manualmente. Las preferencias de movimiento reducido se respetan siempre.</p>
      <div className={styles.formGroup}><label htmlFor="hero-interval" className={styles.formLabel}>Intervalo de rotación (segundos)</label><input id="hero-interval" type="number" min={6} max={20} className={styles.formInput} value={form.hero_interval} onChange={event => set("hero_interval", Number(event.target.value))} /></div>
      <Link href="/admin/carrusel" className={styles.editBtn}>Administrar imágenes y fondos de portada</Link>
    </section>
    <section className={styles.formSection}><h2 className={styles.formSectionTitle}>Atención personalizada</h2>
      <div className={styles.formGroup}><label htmlFor="personalized-title" className={styles.formLabel}>Título de la página</label><textarea id="personalized-title" className={styles.formTextarea} value={form.personalized_title} maxLength={100} onChange={event => set("personalized_title", event.target.value)} /><small className={styles.helperText}>Usa un salto de línea para dividir el título.</small></div>
      <div className={styles.formGroup}><label htmlFor="personalized-description" className={styles.formLabel}>Descripción</label><textarea id="personalized-description" className={styles.formTextarea} value={form.personalized_description} maxLength={500} onChange={event => set("personalized_description", event.target.value)} /></div>
      <div className={styles.formGroup}><label htmlFor="personalized-phone" className={styles.formLabel}>WhatsApp de consultas personalizadas</label><input id="personalized-phone" type="tel" className={styles.formInput} value={form.whatsapp_number} onChange={event => set("whatsapp_number", event.target.value)} /><small className={styles.helperText}>Código de país y número, sin + ni espacios. Este número corresponde a esta página de consultas.</small></div>
    </section>
    <div className={styles.modalActions}><button type="button" className={styles.cancelBtn} onClick={() => { setDraft(defaultStorefrontSettings); setMessage(""); }}>Cargar valores de marca</button><button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? "Guardando…" : "Guardar configuración"}</button></div>
  </form>;
}

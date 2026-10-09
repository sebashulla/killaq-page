"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "@/components/StoreImage";
import { useStorefrontSettings } from "@/context/StorefrontContext";
import { normalizeStorefrontSettings, canShowExclusive } from "@/utils/storefront";
import { supabase } from "@/utils/supabaseClient";
import { getPrimaryImage, normalizeProducts } from "@/data/catalog";
import type { Product } from "@/types/catalog";
import { slugify } from "@/utils/format";
import styles from "../crud.module.css";

export default function ExclusiveAdmin() {
  const { settings, loaded, reload } = useStorefrontSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<typeof settings | null>(null);
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [creating, setCreating] = useState(false);
  const [collectionMessage, setCollectionMessage] = useState("");
  const form = draft ?? settings;
  const selected = products.find(item => item.id === form.exclusive_product_id) || null;
  const update = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => { setDraft({...form, [key]:value}); setMessage(""); };
  useEffect(() => {
    let active = true;
    supabase.from("products").select("id, name, slug, description, compare_price, price, stock, is_active, collection_id, collections(name, slug, is_active), product_images(url, alt_text, sort_order)").eq("is_active",true).not("collection_id","is",null).order("created_at",{ascending:false}).then(({data,error}) => {
      if (!active) return;
      if (error) setError("No se pudieron cargar las piezas de colección. Revisa la conexión y tus permisos.");
      setProducts(normalizeProducts(data).filter(item => item.collections?.is_active === true));
      setPending(false);
    });
    return () => { active = false; };
  }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    if (form.exclusive_enabled && !canShowExclusive(form, selected)) { setError("Selecciona una pieza publicada, con imagen y una colección activa, antes de mostrar el apartado."); return; }
    if (!form.exclusive_title.trim() || !form.exclusive_description.trim()) { setError("Completa el título y la descripción."); return; }
    setSaving(true);
    try {
      // Merge only this section with the latest saved configuration, preserving other admin edits.
      const {data:previous,error:loadError} = await supabase.from("site_settings").select("value").eq("key","storefront").maybeSingle();
      if (loadError) throw new Error("read");
      const clean = normalizeStorefrontSettings({...normalizeStorefrontSettings(previous?.value), exclusive_enabled:form.exclusive_enabled, exclusive_product_id:form.exclusive_product_id, exclusive_title:form.exclusive_title, exclusive_description:form.exclusive_description});
      const {data:{user}} = await supabase.auth.getUser();
      const {error:saveError} = await supabase.from("site_settings").upsert({key:"storefront",value:clean,description:"Experiencia de marca y pieza exclusiva de Killaq",updated_by:user?.id,updated_at:new Date().toISOString()},{onConflict:"key"});
      if (saveError) throw new Error("save");
      await reload(); setDraft(null); setMessage(form.exclusive_enabled ? "Pieza exclusiva configurada para aparecer en la portada." : "El apartado está oculto en la tienda.");
    } catch { setError("No se pudo guardar. Revisa tu acceso de administrador y aplica las migraciones 004 y 005 en Supabase."); }
    finally { setSaving(false); }
  };
  const createCollection = async (event: React.FormEvent) => {
    event.preventDefault(); setCollectionMessage("");
    const name = collectionName.trim(); const slug = slugify(name);
    if (!name || !slug) { setCollectionMessage("Escribe el nombre de la colección."); return; }
    setCreating(true);
    try {
      const {error} = await supabase.from("collections").insert({name,slug,is_active:true});
      if (error) { setCollectionMessage(error.code === "23505" ? "Ya existe una colección con ese nombre." : "No se pudo crear. Revisa tu acceso de administrador."); return; }
      setCollectionName(""); setCollectionMessage("Colección creada. Ahora asígnala a una pieza en Productos y vuelve aquí para elegirla.");
    } catch { setCollectionMessage("No se pudo conectar con Supabase."); }
    finally { setCreating(false); }
  };
  if (!loaded || pending) return <p className={styles.helperText}>Cargando piezas de colección…</p>;
  return <><form onSubmit={save} className={styles.settingsForm}>
    <div className={styles.toolbar}><p className={styles.helperText}>Un espacio especial en la portada para un modelo exclusivo de una colección. Se oculta automáticamente si la pieza deja de estar publicada, no tiene imagen o su colección está inactiva.</p><Link href="/" className={styles.editBtn}>Ver tienda</Link></div>
    {error && <p className={styles.formError} role="alert">{error}</p>}{message && <p className={styles.successMessage} role="status">{message}</p>}
    <section className={styles.formSection}><h2 className={styles.formSectionTitle}>Visibilidad y pieza</h2>
      <label className={styles.checkLabel}><input type="checkbox" checked={form.exclusive_enabled} disabled={!products.length} onChange={event => update("exclusive_enabled",event.target.checked)} /> Mostrar pieza exclusiva en la página de inicio</label>
      {!products.length && <p className={styles.helperText}>Primero publica un producto con imagen y asígnale una colección activa en <Link href="/admin/productos">Productos</Link>. No se muestran ejemplos como si fueran piezas reales.</p>}
      <div className={styles.formGroup}><label htmlFor="exclusive-product" className={styles.formLabel}>Modelo exclusivo de colección</label><select id="exclusive-product" className={styles.formSelect} value={form.exclusive_product_id} onChange={event => update("exclusive_product_id",event.target.value)}><option value="">Selecciona una pieza</option>{products.map(item => <option key={item.id} value={item.id}>{item.name} · {item.collections?.name}{!item.product_images?.length ? " · falta imagen" : ""}</option>)}</select></div>
      {form.exclusive_product_id && !selected && <p className={styles.helperText}>La pieza guardada ya no cumple las condiciones. El bloque permanece oculto; elige otra pieza o desactiva el apartado.</p>}
      {selected && <div className={`${styles.campaignPreview} ${styles.previewblack}`}><Image src={getPrimaryImage(selected)} alt={selected.name} fill style={{objectFit:"contain"}} sizes="600px" /><span>{selected.name} · {selected.collections?.name}</span></div>}
    </section>
    <section className={styles.formSection}><h2 className={styles.formSectionTitle}>Contenido del apartado</h2><div className={styles.formGroup}><label htmlFor="exclusive-title" className={styles.formLabel}>Título</label><input id="exclusive-title" className={styles.formInput} maxLength={100} value={form.exclusive_title} onChange={event => update("exclusive_title",event.target.value)} /></div><div className={styles.formGroup}><label htmlFor="exclusive-description" className={styles.formLabel}>Descripción</label><textarea id="exclusive-description" className={styles.formTextarea} maxLength={500} value={form.exclusive_description} onChange={event => update("exclusive_description",event.target.value)} /></div></section>
    <div className={styles.modalActions}><button type="submit" disabled={saving} className={styles.saveBtn}>{saving ? "Guardando…" : "Guardar apartado"}</button></div>
  </form><form onSubmit={createCollection} className={styles.settingsForm}><section className={styles.formSection}><h2 className={styles.formSectionTitle}>Crear una colección</h2><p className={styles.helperText}>Organiza los modelos especiales bajo una colección propia. Crear una colección no activa el apartado de portada.</p><div className={styles.formGroup}><label htmlFor="new-collection-name" className={styles.formLabel}>Nombre de colección</label><input id="new-collection-name" className={styles.formInput} maxLength={90} value={collectionName} onChange={event => setCollectionName(event.target.value)} placeholder="Ej. Origen" /></div>{collectionMessage && <p className={styles.helperText} role="status">{collectionMessage}</p>}<div className={styles.modalActions}><Link href="/admin/productos" className={styles.editBtn}>Asignar productos</Link><button type="submit" className={styles.saveBtn} disabled={creating}>{creating ? "Creando…" : "Crear colección"}</button></div></section></form></>;
}

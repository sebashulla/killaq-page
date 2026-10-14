"use client";
import { useRef, useState } from "react";
import LegalLinks from "@/components/LegalLinks";
import { emptyComplaint, receiptHtml, type ComplaintInput, type ComplaintReceipt } from "@/lib/complaints/core";
import styles from "./page.module.css";
export default function ComplaintForm({ enabled }: { enabled: boolean }) {
  const [form,setForm] = useState<ComplaintInput>({ ...emptyComplaint });
  const [submission,setSubmission] = useState(""); const [saving,setSaving] = useState(false);
  const [error,setError] = useState(""); const [conflict,setConflict] = useState(false); const [receipt,setReceipt] = useState<ComplaintReceipt | null>(null);
  const [notice,setNotice] = useState(""); const [website,setWebsite] = useState(""); const feedback = useRef<HTMLDivElement>(null);
  const update = (key: keyof ComplaintInput,value: string | boolean) => setForm(current => ({ ...current,[key]:value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!enabled || saving) return; setSaving(true); setError(""); setConflict(false);
    const key = submission || crypto.randomUUID(); setSubmission(key);
    try {
      const response = await fetch("/api/reclamaciones", { method:"POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify({ form,submission_id:key,website }) });
      const result = await response.json(); if (response.status === 409) setConflict(true); if (!response.ok || !result.receipt?.id) throw new Error(result.error || "No se pudo confirmar el registro.");
      setReceipt(result.receipt); setNotice(result.notice);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo confirmar el registro. Conserva tus datos e inténtalo de nuevo."); }
    finally { setSaving(false); requestAnimationFrame(() => feedback.current?.focus()); }
  }
  function sheet(print: boolean) {
    if (!receipt) return;
    const url = URL.createObjectURL(new Blob([receiptHtml(receipt)],{ type:"text/html;charset=utf-8" }));
    if (print) { const view = window.open(url,"_blank"); if (view) view.addEventListener("load",() => view.print(),{ once:true }); }
    else { const anchor = document.createElement("a"); anchor.href=url; anchor.download=`hoja-${receipt.sheet_number}.html`; anchor.click(); }
    window.setTimeout(() => URL.revokeObjectURL(url),60000);
  }
  const text = (key: keyof ComplaintInput,label: string,required = false,type = "text",max = 500) => <label className={styles.field}><span>{label}{required ? " *" : " (opcional)"}</span><input name={key} type={type} required={required} maxLength={max} value={String(form[key])} onChange={event => update(key,event.target.value)} /></label>;
  return <section className={styles.bookForm} aria-label="Formulario de Hoja de Reclamación"><div ref={feedback} tabIndex={-1} className={styles.feedback}>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {conflict && <button type="button" onClick={() => { setSubmission(""); setConflict(false); setError(""); }}>Preparar una nueva hoja con estos datos</button>}
    {receipt && <div role="status" className={styles.success}><h2>Hoja registrada: {receipt.sheet_number}</h2><p>Recepción: {new Date(receipt.created_at).toLocaleString("es-PE",{timeZone:"America/Lima"})} (Perú).</p><p>Fecha límite general de respuesta: {receipt.due_date}.</p><p>{notice}</p><div className={styles.formRow}><button onClick={() => sheet(false)} type="button">Descargar hoja</button><button onClick={() => sheet(true)} type="button">Imprimir / guardar PDF</button></div><p>La copia contiene datos personales. Guárdala de forma privada.</p><button type="button" onClick={() => { setReceipt(null); setForm({ ...emptyComplaint }); setSubmission(""); }}>Nueva hoja</button></div>}
  </div>{!receipt && <form onSubmit={submit}><fieldset disabled={!enabled || saving} className={styles.fieldset}><legend>1. Identificación del consumidor reclamante</legend><p>Los campos con * son necesarios. Elige domicilio o correo según tu canal de respuesta.</p>
    <div className={styles.formRow}>{text("full_name","Nombre y apellidos",true,"text",150)}<label className={styles.field}><span>Tipo de documento *</span><select value={form.document_type} onChange={event => update("document_type",event.target.value)}><option value="dni">DNI</option><option value="ce">Carné de extranjería</option><option value="pasaporte">Pasaporte</option><option value="otro">Otro documento</option></select></label>{text("document_number","Número de documento",true,"text",20)}</div>
    <div className={styles.formRow}>{text("email","Correo electrónico",form.response_channel === "email","email",254)}{text("phone","Teléfono",false,"tel",30)}</div>{text("address","Domicilio",form.response_channel === "carta")}
    <label className={styles.check}><input type="checkbox" checked={form.is_minor} onChange={event => update("is_minor",event.target.checked)} />El consumidor es menor de edad</label>
    {form.is_minor && <div className={styles.representative}><h3>Padre, madre o representante</h3>{text("representative_name","Nombre del representante",true,"text",150)}{text("representative_address","Domicilio del representante")}<div className={styles.formRow}>{text("representative_email","Correo del representante",false,"email",254)}{text("representative_phone","Teléfono del representante",false,"tel",30)}</div><p>Indica domicilio o correo del representante.</p></div>}
    <h2>2. Identificación del bien contratado</h2><div className={styles.formRow}><label className={styles.field}><span>Producto o servicio *</span><select value={form.item_type} onChange={event => update("item_type",event.target.value)}><option value="producto">Producto</option><option value="servicio">Servicio</option></select></label>{text("amount","Monto reclamado (S/)",false,"text",20)}</div>{text("item_description","Descripción del producto o servicio",false,"text",1000)}{text("order_reference","Pedido / referencia",false,"text",120)}
    <h2>3. Detalle y pedido del consumidor</h2><label className={styles.field}><span>Tipo de solicitud *</span><select value={form.claim_type} onChange={event => update("claim_type",event.target.value)}><option value="reclamo">Reclamo</option><option value="queja">Queja</option></select></label><label className={styles.field}><span>Descripción de los hechos *</span><textarea required rows={5} maxLength={5000} value={form.detail} onChange={event => update("detail",event.target.value)} /></label><label className={styles.field}><span>Pedido concreto / solución que solicitas (opcional)</span><textarea rows={3} maxLength={3000} value={form.request} onChange={event => update("request",event.target.value)} /></label>
    <label className={styles.field}><span>¿Cómo deseas recibir la respuesta escrita? *</span><select value={form.response_channel} onChange={event => update("response_channel",event.target.value)}><option value="email">Correo electrónico</option><option value="carta">Carta al domicilio</option></select></label><h2>4. Observaciones del proveedor</h2><p>Se incorporarán al expediente después de la recepción. No necesitas firma manuscrita en el registro virtual.</p>
    <input hidden tabIndex={-1} aria-hidden="true" autoComplete="off" name="website" value={website} onChange={event => setWebsite(event.target.value)} />
    <p>Los datos se utilizan para registrar, atender y conservar esta hoja y su respuesta. No se te suscribe a publicidad.</p><LegalLinks privacyOnly /><button type="submit" className={styles.primaryButton}>{saving ? "Registrando…" : enabled ? "Registrar hoja de reclamación" : "Registro pendiente de habilitación"}</button>
  </fieldset></form>}</section>;
}

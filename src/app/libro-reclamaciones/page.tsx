"use client";

import { useState } from "react";
import SiteChrome from "@/components/SiteChrome";
import { supabase } from "@/utils/supabaseClient";
import styles from "./page.module.css";

const initialForm = {
  full_name: "",
  document_number: "",
  email: "",
  phone: "",
  address: "",
  claim_type: "reclamo",
  order_reference: "",
  detail: "",
  request: "",
};

export default function ComplaintsBookPage() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const { error: insertError } = await supabase.from("complaints_book").insert({
      full_name: form.full_name.trim(),
      document_number: form.document_number.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim(),
      address: form.address.trim() || null,
      claim_type: form.claim_type,
      order_reference: form.order_reference.trim() || null,
      detail: form.detail.trim(),
      request: form.request.trim(),
    });

    setSaving(false);

    if (insertError) {
      setError(
        "No pudimos registrar tu solicitud. Inténtalo de nuevo o comunícate con Killaq al +51 912 964 356."
      );
      return;
    }

    setForm(initialForm);
    setMessage("Tu solicitud fue registrada correctamente. Killaq se comunicará contigo.");
  };

  return (
    <SiteChrome>
      <main className={styles.page}>
        <header className={styles.header}>
          <span>Atención al cliente</span>
          <h1>Libro de reclamaciones</h1>
          <p>
            Registra un reclamo o queja para que el equipo de Killaq pueda revisarlo y responder.
            También puedes comunicarte al +51 912 964 356.
          </p>
        </header>

        <section className={styles.layout}>
          <aside className={styles.infoPanel}>
            <h2>Killaq Joyería Fina</h2>
            <p>
              Indica tus datos de contacto, el detalle del caso y la solución solicitada. Conserva
              la referencia de tu pedido si corresponde.
            </p>
            <a href="tel:+51912964356">+51 912 964 356</a>
            <a href="mailto:contacto@killaq.pe">contacto@killaq.pe</a>
          </aside>

          <form className={styles.formPanel} onSubmit={handleSubmit}>
            {message && <div className={styles.success}>{message}</div>}
            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.formRow}>
              <label className={styles.field}>
                <span>Nombre completo</span>
                <input
                  required
                  minLength={2}
                  maxLength={150}
                  autoComplete="name"
                  value={form.full_name}
                  onChange={(event) => updateField("full_name", event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>DNI / documento</span>
                <input
                  required
                  minLength={4}
                  maxLength={20}
                  value={form.document_number}
                  onChange={(event) => updateField("document_number", event.target.value)}
                />
              </label>
            </div>

            <div className={styles.formRow}>
              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Teléfono</span>
                <input
                  required
                  type="tel"
                  minLength={7}
                  maxLength={25}
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Dirección</span>
              <input
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
              />
            </label>

            <div className={styles.formRow}>
              <label className={styles.field}>
                <span>Tipo</span>
                <select
                  value={form.claim_type}
                  onChange={(event) => updateField("claim_type", event.target.value)}
                >
                  <option value="reclamo">Reclamo</option>
                  <option value="queja">Queja</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Pedido / referencia</span>
                <input
                  value={form.order_reference}
                  onChange={(event) => updateField("order_reference", event.target.value)}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Detalle</span>
              <textarea
                required
                minLength={10}
                maxLength={5000}
                value={form.detail}
                onChange={(event) => updateField("detail", event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Solicitud</span>
              <textarea
                required
                minLength={5}
                maxLength={3000}
                value={form.request}
                onChange={(event) => updateField("request", event.target.value)}
              />
            </label>

            <button className={styles.primaryButton} disabled={saving} type="submit">
              {saving ? "Registrando..." : "Registrar solicitud"}
            </button>
          </form>
        </section>
      </main>
    </SiteChrome>
  );
}

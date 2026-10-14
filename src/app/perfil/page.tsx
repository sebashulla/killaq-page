"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SiteChrome from "@/components/SiteChrome";
import { useAuth } from "@/context/AuthContext";
import type { DocumentType, Profile } from "@/types/auth";
import { supabase } from "@/utils/supabaseClient";
import styles from "./page.module.css";
import LegalLinks from "@/components/LegalLinks";

const emptyProfile = {
  full_name: "",
  phone: "",
  document_type: "dni" as DocumentType,
  document_number: "",
  birthdate: "",
  residence_country: "Perú",
  residence_city: "",
  residence_district: "",
  residence_address: "",
  reference_note: "",
};

export default function ProfilePage() {
  const router = useRouter();
  const { sessionUser, loading, refreshSession, signOut } = useAuth();
  const [form, setForm] = useState(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !sessionUser) router.push("/login");
  }, [loading, router, sessionUser]);

  useEffect(() => {
    const profile = sessionUser?.profile;
    if (!profile) return;

    const timer = window.setTimeout(() => {
      setForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        document_type: profile.document_type || "dni",
        document_number: profile.document_number || "",
        birthdate: profile.birthdate || "",
        residence_country: profile.residence_country || "Perú",
        residence_city: profile.residence_city || "",
        residence_district: profile.residence_district || "",
        residence_address: profile.residence_address || "",
        reference_note: profile.reference_note || "",
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [sessionUser?.profile]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionUser) return;

    setSaving(true);
    setMessage("");
    setError("");

    const payload: Partial<Profile> = {
      full_name: form.full_name.trim() || null,
      phone: form.phone.trim() || null,
      document_type: form.document_type,
      document_number: form.document_number.trim() || null,
      birthdate: form.birthdate || null,
      residence_country: form.residence_country.trim() || null,
      residence_city: form.residence_city.trim() || null,
      residence_district: form.residence_district.trim() || null,
      residence_address: form.residence_address.trim() || null,
      reference_note: form.reference_note.trim() || null,
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", sessionUser.user.id);

    setSaving(false);

    if (updateError) {
      const looksLikeMissingProfileColumns =
        updateError.message.includes("document_type") ||
        updateError.message.includes("document_number") ||
        updateError.message.includes("residence_");

      if (looksLikeMissingProfileColumns) {
        const { error: basicUpdateError } = await supabase
          .from("profiles")
          .update({
            full_name: payload.full_name,
            phone: payload.phone,
          })
          .eq("id", sessionUser.user.id);

        if (!basicUpdateError) {
          await refreshSession();
          setMessage("Guardamos tu nombre y teléfono. No pudimos guardar los datos adicionales; comunícate con Killaq para recibir ayuda.");
          return;
        }
      }

      setError("No pudimos guardar tus datos. Inténtalo nuevamente en unos momentos.");
      return;
    }

    await refreshSession();
    setMessage("Datos guardados correctamente.");
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <SiteChrome>
      <main className={styles.page}>
        <header className={styles.header}>
          <span>Mi cuenta</span>
          <h1>Perfil</h1>
          <p>
            Guarda tus datos para agilizar compras, coordinación de entregas y comprobantes.
          </p>
        </header>

        {loading ? (
          <section className={styles.panel}>Cargando perfil...</section>
        ) : sessionUser ? (
          <section className={styles.layout}>
            <aside className={styles.summary}>
              <div className={styles.avatar}>
                {(form.full_name || sessionUser.user.email || "K").slice(0, 1).toUpperCase()}
              </div>
              <h2>{form.full_name || "Cliente Killaq"}</h2>
              <p>{sessionUser.user.email}</p>
              <span className={styles.roleBadge}>
                {sessionUser.profile?.role === "admin" ? "Administrador" : "Cliente"}
              </span>
              {sessionUser.profile?.role === "admin" && (
                <Link href="/admin" className={styles.secondaryButton}>
                  Ir al panel admin
                </Link>
              )}
              <button className={styles.logoutButton} onClick={handleLogout} type="button">
                Cerrar sesión
              </button>
            </aside>

            <form className={styles.formPanel} onSubmit={handleSave}>
              {message && <div className={styles.success}>{message}</div>}
              {error && <div className={styles.error}>{error}</div>}

              <div className={styles.sectionTitle}>
                <span>Datos personales</span>
                <h2>Identificación</h2>
              </div>

              <div className={styles.formRow}>
                <label className={styles.field}>
                  <span>Nombre completo</span>
                  <input
                    value={form.full_name}
                    onChange={(event) => updateField("full_name", event.target.value)}
                    placeholder="Tu nombre y apellidos"
                  />
                </label>
                <label className={styles.field}>
                  <span>Teléfono</span>
                  <input
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    placeholder="+51 912 964 356"
                  />
                </label>
              </div>

              <div className={styles.formRow}>
                <label className={styles.field}>
                  <span>Tipo de documento</span>
                  <select
                    value={form.document_type}
                    onChange={(event) => updateField("document_type", event.target.value)}
                  >
                    <option value="dni">DNI</option>
                    <option value="carnet_extranjeria">Carnet de extranjería</option>
                    <option value="pasaporte">Pasaporte</option>
                    <option value="ruc">RUC</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Número de documento</span>
                  <input
                    value={form.document_number}
                    onChange={(event) => updateField("document_number", event.target.value)}
                    placeholder="Documento"
                  />
                </label>
              </div>

              <label className={styles.field}>
                <span>Fecha de nacimiento</span>
                <input
                  type="date"
                  value={form.birthdate}
                  onChange={(event) => updateField("birthdate", event.target.value)}
                />
              </label>

              <div className={styles.sectionTitle}>
                <span>Entrega y residencia</span>
                <h2>Ubicación</h2>
              </div>

              <div className={styles.formRow}>
                <label className={styles.field}>
                  <span>País</span>
                  <input
                    value={form.residence_country}
                    onChange={(event) => updateField("residence_country", event.target.value)}
                    placeholder="Perú"
                  />
                </label>
                <label className={styles.field}>
                  <span>Ciudad</span>
                  <input
                    value={form.residence_city}
                    onChange={(event) => updateField("residence_city", event.target.value)}
                    placeholder="Lima"
                  />
                </label>
              </div>

              <div className={styles.formRow}>
                <label className={styles.field}>
                  <span>Distrito / zona</span>
                  <input
                    value={form.residence_district}
                    onChange={(event) => updateField("residence_district", event.target.value)}
                    placeholder="Miraflores, Cusco, Arequipa..."
                  />
                </label>
                <label className={styles.field}>
                  <span>Dirección</span>
                  <input
                    value={form.residence_address}
                    onChange={(event) => updateField("residence_address", event.target.value)}
                    placeholder="Av., calle, número, interior"
                  />
                </label>
              </div>

              <label className={styles.field}>
                <span>Referencia</span>
                <textarea
                  value={form.reference_note}
                  onChange={(event) => updateField("reference_note", event.target.value)}
                  placeholder="Referencia de entrega o notas importantes"
                />
              </label>

              <div className={styles.actions}>
                <button className={styles.primaryButton} type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar datos"}
                </button>
              </div>
              <LegalLinks privacyOnly />
            </form>
          </section>
        ) : null}
      </main>
    </SiteChrome>
  );
}

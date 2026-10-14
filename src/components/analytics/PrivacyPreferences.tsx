"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  analytics,
  rememberLocalDenial,
  LOCAL_DENIAL_KEY,
} from "@/lib/analytics/client";
import { pageKind } from "@/lib/analytics/core";
import { readPreferences, useAnalytics } from "./AnalyticsProvider";
import s from "./privacy.module.css";
export default function PrivacyPreferences() {
  const state = useAnalytics(),
    pathname = usePathname(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, [open]);
  async function choose(decision: "granted" | "denied") {
    setBusy(true);
    setError("");
    if (decision === "denied") {
      analytics.stopLocally();
      try {
        rememberLocalDenial(localStorage);
      } catch {}
    }
    try {
      const response = await fetch("/api/analytics/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, version: state.version }),
        credentials: "same-origin",
        referrerPolicy: "origin",
      });
      if (!response.ok)
        throw new Error(
          "No pudimos guardar la preferencia. La medición se mantiene detenida; vuelve a intentarlo.",
        );
      if (decision === "granted")
        try {
          localStorage.removeItem(LOCAL_DENIAL_KEY);
        } catch {}
      await readPreferences();
      setOpen(false);
    } catch (err) {
      analytics.stopLocally();
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos guardar la preferencia.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!state.enabled && state.decision === "unset") return null;
  const content = (
    <>
      <span className={s.eyebrow}>Tu privacidad</span>
      {!state.enabled && (
        <p role="status">
          La medición está desactivada. Puedes retirar tu autorización aunque el
          servicio esté detenido.
        </p>
      )}
      <h2>Elige cómo mejorar tu experiencia.</h2>
      <p>
        Con tu autorización, KILLAQ utilizará PostHog para medir visitas,
        interés en joyas y consultas. Se emplean identificadores aleatorios
        mediante cookies. No se graban sesiones ni se envían mensajes, teléfonos
        o datos de tus formularios.
      </p>
      <p>
        Es opcional: puedes comprar y navegar sin aceptar. Consulta quién trata
        los datos, los destinatarios internacionales, conservación y tus
        derechos en la{" "}
        <Link href="/politica-de-privacidad">Política de privacidad</Link>.
        Puedes cambiar esta elección aquí en cualquier momento.
      </p>
      <div className={s.actions}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void choose("denied")}
        >
          {state.decision === "granted"
            ? "Retirar autorización"
            : "Rechazar analítica"}
        </button>
        <button
          type="button"
          disabled={busy || !state.enabled}
          onClick={() => void choose("granted")}
        >
          Aceptar analítica
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </>
  );
  return (
    <>
      <button type="button" className={s.access} onClick={() => setOpen(true)}>
        Preferencias de privacidad
      </button>
      {state.decision === "unset" && pageKind(pathname) && !open && (
        <aside className={s.banner} aria-label="Preferencias de analítica">
          {content}
        </aside>
      )}
      {open && (
        <dialog
          ref={dialog}
          className={s.dialog}
          aria-labelledby="analytics-privacy-title"
          onCancel={() => setOpen(false)}
        >
          <h2 id="analytics-privacy-title" className={s.sr}>
            Preferencias de privacidad
          </h2>
          <button
            className={s.close}
            aria-label="Cerrar preferencias"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
          {content}
        </dialog>
      )}
    </>
  );
}

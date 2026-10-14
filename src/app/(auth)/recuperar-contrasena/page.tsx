"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Brand from "@/components/Brand";
import LegalLinks from "@/components/LegalLinks";
import { supabase } from "@/utils/supabaseClient";
import { recoveryProblem, recoveryRedirect } from "@/lib/auth-recovery";
import styles from "../auth.module.css";

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || cooldown) return;
    setBusy(true);
    setError("");
    setSent(false);
    try {
      const { error: failure } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: recoveryRedirect(window.location.origin),
        },
      );
      if (failure) {
        setError(recoveryProblem(failure));
        if (failure.status === 429) setCooldown(60);
      } else {
        setSent(true);
        setCooldown(60);
      }
    } catch {
      setError("No pudimos conectar con el servicio. Vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo} aria-label="Killaq, inicio">
            <Brand />
          </Link>
          <h1 className={styles.authTitle}>Vuelve a tu cuenta.</h1>
          <p className={styles.subtitle}>
            Solicita un enlace para elegir una nueva contraseña.
          </p>
        </div>
        <form onSubmit={submit} className={styles.form}>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {sent && (
            <p className={styles.success} role="status">
              La solicitud fue aceptada. Si existe una cuenta con este correo,
              podrás recibir un enlace de recuperación. Revisa también spam. El
              enlace caduca y solo puede utilizarse una vez.
            </p>
          )}
          <div className={styles.fieldGroup}>
            <label htmlFor="recovery-email" className={styles.label}>
              Correo electrónico de tu cuenta
            </label>
            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button
            className={styles.submitButton}
            disabled={busy || cooldown > 0}
            type="submit"
          >
            {busy
              ? "Solicitando enlace…"
              : cooldown
                ? `Puedes solicitar otro en ${cooldown} s`
                : "Enviar enlace de recuperación"}
          </button>
          <LegalLinks privacyOnly />
        </form>
        <div className={styles.footer}>
          <Link href="/login" className={styles.footerLink}>
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

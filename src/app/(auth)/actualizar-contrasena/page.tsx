"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Brand from "@/components/Brand";
import LegalLinks from "@/components/LegalLinks";
import { supabase } from "@/utils/supabaseClient";
import { passwordProblem } from "@/lib/auth-recovery";
import styles from "../auth.module.css";

export default function UpdatePasswordPage() {
  const [state, setState] = useState<"checking" | "valid" | "invalid" | "done">(
    "checking",
  );
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.hash.slice(1));
    const failedLink = params.has("error") || url.searchParams.has("error");
    async function verify() {
      try {
        const { data, error: failure } = await supabase.auth.getUser();
        if (active)
          setState(!failedLink && !failure && data.user ? "valid" : "invalid");
      } catch {
        if (active) setState("invalid");
      }
      if (active)
        window.history.replaceState(null, "", "/actualizar-contrasena");
    }
    // getUser waits for Supabase to verify the one-use email token/session.
    void verify();
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || state !== "valid") return;
    const problem = passwordProblem(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data: verified, error: verificationError } =
        await supabase.auth.getUser();
      if (verificationError || !verified.user) {
        setState("invalid");
        return;
      }
      const { error: failure } = await supabase.auth.updateUser({ password });
      if (failure) {
        setError(
          failure.code === "same_password"
            ? "Elige una contraseña distinta de la anterior."
            : failure.code === "weak_password"
              ? "Utiliza una contraseña más segura."
              : "No pudimos actualizar la contraseña. El enlace puede haber caducado; solicita uno nuevo si el problema continúa.",
        );
        return;
      }
      setPassword("");
      setConfirmation("");
      setState("done");
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "global",
      });
      if (signOutError)
        setWarning(
          "La contraseña cambió, pero no pudimos cerrar todas las sesiones. Cierra sesión en tus otros dispositivos.",
        );
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
          <h1 className={styles.authTitle}>Un nuevo comienzo.</h1>
          <p className={styles.subtitle}>
            Elige una contraseña para tu cuenta KILLAQ.
          </p>
        </div>
        {state === "checking" && (
          <p role="status">Verificando el acceso seguro…</p>
        )}
        {state === "invalid" && (
          <div className={styles.form}>
            <p className={styles.error} role="alert">
              Necesitas un enlace válido o una sesión verificada. Si el enlace
              caducó o ya fue utilizado, solicita uno nuevo.
            </p>
            <Link href="/recuperar-contrasena" className={styles.footerLink}>
              Solicitar otro enlace
            </Link>
          </div>
        )}
        {state === "done" && (
          <div className={styles.form}>
            <p className={styles.success} role="status">
              Tu contraseña se actualizó correctamente. Inicia sesión con la
              nueva contraseña.
            </p>
            {warning && <p role="alert">{warning}</p>}
            <Link className={styles.footerLink} href="/login">
              Ir a iniciar sesión
            </Link>
          </div>
        )}
        {state === "valid" && (
          <form onSubmit={submit} className={styles.form}>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="new-password">
                Nueva contraseña
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                className={styles.input}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="password-help"
              />
            </div>
            <p id="password-help" className={styles.help}>
              Al menos 8 caracteres. Elige una contraseña que no utilices en
              otras cuentas.
            </p>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="confirm-password">
                Repetir contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                className={styles.input}
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>
            <button
              className={styles.submitButton}
              disabled={busy}
              type="submit"
            >
              {busy ? "Actualizando…" : "Guardar nueva contraseña"}
            </button>
            <LegalLinks privacyOnly />
          </form>
        )}
        <div className={styles.footer}>
          <Link href="/login" className={styles.footerLink}>
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

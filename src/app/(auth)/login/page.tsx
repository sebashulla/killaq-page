"use client";

import Link from "next/link";
import Brand from "@/components/Brand";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import styles from "../auth.module.css";
import LegalLinks from "@/components/LegalLinks";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : authError.message
      );
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user?.id)
      .maybeSingle();

    router.push(profile?.role === "admin" ? "/admin" : "/perfil");
    router.refresh();
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo} aria-label="Killaq, inicio"><Brand /></Link>
          <p className={styles.subtitle}>Ingresa a tu cuenta</p>
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.fieldGroup}>
            <label htmlFor="email" className={styles.label}>Correo electrónico</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={styles.input}
              placeholder="tu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="password" className={styles.label}>Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={styles.input}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <Link href="/recuperar-contrasena" className={styles.recoveryLink}>¿Olvidaste tu contraseña?</Link>
          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
          <LegalLinks privacyOnly />
        </form>

        <div className={styles.footer}>
          ¿No tienes cuenta? <Link href="/register" className={styles.footerLink}>Regístrate aquí</Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import Brand from "@/components/Brand";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import styles from "../auth.module.css";
import LegalLinks from "@/components/LegalLinks";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess("Cuenta creada. Revisa tu correo para confirmar el acceso.");
    setLoading(false);
    window.setTimeout(() => router.push("/login"), 2500);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo} aria-label="Killaq, inicio"><Brand /></Link>
          <p className={styles.subtitle}>Crea tu cuenta</p>
        </div>

        <form onSubmit={handleRegister} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <div className={styles.fieldGroup}>
            <label htmlFor="fullName" className={styles.label}>Nombre completo</label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              className={styles.input}
              placeholder="Juan Pérez"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </div>

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
              autoComplete="new-password"
              minLength={6}
              className={styles.input}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>Confirmar contraseña</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={6}
              className={styles.input}
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? "Creando cuenta..." : "Registrarse"}
          </button>
          <LegalLinks privacyOnly />
        </form>

        <div className={styles.footer}>
          ¿Ya tienes cuenta? <Link href="/login" className={styles.footerLink}>Inicia sesión</Link>
        </div>
      </div>
    </div>
  );
}

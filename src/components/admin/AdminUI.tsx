"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertCircle, ArrowRight, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import s from "./AdminUI.module.css";
export { s as adminStyles };
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  return (
    <div
      className={`${s.notice} ${s[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <AlertCircle size={17} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={s.empty}>
      <span className={s.eyebrow}>Tu espacio de trabajo</span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  );
}
export function Loading({
  children = "Cargando información…",
}: {
  children?: ReactNode;
}) {
  return (
    <p className={s.loading} role="status">
      <LoaderCircle size={18} aria-hidden="true" />
      {children}
    </p>
  );
}
export function Field({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {help && <small>{help}</small>}
      {error && (
        <small className={s.fieldError} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
export function Section({
  title,
  children,
  description,
}: {
  title: string;
  children: ReactNode;
  description?: string;
}) {
  return (
    <section className={s.section}>
      <h2>{title}</h2>
      {description && <p className={s.help}>{description}</p>}
      {children}
    </section>
  );
}
export function Status({
  active,
  children,
}: {
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`${s.status} ${active ? s.published : s.draft}`}>
      {children}
    </span>
  );
}
export function ActionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={s.secondary}>
      {children}
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={s.dialogTitle}>
        <h2 id={id}>{title}</h2>
        <button aria-label="Cerrar" className={s.iconButton} onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function useDirtyGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const leave = (e: Event) => {
      if (
        !window.confirm(
          "Hay cambios sin guardar. ¿Quieres salir y descartarlos?",
        )
      )
        e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      const anchor = (e.target as Element)?.closest("a[href]");
      if (
        anchor &&
        !anchor.getAttribute("href")?.startsWith("#") &&
        !window.confirm(
          "Hay cambios sin guardar. ¿Quieres salir y descartarlos?",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const originalUrl = window.location.href;
    const originalState = window.history.state;
    // A same-route entry lets Back reach the unchanged route before asking.
    // Cancelling restores that entry without unmounting the editor.
    window.history.pushState(
      { ...originalState, killaqEditorGuard: true },
      "",
      originalUrl,
    );
    const pop = () => {
      if (window.history.state?.killaqEditorGuard) return;
      if (
        window.confirm(
          "Hay cambios sin guardar. ¿Quieres salir y descartarlos?",
        )
      ) {
        window.removeEventListener("beforeunload", unload);
        window.removeEventListener("popstate", pop, true);
        window.history.back();
      } else window.history.forward();
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("admin-leave", leave);
    window.addEventListener("popstate", pop, true);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("admin-leave", leave);
      window.removeEventListener("popstate", pop, true);
      document.removeEventListener("click", click, true);
      if (
        window.history.state?.killaqEditorGuard &&
        window.location.href === originalUrl
      )
        window.history.replaceState(originalState, "", originalUrl);
    };
  }, [dirty]);
}

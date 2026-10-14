"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  Diamond,
  Layers,
  Gem,
  Images,
  Video,
  Sparkles,
  BookOpen,
  Building2,
  Scale,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import { supabase } from "@/utils/supabaseClient";
import s from "./admin.module.css";
const groups = [
  {
    label: "General",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard },{href:'/admin/estadisticas',label:'Estadísticas',icon:ChartNoAxesCombined}],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/admin/productos", label: "Productos", icon: Diamond },
      { href: "/admin/colecciones", label: "Colecciones", icon: Layers },
      { href: "/admin/exclusivos", label: "Pieza exclusiva", icon: Gem },
    ],
  },
  {
    label: "Contenido y marca",
    items: [
      { href: "/admin/carrusel", label: "Portada y campañas", icon: Images },
      { href: "/admin/videos", label: "Redes y videos", icon: Video },
      {
        href: "/admin/experiencia",
        label: "Experiencia de marca",
        icon: Sparkles,
      },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { href: "/admin/reclamaciones", label: "Reclamaciones", icon: BookOpen },
    ],
  },
  {
    label: "Configuración",
    items: [
      {
        href: "/admin/configuracion/negocio",
        label: "Datos del negocio",
        icon: Building2,
      },
      {
        href: "/admin/configuracion/legal",
        label: "Información legal",
        icon: Scale,
      },
      {
        href: "/admin/configuracion/operativa",
        label: "Configuración operativa",
        icon: Settings2,
      },
    ],
  },
];
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname(),
    router = useRouter();
  const [email, setEmail] = useState<string | null>(null),
    [error, setError] = useState(""),
    [collapsed, setCollapsed] = useState(false),
    [drawer, setDrawer] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function check() {
      const current = ++generation;
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (!active || current !== generation) return;
        if (error || !user) {
          setEmail(null);
          router.replace("/login");
          return;
        }
        const result = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (!active || current !== generation) return;
        if (result.error) {
          setEmail(null);
          setError(
            "No se pudo verificar tu acceso. Revisa la conexión y vuelve a cargar.",
          );
          return;
        }
        if (result.data?.role !== "admin") {
          setEmail(null);
          router.replace("/");
          return;
        }
        setEmail(user.email || "Equipo KILLAQ");
        setError("");
      } catch {
        if (active) {
          setEmail(null);
          setError("No se pudo verificar la sesión.");
        }
      }
    }
    void check();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        generation++;
        setEmail(null);
        router.replace("/login");
      } else if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setTimeout(() => void check(), 0);
      }
    });
    const focus = () => void check();
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("focus", focus);
    };
  }, [router]);
  useEffect(() => {
    if (!drawer) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    document.body.style.overflow = "hidden";
    const resize = () => {
      if (window.innerWidth > 900) setDrawer(false);
    };
    window.addEventListener("resize", resize);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("resize", resize);
      previous?.focus();
    };
  }, [drawer]);
  const active = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);
  const title =
    groups.flatMap((g) => g.items).find((i) => active(i.href))?.label ||
    "Administración";
  const navigation = (mobile = false) => (
    <>
      <div className={s.brandRow}>
        <Link
          href="/admin"
          className={s.brand}
          onClick={() => setDrawer(false)}
          aria-label="KILLAQ administración"
        >
          {!collapsed || mobile ? "KILLAQ" : "K"}
        </Link>
        {mobile && (
          <button
            onClick={() => setDrawer(false)}
            className={s.iconButton}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        )}
      </div>
      <p className={s.brandSub}>
        {!collapsed || mobile ? "ESTUDIO · ADMINISTRACIÓN" : "ADMIN"}
      </p>
      <nav aria-label="Administración">
        {groups.map((group) => (
          <div key={group.label} className={s.group}>
            <p className={s.groupLabel}>
              {!collapsed || mobile ? group.label : "·"}
            </p>
            {group.items.map((item) => (
              <Link
                href={item.href}
                key={item.href}
                aria-current={active(item.href) ? "page" : undefined}
                title={item.label}
                className={active(item.href) ? s.navActive : s.navItem}
                onClick={() => setDrawer(false)}
              >
                <item.icon size={18} aria-hidden="true" />
                <span className={collapsed && !mobile ? s.srOnly : undefined}>
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className={s.sidebarFooter}>
        <Link href="/" className={s.navItem} onClick={() => setDrawer(false)}>
          <ArrowUpRight size={18} />
          <span className={collapsed && !mobile ? s.srOnly : undefined}>
            Ver tienda
          </span>
        </Link>
        {!mobile && (
          <button
            className={s.collapse}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={
              collapsed ? "Expandir barra lateral" : "Contraer barra lateral"
            }
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
            <span className={collapsed ? s.srOnly : undefined}>
              Contraer menú
            </span>
          </button>
        )}
      </div>
    </>
  );
  if (email === null)
    return (
      <main className={s.loading} role={error ? "alert" : "status"}>
        {error || "Verificando acceso autorizado…"}
      </main>
    );
  return (
    <div className={`${s.shell} ${collapsed ? s.collapsed : ""}`}>
      <a href="#admin-content" className={s.skip}>
        Ir al contenido
      </a>
      <aside className={s.sidebar}>{navigation()}</aside>
      <div className={s.workspace}>
        <header className={s.topbar}>
          <button
            className={s.mobileMenu}
            aria-label="Abrir menú de administración"
            onClick={() => setDrawer(true)}
          >
            <Menu size={21} />
          </button>
          <div>
            <p className={s.breadcrumb}>KILLAQ / ADMINISTRACIÓN</p>
            <h1>{title}</h1>
          </div>
          <div className={s.session}>
            <span>{email}</span>
            <button
              className={s.iconButton}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              onClick={async () => {
                const event = new Event("admin-leave", { cancelable: true });
                if (!window.dispatchEvent(event)) return;
                const { error } = await supabase.auth.signOut();
                if (error) {
                  setError("No se pudo cerrar la sesión. Inténtalo otra vez.");
                  return;
                }
                setEmail(null);
                router.replace("/login");
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        {error && (
          <p role="alert" className={s.authError}>
            {error}
          </p>
        )}
        <main id="admin-content" tabIndex={-1} className={s.content}>
          {children}
        </main>
        <footer className={s.footer}>
          KILLAQ · Espacio privado de gestión
        </footer>
      </div>
      {drawer && (
        <dialog
          ref={dialog}
          className={s.drawer}
          aria-label="Menú de administración"
          onCancel={(e) => {
            e.preventDefault();
            setDrawer(false);
          }}
        >
          {navigation(true)}
        </dialog>
      )}
    </div>
  );
}

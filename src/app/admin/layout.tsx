"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import styles from "./admin.module.css";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "DB" },
  { href: "/admin/productos", label: "Productos", icon: "PR" },
  { href: "/admin/videos", label: "Videos", icon: "VI" },
  { href: "/admin/carrusel", label: "Portada y campañas", icon: "PO" },
  { href: "/admin/experiencia", label: "Experiencia de marca", icon: "EX" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        router.push("/");
        return;
      }

      setUserEmail(user.email || "");
      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return <div className={styles.loading}>Validando acceso al panel...</div>;
  }

  return (
    <div className={styles.adminLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brand}>KILLAQ</div>
          <div className={styles.brandSub}>Panel de administración</div>
        </div>

        <nav className={styles.navSection}>
          <p className={styles.navLabel}>Gestión</p>
          <ul className={styles.navList}>
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={pathname === item.href ? styles.navItemActive : styles.navItem}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.backLink}>
            Volver a la tienda
          </Link>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <div className={styles.topBar}>
          <h1 className={styles.pageTitle}>
            {navItems.find((item) => item.href === pathname)?.label || "Admin"}
          </h1>
          <div className={styles.userBadge}>
            <span>{userEmail}</span>
            <button onClick={handleLogout} className={styles.logoutButton} type="button">
              Salir
            </button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

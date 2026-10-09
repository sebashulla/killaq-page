"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPrice } from "@/utils/format";
import { supabase } from "@/utils/supabaseClient";
import styles from "./dashboard.module.css";

interface Stats {
  totalProducts: number;
  activeProducts: number;
  outOfStock: number;
  pendingOrders: number;
  revenueThisMonth: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    activeProducts: 0,
    outOfStock: 0,
    pendingOrders: 0,
    revenueThisMonth: 0,
  });
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const [productsRes, dashboardRes] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("admin_dashboard_stats").select("*").maybeSingle(),
      ]);
      if (productsRes.error || dashboardRes.error || !dashboardRes.data) { setStatsError(true); return; }
      const dashboard = dashboardRes.data;
      setStatsError(false);
      setStats({
        totalProducts: productsRes.count || 0,
        activeProducts: Number(dashboard.total_products),
        outOfStock: Number(dashboard.out_of_stock),
        pendingOrders: Number(dashboard.pending_orders),
        revenueThisMonth: Number(dashboard.revenue_this_month),
      });
    };

    fetchStats();
  }, []);

  return (
    <>
      {statsError && <p className={styles.emptyState} role="alert">No se pudieron cargar las estadísticas. Revisa los permisos y la migración 002 en Supabase.</p>}
      <div className={styles.grid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Productos totales</span>
          <span className={styles.statValue}>{stats.totalProducts}</span>
          <span className={styles.statNote}>{stats.activeProducts} activos</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Sin stock</span>
          <span className={styles.statValue}>{stats.outOfStock}</span>
          <span className={styles.statNote}>Requieren reposición</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pedidos pendientes</span>
          <span className={styles.statValue}>{stats.pendingOrders}</span>
          <span className={styles.statNote}>Por confirmar</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Ventas del mes</span>
          <span className={styles.statValue}>{formatPrice(stats.revenueThisMonth)}</span>
          <span className={styles.statNote}>Pagos marcados como completados</span>
        </div>
      </div>

      <div className={styles.quickActions}>
        <Link href="/admin/exclusivos" className={styles.actionCard}><span>Pieza exclusiva</span><strong>Mostrar u ocultar un modelo de colección</strong></Link>
        <Link href="/admin/productos" className={styles.actionCard}>
          <span>Productos</span>
          <strong>Agregar piezas, fotos y videos</strong>
        </Link>
        <Link href="/admin/videos" className={styles.actionCard}>
          <span>Videos</span>
          <strong>Publicar Instagram y TikTok</strong>
        </Link>
        <Link href="/admin/carrusel" className={styles.actionCard}>
          <span>Home</span>
          <strong>Actualizar carrusel</strong>
        </Link>
        <Link href="/colecciones" className={styles.actionCard}>
          <span>Tienda</span>
          <strong>Ver catálogo público</strong>
        </Link>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Estado operativo</h2>
        <p className={styles.emptyState}>
          El panel cubre publicación de productos, imágenes, videos, stock y carrusel inicial.
        </p>
      </div>
    </>
  );
}

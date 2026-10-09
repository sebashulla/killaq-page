"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, Search, ShoppingBag, UserRound, X, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import Brand from "./Brand";
import styles from "./Navbar.module.css";
const categories = [
  { name: "Anillos", slug: "anillos", detail: "Promesas y nuevos comienzos" },
  { name: "Collares", slug: "collares", detail: "Detalles cerca del corazón" },
  { name: "Aretes", slug: "aretes", detail: "Un brillo que te acompaña" },
  { name: "Pulseras", slug: "pulseras", detail: "Pequeños gestos, grandes historias" },
];
export default function Navbar() {
  const [menu, setMenu] = useState(false);
  const [shop, setShop] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { totalItems } = useCart();
  const { sessionUser, signOut } = useAuth();
  const close = () => { setMenu(false); setShop(false); setSearch(false); };
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenu(false); setShop(false); setSearch(false); } };
    const outside = (event: PointerEvent) => { if (!navRef.current?.contains(event.target as Node)) { setMenu(false); setShop(false); setSearch(false); } };
    window.addEventListener("keydown", dismiss);
    window.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", dismiss); window.removeEventListener("pointerdown", outside); };
  }, []);
  useEffect(() => { if (search) searchRef.current?.focus(); }, [search]);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/colecciones?search=${encodeURIComponent(query.trim())}`);
    close();
  };
  return <nav className={styles.navbar} ref={navRef} aria-label="Navegación principal">
    <div className={styles.announcement}><span>Joyas para los momentos que importan</span><Link href="/atencion-personalizada" onClick={close}>Atención personalizada <ArrowUpRight size={12} /></Link></div>
    <div className={styles.topBar}>
      <button type="button" className={styles.mobileToggle} aria-label={menu ? "Cerrar menú" : "Abrir menú"} aria-expanded={menu} aria-controls="main-navigation" onClick={() => { setMenu(!menu); setShop(false); setSearch(false); }}>{menu ? <X /> : <Menu />}</button>
      <Link href="/" className={styles.logo} aria-label="Killaq, inicio" onClick={close}><Brand /></Link>
      <div id="main-navigation" className={`${styles.links} ${menu ? styles.open : ""}`}>
        <button type="button" className={styles.link} aria-expanded={shop} aria-controls="shop-menu" onClick={() => setShop(!shop)}>Tienda <ChevronDown size={12} /></button>
        <Link href="/colecciones" className={styles.link} aria-current={pathname === "/colecciones" ? "page" : undefined} onClick={close}>Colecciones</Link>
        <Link href="/ofertas" className={styles.link} aria-current={pathname === "/ofertas" ? "page" : undefined} onClick={close}>Ofertas</Link>
        <Link href="/atencion-personalizada" className={styles.link} aria-current={pathname === "/atencion-personalizada" ? "page" : undefined} onClick={close}>Hecho para ti</Link>
        <Link href="/nosotros" className={styles.link} aria-current={pathname === "/nosotros" ? "page" : undefined} onClick={close}>El universo Killaq</Link>
        <Link className={styles.mobileAccount} href={sessionUser ? "/perfil" : "/login"} onClick={close}>{sessionUser ? "Mi cuenta" : "Ingresar a mi cuenta"}</Link>
        {sessionUser?.profile?.role === "admin" && <Link href="/admin" className={styles.link} onClick={close}>Administrar</Link>}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.icon} aria-label={search ? "Cerrar búsqueda" : "Buscar"} aria-expanded={search} aria-controls="site-search" onClick={() => { setSearch(!search); setMenu(false); setShop(false); }}>{search ? <X /> : <Search />}</button>
        <Link className={`${styles.icon} ${styles.account}`} href={sessionUser ? "/perfil" : "/login"} aria-label={sessionUser ? "Mi cuenta" : "Ingresar"}><UserRound /></Link>
        <Link className={styles.icon} href="/carrito" aria-label={`Abrir carrito, ${totalItems} piezas`} onClick={close}><ShoppingBag />{totalItems > 0 && <span className={styles.count}>{totalItems}</span>}</Link>
      </div>
    </div>
    {shop && <div className={styles.shopMenu} id="shop-menu">
      <div className={styles.shopHeading}><span>Encuentra tu próxima joya</span><Link href="/colecciones" onClick={close}>Ver todo <ArrowUpRight size={15} /></Link></div>
      <div className={styles.categories}>{categories.map((item, index) => <Link key={item.slug} href={`/colecciones?category=${item.slug}`} onClick={close}><small>0{index + 1}</small><strong>{item.name}</strong><span>{item.detail}</span><ArrowUpRight size={18} /></Link>)}</div>
      {sessionUser && <button className={styles.signOut} type="button" onClick={async () => { await signOut(); close(); router.push("/"); }}>Cerrar sesión</button>}
    </div>}
    {search && <form id="site-search" className={styles.search} onSubmit={submit}><Search size={19} /><input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Encuentra un anillo, un collar, una historia…" aria-label="Buscar joyas" /><button type="submit">Buscar <ArrowUpRight size={16} /></button></form>}
  </nav>;
}

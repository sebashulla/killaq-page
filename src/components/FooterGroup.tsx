"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./Footer.module.css";

export default function FooterGroup({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className={styles.column}>
    <h3>{title}</h3>
    <button type="button" className={styles.groupToggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{title}<ChevronDown size={16} aria-hidden="true" /></button>
    <div id={id} className={`${styles.groupLinks} ${open ? styles.groupOpen : ""}`}>{children}</div>
  </div>;
}

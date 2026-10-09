"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export default function StoreImage({ src, alt, ...props }: ImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = typeof src === "string" ? src : null;
  let valid = true;
  let remote = false;
  if (source && !source.startsWith("/")) {
    try { const parsed = new URL(source); valid = parsed.protocol === "https:"; remote = valid; } catch { valid = false; }
  }
  if (source?.startsWith("//")) valid = false;
  const unavailable = !valid || (source !== null && source === failedSource);
  return <Image {...props} src={unavailable ? "/images/product-placeholder.svg" : src} alt={unavailable ? `${alt}. Imagen no disponible` : alt} unoptimized={remote || unavailable} onError={() => { if (source) setFailedSource(source); }} />;
}

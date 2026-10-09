export function safeLink(value: string | null | undefined, fallback = "/colecciones") {
  if (!value) return fallback;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : fallback; } catch { return fallback; }
}

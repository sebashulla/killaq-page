import { supabase } from "@/utils/supabaseClient";
export async function verifyPreviewImage(url: string) {
  await new Promise<void>((resolve, reject) => {
    const image = new window.Image();
    const timer = window.setTimeout(() => finish(false), 8000);
    function finish(ok: boolean) {
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (ok) resolve();
      else {
        const error = new Error(
          "La imagen no pudo cargarse. Revisa su enlace antes de publicar.",
        ) as Error & { fields: Record<string, string> };
        error.fields = {
          primary_image: "Comprueba que la fotografía esté disponible.",
          image_url: "La imagen no está disponible.",
        };
        reject(error);
      }
    }
    image.onload = () => finish(image.naturalWidth > 0);
    image.onerror = () => finish(false);
    image.src = url;
  });
}
export async function adminApi<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Inicia sesión para acceder al panel.");
  const response = await fetch(path, {
    method: method || (body !== undefined ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      result.error || "No se pudo completar la operación.",
    ) as Error & { fields?: Record<string, string> };
    error.fields = result.fields;
    throw error;
  }
  return result;
}

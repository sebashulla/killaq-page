import "server-only";
import { createClient } from "@supabase/supabase-js";
import { AdminError } from "./validation";
import { ComplaintError } from "../complaints/core";
export async function authorizeAdmin(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new AdminError(401, "Inicia sesión para acceder al panel.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new AdminError(503, "Supabase no está configurado.");
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(12000) }),
    },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new AdminError(401, "La sesión no es válida.");
  const profile = await db
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile.error)
    throw new AdminError(
      503,
      "No se pudo verificar el permiso administrativo.",
    );
  if (profile.data?.role !== "admin")
    throw new AdminError(403, "Acceso reservado al equipo autorizado.");
  return { db, user: data.user };
}
export function adminResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export function adminFailure(error: unknown) {
  return adminResponse(
    {
      error:
        error instanceof AdminError || error instanceof ComplaintError
          ? error.message
          : "No se pudo completar la operación. Revisa la conexión y los permisos.",
      ...(error instanceof AdminError ? { fields: error.fields } : {}),
    },
    error instanceof AdminError || error instanceof ComplaintError
      ? error.status
      : 503,
  );
}
export function dbFailure(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "23505")
    throw new AdminError(
      409,
      "Ya existe una pieza, colección o SKU con ese identificador.",
    );
  if (error.code === "PGRST202" || error.code === "42883")
    throw new AdminError(
      503,
      "Aplica 007_admin_operations.sql antes de guardar.",
    );
  if (error.code === "PGRST205" || error.code === "42703")
    throw new AdminError(
      503,
      "Falta una tabla o columna. Revisa las migraciones 001–007 en Configuración operativa.",
    );
  if (error.code === "40001")
    throw new AdminError(
      409,
      "Otro administrador modificó este registro. Recarga antes de guardar.",
    );
  if (["22023", "22007", "23503", "23514"].includes(error.code || ""))
    throw new AdminError(
      422,
      "Revisa los datos del formulario, su clasificación y las condiciones de publicación.",
    );
  throw new AdminError(
    503,
    "La base de datos rechazó la operación. Revisa las migraciones, los campos y el permiso administrativo.",
  );
}

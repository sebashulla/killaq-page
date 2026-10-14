import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY para cargar el catálogo.",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
);

// Handles a recovery redirected to the project's Site URL as well as the exact route.
// Supabase verifies/persists the session before emitting this event. No token is copied.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (
      event === "PASSWORD_RECOVERY" &&
      window.location.pathname !== "/actualizar-contrasena"
    )
      window.location.replace("/actualizar-contrasena");
  });
}

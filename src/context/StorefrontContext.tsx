"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { defaultStorefrontSettings, normalizeStorefrontSettings, type StorefrontSettings } from "@/utils/storefront";

const StorefrontContext = createContext({ settings: defaultStorefrontSettings, loaded: false, reload: async () => {} });
export function StorefrontProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StorefrontSettings>(defaultStorefrontSettings);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    try {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "storefront").maybeSingle();
      setSettings(normalizeStorefrontSettings(data?.value));
    } catch { setSettings(defaultStorefrontSettings); }
    finally { setLoaded(true); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  return <StorefrontContext.Provider value={{ settings, loaded, reload }}>{children}</StorefrontContext.Provider>;
}
export const useStorefrontSettings = () => useContext(StorefrontContext);

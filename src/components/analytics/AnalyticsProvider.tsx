"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  analytics,
  track,
  setAnalyticsSessionToken,
  hasLocalDenial,
  LOCAL_DENIAL_KEY,
  type Preferences,
} from "@/lib/analytics/client";
import { supabase } from "@/utils/supabaseClient";
import {
  CATEGORIES,
  LOCATIONS,
  validProductId,
  pageKind,
  type CommercialEvent,
  type Location,
} from "@/lib/analytics/core";
export function useAnalytics() {
  return useSyncExternalStore(
    analytics.subscribe,
    analytics.getSnapshot,
    analytics.getServerSnapshot,
  );
}
let authInternal = true;
export function refreshAnalyticsContext(internal?: boolean) {
  if (typeof window === "undefined") return;
  if (internal !== undefined) authInternal = internal;
  let excluded = authInternal || navigator.webdriver;
  try {
    if (location.pathname.startsWith("/admin"))
      sessionStorage.setItem("killaq-internal-traffic", "true");
    excluded ||= sessionStorage.getItem("killaq-internal-traffic") === "true";
  } catch {}
  analytics.navigate(location.href, document.referrer, excluded, innerWidth);
}
export async function readPreferences() {
  const response = await fetch("/api/analytics/preferences", {
    cache: "no-store",
    credentials: "same-origin",
    referrerPolicy: "origin",
  });
  if (!response.ok) throw new Error("No pudimos consultar tus preferencias.");
  const value = (await response.json()) as Preferences;
  if (
    typeof value.enabled !== "boolean" ||
    !["unset", "granted", "denied"].includes(value.decision) ||
    typeof value.version !== "string" ||
    !Array.isArray(value.campaigns)
  )
    throw new Error("Preferencia inválida.");
  let locallyDenied = false;
  try {
    locallyDenied = hasLocalDenial(localStorage);
  } catch {}
  analytics.configure({
    ...value,
    ...(locallyDenied ? { decision: "denied" as const } : {}),
  });
  return value;
}
export default function AnalyticsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname(),
    { sessionUser, loading } = useAuth();
  const internal =
    loading ||
    sessionUser?.profile?.role === "admin" ||
    Boolean(sessionUser && !sessionUser.profile);
  useEffect(() => {
    refreshAnalyticsContext(internal);
    let active = true;
    if (sessionUser && !internal)
      void supabase.auth.getSession().then(({ data }) => {
        if (active) setAnalyticsSessionToken(data.session?.access_token);
      });
    else setAnalyticsSessionToken(undefined);
    return () => {
      active = false;
    };
  }, [pathname, internal, sessionUser]);
  useEffect(() => {
    let active = true;
    void readPreferences().catch(() => {
      if (active)
        analytics.configure({
          enabled: false,
          decision: "unset",
          version: "",
          campaigns: [],
        });
    });
    const storage = (event: StorageEvent) => {
      if (event.key !== LOCAL_DENIAL_KEY) return;
      let denied = false;
      try {
        denied = hasLocalDenial(localStorage);
      } catch {}
      if (denied) analytics.stopLocally();
      else void readPreferences().catch(() => analytics.stopLocally());
    };
    const pagehide = () => void analytics.flush();
    window.addEventListener("storage", storage);
    window.addEventListener("pagehide", pagehide);
    return () => {
      active = false;
      window.removeEventListener("storage", storage);
      window.removeEventListener("pagehide", pagehide);
    };
  }, []);
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const resize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => refreshAnalyticsContext(), 150);
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || !analytics.getSnapshot().active) return;
      const anchor = (
        event.target as Element | null
      )?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !anchor.closest("[data-storefront]")) return;
      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      const origin =
        anchor.closest<HTMLElement>("[data-analytics-location]")?.dataset
          .analyticsLocation ||
        pageKind(location.pathname) ||
        "home";
      const where = (
        LOCATIONS.includes(origin as Location) ? origin : "home"
      ) as Location;
      if (url.protocol === "https:" && url.hostname === "wa.me") {
        track({ name: "whatsapp_contact_click", location: where });
        try {
          const items = JSON.parse(
            anchor.dataset.analyticsProducts || "[]",
          ) as { productId: string; quantity: number }[];
          for (const item of items)
            if (
              validProductId(item.productId) &&
              Number.isInteger(item.quantity) &&
              item.quantity > 0
            )
              track({
                name: "product_whatsapp_inquiry",
                productId: item.productId,
                quantity: item.quantity,
              });
        } catch {}
      } else if (url.origin === location.origin) {
        const campaign = anchor.dataset.analyticsCampaign;
        if (campaign)
          track({
            name: "campaign_selected",
            campaignId: campaign,
            location: "hero",
          });
        const category =
          url.pathname === "/colecciones"
            ? url.searchParams.get("category")
            : null;
        if (
          category &&
          CATEGORIES.includes(category as (typeof CATEGORIES)[number])
        )
          track({
            name: "category_selected",
            category: category as (typeof CATEGORIES)[number],
            location: where,
          });
      }
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  return <>{children}</>;
}
export function useImpression<T extends HTMLElement = HTMLElement>(
  event: CommercialEvent,
  key: string,
) {
  const ref = useRef<T | null>(null),
    state = useAnalytics();
  const serialized = JSON.stringify(event);
  useEffect(() => {
    if (!state.active || !ref.current) return;
    let visible = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      cancel();
      if (visible && !document.hidden)
        timer = setTimeout(() => {
          analytics.trackOnce(
            "impression:" + key,
            JSON.parse(serialized) as CommercialEvent,
          );
        }, 1000);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = Boolean(
          entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.5,
        );
        schedule();
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(ref.current);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      cancel();
      observer.disconnect();
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [state.active, state.navigation, serialized, key]);
  return ref;
}

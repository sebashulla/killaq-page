import {
  landingTraffic,
  pageKind,
  type CommercialEvent,
  type Device,
  type EventEnvelope,
  type PageKind,
} from "./core";
export type Preferences = {
  enabled: boolean;
  decision: "unset" | "granted" | "denied";
  version: string;
  campaigns: string[];
};
export const LOCAL_DENIAL_KEY = "killaq-analytics-denied";
const PREFERENCE_LIFETIME = 180 * 86400000;
type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function hasLocalDenial(storage: PreferenceStorage, now = Date.now()) {
  try {
    const raw = storage.getItem(LOCAL_DENIAL_KEY);
    if (!raw) return false;
    const value = JSON.parse(raw) as { expires?: unknown };
    if (
      typeof value?.expires === "number" &&
      Number.isFinite(value.expires) &&
      value.expires > now
    )
      return true;
    storage.removeItem(LOCAL_DENIAL_KEY);
  } catch {
    // An unavailable browser store must not prevent using the shop.
  }
  return false;
}
export function rememberLocalDenial(
  storage: PreferenceStorage,
  now = Date.now(),
) {
  storage.setItem(
    LOCAL_DENIAL_KEY,
    JSON.stringify({ expires: now + PREFERENCE_LIFETIME }),
  );
}
export type AnalyticsSnapshot = Preferences & {
  active: boolean;
  navigation: number;
  error: string;
};
const initial: AnalyticsSnapshot = {
  enabled: false,
  decision: "unset",
  version: "",
  campaigns: [],
  active: false,
  navigation: 0,
  error: "",
};
type Transport = (events: EventEnvelope[]) => Promise<void>;
export class AnalyticsEngine {
  private snapshot = initial;
  private listeners = new Set<() => void>();
  private once = new Set<string>();
  private queue: EventEnvelope[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private path = "";
  private page: PageKind | null = null;
  private device: Device = "desktop";
  private internal = false;
  private landingUrl = "";
  private landingReferrer = "";
  private traffic = {
    source: "direct",
    medium: "direct",
    campaign: "sin-campana",
  };
  constructor(
    private transport: Transport,
    private uuid: () => string = () => crypto.randomUUID(),
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => initial;
  private update(patch: Partial<AnalyticsSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  configure(preferences: Preferences) {
    if (
      preferences.decision === "granted" &&
      this.snapshot.decision !== "granted"
    ) {
      this.once.clear();
      this.update({ navigation: this.snapshot.navigation + 1 });
    }
    if (this.landingUrl)
      this.traffic = landingTraffic(
        this.landingUrl,
        this.landingReferrer,
        preferences.campaigns,
      );
    this.update({
      ...preferences,
      active:
        preferences.enabled &&
        preferences.decision === "granted" &&
        !this.internal &&
        Boolean(this.page),
      error: "",
    });
    if (!this.snapshot.active) this.clear();
    else if (this.page)
      this.trackOnce("page", { name: "page_view", page: this.page });
  }
  navigate(url: string, referrer = "", internal = false, width = 1440) {
    const parsed = new URL(url),
      page = pageKind(parsed.pathname),
      key = parsed.pathname + parsed.search;
    if (!this.landingUrl) {
      this.landingUrl = url;
      this.landingReferrer = referrer;
    }
    this.internal = internal;
    this.page = page;
    this.device =
      width <= 700 ? "mobile" : width <= 1100 ? "tablet" : "desktop";
    if (this.path !== key) {
      this.path = key;
      this.once.clear();
      this.update({ navigation: this.snapshot.navigation + 1 });
    }
    if (!this.snapshot.active)
      this.traffic = landingTraffic(
        this.landingUrl,
        this.landingReferrer,
        this.snapshot.campaigns,
      );
    this.update({
      active:
        this.snapshot.enabled &&
        this.snapshot.decision === "granted" &&
        !internal &&
        Boolean(page),
    });
    if (!this.snapshot.active) this.clear();
    else if (page) this.trackOnce("page", { name: "page_view", page });
  }
  track(event: CommercialEvent) {
    if (!this.snapshot.active || !this.page) return false;
    this.queue.push({
      id: this.uuid(),
      event,
      page: this.page,
      device: this.device,
      traffic: this.traffic,
    });
    if (this.queue.length >= 20) void this.flush();
    else if (!this.timer) this.timer = setTimeout(() => void this.flush(), 250);
    return true;
  }
  trackOnce(key: string, event: CommercialEvent) {
    if (this.once.has(key) || !this.snapshot.active) return false;
    this.once.add(key);
    return this.track(event);
  }
  stopLocally(error = "") {
    this.clear();
    this.update({ decision: "denied", active: false, error });
  }
  private clear() {
    this.queue = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.flushing || !this.snapshot.active || !this.queue.length) return;
    const batch = this.queue.splice(0, 20);
    this.flushing = true;
    try {
      await this.transport(batch);
    } catch {
      /* Measurement loss never blocks navigation or commerce. No blind retry. */
    } finally {
      this.flushing = false;
      if (this.snapshot.active && this.queue.length)
        this.timer = setTimeout(() => void this.flush(), 250);
    }
  }
}
let sessionToken: string | undefined;
export function setAnalyticsSessionToken(token: string | undefined) {
  sessionToken = token;
}
export const analytics = new AnalyticsEngine(async (events) => {
  const response = await fetch("/api/analytics/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    credentials: "same-origin",
    referrerPolicy: "origin",
    body: JSON.stringify({ events }),
    keepalive: true,
  });
  if (!response.ok) throw new Error("Medición no disponible");
});
export function track(event: CommercialEvent) {
  return analytics.track(event);
}
export function trackOnce(key: string, event: CommercialEvent) {
  return analytics.trackOnce(key, event);
}

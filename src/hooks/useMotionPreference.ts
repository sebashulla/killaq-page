"use client";
import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const serverSnapshot = () => false;
const snapshot = () => window.matchMedia(query).matches;
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

// Use the same first snapshot on the server and during hydration.
// The browser preference is applied immediately after hydration and stays live.
export function useMotionPreference() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

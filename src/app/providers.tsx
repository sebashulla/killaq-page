"use client";

import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { StorefrontProvider } from "@/context/StorefrontContext";
import AnalyticsProvider from "@/components/analytics/AnalyticsProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AnalyticsProvider><CartProvider><StorefrontProvider>{children}</StorefrontProvider></CartProvider></AnalyticsProvider>
    </AuthProvider>
  );
}

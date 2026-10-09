"use client";

import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { StorefrontProvider } from "@/context/StorefrontContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider><StorefrontProvider>{children}</StorefrontProvider></CartProvider>
    </AuthProvider>
  );
}

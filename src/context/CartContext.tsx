"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/types/catalog";
import { addCartItem, changeCartQuantity, parseStoredCart } from "@/utils/cart";

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (id: string, quantity: number, size?: string) => void;
  removeItem: (id: string, size?: string) => void;
  clearCart: () => void;
  refreshItems: (products: { id: string; price: number; stock: number }[]) => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "killaq-cart";

function itemKey(id: string, size?: string) {
  return `${id}:${size || "default"}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setItems(parseStoredCart(window.localStorage.getItem(STORAGE_KEY))); } catch { setItems([]); }
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* Keep the cart usable without storage. */ }
  }, [hydrated, items]);

  const refreshItems = useCallback((products: { id: string; price: number; stock: number }[]) => setItems(current => current.map(item => {
    const product = products.find(product => product.id === item.id);
    return product ? { ...item, price: Number(product.price), stock: product.stock } : { ...item, stock: 0 };
  })), []);

  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      items,
      totalItems,
      subtotal,
      addItem: (item, quantity = 1) => {
        setItems(current => addCartItem(current, item, quantity));
      },
      updateQuantity: (id, quantity, size) => {
        setItems(current => changeCartQuantity(current, id, quantity, size));
      },
      removeItem: (id, size) => {
        setItems((current) =>
          current.filter((entry) => itemKey(entry.id, entry.size) !== itemKey(id, size))
        );
      },
      clearCart: () => setItems([]),
      refreshItems,
    };
  }, [items, refreshItems]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}

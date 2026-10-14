"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CartItem } from "@/types/catalog";
import { addCartItem, changeCartQuantity, parseStoredCart } from "@/utils/cart";
import { track } from '@/lib/analytics/client';

interface CartContextValue {
  ready: boolean;
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => boolean;
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
  const currentItems = useRef<CartItem[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { currentItems.current=parseStoredCart(window.localStorage.getItem(STORAGE_KEY)); } catch { currentItems.current=[]; }
      setItems(currentItems.current);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* Keep the cart usable without storage. */ }
  }, [hydrated, items]);

  const refreshItems = useCallback((products: { id: string; price: number; stock: number }[]) => {const next=currentItems.current.map(item => {
    const product = products.find(product => product.id === item.id);
    return product ? { ...item, price: Number(product.price), stock: product.stock } : { ...item, stock: 0 };
  });currentItems.current=next;setItems(next);}, []);

  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      ready: hydrated,
      items,
      totalItems,
      subtotal,
      addItem: (item, quantity = 1) => {
        const previous=currentItems.current;
        const next=addCartItem(previous,item,quantity);
        const before=previous.filter(entry=>entry.id===item.id).reduce((sum,entry)=>sum+entry.quantity,0);
        const after=next.filter(entry=>entry.id===item.id).reduce((sum,entry)=>sum+entry.quantity,0);
        currentItems.current=next;setItems(next);
        if(after>before)track({name:'add_to_cart',productId:item.id,quantity:after-before});
        return after>before;
      },
      updateQuantity: (id, quantity, size) => {
        const previous=currentItems.current;
        const next=changeCartQuantity(previous,id,quantity,size);
        const before=previous.find(entry=>itemKey(entry.id,entry.size)===itemKey(id,size))?.quantity||0;
        const after=next.find(entry=>itemKey(entry.id,entry.size)===itemKey(id,size))?.quantity||0;
        currentItems.current=next;setItems(next);
        if(after!==before)track({name:after>before?'add_to_cart':'remove_from_cart',productId:id,quantity:Math.abs(after-before)});
      },
      removeItem: (id, size) => {
        const removed=currentItems.current.find(entry=>itemKey(entry.id,entry.size)===itemKey(id,size));
        const next=currentItems.current.filter(entry=>itemKey(entry.id,entry.size)!==itemKey(id,size));
        currentItems.current=next;setItems(next);
        if(removed)track({name:'remove_from_cart',productId:id,quantity:removed.quantity});
      },
      clearCart: () => {const removed=currentItems.current;currentItems.current=[];setItems([]);for(const item of removed)track({name:'remove_from_cart',productId:item.id,quantity:item.quantity});},
      refreshItems,
    };
  }, [items, refreshItems,hydrated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}

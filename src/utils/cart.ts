import type { CartItem } from "../types/catalog";

export function cartItemKey(id: string, size?: string) { return `${id}:${size || "default"}`; }
function validQuantity(value: number) { return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1; }
export function availableQuantity(items: CartItem[], item: Pick<CartItem, "id" | "size" | "stock">) {
  const otherSizes = items.filter(entry => entry.id === item.id && cartItemKey(entry.id, entry.size) !== cartItemKey(item.id, item.size)).reduce((sum, entry) => sum + entry.quantity, 0);
  return item.stock === undefined ? 99 : Math.max(0, Math.floor(item.stock) - otherSizes);
}
export function addCartItem(items: CartItem[], item: Omit<CartItem, "quantity">, quantity = 1): CartItem[] {
  const key = cartItemKey(item.id, item.size);
  const existing = items.find(entry => cartItemKey(entry.id, entry.size) === key);
  const limit = availableQuantity(items, item);
  if (limit === 0) return items;
  const next = { ...item, quantity: Math.min(limit, (existing?.quantity || 0) + validQuantity(quantity)) };
  return existing ? items.map(entry => cartItemKey(entry.id, entry.size) === key ? next : entry) : [...items, next];
}
export function changeCartQuantity(items: CartItem[], id: string, quantity: number, size?: string): CartItem[] {
  return items.map(entry => cartItemKey(entry.id, entry.size) === cartItemKey(id, size) ? { ...entry, quantity: Math.min(Math.max(1, availableQuantity(items, entry)), validQuantity(quantity)) } : entry);
}
export function parseStoredCart(saved: string | null): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(saved || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.reduce<CartItem[]>((items, item: Partial<CartItem> | null) => {
      if (!item || typeof item.id !== "string" || typeof item.slug !== "string" || typeof item.name !== "string" || typeof item.imageUrl !== "string" || typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0 || typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity < 1 || (item.size !== undefined && typeof item.size !== "string") || (item.stock !== undefined && (typeof item.stock !== "number" || !Number.isFinite(item.stock) || item.stock < 0))) return items;
      return addCartItem(items, item as CartItem, item.quantity);
    }, []);
  } catch { return []; }
}

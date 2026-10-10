import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartItem, DeliveryArea } from '../types';

type CartValue = {
  items: CartItem[]; count: number; subtotal: number;
  deliveryArea: DeliveryArea; setDeliveryArea: (area: DeliveryArea) => void;
  add: (item: Omit<CartItem, 'key'>) => void;
  buyNow: (item: Omit<CartItem, 'key'>) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void; clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);
const storageKey = 'nix-storefront-cart-v1';
const deliveryAreaStorageKey = 'nix-storefront-delivery-area-v2';
const validDeliveryAreas: DeliveryArea[] = ['OUTSIDE_DHAKA', 'SUB_AREA', 'DHAKA_CITY'];

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  const [deliveryArea, setDeliveryArea] = useState<DeliveryArea>(() => {
    try { const saved = localStorage.getItem(deliveryAreaStorageKey) as DeliveryArea | null; return saved && validDeliveryAreas.includes(saved) ? saved : 'OUTSIDE_DHAKA'; }
    catch { return 'OUTSIDE_DHAKA'; }
  });
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem(deliveryAreaStorageKey, deliveryArea); }, [deliveryArea]);

  const value = useMemo<CartValue>(() => ({
    items,
    deliveryArea,
    setDeliveryArea,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    add: (next) => setItems((current) => {
      const key = `${next.productId}:${next.variantId || 'simple'}`;
      const found = current.find((item) => item.key === key);
      return found
        ? current.map((item) => item.key === key ? { ...item, quantity: Math.min(item.quantity + next.quantity, item.stockQuantity) } : item)
        : [...current, { ...next, key }];
    }),
    buyNow: (next) => setItems([{ ...next, key: `${next.productId}:${next.variantId || 'simple'}` }]),
    setQuantity: (key, quantity) => setItems((current) => current.map((item) => item.key === key ? { ...item, quantity: Math.max(1, Math.min(quantity, item.stockQuantity)) } : item)),
    remove: (key) => setItems((current) => current.filter((item) => item.key !== key)),
    clear: () => setItems([]),
  }), [items, deliveryArea]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartItem, CartSummary } from '../types/cart';
import type { Product } from '../types/product';
import {
  addCartItem, CART_STORAGE_KEY, cartKey, cartSummary, parseStoredCart,
  removeCartItem, serializeCart, setCartItemQuantity, syncCartProducts,
} from './cartState';

interface CartContextValue extends CartSummary {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addProduct: (product: Product, quantity: number) => number;
  quantityFor: (product: Pick<Product, 'business' | 'id'>) => number;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  syncProducts: (products: Product[]) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function initialItems() {
  if (typeof window === 'undefined') return [];
  try { return parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY)); } catch { return []; }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [isOpen, setOpen] = useState(false);
  useEffect(() => {
    try { window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(items)); } catch { /* The in-memory cart remains usable. */ }
  }, [items]);
  const addProduct = useCallback((product: Product, quantity: number) => {
    const result = addCartItem(items, product, quantity);
    if (result.added) setItems(result.items);
    return result.added;
  }, [items]);
  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => setOpen(false), []);
  const setQuantity = useCallback((key: string, quantity: number) =>
    setItems(current => setCartItemQuantity(current, key, quantity)), []);
  const removeItem = useCallback((key: string) => setItems(current => removeCartItem(current, key)), []);
  const syncProducts = useCallback((products: Product[]) =>
    setItems(current => syncCartProducts(current, products)), []);
  const quantityFor = useCallback((product: Pick<Product, 'business' | 'id'>) =>
    items.find(item => item.key === cartKey(product))?.quantity ?? 0, [items]);
  const value = useMemo<CartContextValue>(() => ({
    items,
    ...cartSummary(items),
    isOpen,
    openCart,
    closeCart,
    addProduct,
    quantityFor,
    setQuantity,
    removeItem,
    syncProducts,
  }), [addProduct, closeCart, isOpen, items, openCart, quantityFor, removeItem, setQuantity, syncProducts]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}

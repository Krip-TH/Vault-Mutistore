import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  addCartItem, CART_STORAGE_KEY, cartKey, cartSummary, parseStoredCart,
  removeCartItem, serializeCart, setCartItemQuantity, syncCartProducts,
} from './cartState';
import type { CartItem, CartSummary, Product } from '../types';

interface CartContextValue extends CartSummary {
  items: CartItem[];
  loaded: boolean;
  addProduct: (product: Product, quantity: number) => number;
  quantityFor: (product: Pick<Product, 'business' | 'id'>) => number;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  syncProducts: (products: Product[]) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const hydrating = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem(CART_STORAGE_KEY)
      .then(raw => setItems(parseStoredCart(raw)))
      .catch(() => { /* The in-memory cart remains usable. */ })
      .finally(() => { hydrating.current = false; setLoaded(true); });
  }, []);

  useEffect(() => {
    if (hydrating.current) return; // Don't overwrite storage with the empty initial state.
    AsyncStorage.setItem(CART_STORAGE_KEY, serializeCart(items)).catch(() => {
      /* The in-memory cart remains usable. */
    });
  }, [items]);

  const addProduct = useCallback((product: Product, quantity: number) => {
    let added = 0;
    setItems(current => {
      const result = addCartItem(current, product, quantity);
      added = result.added;
      return result.added ? result.items : current;
    });
    return added;
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems(current => setCartItemQuantity(current, key, quantity));
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems(current => removeCartItem(current, key));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const syncProducts = useCallback((products: Product[]) => {
    setItems(current => syncCartProducts(current, products));
  }, []);

  const quantityFor = useCallback(
    (product: Pick<Product, 'business' | 'id'>) => items.find(item => item.key === cartKey(product))?.quantity ?? 0,
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      loaded,
      ...cartSummary(items),
      addProduct,
      quantityFor,
      setQuantity,
      removeItem,
      clearCart,
      syncProducts,
    }),
    [addProduct, clearCart, items, loaded, quantityFor, removeItem, setQuantity, syncProducts],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}

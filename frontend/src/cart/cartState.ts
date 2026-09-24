import type { CartItem, CartProduct, CartSummary } from '../types/cart';
import type { BusinessType, Product, StockStatus } from '../types/product';
import { hasNumber, textValue } from '../utils/product';

export const CART_STORAGE_KEY = 'moodeng-cart-v1';
const businesses = new Set<BusinessType>(['door', 'plug', 'brandname', 'clothing', 'powerbank', 'projector']);
const statuses = new Set<StockStatus>(['In Stock', 'Low Stock', 'Out of Stock']);

export function cartKey(product: Pick<Product, 'business' | 'id'>): string {
  return JSON.stringify([product.business, product.id]);
}

export function cartProduct(product: Product): CartProduct {
  return {
    id: textValue(product.id),
    business: product.business,
    business_name: textValue(product.business_name),
    name: textValue(product.name),
    category: textValue(product.category),
    image_url: textValue(product.image_url),
    price: hasNumber(product.price) ? product.price : 0,
    stock: hasNumber(product.stock) ? Math.floor(product.stock) : 0,
    unit: textValue(product.unit),
    status: statuses.has(product.status) ? product.status : 'Out of Stock',
  };
}

export function addCartItem(items: CartItem[], product: Product, requestedQuantity: number) {
  const snapshot = cartProduct(product);
  const requested = Number.isSafeInteger(requestedQuantity) ? Math.max(1, requestedQuantity) : 1;
  if (!snapshot.id || !businesses.has(snapshot.business) || snapshot.stock < 1 || snapshot.status === 'Out of Stock') {
    return { items, added: 0 };
  }
  const key = cartKey(snapshot);
  const existing = items.find(item => item.key === key);
  const current = existing?.quantity ?? 0;
  const added = Math.max(0, Math.min(requested, snapshot.stock - current));
  if (!added) return { items, added: 0 };
  const next: CartItem = { key, product: snapshot, quantity: current + added };
  return { items: existing ? items.map(item => item.key === key ? next : item) : [...items, next], added };
}

export function setCartItemQuantity(items: CartItem[], key: string, requestedQuantity: number): CartItem[] {
  return items.map(item => {
    if (item.key !== key || item.product.stock < 1 || item.product.status === 'Out of Stock') return item;
    const requested = Number.isSafeInteger(requestedQuantity) ? requestedQuantity : item.quantity;
    return { ...item, quantity: Math.max(1, Math.min(requested, item.product.stock)) };
  });
}

export function removeCartItem(items: CartItem[], key: string): CartItem[] {
  return items.filter(item => item.key !== key);
}

export function syncCartProducts(items: CartItem[], products: Product[]): CartItem[] {
  if (!products.length) return items;
  const current = new Map(products.map(product => [cartKey(product), product]));
  return items.map(item => {
    const product = current.get(item.key);
    if (!product) return item;
    const snapshot = cartProduct(product);
    return {
      ...item,
      product: snapshot,
      quantity: snapshot.stock > 0 ? Math.min(item.quantity, snapshot.stock) : item.quantity,
    };
  });
}

export function cartSummary(items: CartItem[]): CartSummary {
  return items.reduce<CartSummary>((summary, item) => ({
    itemCount: summary.itemCount + item.quantity,
    subtotal: summary.subtotal + item.product.price * item.quantity,
    hasUnavailableItems: summary.hasUnavailableItems || item.product.stock < 1 || item.product.status === 'Out of Stock',
  }), { itemCount: 0, subtotal: 0, hasUnavailableItems: false });
}

export function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.items)) return [];
    const unique = new Map<string, CartItem>();
    for (const value of parsed.items) {
      const item = parseItem(value);
      if (item) unique.set(item.key, item);
    }
    return [...unique.values()];
  } catch {
    return [];
  }
}

export function serializeCart(items: CartItem[]): string {
  return JSON.stringify({ version: 1, items });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseItem(value: unknown): CartItem | null {
  if (!isRecord(value) || !isRecord(value.product) || !Number.isSafeInteger(value.quantity) || Number(value.quantity) < 1) return null;
  const product = value.product;
  if (!businesses.has(product.business as BusinessType) || !statuses.has(product.status as StockStatus) ||
    !hasNumber(product.price) || !hasNumber(product.stock)) return null;
  const snapshot: CartProduct = {
    id: textValue(product.id), business: product.business as BusinessType,
    business_name: textValue(product.business_name), name: textValue(product.name),
    category: textValue(product.category), image_url: textValue(product.image_url),
    price: product.price, stock: Math.floor(product.stock), unit: textValue(product.unit),
    status: product.status as StockStatus,
  };
  const key = cartKey(snapshot);
  if (!snapshot.id || value.key !== key) return null;
  const quantity = snapshot.stock > 0 ? Math.min(Number(value.quantity), snapshot.stock) : Number(value.quantity);
  return { key, product: snapshot, quantity };
}

import type { Product } from '../types/product';

export function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function imageUrls(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.map(textValue).filter(Boolean))] : [];
}

export function hasNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function cartCount(items: Record<string, number>): number {
  return Object.values(items).reduce((total, quantity) =>
    total + (Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0), 0);
}

export function purchaseState(product: Product, bagQuantity: number, quantity: number, inventoryAvailable = true) {
  const stock = hasNumber(product.stock) ? Math.floor(product.stock) : 0;
  const bag = Number.isSafeInteger(bagQuantity) && bagQuantity > 0 ? bagQuantity : 0;
  const remaining = Math.max(0, stock - bag);
  const canAdd = inventoryAvailable && hasNumber(product.price) && product.status !== 'Out of Stock' && remaining > 0;
  return {
    stock,
    remaining,
    canAdd,
    quantity: Math.max(1, Math.min(Number.isSafeInteger(quantity) ? quantity : 1, remaining)),
  };
}

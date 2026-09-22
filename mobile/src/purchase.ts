import type { Product } from './types';

function hasNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Ported from frontend/src/utils/product.ts — identical stock-clamping rules. */
export function purchaseState(product: Product, cartQuantity: number, quantity: number) {
  const stock = hasNumber(product.stock) ? Math.floor(product.stock) : 0;
  const inCart = Number.isSafeInteger(cartQuantity) && cartQuantity > 0 ? cartQuantity : 0;
  const remaining = Math.max(0, stock - inCart);
  const canAdd = hasNumber(product.price) && product.status !== 'Out of Stock' && remaining > 0;
  return {
    stock,
    remaining,
    canAdd,
    quantity: Math.max(1, Math.min(Number.isSafeInteger(quantity) ? quantity : 1, remaining || 1)),
  };
}

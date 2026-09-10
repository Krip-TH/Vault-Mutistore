import type { NormalizedProduct } from '../../types/product.js';
import { getStockStatus } from '../../utils/stockStatus.js';
import type { ProductAdapter } from '../types.js';

export const business = 'projector' as const;
export const businessName = 'Projector';

export function normalizeProduct(sourceProduct: unknown): NormalizedProduct {
  const product = sourceProduct as Record<string, unknown>;
  const stock = Number(product.stock ?? 0);

  return {
    id: String(product.id ?? ''),
    business,
    business_name: businessName,
    name: String(product.name ?? ''),
    category: String(product.category ?? ''),
    price: Number(product.price ?? 0),
    stock,
    unit: String(product.unit ?? 'pcs'),
    status: getStockStatus(stock),
    image_url: String(product.image_url ?? ''),
    updated_at: String(product.updated_at ?? new Date().toISOString()),
  };
}

export const projectorAdapter: ProductAdapter = {
  async getProducts() {
    // TODO: Request the real Projector API using PROJECTOR_API_URL.
    // Example: const response = await fetch(`${process.env.PROJECTOR_API_URL}/products`);
    // Adjust normalizeProduct() to match the real response fields.
    return [];
  },
};

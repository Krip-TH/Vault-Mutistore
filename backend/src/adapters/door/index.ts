import type { NormalizedProduct } from '../../types/product.js';
import { getStockStatus } from '../../utils/stockStatus.js';
import type { ProductAdapter } from '../types.js';

export const business = 'door' as const;
export const businessName = 'Door';

export function normalizeProduct(sourceProduct: unknown): NormalizedProduct {
  const product = sourceProduct as Record<string, unknown>;
  const stock = Number(product.StockQuantity ?? 0);

  return {
    id: String(product.ProductID ?? ''),
    business,
    business_name: businessName,
    name: String(product.ProductName ?? ''),
    category: String(product.CategoryName ?? ''),
    price: Number(product.Price ?? 0),
    stock,
    unit: 'pcs',
    status: getStockStatus(stock),
    image_url: String(product.ImageURL ?? ''),
    updated_at: String(product.UpdatedAt ?? new Date().toISOString()),
  };
}

export const doorAdapter: ProductAdapter = {
  async getProducts() {
    // TODO: Request the real Door Stock Product API using DOOR_API_URL.
    // Example: const response = await fetch(`${process.env.DOOR_API_URL}/products`);
    // Normalize each product from the API response with normalizeProduct().
    return [];
  },
};

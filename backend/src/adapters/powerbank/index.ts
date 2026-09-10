import type { NormalizedProduct } from '../../types/product.js';
import { getStockStatus } from '../../utils/stockStatus.js';
import type { ProductAdapter } from '../types.js';

export const business = 'powerbank' as const;
export const businessName = 'Powerbank';

export function normalizeProduct(sourceProduct: unknown): NormalizedProduct {
  const product = sourceProduct as Record<string, unknown>;
  const stock = Number(product.quantity_available ?? 0);

  return {
    id: String(product.sku ?? ''),
    business,
    business_name: businessName,
    name: String(product.title ?? ''),
    category: String(product.product_type ?? 'Powerbank'),
    price: Number(product.unit_price ?? 0),
    stock,
    unit: String(product.stock_unit ?? 'pcs'),
    status: getStockStatus(stock),
    image_url: String(product.image ?? ''),
    updated_at: String(product.last_modified ?? new Date().toISOString()),
  };
}

export const powerbankAdapter: ProductAdapter = {
  async getProducts() {
    // TODO: Request the real Powerbank API using POWERBANK_API_URL.
    // Example: const response = await fetch(`${process.env.POWERBANK_API_URL}/products`);
    // Normalize each product from the API response with normalizeProduct().
    return [];
  },
};

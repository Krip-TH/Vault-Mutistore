import type { NormalizedProduct } from '../../types/product.js';
import { getStockStatus } from '../../utils/stockStatus.js';
import type { ProductAdapter } from '../types.js';

export const business = 'plug' as const;
export const businessName = 'Electrical Plug';

/**
 * Live Plug API (http://<host>/api/products) returns a bare JSON array of
 * products shaped like:
 * { id: number, created_at: string, name: string, brand: string,
 *   category: string, price: string ("639.00"), price_tier: null,
 *   oldPrice: string, rating: number, stock: number,
 *   image: string, is_active: number }
 * There is no envelope wrapper and no `updated_at`/`image_url`/`unit` field,
 * so those are derived below.
 */
export function normalizeProduct(sourceProduct: unknown): NormalizedProduct {
  const product = sourceProduct as Record<string, unknown>;

  const price = Number(product.price ?? 0);
  const stock = Number(product.stock ?? 0);
  const safeStock = Number.isFinite(stock) ? stock : 0;

  return {
    id: String(product.id ?? ''),
    business,
    business_name: businessName,
    name: typeof product.name === 'string' ? product.name : '',
    category: typeof product.category === 'string' ? product.category : '',
    price: Number.isFinite(price) ? price : 0,
    stock: safeStock,
    unit: 'pcs',
    status: getStockStatus(safeStock),
    image_url: typeof product.image === 'string' ? product.image : '',
    updated_at: typeof product.created_at === 'string'
      ? product.created_at
      : new Date().toISOString(),
  };
}

export const plugAdapter: ProductAdapter = {
  async getProducts() {
    const url = process.env.PLUG_API_URL;
    if (!url) {
      throw new Error('PLUG_API_URL is not configured');
    }

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown network error';
      throw new Error(`Plug API request failed: ${detail}`, { cause: error });
    }

    if (!response.ok) {
      throw new Error(`Plug API request failed with HTTP ${response.status} ${response.statusText}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error('Plug API returned invalid JSON', { cause: error });
    }

    if (!Array.isArray(payload)) {
      throw new Error('Plug API response must be an array of products');
    }

    return payload.map(normalizeProduct);
  },
};

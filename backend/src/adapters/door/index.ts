import type { NormalizedProduct } from '../../types/product.js';
import { getStockStatus } from '../../utils/stockStatus.js';
import type { ProductAdapter } from '../types.js';

export const business = 'door' as const;
export const businessName = 'Door';

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Door API ${context} must be an object`);
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
    throw new Error(`Door API product has an invalid ${field}`);
  }

  return String(value);
}

function requiredNumber(value: unknown, field: string): number {
  if ((typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`Door API product has an invalid ${field}`);
  }

  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Door API product has an invalid ${field}`);
  }

  return number;
}

export function normalizeProduct(sourceProduct: unknown): NormalizedProduct {
  const product = asRecord(sourceProduct, 'product');
  const stock = requiredNumber(product.total_stock, 'total_stock');

  return {
    id: requiredString(product.product_id, 'product_id'),
    business,
    business_name: businessName,
    name: requiredString(product.product_name, 'product_name'),
    category: typeof product.category_name === 'string' ? product.category_name : '',
    price: requiredNumber(product.price, 'price'),
    stock,
    unit: 'pcs',
    status: getStockStatus(stock),
    image_url: typeof product.image_url === 'string' ? product.image_url : '',
    updated_at: typeof product.updated_at === 'string'
      ? product.updated_at
      : new Date().toISOString(),
  };
}

export const doorAdapter: ProductAdapter = {
  async getProducts() {
    const url = process.env.DOOR_API_URL;
    if (!url) {
      throw new Error('DOOR_API_URL is not configured');
    }

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown network error';
      throw new Error(`Door API request failed: ${detail}`, { cause: error });
    }

    if (!response.ok) {
      throw new Error(`Door API request failed with HTTP ${response.status} ${response.statusText}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error('Door API returned invalid JSON', { cause: error });
    }

    const envelope = asRecord(payload, 'response');
    if (envelope.success !== true || !Array.isArray(envelope.data)) {
      throw new Error('Door API response must contain success: true and a data array');
    }

    return envelope.data.map(normalizeProduct);
  },
};

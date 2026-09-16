import type { NormalizedProduct } from '../../types/product.js';
import { getStockStatus } from '../../utils/stockStatus.js';
import type { ProductAdapter } from '../types.js';

export const business = 'projector' as const;
export const businessName = 'Projector';

const defaultApiUrl = 'http://119.59.102.161:3005/api/products';

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  return 0;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

export function normalizeProduct(sourceProduct: unknown): NormalizedProduct {
  const product = asRecord(sourceProduct);
  const stock = asNumber(product.stock);

  return {
    id: asString(product.id),
    business,
    business_name: businessName,
    name: asString(product.name),
    category: asString(product.category),
    price: asNumber(product.price),
    stock,
    unit: asString(product.unit, 'pcs'),
    status: getStockStatus(stock),
    image_url: asString(product.image),
    updated_at: asString(product.lastUpdate, new Date().toISOString()),
  };
}

export const projectorAdapter: ProductAdapter = {
  async getProducts() {
    const url = process.env.PROJECTOR_API_URL ?? defaultApiUrl;

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown network error';
      throw new Error(`Projector API request failed: ${detail}`, { cause: error });
    }

    if (!response.ok) {
      throw new Error(`Projector API request failed with HTTP ${response.status} ${response.statusText}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error('Projector API returned invalid JSON', { cause: error });
    }

    if (!Array.isArray(payload)) {
      throw new Error('Projector API response must be a product array');
    }

    return payload.map(normalizeProduct);
  },
};

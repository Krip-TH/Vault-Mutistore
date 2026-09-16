import type { NormalizedProduct } from '../../types/product.js';
import { getStockStatus } from '../../utils/stockStatus.js';
import type { ProductAdapter } from '../types.js';

export const business = 'powerbank' as const;
export const businessName = 'Powerbank';

const DEFAULT_API_URL = 'http://localhost:4000/api/powerbank';
const REQUEST_TIMEOUT_MS = 10_000;

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function asString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value);

  return text === '' ? fallback : text;
}

/**
 * The Powerbank Stock Product API (powerbank-api/) returns products shaped
 * like: { id: string, name: string, brand: string, price: number,
 * stock: number, description: string, image: string, category: "Powerbank",
 * createdAt: string, updatedAt: string }.
 */
export function normalizeProduct(sourceProduct: unknown): NormalizedProduct {
  const product = asRecord(sourceProduct);
  const stock = asNumber(product.stock);

  return {
    id: asString(product.id),
    business,
    business_name: businessName,
    name: asString(product.name),
    category: asString(product.category, 'Powerbank'),
    price: asNumber(product.price),
    stock,
    unit: 'pcs',
    status: getStockStatus(stock),
    image_url: asString(product.image),
    updated_at: asString(product.updatedAt, new Date().toISOString()),
  };
}

function extractProductList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const data = (payload as Record<string, unknown> | null)?.data;

  return Array.isArray(data) ? data : [];
}

export const powerbankAdapter: ProductAdapter = {
  async getProducts(): Promise<NormalizedProduct[]> {
    const url = process.env.POWERBANK_API_URL || DEFAULT_API_URL;

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Powerbank API responded with ${response.status} ${response.statusText}`);
      }

      return extractProductList(await response.json()).map(normalizeProduct);
    } catch (error) {
      // Adapters are aggregated with Promise.all, so a Powerbank outage must not
      // take down the other businesses.
      console.error('[powerbank] Failed to load products:', error);
      return [];
    }
  },
};

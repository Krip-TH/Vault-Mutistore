import type { NormalizedProduct } from '../../types/product.js';
import { getStockStatus } from '../../utils/stockStatus.js';
import type { ProductAdapter } from '../types.js';

export const business = 'brandname' as const;
export const businessName = 'Brandname';

const DEFAULT_API_URL = 'http://119.59.102.161:3063/api/products';
const PRODUCTS_PATH = '/products';
const REQUEST_TIMEOUT_MS = 10_000;

function toNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value);

  return text === '' ? fallback : text;
}

export function normalizeProduct(sourceProduct: unknown): NormalizedProduct {
  const product = (sourceProduct ?? {}) as Record<string, unknown>;
  // The source schema renamed `stock_quantity` to `total_stock`; `total_stock` is
  // the column the Brandname API reads and writes for every stock operation, so it
  // holds the available quantity. The legacy `stock_quantity` field is unused.
  const stock = toNumber(product.total_stock);

  return {
    id: toText(product.id),
    business,
    business_name: businessName,
    name: toText(product.name),
    category: toText(product.category),
    // The API returns price as a decimal string such as "4800.00".
    price: toNumber(product.price),
    stock,
    unit: 'pcs',
    status: getStockStatus(stock),
    image_url: toText(product.image_url),
    updated_at: toText(product.updated_at, new Date().toISOString()),
  };
}

function extractProductList(payload: unknown): unknown[] | undefined {
  // The live API responds with a bare JSON array. API_CONTRACT.md also allows a
  // `data` wrapper, so accept that shape too.
  if (Array.isArray(payload)) {
    return payload;
  }

  const data = (payload as Record<string, unknown> | null)?.data;

  return Array.isArray(data) ? data : undefined;
}

export const brandnameAdapter: ProductAdapter = {
  async getProducts(): Promise<NormalizedProduct[]> {
    const configuredUrl = (process.env.BRANDNAME_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
    const url = configuredUrl.endsWith(PRODUCTS_PATH)
      ? configuredUrl
      : `${configuredUrl}${PRODUCTS_PATH}`;

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Brandname API responded with ${response.status} ${response.statusText}`);
      }

      const products = extractProductList(await response.json());
      if (!products) throw new Error('Brandname API response must contain a product array');
      return products.map(normalizeProduct);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown upstream error';
      throw new Error(`Brandname API request failed: ${detail}`, { cause: error });
    }
  },
};

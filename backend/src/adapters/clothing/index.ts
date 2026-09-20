import type { NormalizedProduct } from '../../types/product.js';
import { getStockStatus } from '../../utils/stockStatus.js';
import type { ProductAdapter } from '../types.js';

export const business = 'clothing' as const;
export const businessName = 'Clothing';
const REQUEST_TIMEOUT_MS = 10_000;

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function firstValue(source: Record<string, unknown>, keys: string[]): unknown {
  const key = keys.find((candidate) => source[candidate] !== undefined && source[candidate] !== null);

  return key ? source[key] : undefined;
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text === '' ? fallback : text;
  }

  return fallback;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function buildProductsUrl(configuredUrl: string): string {
  const url = new URL(configuredUrl);
  const path = url.pathname.replace(/\/+$/, '');

  if (!path.endsWith('/products')) {
    url.pathname = `${path}/products`;
  }

  return url.toString();
}

function extractProductList(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) {
    return payload;
  }

  const envelope = asRecord(payload);
  const productList = firstValue(envelope, ['data', 'products', 'items', 'result']);

  return Array.isArray(productList) ? productList : undefined;
}

export function normalizeProduct(sourceProduct: unknown): NormalizedProduct {
  const product = asRecord(sourceProduct);
  const stock = asNumber(firstValue(product, [
    'stock',
    'quantity',
    'qty',
    'total_stock',
    'stock_quantity',
    'inventory',
    'quantity_available',
  ]));

  return {
    id: asString(firstValue(product, ['id', 'product_id', 'productId', 'sku', 'SKU', 'model'])),
    business,
    business_name: businessName,
    name: asString(firstValue(product, ['name', 'product_name', 'productName', 'title'])),
    category: asString(firstValue(product, ['category', 'category_name', 'categoryName', 'type', 'product_type']), 'Clothing'),
    price: asNumber(firstValue(product, ['price', 'unit_price', 'sale_price', 'product_price'])),
    stock,
    unit: asString(firstValue(product, ['unit', 'stock_unit']), 'pcs'),
    status: getStockStatus(stock),
    image_url: asString(firstValue(product, ['image_url', 'imageUrl', 'image', 'thumbnail'])),
    updated_at: asString(
      firstValue(product, ['updated_at', 'updatedAt', 'last_modified', 'lastUpdate', 'created_at']),
      new Date().toISOString(),
    ),
  };
}

export const clothingAdapter: ProductAdapter = {
  async getProducts() {
    const configuredUrl = process.env.CLOTHING_API_URL;
    if (!configuredUrl) {
      throw new Error('CLOTHING_API_URL is not configured');
    }

    try {
      const response = await fetch(buildProductsUrl(configuredUrl), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Clothing API responded with ${response.status} ${response.statusText}`);
      }

      const products = extractProductList(await response.json());
      if (!products) {
        throw new Error('Clothing API response must be an array or contain a product array');
      }

      return products.map(normalizeProduct);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown upstream error';
      throw new Error(`Clothing API request failed: ${detail}`, { cause: error });
    }
  },
};

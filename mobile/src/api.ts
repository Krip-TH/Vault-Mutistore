import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import type { BusinessAvailability, Product, ProductsResponse } from './types';

export interface ProductsResult {
  products: Product[];
  businesses: BusinessAvailability[];
}

export async function fetchProducts(): Promise<ProductsResult> {
  const response = await fetch(`${API_BASE_URL}/api/products`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`The products API returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as ProductsResponse;
  if (!Array.isArray(payload.data)) {
    throw new Error('The products API returned an unexpected response.');
  }

  return {
    products: payload.data,
    businesses: Array.isArray(payload.businesses) ? payload.businesses : [],
  };
}

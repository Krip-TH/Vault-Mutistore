import { productService } from '../productService.js';
import type { NormalizedProduct } from '../../types/product.js';
import { TtlCache } from './cache.js';

const CACHE_TTL_MS = 20_000; // 20 seconds
const CACHE_KEY = 'products';

const cache = new TtlCache<NormalizedProduct[]>(CACHE_TTL_MS);

/**
 * Aggregating all six business adapters is a real network round-trip (~2s even when nothing
 * is wrong) and every AI feature needs the current catalog. A shopper browsing several
 * products within the same few seconds shouldn't pay for six fresh adapter calls each time.
 * This cache is scoped to the AI feature layer only — it never touches productService.ts or
 * GET /api/products, so that endpoint stays exactly as fresh as it always was.
 */
export async function getCachedProducts(): Promise<NormalizedProduct[]> {
  const cached = cache.get(CACHE_KEY);
  if (cached) return cached;

  const products = (await productService.getProductAggregation()).products;
  cache.set(CACHE_KEY, products);
  return products;
}

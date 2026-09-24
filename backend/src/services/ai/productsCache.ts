import { productService } from '../productService.js';
import type { NormalizedProduct } from '../../types/product.js';
import { TtlCache } from './cache.js';

const CACHE_TTL_MS = 20_000; // 20 seconds
const CACHE_KEY = 'products';

const cache = new TtlCache<NormalizedProduct[]>(CACHE_TTL_MS);
let inFlight: Promise<NormalizedProduct[]> | null = null;

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

  if (inFlight) return inFlight;
  inFlight = productService.getProductAggregation()
    .then(aggregation => {
      cache.set(CACHE_KEY, aggregation.products);
      return aggregation.products;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

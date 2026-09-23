import type { BestSellersResponse } from '../types/product';

type Fetcher = typeof fetch;

export async function fetchBestSellers(limit = 10, fetcher: Fetcher = fetch): Promise<BestSellersResponse> {
  const response = await fetcher(`/api/products/best-sellers?limit=${encodeURIComponent(limit)}`, {
    credentials: 'same-origin', headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    let message = 'Unable to load best sellers right now.';
    try {
      const payload = await response.json() as { error?: { message?: string } };
      if (payload.error?.message) message = payload.error.message;
    } catch { /* Use the safe fallback. */ }
    throw new Error(message);
  }
  const payload = await response.json() as BestSellersResponse;
  if (!Array.isArray(payload.data)) throw new Error('The best sellers response was invalid.');
  return payload;
}

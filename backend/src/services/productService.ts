import { adapters } from '../adapters/index.js';
import type { NormalizedProduct } from '../types/product.js';
import { getStockStatus } from '../utils/stockStatus.js';

function getConfiguredUrl(business: string): string {
  return process.env[`${business.toUpperCase()}_API_URL`] || '(adapter default)';
}

const mockProducts: NormalizedProduct[] = [{
  id: 'door-demo-001', business: 'door', business_name: 'Door', name: 'Sample Door',
  category: 'Door', price: 0, stock: 0, unit: 'pcs', status: getStockStatus(0),
  image_url: '', updated_at: new Date(0).toISOString(),
}];

export const productService = {
  getProducts: () => mockProducts,
  async getProductsFromAdapters(): Promise<NormalizedProduct[]> {
    const adapterEntries = Object.entries(adapters);
    const results = await Promise.allSettled(
      adapterEntries.map(async ([business, adapter]) => {
        const url = getConfiguredUrl(business);
        console.info(`[${business}] Requesting products from ${url}`);

        const products = await adapter.getProducts();
        console.info(`[${business}] Product request completed: ${products.length} products`);
        return products;
      }),
    );

    return results.flatMap((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      const [business] = adapterEntries[index];
      const url = getConfiguredUrl(business);
      console.error(`[${business}] Product request failed (${url}):`, result.reason);
      return [];
    });
  },
  getStockSummary: () => ({
    business_count: 6,
    cached_product_count: mockProducts.length,
    total_stock: mockProducts.reduce((total, product) => total + product.stock, 0),
    status: 'mock_data',
  }),
};

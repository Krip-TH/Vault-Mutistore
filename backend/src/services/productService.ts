import { adapters } from '../adapters/index.js';
import type { NormalizedProduct } from '../types/product.js';
import { getStockStatus } from '../utils/stockStatus.js';

const mockProducts: NormalizedProduct[] = [{
  id: 'door-demo-001', business: 'door', business_name: 'Door', name: 'Sample Door',
  category: 'Door', price: 0, stock: 0, unit: 'pcs', status: getStockStatus(0),
  image_url: '', updated_at: new Date(0).toISOString(),
}];

export const productService = {
  getProducts: () => mockProducts,
  async getProductsFromAdapters(): Promise<NormalizedProduct[]> {
    const productsByBusiness = await Promise.all(
      Object.values(adapters).map((adapter) => adapter.getProducts()),
    );

    return productsByBusiness.flat();
  },
  getStockSummary: () => ({
    business_count: 6,
    cached_product_count: mockProducts.length,
    total_stock: mockProducts.reduce((total, product) => total + product.stock, 0),
    status: 'mock_data',
  }),
};

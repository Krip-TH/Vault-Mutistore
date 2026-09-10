import type { NormalizedProduct } from '../types/product.js';

const mockProducts: NormalizedProduct[] = [{
  id: 'door-demo-001', name: 'Sample Door', category: 'Door', price: 0,
  stock: 0, unit: 'pcs', image_url: '', updated_at: new Date(0).toISOString(),
}];

export const productService = {
  getProducts: () => mockProducts,
  getStockSummary: () => ({
    business_count: 6,
    cached_product_count: mockProducts.length,
    total_stock: mockProducts.reduce((total, product) => total + product.stock, 0),
    status: 'mock_data',
  }),
};

import type { NormalizedProduct } from '../types/product.js';

export interface ProductAdapter {
  getProducts(): Promise<NormalizedProduct[]>;
}

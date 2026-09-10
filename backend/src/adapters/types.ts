import type { NormalizedProduct } from '../types/product.js';

export interface ExternalProductAdapter {
  readonly businessType: string;
  fetchProducts(): Promise<NormalizedProduct[]>;
}

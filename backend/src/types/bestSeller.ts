import type { BusinessType, NormalizedProduct } from './product.js';

export interface ProductSalesTotal {
  product_id: string;
  business: BusinessType;
  units_sold: number;
}

export interface BestSeller {
  rank: number;
  units_sold: number;
  product: NormalizedProduct;
}

import type { Product } from './product';

export type CartProduct = Pick<Product,
  'id' | 'business' | 'business_name' | 'name' | 'category' | 'image_url' |
  'price' | 'stock' | 'unit' | 'status'>;

export interface CartItem {
  key: string;
  product: CartProduct;
  quantity: number;
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  hasUnavailableItems: boolean;
}

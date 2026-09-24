import type { BusinessType } from './product';

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'completed' | 'cancelled';

export interface CheckoutForm {
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  district: string;
  province: string;
  postal_code: string;
  country: string;
}

export interface CreateOrderRequest {
  customer: { name: string; email: string; phone: string };
  shipping: Omit<CheckoutForm, 'name' | 'email' | 'phone'>;
  items: Array<{ product_id: string; business: BusinessType; quantity: number }>;
}

export interface OrderItem {
  product_id: string;
  business: BusinessType;
  business_name: string;
  product_name: string;
  category: string;
  image_url: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Order {
  order_no: string;
  customer: { name: string; email: string; phone: string };
  shipping: Omit<CheckoutForm, 'name' | 'email' | 'phone'>;
  items: OrderItem[];
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface OrderSummary {
  order_no: string;
  total: number;
  status: OrderStatus;
  item_count: number;
  created_at: string;
}

export interface OrderResponse { data: Order }
export interface OrdersResponse { data: OrderSummary[] }
export interface OrderErrorResponse { error?: { code?: string; message?: string } }

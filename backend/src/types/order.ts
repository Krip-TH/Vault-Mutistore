import type { BusinessType } from './product.js';

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'completed' | 'cancelled';

export interface CheckoutCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface ShippingAddress {
  address_line1: string;
  address_line2: string;
  district: string;
  province: string;
  postal_code: string;
  country: string;
}

export interface CreateOrderItemRequest {
  product_id: string;
  business: BusinessType;
  quantity: number;
}

export interface CreateOrderRequest {
  customer: CheckoutCustomer;
  shipping: ShippingAddress;
  items: CreateOrderItemRequest[];
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
  customer: CheckoutCustomer;
  shipping: ShippingAddress;
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

export interface NewOrder extends Omit<Order, 'created_at' | 'updated_at'> {
  user_id: number;
}

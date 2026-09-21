import type { Order, OrderStatus } from './order';

export interface AdminOrderSummary {
  order_no: string;
  customer_name: string;
  customer_email: string;
  total: number;
  status: OrderStatus;
  item_count: number;
  created_at: string;
}

export interface AdminDashboardData {
  total_orders: number;
  total_customers: number;
  total_revenue: number;
  pending_orders: number;
  confirmed_orders: number;
  processing_orders: number;
  shipped_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  recent_orders: AdminOrderSummary[];
}

export type AdminOrder = Order;
export type AdminView = 'dashboard' | 'products' | 'orders';

export interface AdminProduct {
  id: string;
  business: import('./product').BusinessType;
  business_name: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  status: import('./product').StockStatus;
  image_url: string;
  updated_at: string;
  management: 'vault' | 'external';
  can_edit: boolean;
  can_delete: boolean;
  catalog_business: import('./product').BusinessType | null;
  catalog_business_name: string;
}

export type AdminProductInput = Pick<AdminProduct, 'name' | 'category' | 'price' | 'stock' | 'unit' | 'image_url'> & { business: string };

export interface ProductOptions {
  businesses: Array<{ id: string; name: string; categories: string[] }>;
}

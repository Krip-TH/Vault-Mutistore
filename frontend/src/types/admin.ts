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
export type AdminView = 'dashboard' | 'products' | 'orders' | 'users' | 'businesses';

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
export interface ManagedUser {id:number;name:string;email:string;role:'customer'|'admin';created_at:string;updated_at:string}
export interface ManagedBusiness {id:number;name:string;business_type:string;api_url:string;status:'active'|'inactive'|'unavailable';last_checked_at:string|null;updated_at:string}
export interface AdminAnalytics {
  kpis:{total_revenue:number;total_orders:number;total_customers:number;average_order_value:number;total_products:number;in_stock:number;low_stock:number;out_of_stock:number};
  revenue_trend:Array<{date:string;revenue:number}>;
  revenue_by_business:Array<{business:string;revenue:number}>;
  inventory:Array<{status:string;count:number}>;
  products_by_business:Array<{business:string;name:string;count:number;available:boolean}>;
  order_statuses:Array<{status:OrderStatus;count:number}>;
  top_products:Array<{product_id:string;name:string;business:string;quantity_sold:number;revenue:number}>;
  kmeans:{products:Array<{id:string;name:string;business:string;price:number;stock:number;cluster:number}>;clusters:Array<{cluster:number;label:string;product_count:number;average_price:number;average_stock:number;centroid_price:number;centroid_stock:number}>};
  insights:string[]; warnings:string[]; recent_orders:AdminOrderSummary[];
  business_availability:Array<{business:string;business_name:string;status:'online'|'unavailable';product_count:number}>;
}

import type { BusinessAvailability, ExternalBusinessType } from './product.js';
import type { AdminOrderSummary } from './admin.js';
import type { OrderStatus } from './order.js';

export interface AnalyticsDatabaseData {
  total_orders: number;
  valid_orders: number;
  total_revenue: number;
  total_customers: number;
  revenue_trend: Array<{ date: string; revenue: number }>;
  revenue_by_business: Array<{ business: ExternalBusinessType; revenue: number }>;
  order_statuses: Array<{ status: OrderStatus; count: number }>;
  top_products: Array<{ product_id: string; name: string; business: string; quantity_sold: number; revenue: number }>;
  recent_orders: AdminOrderSummary[];
}

export interface ClusteredProduct {
  id: string; name: string; business: string; price: number; stock: number; cluster: number;
}

export interface ClusterSummary {
  cluster: number; label: string; product_count: number; average_price: number; average_stock: number;
  centroid_price: number; centroid_stock: number;
}

export interface AdminAnalytics {
  kpis: { total_revenue: number; total_orders: number; total_customers: number; average_order_value: number; total_products: number; in_stock: number; low_stock: number; out_of_stock: number };
  revenue_trend: AnalyticsDatabaseData['revenue_trend'];
  revenue_by_business: AnalyticsDatabaseData['revenue_by_business'];
  inventory: Array<{ status: string; count: number }>;
  products_by_business: Array<{ business: ExternalBusinessType; name: string; count: number; available: boolean }>;
  order_statuses: AnalyticsDatabaseData['order_statuses'];
  top_products: AnalyticsDatabaseData['top_products'];
  kmeans: { products: ClusteredProduct[]; clusters: ClusterSummary[] };
  insights: string[];
  business_availability: BusinessAvailability[];
  recent_orders: AdminOrderSummary[];
  warnings: string[];
}

import type { Order, OrderStatus } from './order.js';

export interface AdminOrderSummary {
  order_no: string;
  customer_name: string;
  customer_email: string;
  total: number;
  status: OrderStatus;
  item_count: number;
  created_at: string;
}

export interface AdminDashboard {
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

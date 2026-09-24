import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../db/pool.js';
import type { AdminDashboard, AdminOrder, AdminOrderSummary } from '../types/admin.js';
import type { OrderItem, OrderStatus } from '../types/order.js';

export interface AdminRepository {
  getDashboard(): Promise<AdminDashboard>;
  listOrders(): Promise<AdminOrderSummary[]>;
  findOrderByNumber(orderNo: string): Promise<AdminOrder | null>;
  updateOrderStatus(orderNo: string, status: OrderStatus): Promise<boolean>;
}

interface DashboardRow extends RowDataPacket {
  total_orders: number;
  total_revenue: number;
  pending_orders: number;
  confirmed_orders: number;
  processing_orders: number;
  shipped_orders: number;
  completed_orders: number;
  cancelled_orders: number;
}

interface CountRow extends RowDataPacket { total_customers: number }

interface SummaryRow extends RowDataPacket {
  order_no: string;
  customer_name: string;
  customer_email: string;
  total: number;
  status: OrderStatus;
  item_count: number;
  created_at: Date;
}

interface OrderRow extends RowDataPacket {
  id: number;
  order_no: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_district: string;
  shipping_province: string;
  shipping_postal_code: string;
  shipping_country: string;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  created_at: Date;
  updated_at: Date;
}

interface OrderItemRow extends RowDataPacket, OrderItem {}

const summariesSql = `SELECT o.order_no, o.customer_name, o.customer_email, o.total, o.status,
  COALESCE(SUM(oi.quantity), 0) AS item_count, o.created_at
  FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
  GROUP BY o.id, o.order_no, o.customer_name, o.customer_email, o.total, o.status, o.created_at
  ORDER BY o.created_at DESC, o.id DESC`;

function mapSummary(row: SummaryRow): AdminOrderSummary {
  return {
    order_no: row.order_no,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    total: row.total,
    status: row.status,
    item_count: Number(row.item_count),
    created_at: new Date(row.created_at).toISOString(),
  };
}

export const adminRepository: AdminRepository = {
  async getDashboard() {
    const [dashboardRows] = await pool.query<DashboardRow[]>(`SELECT
      COUNT(*) AS total_orders,
      COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total ELSE 0 END), 0) AS total_revenue,
      SUM(status = 'pending') AS pending_orders,
      SUM(status = 'confirmed') AS confirmed_orders,
      SUM(status = 'processing') AS processing_orders,
      SUM(status = 'shipped') AS shipped_orders,
      SUM(status = 'completed') AS completed_orders,
      SUM(status = 'cancelled') AS cancelled_orders
      FROM orders`);
    const [customerRows] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total_customers FROM users WHERE role = 'customer'",
    );
    const [recentRows] = await pool.query<SummaryRow[]>(`${summariesSql} LIMIT 10`);
    const stats = dashboardRows[0];
    return {
      total_orders: Number(stats?.total_orders ?? 0),
      total_customers: Number(customerRows[0]?.total_customers ?? 0),
      total_revenue: Number(stats?.total_revenue ?? 0),
      pending_orders: Number(stats?.pending_orders ?? 0),
      confirmed_orders: Number(stats?.confirmed_orders ?? 0),
      processing_orders: Number(stats?.processing_orders ?? 0),
      shipped_orders: Number(stats?.shipped_orders ?? 0),
      completed_orders: Number(stats?.completed_orders ?? 0),
      cancelled_orders: Number(stats?.cancelled_orders ?? 0),
      recent_orders: recentRows.map(mapSummary),
    };
  },

  async listOrders() {
    const [rows] = await pool.query<SummaryRow[]>(summariesSql);
    return rows.map(mapSummary);
  },

  async findOrderByNumber(orderNo) {
    const [rows] = await pool.execute<OrderRow[]>(
      'SELECT * FROM orders WHERE order_no = ? LIMIT 1',
      [orderNo],
    );
    const row = rows[0];
    if (!row) return null;
    const [items] = await pool.execute<OrderItemRow[]>(`SELECT product_id, business, business_name,
      product_name, COALESCE(category, '') AS category, COALESCE(image_url, '') AS image_url,
      unit_price, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY id`, [row.id]);
    return {
      order_no: row.order_no,
      customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone },
      shipping: {
        address_line1: row.shipping_address_line1,
        address_line2: row.shipping_address_line2 || '',
        district: row.shipping_district,
        province: row.shipping_province,
        postal_code: row.shipping_postal_code,
        country: row.shipping_country,
      },
      items,
      subtotal: row.subtotal,
      shipping_fee: row.shipping_fee,
      discount: row.discount,
      total: row.total,
      status: row.status,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    };
  },

  async updateOrderStatus(orderNo, status) {
    // completed_at is the start of the claim window, so it is stamped the first time an
    // order completes and left untouched afterwards.
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE orders SET status = ?, completed_at = ${status === 'completed' ? 'COALESCE(completed_at, CURRENT_TIMESTAMP)' : 'completed_at'}
       WHERE order_no = ?`,
      [status, orderNo],
    );
    return result.affectedRows === 1;
  },
};

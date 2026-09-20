import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../db/pool.js';
import type { NewOrder, Order, OrderItem, OrderStatus, OrderSummary } from '../types/order.js';

export interface OrderRepository {
  create(order: NewOrder): Promise<Order>;
  listNewestForUser(userId: number): Promise<OrderSummary[]>;
  findByOrderNoForUser(orderNo: string, userId: number): Promise<Order | null>;
}

export interface TransactionLifecycle {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

export async function withTransaction<T>(
  connection: TransactionLifecycle,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    await connection.beginTransaction();
    const result = await operation();
    await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); } catch { /* Keep the original transaction error. */ }
    throw error;
  } finally {
    connection.release();
  }
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

interface OrderSummaryRow extends RowDataPacket {
  order_no: string;
  total: number;
  status: OrderStatus;
  item_count: number;
  created_at: Date;
}

export const orderRepository: OrderRepository = {
  async create(order) {
    const connection = await pool.getConnection();
    return withTransaction(connection, async () => {
      const [result] = await connection.execute<ResultSetHeader>(`INSERT INTO orders (
        user_id, order_no, customer_name, customer_email, customer_phone,
        shipping_address_line1, shipping_address_line2, shipping_district,
        shipping_province, shipping_postal_code, shipping_country,
        subtotal, shipping_fee, discount, total, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        order.user_id, order.order_no, order.customer.name, order.customer.email, order.customer.phone,
        order.shipping.address_line1, order.shipping.address_line2 || null, order.shipping.district,
        order.shipping.province, order.shipping.postal_code, order.shipping.country,
        order.subtotal, order.shipping_fee, order.discount, order.total, order.status,
      ]);
      for (const item of order.items) {
        await connection.execute(`INSERT INTO order_items (
          order_id, product_id, business, business_name, product_name, category,
          image_url, unit_price, quantity, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          result.insertId, item.product_id, item.business, item.business_name, item.product_name,
          item.category || null, item.image_url || null, item.unit_price, item.quantity, item.line_total,
        ]);
      }
      const now = new Date().toISOString();
      return {
        order_no: order.order_no,
        customer: order.customer,
        shipping: order.shipping,
        items: order.items,
        subtotal: order.subtotal,
        shipping_fee: order.shipping_fee,
        discount: order.discount,
        total: order.total,
        status: order.status,
        created_at: now,
        updated_at: now,
      };
    });
  },

  async listNewestForUser(userId) {
    const [rows] = await pool.execute<OrderSummaryRow[]>(`SELECT o.order_no, o.total, o.status,
      COALESCE(SUM(oi.quantity), 0) AS item_count, o.created_at
      FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = ?
      GROUP BY o.id, o.order_no, o.total, o.status, o.created_at
      ORDER BY o.created_at DESC, o.id DESC LIMIT 100`, [userId]);
    return rows.map(row => ({
      order_no: row.order_no,
      total: row.total,
      status: row.status,
      item_count: Number(row.item_count),
      created_at: new Date(row.created_at).toISOString(),
    }));
  },

  async findByOrderNoForUser(orderNo, userId) {
    const [rows] = await pool.execute<OrderRow[]>(
      'SELECT * FROM orders WHERE order_no = ? AND user_id = ? LIMIT 1',
      [orderNo, userId],
    );
    const row = rows[0];
    if (!row) return null;
    const [itemRows] = await pool.execute<OrderItemRow[]>(`SELECT product_id, business, business_name,
      product_name, COALESCE(category, '') AS category, COALESCE(image_url, '') AS image_url,
      unit_price, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY id`, [row.id]);
    return {
      order_no: row.order_no,
      customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone },
      shipping: {
        address_line1: row.shipping_address_line1, address_line2: row.shipping_address_line2 || '',
        district: row.shipping_district, province: row.shipping_province,
        postal_code: row.shipping_postal_code, country: row.shipping_country,
      },
      items: itemRows,
      subtotal: row.subtotal, shipping_fee: row.shipping_fee, discount: row.discount,
      total: row.total, status: row.status,
      created_at: new Date(row.created_at).toISOString(), updated_at: new Date(row.updated_at).toISOString(),
    };
  },
};

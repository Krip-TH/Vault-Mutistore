import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../db/pool.js';
import type { ProductSalesTotal } from '../types/bestSeller.js';
import type { BusinessType } from '../types/product.js';

interface SalesRow extends RowDataPacket {
  product_id: string;
  business: BusinessType;
  units_sold: number;
}

export interface BestSellerRepository {
  listCompletedSales(limit: number, business?: BusinessType | null): Promise<ProductSalesTotal[]>;
}

// A product is uniquely identified by both source business and source product id.
export const completedSalesSql = `SELECT oi.business, oi.product_id, SUM(oi.quantity) AS units_sold
  FROM order_items oi
  INNER JOIN orders o ON o.id = oi.order_id
  WHERE o.status = 'completed'
  GROUP BY oi.business, oi.product_id
  ORDER BY units_sold DESC, oi.business ASC, oi.product_id ASC
  LIMIT ?`;

export const completedSalesByBusinessSql = `SELECT oi.business, oi.product_id, SUM(oi.quantity) AS units_sold
  FROM order_items oi
  INNER JOIN orders o ON o.id = oi.order_id
  WHERE o.status = 'completed' AND oi.business = ?
  GROUP BY oi.business, oi.product_id
  ORDER BY units_sold DESC, oi.business ASC, oi.product_id ASC
  LIMIT ?`;

export const bestSellerRepository: BestSellerRepository = {
  async listCompletedSales(limit, business) {
    const [rows] = await pool.execute<SalesRow[]>(
      business ? completedSalesByBusinessSql : completedSalesSql,
      business ? [business, limit] : [limit],
    );
    return rows.map(row => ({
      product_id: String(row.product_id), business: row.business, units_sold: Number(row.units_sold),
    }));
  },
};

import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../db/pool.js';
import { businessCatalog } from '../adapters/index.js';
import type { AnalyticsDatabaseData } from '../types/analytics.js';
import type { ExternalBusinessType } from '../types/product.js';
import type { OrderStatus } from '../types/order.js';

type MetricRow = RowDataPacket & { total_orders:number; valid_orders:number; total_revenue:number; total_customers:number };
type TrendRow = RowDataPacket & { date:string; revenue:number };
type BusinessRow = RowDataPacket & { business:ExternalBusinessType; revenue:number };
type StatusRow = RowDataPacket & { status:OrderStatus; count:number };
type ProductRow = RowDataPacket & { product_id:string; name:string; business:string; quantity_sold:number; revenue:number };
type OrderRow = RowDataPacket & { order_no:string; customer_name:string; customer_email:string; total:number; status:OrderStatus; item_count:number; created_at:Date };

export interface AnalyticsRepository { load(): Promise<AnalyticsDatabaseData> }

export const analyticsRepository: AnalyticsRepository = {
  async load() {
    const [metrics, trend, revenue, statuses, products, recent] = await Promise.all([
      pool.query<MetricRow[]>(`SELECT COUNT(*) total_orders, SUM(status <> 'cancelled') valid_orders,
        COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total ELSE 0 END),0) total_revenue,
        (SELECT COUNT(*) FROM users WHERE role='customer') total_customers FROM orders`),
      pool.query<TrendRow[]>(`SELECT DATE_FORMAT(created_at,'%Y-%m-%d') date, SUM(total) revenue FROM orders
        WHERE status <> 'cancelled' GROUP BY DATE_FORMAT(created_at,'%Y-%m-%d') ORDER BY date`),
      pool.query<BusinessRow[]>(`SELECT business,SUM(line_total) revenue FROM (
        SELECT COALESCE(CASE WHEN oi.business='vault' THEN vp.business_key ELSE oi.business END,oi.business) business,oi.line_total
        FROM order_items oi JOIN orders o ON o.id=oi.order_id
        LEFT JOIN vault_products vp ON oi.business='vault' AND CAST(vp.id AS CHAR) COLLATE utf8mb4_unicode_ci=oi.product_id
        WHERE o.status <> 'cancelled') sales GROUP BY business`),
      pool.query<StatusRow[]>(`SELECT status, COUNT(*) count FROM orders GROUP BY status`),
      pool.query<ProductRow[]>(`SELECT oi.product_id, MAX(oi.product_name) name, MAX(oi.business_name) business,
        SUM(oi.quantity) quantity_sold, SUM(oi.line_total) revenue FROM order_items oi
        JOIN orders o ON o.id=oi.order_id WHERE o.status <> 'cancelled'
        GROUP BY oi.business, oi.product_id ORDER BY quantity_sold DESC, revenue DESC LIMIT 5`),
      pool.query<OrderRow[]>(`SELECT o.order_no,o.customer_name,o.customer_email,o.total,o.status,
        COALESCE(SUM(oi.quantity),0) item_count,o.created_at FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
        GROUP BY o.id ORDER BY o.created_at DESC,o.id DESC LIMIT 10`),
    ]);
    const metric = metrics[0][0];
    const revenueMap = new Map(revenue[0].map(row => [row.business, Number(row.revenue)]));
    return {
      total_orders:Number(metric?.total_orders ?? 0), valid_orders:Number(metric?.valid_orders ?? 0),
      total_revenue:Number(metric?.total_revenue ?? 0), total_customers:Number(metric?.total_customers ?? 0),
      revenue_trend:trend[0].map(row => ({date:row.date,revenue:Number(row.revenue)})),
      revenue_by_business:businessCatalog.map(item => ({business:item.id,revenue:revenueMap.get(item.id) ?? 0})),
      order_statuses:statuses[0].map(row => ({status:row.status,count:Number(row.count)})),
      top_products:products[0].map(row => ({...row,quantity_sold:Number(row.quantity_sold),revenue:Number(row.revenue)})),
      recent_orders:recent[0].map(row => ({...row,total:Number(row.total),item_count:Number(row.item_count),created_at:new Date(row.created_at).toISOString()})),
    };
  },
};

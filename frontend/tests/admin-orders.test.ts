import assert from 'node:assert/strict';
import test from 'node:test';
import { filterAdminOrders, orderMetrics } from '../src/components/AdminDashboard';
import type { AdminOrderSummary } from '../src/types/admin';

const orders: AdminOrderSummary[] = [
  { order_no: 'MDG-20260920-ONE001', customer_name: 'Narin Chai', customer_email: 'narin@example.com', total: 5000, status: 'pending', item_count: 2, created_at: '2026-09-20T10:00:00.000Z' },
  { order_no: 'MDG-20260920-TWO002', customer_name: 'Mali Dee', customer_email: 'mali@example.com', total: 900, status: 'processing', item_count: 1, created_at: '2026-09-20T11:00:00.000Z' },
  { order_no: 'MDG-20260920-THR003', customer_name: 'Decha Mee', customer_email: 'decha@example.com', total: 1200, status: 'completed', item_count: 1, created_at: '2026-09-20T12:00:00.000Z' },
];

test('admin order search matches order ID, customer name, and email', () => {
  assert.deepEqual(filterAdminOrders(orders, 'ONE001', 'all').map(order => order.order_no), [orders[0].order_no]);
  assert.deepEqual(filterAdminOrders(orders, 'mali', 'all').map(order => order.order_no), [orders[1].order_no]);
  assert.deepEqual(filterAdminOrders(orders, 'decha@example.com', 'all').map(order => order.order_no), [orders[2].order_no]);
});

test('admin status filter and summary metrics use database statuses', () => {
  assert.deepEqual(filterAdminOrders(orders, '', 'processing'), [orders[1]]);
  assert.deepEqual(orderMetrics(orders), { total: 3, pending: 1, active: 1, completed: 1, cancelled: 0 });
});

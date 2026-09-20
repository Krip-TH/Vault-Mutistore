import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import type { AdminRepository } from '../src/repositories/adminRepository.js';
import { createAdminRouter } from '../src/routes/admin.js';
import { createAdminService } from '../src/services/adminService.js';
import type { AdminDashboard, AdminOrder, AdminOrderSummary } from '../src/types/admin.js';
import type { OrderStatus } from '../src/types/order.js';
import type { UserRole } from '../src/types/user.js';

const orderNo = 'MDG-20260920-ADM001';
const now = '2026-09-20T10:00:00.000Z';

function order(status: OrderStatus = 'confirmed'): AdminOrder {
  return {
    order_no: orderNo,
    customer: { name: 'Customer One', email: 'customer@example.com', phone: '+66 81 234 5678' },
    shipping: {
      address_line1: '1 Vault Road', address_line2: '', district: 'Watthana',
      province: 'Bangkok', postal_code: '10110', country: 'Thailand',
    },
    items: [{
      product_id: 'door-1', business: 'door', business_name: 'Door', product_name: 'Walnut Door',
      category: 'Doors', image_url: '', unit_price: 2500, quantity: 2, line_total: 5000,
    }],
    subtotal: 5000, shipping_fee: 0, discount: 0, total: 5000, status,
    created_at: now, updated_at: now,
  };
}

function summary(status: OrderStatus = 'confirmed'): AdminOrderSummary {
  return {
    order_no: orderNo, customer_name: 'Customer One', customer_email: 'customer@example.com',
    total: 5000, status, item_count: 2, created_at: now,
  };
}

function dashboard(): AdminDashboard {
  return {
    total_orders: 1, total_customers: 1, total_revenue: 5000,
    pending_orders: 0, confirmed_orders: 1, processing_orders: 0,
    shipped_orders: 0, completed_orders: 0, cancelled_orders: 0,
    recent_orders: [summary()],
  };
}

function fakeRepository(): AdminRepository {
  let current = order();
  return {
    async getDashboard() { return dashboard(); },
    async listOrders() { return [summary(current.status)]; },
    async findOrderByNumber(value) { return value === orderNo ? current : null; },
    async updateOrderStatus(value, status) {
      if (value !== orderNo) return false;
      current = { ...current, status };
      return true;
    },
  };
}

async function request(role: UserRole | undefined, path: string, init?: RequestInit) {
  const app = express();
  app.use(express.json());
  if (role) app.use((req, _res, next) => { req.auth = { userId: role === 'admin' ? 1 : 2, role }; next(); });
  app.use('/api/admin', createAdminRouter(createAdminService(fakeRepository())));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const { port } = server.address() as AddressInfo;
    return await fetch(`http://127.0.0.1:${port}/api/admin${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('unauthenticated requests cannot access admin endpoints', async () => {
  const response = await request(undefined, '/dashboard');
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
});

test('customers cannot access admin endpoints', async () => {
  const response = await request('customer', '/dashboard');
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN');
});

test('admins can access database-derived dashboard data', async () => {
  const response = await request('admin', '/dashboard');
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, dashboard());
});

test('admins can list all orders', async () => {
  const response = await request('admin', '/orders');
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, [summary()]);
});

test('admins can view an order with customer, shipping, and item data', async () => {
  const response = await request('admin', `/orders/${orderNo}`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, order());
});

test('admins can update an order to a valid status', async () => {
  const response = await request('admin', `/orders/${orderNo}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'shipped' }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, 'shipped');
});

test('invalid order statuses are rejected without reaching persistence', async () => {
  const response = await request('admin', `/orders/${orderNo}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'refunded' }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_ORDER_STATUS');
});

test('nonexistent admin order lookups return not found', async () => {
  const response = await request('admin', '/orders/MDG-20260920-NONE00');
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'ORDER_NOT_FOUND');
});

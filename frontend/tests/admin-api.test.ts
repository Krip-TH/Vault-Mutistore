import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAdminDashboard, fetchAdminOrders, updateAdminOrderStatus } from '../src/admin/adminApi';

test('admin dashboard and order list use protected same-origin endpoints', async () => {
  const requests: Array<{ url: string; credentials?: RequestCredentials }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), credentials: init?.credentials });
    const data = String(input).endsWith('/dashboard') ? {
      total_orders: 0, total_customers: 0, total_revenue: 0,
      pending_orders: 0, confirmed_orders: 0, processing_orders: 0,
      shipped_orders: 0, completed_orders: 0, cancelled_orders: 0, recent_orders: [],
    } : [];
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  await fetchAdminDashboard(fetcher);
  await fetchAdminOrders(fetcher);
  assert.deepEqual(requests, [
    { url: '/api/admin/dashboard', credentials: 'same-origin' },
    { url: '/api/admin/orders', credentials: 'same-origin' },
  ]);
});

test('status updates send only the selected status to the dedicated admin endpoint', async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    request = { url: String(input), init };
    return new Response(JSON.stringify({ data: { order_no: 'MDG-20260920-ADM001', status: 'processing' } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  await updateAdminOrderStatus('MDG-20260920-ADM001', 'processing', fetcher);
  assert.equal(request?.url, '/api/admin/orders/MDG-20260920-ADM001/status');
  assert.equal(request?.init?.method, 'PATCH');
  assert.equal(request?.init?.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(String(request?.init?.body)), { status: 'processing' });
});

test('admin API errors preserve safe backend messages', async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    error: { code: 'FORBIDDEN', message: 'Admin access is required.' },
  }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(fetchAdminDashboard(fetcher), /Admin access is required/);
});

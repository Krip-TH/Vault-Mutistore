import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminProduct, deleteAdminProduct, fetchAdminDashboard, fetchAdminProductOptions, fetchAdminProducts, fetchAdminOrders, updateAdminOrderStatus, updateAdminProduct, uploadAdminProductImage } from '../src/admin/adminApi';
import type { AdminProduct } from '../src/types/admin';

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

test('admin image upload sends a single multipart image without overriding its content type', async () => {
  let captured: RequestInit | undefined;
  const file = new File(['image'], 'product.webp', { type: 'image/webp' });
  const url = await uploadAdminProductImage(file, async (_input, init) => {
    captured = init;
    return new Response(JSON.stringify({ data: { image_url: '/uploads/products/safe.webp' } }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  });
  assert.equal(url, '/uploads/products/safe.webp');
  assert.equal(captured?.method, 'POST'); assert.equal(captured?.credentials, 'same-origin');
  assert.ok(captured?.body instanceof FormData); assert.equal((captured?.body as FormData).get('image'), file);
  assert.deepEqual(captured?.headers, { Accept: 'application/json' });
});

test('admin product CRUD uses protected ownership-aware endpoints', async () => {
  const calls: Array<{ url: string; method?: string; body?: string }> = [];
  const product: AdminProduct = { id: '4', business: 'vault', business_name: 'VAULT', catalog_business: 'door', catalog_business_name: 'Door', name: 'Door Handle', category: 'Doors', price: 900, stock: 2, unit: 'pcs', status: 'Low Stock', image_url: '', updated_at: '', management: 'vault', can_edit: true, can_delete: true };
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method, body: init?.body ? String(init.body) : undefined });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ data: String(input).endsWith('/products') && !init?.method ? [product] : product }), { status: init?.method === 'POST' ? 201 : 200, headers: { 'Content-Type': 'application/json' } });
  };
  await fetchAdminProducts(fetcher);
  const input = { business: 'door', name: 'Door Handle', category: 'Doors', price: 900, stock: 2, unit: 'pcs', image_url: '' };
  await createAdminProduct(input, fetcher); await updateAdminProduct(product, input, fetcher); await deleteAdminProduct(product, fetcher);
  assert.deepEqual(calls.map(call => [call.url, call.method]), [
    ['/api/admin/products', undefined], ['/api/admin/products', 'POST'],
    ['/api/admin/products/vault/4', 'PUT'], ['/api/admin/products/vault/4', 'DELETE'],
  ]);
});

test('admin product options use the protected dynamic endpoint', async () => {
  let url = '';
  const options = await fetchAdminProductOptions(async input => {
    url = String(input);
    return new Response(JSON.stringify({ data: { businesses: [{ id: 'door', name: 'Door', categories: ['Doors'] }] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.equal(url, '/api/admin/product-options');
  assert.deepEqual(options.businesses[0], { id: 'door', name: 'Door', categories: ['Doors'] });
});

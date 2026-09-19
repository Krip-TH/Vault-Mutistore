import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrderRequest, validateCheckout } from '../src/checkout/checkout.js';
import { completeCheckout, fetchOrders, placeOrder } from '../src/checkout/orderApi.js';
import type { CartItem } from '../src/types/cart.js';

const form = {
  name: 'Narin Chai', email: 'narin@example.com', phone: '+66 81 234 5678',
  address_line1: '88 Sukhumvit Road', address_line2: '', district: 'Watthana',
  province: 'Bangkok', postal_code: '10110', country: 'Thailand',
};
const items: CartItem[] = [{
  key: 'door::door-1',
  product: {
    id: 'door-1', business: 'door', business_name: 'Door', name: 'Walnut Entry Door',
    category: 'Entry doors', image_url: 'https://example.test/door.jpg', price: 2499.5,
    stock: 4, unit: 'piece', status: 'In Stock',
  },
  quantity: 2,
}];
const order = {
  order_no: 'MDG-20260919-ABC123', customer: { name: form.name, email: form.email, phone: form.phone },
  shipping: {
    address_line1: form.address_line1, address_line2: '', district: form.district,
    province: form.province, postal_code: form.postal_code, country: form.country,
  },
  items: [{
    product_id: 'door-1', business: 'door' as const, business_name: 'Door',
    product_name: 'Walnut Entry Door', category: 'Entry doors', image_url: items[0].product.image_url,
    unit_price: 2499.5, quantity: 2, line_total: 4999,
  }],
  subtotal: 4999, shipping_fee: 0, discount: 0, total: 4999, status: 'confirmed',
  created_at: '2026-09-19T08:30:00.000Z', updated_at: '2026-09-19T08:30:00.000Z',
};

test('validates required contact and shipping fields', () => {
  assert.deepEqual(validateCheckout(form), {});
  const errors = validateCheckout({ ...form, name: '', email: 'invalid', phone: '12', address_line1: '', postal_code: '' });
  assert.ok(errors.name);
  assert.ok(errors.email);
  assert.ok(errors.phone);
  assert.ok(errors.address_line1);
  assert.ok(errors.postal_code);
});

test('builds a minimal request without trusting cart prices or totals', () => {
  const request = createOrderRequest(form, items);
  assert.deepEqual(request.items, [{ business: 'door', product_id: 'door-1', quantity: 2 }]);
  assert.equal('price' in request.items[0], false);
  assert.equal('subtotal' in request, false);
  assert.equal('total' in request, false);
});

test('clears the cart only after an accepted order response', async () => {
  let clearCount = 0;
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ data: order }), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
  const result = await completeCheckout(createOrderRequest(form, items), () => { clearCount += 1; }, fetcher);
  assert.equal(result.order_no, order.order_no);
  assert.equal(clearCount, 1);
});

test('keeps the cart when order submission fails', async () => {
  let clearCount = 0;
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    error: { code: 'INSUFFICIENT_STOCK', message: 'Only 1 item remains.' },
  }), { status: 409, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(completeCheckout(
    createOrderRequest(form, items), () => { clearCount += 1; }, fetcher,
  ), /Only 1 item remains/);
  assert.equal(clearCount, 0);
});

test('rejects an incomplete success response', async () => {
  const fetcher: typeof fetch = async () => new Response('{}', {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(placeOrder(createOrderRequest(form, items), fetcher), /incomplete/);
});

test('loads order history summaries from the orders endpoint', async () => {
  const summaries = [{
    order_no: order.order_no,
    total: order.total,
    status: order.status,
    item_count: 2,
    created_at: order.created_at,
  }];
  let requestedUrl = '';
  const fetcher: typeof fetch = async input => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: summaries }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  assert.deepEqual(await fetchOrders(fetcher), summaries);
  assert.equal(requestedUrl, '/api/orders');
});

test('reports an invalid order history response', async () => {
  const fetcher: typeof fetch = async () => new Response('{"data":null}', {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(fetchOrders(fetcher), /incomplete/);
});

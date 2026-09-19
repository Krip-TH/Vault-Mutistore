import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors/apiError.js';
import { withTransaction } from '../src/repositories/orderRepository.js';
import type { OrderRepository } from '../src/repositories/orderRepository.js';
import { createOrder, getOrder, listOrders } from '../src/services/orderService.js';
import type { NewOrder, Order } from '../src/types/order.js';
import type { NormalizedProduct } from '../src/types/product.js';

const now = new Date('2026-09-19T08:30:00.000Z');
const product: NormalizedProduct = {
  id: 'door-1', business: 'door', business_name: 'Door', name: 'Walnut Entry Door',
  category: 'Entry doors', price: 2499.5, stock: 4, unit: 'piece', status: 'In Stock',
  image_url: 'https://example.test/door.jpg', updated_at: now.toISOString(),
};
const validPayload = {
  customer: { name: 'Narin Chai', email: 'narin@example.com', phone: '+66 81 234 5678' },
  shipping: {
    address_line1: '88 Sukhumvit Road', address_line2: '', district: 'Watthana',
    province: 'Bangkok', postal_code: '10110', country: 'Thailand',
  },
  items: [{ business: 'door', product_id: 'door-1', quantity: 2 }],
};

function mockRepository(overrides: Partial<OrderRepository> = {}) {
  let saved: NewOrder | undefined;
  const value: OrderRepository = {
    async create(order) {
      saved = order;
      return { ...order, created_at: now.toISOString(), updated_at: now.toISOString() };
    },
    async listNewest() { return []; },
    async findByOrderNo() { return null; },
    ...overrides,
  };
  return { value, getSaved: () => saved };
}

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

test('uses current server pricing and loads only businesses in the order', async () => {
  const repository = mockRepository();
  const loaded: string[] = [];
  const payload = {
    ...validPayload,
    subtotal: 0.01,
    total: 0.01,
    items: [{ ...validPayload.items[0], price: 0.01, unit_price: 0.01, line_total: 0.02 }],
  };
  const order = await createOrder(payload, {
    repository: repository.value,
    now: () => now,
    randomSuffix: () => 'ABC123',
    loadProducts: async business => { loaded.push(business); return [product]; },
  });

  assert.deepEqual(loaded, ['door']);
  assert.equal(order.order_no, 'MDG-20260919-ABC123');
  assert.equal(order.items[0].unit_price, 2499.5);
  assert.equal(order.items[0].line_total, 4999);
  assert.equal(order.subtotal, 4999);
  assert.equal(order.total, 4999);
  assert.equal(repository.getSaved()?.items[0].product_name, product.name);
});

test('rejects invalid quantities before loading products', async () => {
  let loaded = false;
  await expectApiError(createOrder(
    { ...validPayload, items: [{ ...validPayload.items[0], quantity: 0 }] },
    { repository: mockRepository().value, loadProducts: async () => { loaded = true; return [product]; } },
  ), 400, 'INVALID_QUANTITY');
  assert.equal(loaded, false);
});

test('rejects quantities above available stock', async () => {
  await expectApiError(createOrder(
    { ...validPayload, items: [{ ...validPayload.items[0], quantity: 5 }] },
    { repository: mockRepository().value, loadProducts: async () => [product] },
  ), 409, 'INSUFFICIENT_STOCK');
});

test('rejects products that are no longer available upstream', async () => {
  await expectApiError(createOrder(validPayload, {
    repository: mockRepository().value,
    loadProducts: async () => [{ ...product, id: 'another-product' }],
  }), 404, 'PRODUCT_NOT_FOUND');
});

test('returns a safe error when upstream product validation fails', async () => {
  await expectApiError(createOrder(validPayload, {
    repository: mockRepository().value,
    loadProducts: async () => { throw new Error('upstream credentials'); },
  }), 502, 'INVENTORY_UNAVAILABLE');
});

test('does not report success when transactional persistence fails', async () => {
  const failure = new Error('transaction rolled back');
  await assert.rejects(createOrder(validPayload, {
    repository: mockRepository({ async create() { throw failure; } }).value,
    loadProducts: async () => [product],
  }), failure);
});

test('rolls back and releases the connection when a transaction write fails', async () => {
  const calls: string[] = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); },
  };
  const failure = new Error('item insert failed');

  await assert.rejects(withTransaction(connection, async () => {
    calls.push('write');
    throw failure;
  }), failure);
  assert.deepEqual(calls, ['begin', 'write', 'rollback', 'release']);
});

test('retrieves a persisted order by order number', async () => {
  const persisted: Order = {
    order_no: 'MDG-20260919-ABC123', customer: validPayload.customer,
    shipping: validPayload.shipping, subtotal: 2499.5, shipping_fee: 0,
    discount: 0, total: 2499.5, status: 'confirmed',
    items: [{
      product_id: product.id, business: product.business, business_name: product.business_name,
      product_name: product.name, category: product.category, image_url: product.image_url,
      unit_price: product.price, quantity: 1, line_total: product.price,
    }],
    created_at: now.toISOString(), updated_at: now.toISOString(),
  };
  const repository = mockRepository({
    async findByOrderNo(orderNo) { assert.equal(orderNo, persisted.order_no); return persisted; },
  });
  assert.deepEqual(await getOrder(persisted.order_no, repository.value), persisted);
});

test('lists repository order summaries in repository order', async () => {
  const summaries = [
    { order_no: 'MDG-20260919-NEW001', total: 4999, status: 'confirmed' as const, item_count: 2, created_at: now.toISOString() },
    { order_no: 'MDG-20260918-OLD001', total: 2499.5, status: 'completed' as const, item_count: 1, created_at: '2026-09-18T08:30:00.000Z' },
  ];
  const repository = mockRepository({ async listNewest() { return summaries; } });
  assert.deepEqual(await listOrders(repository.value), summaries);
});

test('returns not found for an unknown valid order number', async () => {
  await expectApiError(getOrder('MDG-20260919-ZZZ999', mockRepository().value), 404, 'ORDER_NOT_FOUND');
});

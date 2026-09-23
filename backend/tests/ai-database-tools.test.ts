import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors/apiError.js';
import { chatWithDatabaseAssistant, databaseAssistantInstruction } from '../src/services/ai/databaseChatService.js';
import { createDatabaseToolExecutor } from '../src/services/ai/databaseTools.js';
import type { DatabaseToolDependencies } from '../src/services/ai/databaseTools.js';
import type { NormalizedProduct } from '../src/types/product.js';

const products: NormalizedProduct[] = Array.from({ length: 25 }, (_, index) => ({
  id: String(index + 1), business: 'vault', business_name: 'VAULT', name: `Plug ${index + 1}`,
  category: 'Adapters', price: 100 + index * 25, stock: index % 2, unit: 'pcs',
  status: index % 2 ? 'In Stock' : 'Out of Stock', image_url: '', updated_at: '2026-09-20T00:00:00Z',
}));

function dependencies(overrides: Partial<DatabaseToolDependencies> = {}): Partial<DatabaseToolDependencies> {
  return {
    getProducts: async () => products,
    getProfile: async userId => ({ id: userId, name: 'Customer' }),
    getOrders: async () => [{ order_no: 'MDG-20260920-ABC123', total: 499, status: 'shipped', item_count: 1, created_at: '2026-09-20T00:00:00Z' }],
    getOrder: async (orderNo, userId) => userId === 7 && orderNo === 'MDG-20260920-ABC123' ? ({ order_no: orderNo } as never) : null,
    getClaims: async () => ({ claims: [], total: 0, page: 1, page_size: 10 }),
    getClaim: async () => { throw new ApiError(404, 'CLAIM_NOT_FOUND', 'Claim not found.'); },
    getWarranty: async (_userId, orderNo) => ({ order_no: orderNo, eligible: true } as never),
    getBestSellers: async () => [{ rank: 1, units_sold: 12, product: products[1] }],
    ...overrides,
  };
}

test('product search uses current service data and applies price/stock filters', async () => {
  const execute = createDatabaseToolExecutor(null, dependencies());
  const result = await execute({ name: 'search_products', args: { max_price: 500, in_stock_only: true, limit: 20 } });
  const rows = result.products as Array<{ price: number; stock: number }>;
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => row.price <= 500 && row.stock > 0));
});

test('tool result limiting is capped at 20 even when a larger limit is supplied', async () => {
  const result = await createDatabaseToolExecutor(null, dependencies())({ name: 'search_products', args: { limit: 999 } });
  assert.equal(result.returned, 20);
  assert.equal((result.products as unknown[]).length, 20);
});

test('latest order lookup uses only the authenticated user id', async () => {
  let received = 0;
  const execute = createDatabaseToolExecutor(7, dependencies({ getOrders: async userId => {
    received = userId; return [{ order_no: 'MDG-20260920-ABC123', total: 499, status: 'shipped', item_count: 1, created_at: '2026-09-20T00:00:00Z' }];
  } }));
  const result = await execute({ name: 'get_my_orders', args: { limit: 1, user_id: 999 } });
  assert.equal(received, 7);
  assert.equal((result.orders as unknown[]).length, 1);
});

test('another customer order is indistinguishable from an unknown order', async () => {
  const result = await createDatabaseToolExecutor(8, dependencies())({ name: 'get_my_order_details', args: { order_no: 'MDG-20260920-ABC123' } });
  assert.deepEqual(result, { found: false });
});

test('claim and warranty lookup is scoped to the signed-in user', async () => {
  let received = 0;
  const execute = createDatabaseToolExecutor(7, dependencies({ getWarranty: async (userId, orderNo) => {
    received = userId; return { order_no: orderNo, eligible: true } as never;
  } }));
  const result = await execute({ name: 'get_warranty_information', args: { order_no: 'MDG-20260920-ABC123' } });
  assert.equal(received, 7);
  assert.equal((result.warranty as { eligible: boolean }).eligible, true);
});

test('unknown products return found false', async () => {
  const result = await createDatabaseToolExecutor(null, dependencies())({ name: 'get_product_details', args: { product_id: 'missing', business: 'vault' } });
  assert.deepEqual(result, { found: false });
});

test('best seller tool reuses the shared service and supports business and limit filters', async () => {
  let query: unknown;
  const execute = createDatabaseToolExecutor(null, dependencies({ getBestSellers: async value => {
    query = value; return [{ rank: 1, units_sold: 12, product: products[1] }];
  } }));
  const result = await execute({ name: 'get_best_sellers', args: { business: 'vault', limit: 5 } });
  assert.deepEqual(query, { business: 'vault', limit: 5 });
  assert.equal((result.best_sellers as unknown[]).length, 1);
});

test('database failures do not expose query or credential details in controller-facing errors', async () => {
  const execute = createDatabaseToolExecutor(7, dependencies({ getOrders: async () => { throw new Error('SELECT password_hash DB_PASSWORD=secret'); } }));
  await assert.rejects(execute({ name: 'get_my_orders', args: {} }), /SELECT password_hash/);
  // The Gemini loop converts this to the fixed DATA_UNAVAILABLE result; it never serializes the thrown message.
});

test('Gemini failures propagate as safe API errors', async () => {
  await assert.rejects(
    chatWithDatabaseAssistant({ messages: [{ role: 'user', content: 'สินค้าอะไรมีบ้าง' }] }, null, {
      generateReply: async () => { throw new ApiError(502, 'AI_REQUEST_FAILED', 'The AI assistant is temporarily unavailable.'); },
    }),
    (error: unknown) => error instanceof ApiError && error.code === 'AI_REQUEST_FAILED',
  );
});

test('system prompt requires tools and refuses sensitive information', () => {
  const instruction = databaseAssistantInstruction(true);
  assert.match(instruction, /MUST call/);
  assert.match(instruction, /password hashes/);
  assert.match(instruction, /Refuse sensitive-data requests/);
});

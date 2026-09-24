import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors/apiError.js';
import { chatWithAssistant } from '../src/services/ai/chatService.js';
import type { ChatServiceDependencies } from '../src/services/ai/chatService.js';
import type { NormalizedProduct } from '../src/types/product.js';
import type { OrderSummary } from '../src/types/order.js';

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

const products: NormalizedProduct[] = [{
  id: 'plug-1', business: 'plug', business_name: 'Electrical Plug', name: 'Universal plug', category: 'Adapters',
  price: 199, stock: 10, unit: 'pcs', status: 'In Stock', image_url: '', updated_at: '2026-09-20T00:00:00Z',
}];

const orders: OrderSummary[] = [
  { order_no: 'MDG-1001', total: 199, status: 'completed', item_count: 1, created_at: '2026-09-18T00:00:00Z' },
];

function dependencies(overrides: Partial<ChatServiceDependencies> = {}): Partial<ChatServiceDependencies> {
  return {
    generateReply: async () => 'สวัสดีค่ะ ยินดีให้บริการ',
    getProducts: async () => products,
    getOrdersForUser: async () => orders,
    ...overrides,
  };
}

test('chatWithAssistant rejects an empty message list', async () => {
  await expectApiError(chatWithAssistant({ messages: [] }, null, dependencies()), 400, 'INVALID_MESSAGES');
});

test('chatWithAssistant rejects a payload with no valid messages', async () => {
  await expectApiError(
    chatWithAssistant({ messages: [{ role: 'system', content: 'hi' }, { role: 'user', content: '' }] }, null, dependencies()),
    400,
    'INVALID_MESSAGES',
  );
});

test('chatWithAssistant never fetches order data for a guest, even if a userId is smuggled into the body', async () => {
  let orderLookupCalled = false;
  const deps = dependencies({
    getOrdersForUser: async () => { orderLookupCalled = true; return orders; },
    generateReply: async ({ systemInstruction }) => {
      assert.ok(systemInstruction.includes('not signed in'));
      assert.ok(!systemInstruction.includes('MDG-1001'));
      return 'กรุณาเข้าสู่ระบบเพื่อดูคำสั่งซื้อของคุณค่ะ';
    },
  });

  const payload = { messages: [{ role: 'user', content: 'What are my orders?' }], userId: 999 };
  const result = await chatWithAssistant(payload, null, deps);

  assert.equal(orderLookupCalled, false);
  assert.equal(result.reply, 'กรุณาเข้าสู่ระบบเพื่อดูคำสั่งซื้อของคุณค่ะ');
});

test('chatWithAssistant includes the real signed-in user\'s own orders, sourced only from the trusted session userId', async () => {
  let lookedUpUserId: number | null = null;
  const deps = dependencies({
    getOrdersForUser: async userId => { lookedUpUserId = userId; return orders; },
    generateReply: async ({ systemInstruction }) => {
      assert.ok(systemInstruction.includes('MDG-1001'));
      return 'คุณมีคำสั่งซื้อ MDG-1001 ค่ะ';
    },
  });

  // The controller passes the session userId as a separate argument; a body-supplied id must never be used instead.
  const payload = { messages: [{ role: 'user', content: 'What are my orders?' }], userId: 999 };
  const result = await chatWithAssistant(payload, 42, deps);

  assert.equal(lookedUpUserId, 42);
  assert.equal(result.reply, 'คุณมีคำสั่งซื้อ MDG-1001 ค่ะ');
});

test('chatWithAssistant trims the conversation to the most recent messages and passes them as chat turns', async () => {
  const longHistory = Array.from({ length: 25 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `message ${index}`,
  }));
  const deps = dependencies({
    generateReply: async ({ turns }) => {
      assert.equal(turns.length, 20);
      assert.equal(turns[turns.length - 1].text, 'message 24');
      assert.equal(turns[turns.length - 1].role, 'user');
      assert.ok(turns.every(turn => turn.role === 'user' || turn.role === 'model'));
      return 'ok';
    },
  });

  await chatWithAssistant({ messages: longHistory }, null, deps);
});

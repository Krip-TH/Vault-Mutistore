import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors/apiError.js';
import { TtlCache } from '../src/services/ai/cache.js';
import { describeProduct } from '../src/services/ai/describeService.js';
import type { DescribeServiceDependencies } from '../src/services/ai/describeService.js';
import type { NormalizedProduct } from '../src/types/product.js';

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

function product(overrides: Partial<NormalizedProduct>): NormalizedProduct {
  return {
    id: 'p1', business: 'plug', business_name: 'Electrical Plug', name: 'Plug', category: 'Adapters',
    price: 100, stock: 10, unit: 'pcs', status: 'In Stock', image_url: '', updated_at: '2026-09-20T00:00:00Z',
    ...overrides,
  };
}

test('describeProduct rejects a blank product id', async () => {
  const deps: Partial<DescribeServiceDependencies> = { getProducts: async () => [] };
  await expectApiError(describeProduct('', undefined, deps), 400, 'INVALID_PRODUCT_ID');
});

test('describeProduct returns 404 when the product does not exist in real inventory', async () => {
  const deps: Partial<DescribeServiceDependencies> = { getProducts: async () => [product({ id: 'a' })] };
  await expectApiError(describeProduct('missing', undefined, deps), 404, 'PRODUCT_NOT_FOUND');
});

test('describeProduct returns the trimmed model text for a real product', async () => {
  const deps: Partial<DescribeServiceDependencies> = {
    getProducts: async () => [product({ id: 'target', name: 'Universal plug' })],
    cache: new TtlCache(60_000),
    generateDescription: async target => {
      assert.equal(target.id, 'target');
      return '  ปลั๊กไฟอเนกประสงค์ ใช้งานง่าย เหมาะกับทุกบ้าน  ';
    },
  };

  const result = await describeProduct('target', undefined, deps);
  assert.equal(result.description, 'ปลั๊กไฟอเนกประสงค์ ใช้งานง่าย เหมาะกับทุกบ้าน');
});

test('describeProduct treats an empty model response as a failure rather than returning blank text', async () => {
  const deps: Partial<DescribeServiceDependencies> = {
    getProducts: async () => [product({ id: 'target' })],
    cache: new TtlCache(60_000),
    generateDescription: async () => '   ',
  };
  await expectApiError(describeProduct('target', undefined, deps), 502, 'AI_EMPTY_RESPONSE');
});

test('describeProduct caches a generated description so a repeat call skips the model', async () => {
  let callCount = 0;
  const deps: Partial<DescribeServiceDependencies> = {
    getProducts: async () => [product({ id: 'target' })],
    cache: new TtlCache(60_000),
    generateDescription: async () => { callCount += 1; return 'คำอธิบายสินค้าโดย AI'; },
  };

  const first = await describeProduct('target', undefined, deps);
  const second = await describeProduct('target', undefined, deps);

  assert.equal(callCount, 1);
  assert.equal(first.description, second.description);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors/apiError.js';
import { TtlCache } from '../src/services/ai/cache.js';
import { recommendProducts } from '../src/services/ai/recommendService.js';
import type { RecommendServiceDependencies } from '../src/services/ai/recommendService.js';
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

test('recommendProducts rejects a blank product id', async () => {
  const deps: Partial<RecommendServiceDependencies> = { getProducts: async () => [] };
  await expectApiError(recommendProducts('  ', undefined, deps), 400, 'INVALID_PRODUCT_ID');
});

test('recommendProducts returns 404 when the product does not exist in real inventory', async () => {
  const deps: Partial<RecommendServiceDependencies> = { getProducts: async () => [product({ id: 'a' })] };
  await expectApiError(recommendProducts('does-not-exist', undefined, deps), 404, 'PRODUCT_NOT_FOUND');
});

test('recommendProducts maps AI-picked refs back to real products and drops any ref the model invented', async () => {
  const products = [
    product({ id: 'target', name: 'Universal plug' }),
    product({ id: 'real-1', name: 'Extension cord' }),
    product({ id: 'real-2', name: 'Surge protector' }),
  ];
  const deps: Partial<RecommendServiceDependencies> = {
    getProducts: async () => products,
    cache: new TtlCache(60_000),
    generateRecommendations: async () => ({
      recommendations: [
        { ref: 'plug:real-1', reason: 'Often bought together.' },
        { ref: 'plug:invented-id-that-does-not-exist', reason: 'This should be dropped.' },
        { ref: 'plug:real-2', reason: 'Same category.' },
      ],
    }),
  };

  const result = await recommendProducts('target', undefined, deps);

  assert.equal(result.data.length, 2);
  assert.deepEqual(result.data.map(entry => entry.product.id), ['real-1', 'real-2']);
  assert.equal(result.data[0].reason, 'Often bought together.');
});

test('recommendProducts disambiguates products that share the same id across different businesses', async () => {
  // Regression test: ids are only unique within one business (e.g. real live data has id "31" in
  // both "plug" and "powerbank"). A bare id would let the model's pick resolve to the wrong product.
  const target = product({ id: 'target', business: 'plug' });
  const plugThirtyOne = product({ id: '31', business: 'plug', business_name: 'Electrical Plug', name: 'Plug 31' });
  const powerbankThirtyOne = product({ id: '31', business: 'powerbank', business_name: 'Powerbank', name: 'Powerbank 31' });
  const deps: Partial<RecommendServiceDependencies> = {
    getProducts: async () => [target, plugThirtyOne, powerbankThirtyOne],
    cache: new TtlCache(60_000),
    generateRecommendations: async () => ({
      recommendations: [{ ref: 'powerbank:31', reason: 'A power bank pairs well with this.' }],
    }),
  };

  const result = await recommendProducts('target', 'plug', deps);

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].product.business, 'powerbank');
  assert.equal(result.data[0].product.name, 'Powerbank 31');
});

test('recommendProducts caches the AI decision so a repeat call does not invoke the model again', async () => {
  const products = [product({ id: 'target' }), product({ id: 'other' })];
  let callCount = 0;
  const deps: Partial<RecommendServiceDependencies> = {
    getProducts: async () => products,
    cache: new TtlCache(60_000),
    generateRecommendations: async () => {
      callCount += 1;
      return { recommendations: [{ ref: 'plug:other', reason: 'Related.' }] };
    },
  };

  await recommendProducts('target', undefined, deps);
  await recommendProducts('target', undefined, deps);

  assert.equal(callCount, 1);
});

test('recommendProducts re-hydrates cached picks against current product data so stock/price stay fresh', async () => {
  const cache = new TtlCache<{ ref: string; reason: string }[]>(60_000);
  const staleProducts = [product({ id: 'target' }), product({ id: 'other', price: 100, stock: 5 })];
  const freshProducts = [product({ id: 'target' }), product({ id: 'other', price: 250, stock: 0, status: 'Out of Stock' })];
  let call = 0;
  const deps: Partial<RecommendServiceDependencies> = {
    getProducts: async () => (call++ === 0 ? staleProducts : freshProducts),
    cache,
    generateRecommendations: async () => ({ recommendations: [{ ref: 'plug:other', reason: 'Related.' }] }),
  };

  await recommendProducts('target', undefined, deps);
  const second = await recommendProducts('target', undefined, deps);

  assert.equal(second.data[0].product.price, 250);
  assert.equal(second.data[0].product.status, 'Out of Stock');
});

test('recommendProducts falls back to an empty list when the model response has no usable shape', async () => {
  const products = [product({ id: 'target' }), product({ id: 'other' })];
  const deps: Partial<RecommendServiceDependencies> = {
    getProducts: async () => products,
    cache: new TtlCache(60_000),
    generateRecommendations: async () => ({ unexpected: 'shape' }),
  };

  const result = await recommendProducts('target', undefined, deps);
  assert.deepEqual(result.data, []);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors/apiError.js';
import { generateJson, Type } from '../src/services/ai/geminiClient.js';
import { searchProducts } from '../src/services/ai/searchService.js';
import type { SearchServiceDependencies } from '../src/services/ai/searchService.js';
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

test('geminiClient.generateJson throws a 503 ApiError when GEMINI_API_KEY is not configured', async () => {
  delete process.env.GEMINI_API_KEY;
  await expectApiError(
    generateJson({ prompt: 'test', responseSchema: { type: Type.OBJECT } }),
    503,
    'AI_NOT_CONFIGURED',
  );
});

test('searchProducts rejects an empty query before calling the model', async () => {
  const dependencies: Partial<SearchServiceDependencies> = {
    generateFilters: async () => { throw new Error('should not be called'); },
    getProducts: async () => [],
  };
  await expectApiError(searchProducts({ query: '  ' }, dependencies), 400, 'INVALID_QUERY');
});

test('searchProducts propagates an ApiError when the model response cannot be parsed as JSON', async () => {
  const dependencies: Partial<SearchServiceDependencies> = {
    generateFilters: async () => {
      throw new ApiError(502, 'AI_INVALID_JSON', 'The AI assistant returned an invalid response.');
    },
    getProducts: async () => [product({})],
  };
  await expectApiError(
    searchProducts({ query: 'find a plug' }, dependencies),
    502,
    'AI_INVALID_JSON',
  );
});

test('searchProducts filters and sorts real inventory using the AI-provided filters', async () => {
  const products = [
    product({ id: 'plug-1', business: 'plug', business_name: 'Electrical Plug', name: 'Compact plug', price: 450 }),
    product({ id: 'plug-2', business: 'plug', business_name: 'Electrical Plug', name: 'Universal plug', price: 199 }),
    product({ id: 'plug-3', business: 'plug', business_name: 'Electrical Plug', name: 'Premium plug', price: 999 }),
    product({ id: 'door-1', business: 'door', business_name: 'Door', name: 'Wooden door', price: 300 }),
  ];
  const dependencies: Partial<SearchServiceDependencies> = {
    generateFilters: async () => ({
      keywords: ['plug'],
      minPrice: null,
      maxPrice: 500,
      business: 'plug',
      sortBy: 'price_asc',
      explanation: 'ค้นหาปลั๊กไฟราคาไม่เกิน 500 บาท',
      unexpectedExtraField: 'must be ignored safely',
    }),
    getProducts: async () => products,
  };

  const result = await searchProducts({ query: 'find a power plug under 500 baht' }, dependencies);

  assert.deepEqual(result.data.map(item => item.id), ['plug-2', 'plug-1']);
  assert.equal(result.filters.business, 'plug');
  assert.equal(result.filters.maxPrice, 500);
  assert.equal(result.filters.sortBy, 'price_asc');
  assert.equal(result.explanation, 'ค้นหาปลั๊กไฟราคาไม่เกิน 500 บาท');
  assert.ok(result.data.every(item => item.business === 'plug'));
  assert.ok(result.data.every(item => item.price <= 500));
});

test('searchProducts never trusts the model\'s shape and falls back to safe defaults for garbage output', async () => {
  const products = [product({ id: 'a' }), product({ id: 'b' })];
  const dependencies: Partial<SearchServiceDependencies> = {
    generateFilters: async () => ({
      keywords: 'not-an-array',
      minPrice: 'not-a-number',
      maxPrice: -5,
      business: 'not-a-real-business',
      sortBy: 'banana',
    }),
    getProducts: async () => products,
  };

  const result = await searchProducts({ query: 'anything' }, dependencies);

  assert.deepEqual(result.filters, {
    keywords: [], minPrice: null, maxPrice: null, business: null, sortBy: 'relevance',
  });
  assert.equal(result.explanation, 'Showing results that match your search.');
  assert.deepEqual(result.data.map(item => item.id), ['a', 'b']);
});

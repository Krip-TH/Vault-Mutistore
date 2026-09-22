import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors/apiError.js';
import { completedSalesByBusinessSql, completedSalesSql } from '../src/repositories/bestSellerRepository.js';
import { createBestSellerService, parseBestSellerQuery } from '../src/services/bestSellerService.js';
import type { ProductSalesTotal } from '../src/types/bestSeller.js';
import type { BusinessType, NormalizedProduct, ProductAggregation } from '../src/types/product.js';

function product(id: string, business: BusinessType, name: string): NormalizedProduct {
  return { id, business, business_name: business, name, category: 'Test', price: 100, stock: 5, unit: 'pcs', status: 'In Stock', image_url: '', updated_at: '' };
}
function service(sales: ProductSalesTotal[], products: NormalizedProduct[]) {
  return createBestSellerService({
    repository: { listCompletedSales: async () => sales },
    getProductAggregation: async (): Promise<ProductAggregation> => ({ products, businesses: [] }),
  });
}

test('completed sales SQL aggregates quantity and only counts completed orders', () => {
  assert.match(completedSalesSql, /SUM\(oi\.quantity\)/);
  assert.match(completedSalesSql, /WHERE o\.status = 'completed'/);
  assert.match(completedSalesSql, /GROUP BY oi\.business, oi\.product_id/);
  assert.match(completedSalesByBusinessSql, /oi\.business = \?/);
});

test('best sellers rank by repository sales order and hydrate current product data', async () => {
  const rows = await service([
    { product_id: '2', business: 'door', units_sold: 12 },
    { product_id: '1', business: 'plug', units_sold: 7 },
  ], [product('1', 'plug', 'Current Plug'), product('2', 'door', 'Current Door')]).list({ limit: 10 });
  assert.deepEqual(rows.map(row => [row.rank, row.product.name, row.units_sold]), [[1, 'Current Door', 12], [2, 'Current Plug', 7]]);
});

test('overlapping product ids remain separate across businesses', async () => {
  const rows = await service([
    { product_id: '1', business: 'door', units_sold: 9 }, { product_id: '1', business: 'plug', units_sold: 4 },
  ], [product('1', 'door', 'Door One'), product('1', 'plug', 'Plug One')]).list({ limit: 10 });
  assert.deepEqual(rows.map(row => row.product.name), ['Door One', 'Plug One']);
});

test('zero-sale products and historical products missing from current inventory do not appear', async () => {
  const rows = await service([{ product_id: 'sold', business: 'door', units_sold: 2 }], [
    product('zero', 'door', 'Zero Sales'),
  ]).list({ limit: 10 });
  assert.deepEqual(rows, []);
});

test('limit and business filters are applied with deterministic ranks', async () => {
  const sales = [
    { product_id: '1', business: 'door', units_sold: 8 },
    { product_id: '2', business: 'plug', units_sold: 7 },
    { product_id: '3', business: 'door', units_sold: 6 },
  ] as ProductSalesTotal[];
  const products = [product('1', 'door', 'D1'), product('2', 'plug', 'P2'), product('3', 'door', 'D3')];
  const rows = await service(sales, products).list({ limit: 1, business: 'door' });
  assert.equal(rows.length, 1); assert.equal(rows[0].product.name, 'D1'); assert.equal(rows[0].rank, 1);
});

test('empty completed sales return an empty list', async () => {
  assert.deepEqual(await service([], [product('1', 'door', 'Unsold')]).list({ limit: 10 }), []);
});

test('limit validation accepts 1-20 and rejects out-of-range values', () => {
  assert.equal(parseBestSellerQuery({ limit: '5' }).limit, 5);
  for (const limit of [0, 21, 1.5, 'nope']) assert.throws(() => parseBestSellerQuery({ limit }), (error: unknown) => error instanceof ApiError && error.code === 'INVALID_LIMIT');
});

test('repository or product aggregation failures are propagated for safe controller handling', async () => {
  const failing = createBestSellerService({
    repository: { listCompletedSales: async () => { throw new Error('database unavailable'); } },
    getProductAggregation: async () => ({ products: [], businesses: [] }),
  });
  await assert.rejects(failing.list({ limit: 10 }), /database unavailable/);
});

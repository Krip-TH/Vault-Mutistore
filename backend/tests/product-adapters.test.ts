import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProduct as normalizeBrandname } from '../src/adapters/brandname/index.js';
import { normalizeProduct as normalizeClothing } from '../src/adapters/clothing/index.js';
import { normalizeProduct as normalizeDoor } from '../src/adapters/door/index.js';
import { normalizeProduct as normalizePlug } from '../src/adapters/plug/index.js';
import { normalizeProduct as normalizePowerbank } from '../src/adapters/powerbank/index.js';
import { normalizeProduct as normalizeProjector } from '../src/adapters/projector/index.js';
import type { ProductAdapter } from '../src/adapters/types.js';
import { aggregateProducts } from '../src/services/productService.js';
import type { ExternalBusinessType, NormalizedProduct } from '../src/types/product.js';

test('all six adapters normalize their source fields into the shared contract', () => {
  const products = [
    normalizeDoor({ product_id: 1, product_name: 'Oak Door', category_name: 'Door', price: '2500.50', total_stock: '5', image_url: '/door.jpg', updated_at: '2026-09-20T00:00:00Z' }),
    normalizePlug({ id: 1, name: 'Smart Plug', category: 'Plug', price: '639.00', stock: 9, image: '/plug.jpg', created_at: '2026-09-20T00:00:00Z' }),
    normalizeBrandname({ id: 1, name: 'Leather Bag', category: 'Bag', price: '4800.00', total_stock: 2, image_url: '/bag.jpg', updated_at: '2026-09-20T00:00:00Z' }),
    normalizeClothing({ productId: 1, productName: 'Linen Shirt', categoryName: 'Shirt', sale_price: '1,290', quantity_available: '7', imageUrl: '/shirt.jpg', updatedAt: '2026-09-20T00:00:00Z' }),
    normalizePowerbank({ id: 1, name: 'PowerCore', category: 'Powerbank', price: '990', stock: '0', image: '/powerbank.jpg', updatedAt: '2026-09-20T00:00:00Z' }),
    normalizeProjector({ id: 1, name: 'Cinema Projector', category: 'Projector', price: '15000', stock: '4', unit: 'set', image: '/projector.jpg', lastUpdate: '2026-09-20T00:00:00Z' }),
  ];

  assert.deepEqual(products.map(product => product.business), [
    'door', 'plug', 'brandname', 'clothing', 'powerbank', 'projector',
  ]);
  for (const product of products) {
    assert.equal(product.id, '1');
    assert.ok(product.name);
    assert.ok(Number.isFinite(product.price));
    assert.ok(Number.isFinite(product.stock));
    assert.ok(product.unit);
    assert.ok(['In Stock', 'Low Stock', 'Out of Stock'].includes(product.status));
  }
  assert.equal(products[0].price, 2500.5);
  assert.equal(products[3].price, 1290);
  assert.equal(products[4].status, 'Out of Stock');
  assert.equal(products[5].unit, 'set');
});

test('aggregation isolates failures and distinguishes unavailable from online-empty businesses', async () => {
  const product = (business: ExternalBusinessType, id = 'shared'): NormalizedProduct => ({
    id, business, business_name: business, name: `${business} product`, category: 'Test',
    price: 100, stock: 2, unit: 'pcs', status: 'Low Stock', image_url: '',
    updated_at: '2026-09-20T00:00:00Z',
  });
  const succeeds = (products: NormalizedProduct[]): ProductAdapter => ({ async getProducts() { return products; } });
  const fails: ProductAdapter = { async getProducts() { throw new Error('offline'); } };
  const adapterMap: Record<ExternalBusinessType, ProductAdapter> = {
    door: succeeds([product('door'), product('door')]),
    plug: fails,
    brandname: succeeds([]),
    clothing: succeeds([product('clothing')]),
    powerbank: fails,
    projector: succeeds([{ ...product('projector', ''), name: '' }]),
  };
  const messages: string[] = [];
  const logger = {
    info: (...values: unknown[]) => messages.push(values.join(' ')),
    warn: (...values: unknown[]) => messages.push(values.join(' ')),
    error: (...values: unknown[]) => messages.push(values.join(' ')),
  };

  const result = await aggregateProducts(adapterMap, logger);

  assert.deepEqual(result.products.map(value => [value.business, value.id]), [
    ['door', 'shared'], ['clothing', 'shared'],
  ]);
  assert.deepEqual(result.businesses.map(value => [value.business, value.status, value.product_count]), [
    ['door', 'online', 1],
    ['plug', 'unavailable', 0],
    ['brandname', 'online', 0],
    ['clothing', 'online', 1],
    ['powerbank', 'unavailable', 0],
    ['projector', 'online', 0],
  ]);
  assert.ok(messages.some(message => message.includes('[plug] Product request failed')));
  assert.ok(messages.some(message => message.includes('[door] Ignored 1 invalid or duplicate product')));
});

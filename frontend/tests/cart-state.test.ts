import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addCartItem, cartKey, cartSummary, parseStoredCart, removeCartItem,
  serializeCart, setCartItemQuantity, syncCartProducts,
} from '../src/cart/cartState';
import type { Product } from '../src/types/product';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'door-1', business: 'door', business_name: 'Door', name: 'Walnut Door',
  category: 'Entrance Doors', price: 24500, stock: 5, unit: 'pcs', status: 'In Stock',
  image_url: '/door.webp', updated_at: '2026-01-01T00:00:00.000Z', ...overrides,
});

test('adds a compact product snapshot and respects the selected quantity', () => {
  const result = addCartItem([], product(), 3);
  assert.equal(result.added, 3);
  assert.equal(result.items[0].quantity, 3);
  assert.deepEqual(Object.keys(result.items[0].product).sort(), [
    'business', 'business_name', 'category', 'id', 'image_url', 'name', 'price', 'status', 'stock', 'unit',
  ]);
});

test('adding the same product increases its quantity without exceeding stock', () => {
  const first = addCartItem([], product(), 3);
  const second = addCartItem(first.items, product(), 4);
  assert.equal(second.items.length, 1);
  assert.equal(second.added, 2);
  assert.equal(second.items[0].quantity, 5);
  const full = addCartItem(second.items, product(), 1);
  assert.equal(full.added, 0);
  assert.equal(full.items, second.items);
});

test('out-of-stock and zero-stock products cannot be added', () => {
  assert.equal(addCartItem([], product({ stock: 0 }), 1).added, 0);
  assert.equal(addCartItem([], product({ status: 'Out of Stock' }), 1).added, 0);
});

test('quantity controls clamp to one and current stock, and removal is immediate', () => {
  const item = addCartItem([], product(), 2).items;
  const key = cartKey(product());
  assert.equal(setCartItemQuantity(item, key, -20)[0].quantity, 1);
  assert.equal(setCartItemQuantity(item, key, 200)[0].quantity, 5);
  assert.deepEqual(removeCartItem(item, key), []);
});

test('summary uses total quantity and calculates THB-ready subtotal across businesses', () => {
  const door = addCartItem([], product(), 2).items;
  const projector = addCartItem(door, product({ id: 'projector-1', business: 'projector', business_name: 'Projector', price: 10000, stock: 3 }), 3).items;
  assert.deepEqual(cartSummary(projector), { itemCount: 5, subtotal: 79000, hasUnavailableItems: false });
});

test('live products refresh stock and clamp existing quantities', () => {
  const items = addCartItem([], product(), 5).items;
  const synced = syncCartProducts(items, [product({ stock: 2, status: 'Low Stock', price: 25000 })]);
  assert.equal(synced[0].quantity, 2);
  assert.equal(synced[0].product.stock, 2);
  assert.equal(synced[0].product.price, 25000);
  assert.equal(synced[0].product.status, 'Low Stock');
});

test('persistence round-trips valid carts and safely rejects corrupt values', () => {
  const items = addCartItem([], product(), 2).items;
  assert.deepEqual(parseStoredCart(serializeCart(items)), items);
  for (const invalid of [null, '', '{bad', '[]', '{}', '{"version":2,"items":[]}']) {
    assert.deepEqual(parseStoredCart(invalid), []);
  }
  const mixed = JSON.stringify({ version: 1, items: [...items, { key: 'bad', quantity: -1, product: {} }] });
  assert.deepEqual(parseStoredCart(mixed), items);
});

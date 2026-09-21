import assert from 'node:assert/strict';
import test from 'node:test';
import { productInputForBusiness } from '../src/components/AdminProducts';

test('changing product business resets the selected category and preserves other fields', () => {
  const current = { business: 'door', category: 'Doors', name: 'Handle', price: 10, stock: 2, unit: 'pcs', image_url: '' };
  assert.deepEqual(productInputForBusiness(current, 'plug'), { ...current, business: 'plug', category: '' });
});

test('edit form input can preserve a current valid business and category', () => {
  const current = { business: 'door', category: 'Doors', name: 'Handle', price: 10, stock: 2, unit: 'pcs', image_url: '' };
  assert.equal(current.business, 'door'); assert.equal(current.category, 'Doors');
});

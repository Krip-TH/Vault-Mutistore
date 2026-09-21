import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductOptionsService } from '../src/services/productOptionsService.js';

test('product options merge live and stored categories uniquely without crossing businesses', async () => {
  const service = createProductOptionsService({ async listCategorySources() { return [
    { business_key: 'Door', business_name: 'Door Business', category: ' Interior Doors ' },
    { business_key: 'door', business_name: 'Door', category: 'interior doors' },
    { business_key: 'Electrical Plug', business_name: 'Electrical Plug Business', category: 'Sockets' },
  ]; } }, async () => ({ products: [
    { id: '1', business: 'door', business_name: 'Door', name: 'Door', category: 'Exterior Doors', price: 1, stock: 1, unit: 'pcs', status: 'Low Stock', image_url: '', updated_at: '' },
    { id: '2', business: 'door', business_name: 'Door', name: 'Door', category: 'Exterior Doors', price: 1, stock: 1, unit: 'pcs', status: 'Low Stock', image_url: '', updated_at: '' },
  ], businesses: [] }));
  const options = await service.getOptions();
  const door = options.businesses.find(item => item.id === 'door')!;
  const plug = options.businesses.find(item => item.id === 'plug')!;
  assert.deepEqual(door.categories, ['Exterior Doors', 'Interior Doors']);
  assert.deepEqual(plug.categories, ['Sockets']);
  assert.equal(new Set(door.categories.map(value => value.toLowerCase())).size, door.categories.length);
  assert.equal(door.categories.includes('Sockets'), false);
});

test('stored categories remain available when external aggregation fails', async () => {
  const service = createProductOptionsService({ async listCategorySources() { return [
    { business_key: 'projector', business_name: 'Projector', category: 'Portable' },
  ]; } }, async () => { throw new Error('adapters unavailable'); });
  const options = await service.getOptions();
  assert.deepEqual(options.businesses.find(item => item.id === 'projector')?.categories, ['Portable']);
});

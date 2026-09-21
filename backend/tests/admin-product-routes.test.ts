import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createAdminRouter } from '../src/routes/admin.js';
import { createAdminProductService } from '../src/services/adminProductService.js';
import type { AdminProductService } from '../src/services/adminProductService.js';
import type { AdminService } from '../src/services/adminService.js';
import type { ProductRepository } from '../src/repositories/productRepository.js';
import type { NormalizedProduct, ProductInput } from '../src/types/product.js';
import type { UserRole } from '../src/types/user.js';
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { productUploadDirectory } from '../src/middleware/productImageUpload.js';

const now = '2026-09-21T00:00:00.000Z';
const external: NormalizedProduct = { id: 'ext-1', business: 'door', business_name: 'Door', name: 'Oak Door', category: 'Doors', price: 2500, stock: 5, unit: 'pcs', status: 'In Stock', image_url: '', updated_at: now };
const local = (id = '1'): NormalizedProduct => ({ id, business: 'vault', business_name: 'VAULT', name: 'Vault Door', category: 'Doors', price: 1200, stock: 4, unit: 'pcs', status: 'In Stock', image_url: '', updated_at: now, catalog_business: 'door' });

function repository(): ProductRepository {
  let products = [local()];
  return {
    async list() { return products; },
    async findById(id) { return products.find(product => product.id === id) || null; },
    async create(input) { const { business, ...fields } = input; const value = { ...local('2'), ...fields, catalog_business: business }; products.push(value); return value; },
    async update(id, input) { const index = products.findIndex(product => product.id === id); if (index < 0) return null; const { business, ...fields } = input; products[index] = { ...products[index], ...fields, catalog_business: business }; return products[index]; },
    async delete(id) { const length = products.length; products = products.filter(product => product.id !== id); return length !== products.length; },
    async listCategorySources() { return [{ business_key: 'door', business_name: 'Door', category: 'Doors' }]; },
  };
}

function services() {
  const repo = repository();
  const products = createAdminProductService(repo, { async getProductAggregation() { return { products: [...await repo.list(), external], businesses: [] }; } }, { async getOptions() { return { businesses: [{ id: 'door', name: 'Door', categories: ['Doors'] }, { id: 'plug', name: 'Electrical Plug', categories: ['Sockets'] }] }; } });
  const admin = {} as AdminService;
  return { admin, products };
}

async function request(role: UserRole | undefined, path: string, init?: RequestInit, productService?: AdminProductService) {
  const app = express(); app.use(express.json());
  if (role) app.use((req, _res, next) => { req.auth = { userId: 1, role }; next(); });
  const defaults = services();
  app.use('/api/admin', createAdminRouter(defaults.admin, productService || defaults.products));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { return await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin${path}`, init); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

const valid: ProductInput = { business: 'door', name: 'Door Handle', category: 'Doors', price: 999, stock: 3, unit: 'pcs', image_url: 'https://example.test/door.jpg' };

test('admin product access requires authentication and admin role', async () => {
  assert.equal((await request(undefined, '/products')).status, 401);
  assert.equal((await request('customer', '/products')).status, 403);
  assert.equal((await request('customer', '/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) })).status, 403);
});

test('admin can read normalized local and external products with ownership capabilities', async () => {
  const response = await request('admin', '/products');
  assert.equal(response.status, 200);
  const data = (await response.json()).data;
  assert.deepEqual(data.map((item: { management: string }) => item.management), ['vault', 'external']);
  assert.equal(data[0].can_edit, true); assert.equal(data[1].can_edit, false);
  assert.equal((await request('admin', '/products/door/ext-1')).status, 200);
});

test('admin retrieves real business-specific category options', async () => {
  const response = await request('admin', '/product-options');
  assert.equal(response.status, 200);
  const businesses = (await response.json()).data.businesses;
  assert.deepEqual(businesses.find((item: { id: string }) => item.id === 'door').categories, ['Doors']);
  assert.deepEqual(businesses.find((item: { id: string }) => item.id === 'plug').categories, ['Sockets']);
  assert.equal(businesses.find((item: { id: string }) => item.id === 'door').categories.includes('Sockets'), false);
});

test('invalid business and category combinations are rejected', async () => {
  const response = await request('admin', '/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...valid, business: 'plug', category: 'Doors' }) });
  assert.equal(response.status, 400); assert.equal((await response.json()).error.code, 'INVALID_PRODUCT_CATEGORY');
});

test('admin create validates input and returns the persisted product', async () => {
  const invalid = await request('admin', '/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '' }) });
  assert.equal(invalid.status, 400);
  const response = await request('admin', '/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) });
  assert.equal(response.status, 201); const created = (await response.json()).data;
  assert.equal(created.business, 'vault'); assert.equal(created.image_url, valid.image_url);
});

test('admin can update and delete only VAULT-owned products', async () => {
  const updated = await request('admin', '/products/vault/1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...valid, name: 'Updated Desk' }) });
  assert.equal(updated.status, 200); assert.equal((await updated.json()).data.name, 'Updated Desk');
  assert.equal((await request('admin', '/products/vault/1', { method: 'DELETE' })).status, 204);
  const protectedUpdate = await request('admin', '/products/door/ext-1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) });
  assert.equal(protectedUpdate.status, 409); assert.equal((await protectedUpdate.json()).error.code, 'EXTERNAL_PRODUCT_READ_ONLY');
  assert.equal((await request('admin', '/products/door/ext-1', { method: 'DELETE' })).status, 409);
});

test('missing VAULT products return not found for read, update, and delete', async () => {
  assert.equal((await request('admin', '/products/vault/999')).status, 404);
  assert.equal((await request('admin', '/products/vault/999', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) })).status, 404);
  assert.equal((await request('admin', '/products/vault/999', { method: 'DELETE' })).status, 404);
});

test('admin uploads one safely named supported product image', async () => {
  const before = new Set(await readdir(productUploadDirectory));
  try {
    const body = new FormData();
    body.append('image', new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }), '../../unsafe name.jpg');
    const response = await request('admin', '/products/upload-image', { method: 'POST', body });
    assert.equal(response.status, 201);
    const imageUrl = (await response.json()).data.image_url as string;
    assert.match(imageUrl, /^\/uploads\/products\/[a-f0-9-]+\.jpg$/);
    assert.equal(imageUrl.includes('unsafe'), false);

    const create = await request('admin', '/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...valid, image_url: imageUrl }) });
    assert.equal(create.status, 201); assert.equal((await create.json()).data.image_url, imageUrl);
  } finally {
    for (const name of await readdir(productUploadDirectory)) if (!before.has(name)) await unlink(path.join(productUploadDirectory, name));
  }
});

test('product image upload enforces authentication, role, MIME type, and size', async () => {
  const image = new FormData(); image.append('image', new Blob(['image'], { type: 'image/png' }), 'image.png');
  assert.equal((await request(undefined, '/products/upload-image', { method: 'POST', body: image })).status, 401);
  const customerImage = new FormData(); customerImage.append('image', new Blob(['image'], { type: 'image/png' }), 'image.png');
  assert.equal((await request('customer', '/products/upload-image', { method: 'POST', body: customerImage })).status, 403);
  const invalid = new FormData(); invalid.append('image', new Blob(['not an image'], { type: 'text/plain' }), 'note.txt');
  assert.equal((await request('admin', '/products/upload-image', { method: 'POST', body: invalid })).status, 400);
  const oversized = new FormData(); oversized.append('image', new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/webp' }), 'large.webp');
  const response = await request('admin', '/products/upload-image', { method: 'POST', body: oversized });
  assert.equal(response.status, 413); assert.equal((await response.json()).error.code, 'IMAGE_TOO_LARGE');
});

test('VAULT product update can replace an external URL with an uploaded image path', async () => {
  const response = await request('admin', '/products/vault/1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...valid, image_url: '/uploads/products/123e4567-e89b-12d3-a456-426614174000.webp' }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.image_url, '/uploads/products/123e4567-e89b-12d3-a456-426614174000.webp');
});

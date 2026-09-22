import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createBestSellerController } from '../src/controllers/bestSellerController.js';

async function requestWith(service: { list(value: unknown): Promise<unknown> }) {
  const app = express();
  app.get('/api/products/best-sellers', createBestSellerController(service as never));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try { return await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/products/best-sellers?limit=5`); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test('best seller endpoint returns only ranked product data', async () => {
  let query: unknown;
  const response = await requestWith({ list: async value => { query = value; return [{ rank: 1, units_sold: 4, product: { id: '1' } }]; } });
  assert.equal(response.status, 200);
  assert.equal((query as { limit: string }).limit, '5');
  const payload = await response.json() as { data: unknown[]; source: string };
  assert.equal(payload.source, 'completed_orders'); assert.equal(payload.data.length, 1);
});

test('best seller endpoint hides database failure details', async () => {
  const original = console.error; console.error = () => {};
  try {
    const response = await requestWith({ list: async () => { throw new Error('SELECT customer_email secret'); } });
    assert.equal(response.status, 500);
    const text = await response.text();
    assert.match(text, /Unable to load best sellers right now/);
    assert.doesNotMatch(text, /customer_email|SELECT|secret/);
  } finally { console.error = original; }
});

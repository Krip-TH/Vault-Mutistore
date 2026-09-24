import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import apiRouter from '../src/routes/index.js';

test('order endpoints reject unauthenticated requests before reaching order logic', async t => {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));

  const { port } = server.address() as AddressInfo;
  const requests: Array<[string, RequestInit | undefined]> = [
    ['/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }],
    ['/api/orders', undefined],
    ['/api/orders/MDG-20260919-ABC123', undefined],
  ];

  for (const [path, init] of requests) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
    assert.equal(response.status, 401, `${init?.method ?? 'GET'} ${path}`);
    assert.deepEqual(await response.json(), {
      error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' },
    });
  }
});

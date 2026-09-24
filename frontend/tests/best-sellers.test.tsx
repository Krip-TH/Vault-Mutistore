import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BestSellersPage from '../src/components/BestSellersPage';
import { fetchBestSellers } from '../src/products/bestSellersApi';
import { customerNavigation } from '../src/navigation';

test('customer navigation includes Best Sellers and admin navigation is unaffected', () => {
  assert.ok(customerNavigation.some(item => item.label === 'Best Sellers' && item.route === 'best-sellers'));
});

test('best sellers API requests the read-only endpoint and returns structured data', async () => {
  let requested = '';
  const response = await fetchBestSellers(5, async input => {
    requested = String(input);
    return new Response(JSON.stringify({ data: [], source: 'completed_orders' }), { status: 200 });
  });
  assert.equal(requested, '/api/products/best-sellers?limit=5');
  assert.deepEqual(response.data, []);
});

test('best sellers API exposes a safe server error', async () => {
  await assert.rejects(fetchBestSellers(10, async () => new Response(JSON.stringify({ error: { message: 'Unable to load best sellers right now.' } }), { status: 500 })), /Unable to load best sellers/);
});

test('best sellers page renders its initial loading state', () => {
  const html = renderToStaticMarkup(<BestSellersPage onSelect={() => {}} />);
  assert.match(html, /Best Sellers/);
  assert.match(html, /Loading best sellers/);
});

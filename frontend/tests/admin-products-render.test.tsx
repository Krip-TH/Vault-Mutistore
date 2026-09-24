import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminProducts from '../src/components/AdminProducts';

test('admin Products CRUD page still renders its initial protected workspace', () => {
  const html = renderToStaticMarkup(<AdminProducts />);
  assert.match(html, /Loading products/);
});

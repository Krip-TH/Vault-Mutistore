import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProductDetail from '../src/components/ProductDetail';
import ProductGallery from '../src/components/ProductGallery';
import Product360Viewer from '../src/components/Product360Viewer';
import { ProductCard } from '../src/components/ProductPresentation';
import { CartProvider } from '../src/cart/CartContext';
import { imageUrls, purchaseState } from '../src/utils/product';
import type { BusinessType, Product, ProductsResponse } from '../src/types/product';

// Test fixture only; the storefront always consumes /api/products.
const product: Product = {
  id: 'test-reference', business: 'door', business_name: 'Test business', category: 'Test category',
  name: 'Test product', price: 100, stock: 5, unit: 'pcs', status: 'In Stock', image_url: '', updated_at: '',
};
const callbacks = { onClose() {}, onFavorite() {} };
const detail = (value: Product, inventoryAvailable = true) => renderToStaticMarkup(
  <CartProvider><ProductDetail {...callbacks} product={value} favorite={false} inventoryAvailable={inventoryAvailable} /></CartProvider>,
);

test('card selection passes the exact product, including business identity and optional fields', () => {
  for (const business of ['door', 'brandname', 'projector', 'clothing', 'plug', 'powerbank'] as BusinessType[]) {
    const selectedProduct = { ...product, business, description: 'Supplied description', images_360: [] };
    let selected: Product | undefined;
    const card = ProductCard({ product: selectedProduct, onSelect(value) { selected = value; } });
    card.props.children.props.onClick();
    assert.equal(selected, selectedProduct);
    assert.ok(renderToStaticMarkup(card).includes('card-arrow'));
  }
});

test('quantity stays valid across changes to stock, bag quantity, and requested quantity', () => {
  for (const stock of [0, 1, 5, 100, -1, NaN, Infinity]) {
    for (const bag of [0, 1, 5, 200]) {
      for (const requested of [-10, 0, 1, 3, 500, 1.5, NaN, Infinity]) {
        const result = purchaseState({ ...product, stock }, bag, requested);
        assert.ok(Number.isSafeInteger(result.quantity) && result.quantity >= 1);
        if (result.canAdd) {
          assert.ok(result.quantity <= result.remaining);
          assert.ok(bag + result.quantity <= stock);
        }
      }
    }
  }
  assert.equal(purchaseState(product, 0, 4).quantity, 4);
  assert.equal(purchaseState({ ...product, stock: 2 }, 0, 4).quantity, 2);
  assert.equal(purchaseState(product, 4, 4).quantity, 1);
  assert.equal(purchaseState(product, 5, 1).canAdd, false);
});

test('zero stock, out-of-stock status, missing price and offline inventory disable purchases', () => {
  for (const value of [{ ...product, stock: 0 }, { ...product, status: 'Out of Stock' as const }]) {
    assert.equal(purchaseState(value, 0, 1).canAdd, false);
    assert.match(detail(value), /add-to-bag[^>]*disabled=""[^>]*>Out of stock/);
  }
  assert.equal(purchaseState({ ...product, price: NaN }, 0, 1).canAdd, false);
  assert.equal(purchaseState(product, 0, 1, false).canAdd, false);
  assert.match(detail(product, false), /add-to-bag[^>]*disabled=""[^>]*>Inventory unavailable/);
});

test('incomplete optional and required display fields do not crash detail or cards', () => {
  // Simulates a runtime response with fields omitted despite the normalized contract.
  const incomplete = { id: 'incomplete', business: 'plug', name: 'Incomplete product' } as Product;
  const html = detail(incomplete);
  assert.ok(html.includes('Incomplete product'));
  assert.ok(html.includes('Image unavailable'));
  assert.ok(!html.includes('NaN'));
  assert.ok(!html.includes('<dt>Category</dt>'));
  assert.ok(!html.includes('detail-description'));
  assert.doesNotThrow(() => renderToStaticMarkup(<ProductCard product={incomplete} onSelect={() => {}} />));
  const optional = detail({ ...product, description: '<Supplied & safe>', images: undefined, images_360: undefined });
  assert.ok(optional.includes('&lt;Supplied &amp; safe&gt;'));
});

test('missing, single-frame, duplicate and malformed sequences never expose a fake 360 option', () => {
  assert.deepEqual(imageUrls(null), []);
  assert.deepEqual(imageUrls(['', null, ' image-a ', 'image-a']), ['image-a']);
  for (const images_360 of [undefined, [], ['image-a'], ['image-a', 'image-a']]) {
    const html = renderToStaticMarkup(<ProductGallery product={{ ...product, images_360 }} />);
    assert.ok(!html.includes('thumbnail-360'));
  }
  const html = renderToStaticMarkup(<ProductGallery product={{ ...product, images_360: ['image-a', 'image-b'] }} />);
  assert.ok(html.includes('thumbnail-360'));
  assert.ok(html.includes('360° View'));
  const alias = renderToStaticMarkup(<ProductGallery product={{ ...product, view_360: ['image-a', 'image-b'] }} />);
  assert.ok(alias.includes('thumbnail-360'));
  const standalone = renderToStaticMarkup(<Product360Viewer name={product.name} image_url="image-a" images_360={[]} />);
  assert.ok(standalone.includes('src="image-a"'));
  assert.ok(!standalone.includes('Drag to rotate'));
});

test('image_url-only products show one intentional main view with a loading placeholder', () => {
  const html = renderToStaticMarkup(<ProductGallery product={{ ...product, image_url: 'image-a' }} />);
  assert.ok(html.includes('src="image-a"'));
  assert.ok(html.includes('Loading image'));
  assert.ok(html.includes('1 / 1'));
  assert.ok(!html.includes('gallery-thumbnails'));
  assert.ok(renderToStaticMarkup(<ProductGallery product={product} />).includes('Image unavailable'));
});

test('live products render collection cards and the matching details through the frontend API proxy', async context => {
  const url = process.env.MOODENG_TEST_API_URL;
  if (!url) { context.skip('Set MOODENG_TEST_API_URL to test a running frontend proxy.'); return; }
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  const payload = await response.json() as ProductsResponse;
  assert.ok(Array.isArray(payload.data) && payload.data.length > 0);
  const counts: Record<string, number> = {};
  for (const value of payload.data) {
    let selected: Product | undefined;
    const card = ProductCard({ product: value, onSelect(next) { selected = next; } });
    card.props.children.props.onClick();
    assert.equal(selected, value);
    assert.ok(renderToStaticMarkup(card).includes('product-card'));
    const html = detail(selected!);
    assert.ok(html.includes('detail-title'));
    assert.ok(!html.includes('NaN'));
    counts[value.business] = (counts[value.business] ?? 0) + 1;
  }
  context.diagnostic(JSON.stringify(counts));
});

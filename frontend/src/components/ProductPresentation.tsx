import { useState } from 'react';
import type { Product, StockStatus } from '../types/product';
import { hasNumber, textValue } from '../utils/product';

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
const statusClass: Record<StockStatus, string> = {
  'In Stock': 'available', 'Low Stock': 'low', 'Out of Stock': 'unavailable',
};

export function ProductImage({ product, eager = false }: { product: Product; eager?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!product.image_url || failedUrl === product.image_url) {
    return <div className="image-fallback" role="img" aria-label={`Image unavailable for ${product.name}`}>
      <span className="product-placeholder-mark" aria-hidden="true">m.</span>
      <span className="product-placeholder-business">{product.business_name}</span>
      <span className="product-placeholder-category">{product.category || 'Product collection'}</span>
    </div>;
  }
  return <img src={product.image_url} alt={product.name} loading={eager ? 'eager' : 'lazy'} onError={() => setFailedUrl(product.image_url)} />;
}

export function StockBadge({ status }: { status: StockStatus }) {
  if (!Object.prototype.hasOwnProperty.call(statusClass, status)) return null;
  return <span className={`stock-badge ${statusClass[status]}`}><span aria-hidden="true" />{status}</span>;
}

export function ProductCard({ product, onSelect }: { product: Product; onSelect: (product: Product) => void }) {
  return <article className="product-card">
    <button className="product-open" onClick={() => onSelect(product)} aria-label={`View details for ${product.name}`}>
      <div className="product-image"><ProductImage product={product} /><span className="image-business">{product.business_name}</span><span className="card-arrow" aria-hidden="true">↗</span></div>
      <div className="product-info">
        <p className="product-category">{product.category || 'Uncategorized'}</p>
        <h3>{product.name}</h3>
        <div className="product-card-meta">
          <div className="product-bottom">{hasNumber(product.price) && <strong>{price.format(product.price)}</strong>}{hasNumber(product.stock) && <span>{product.stock.toLocaleString()} {textValue(product.unit)}</span>}</div>
          <StockBadge status={product.status} />
        </div>
      </div>
    </button>
  </article>;
}

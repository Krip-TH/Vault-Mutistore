import { useEffect, useRef, useState } from 'react';
import type { Product, StockStatus } from '../types/product';

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
const statusClass: Record<StockStatus, string> = {
  'In Stock': 'available', 'Low Stock': 'low', 'Out of Stock': 'unavailable',
};

export function ProductImage({ product, eager = false }: { product: Product; eager?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!product.image_url || failedUrl === product.image_url) {
    return <div className="image-fallback" role="img" aria-label={`Image unavailable for ${product.name}`}><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="7" y="7" width="34" height="34" rx="5" /><circle cx="18" cy="18" r="3" /><path d="m8 34 11-11 8 8 6-6 8 9" /></svg><span>Image unavailable</span></div>;
  }
  return <img src={product.image_url} alt={product.name} loading={eager ? 'eager' : 'lazy'} onError={() => setFailedUrl(product.image_url)} />;
}

export function StockBadge({ status }: { status: StockStatus }) {
  return <span className={`stock-badge ${statusClass[status]}`}><span aria-hidden="true" />{status}</span>;
}

export function ProductCard({ product, onSelect }: { product: Product; onSelect: (product: Product) => void }) {
  return <article className="product-card">
    <button className="product-open" onClick={() => onSelect(product)} aria-label={`View details for ${product.name}`}>
      <div className="product-image"><ProductImage product={product} /><span className="image-business">{product.business_name}</span><span className="card-arrow" aria-hidden="true">↗</span></div>
      <div className="product-info"><p className="product-category">{product.category}</p><h3>{product.name}</h3><div className="product-bottom"><strong>{price.format(product.price)}</strong><span>{product.stock.toLocaleString()} {product.unit}</span></div><StockBadge status={product.status} /></div>
    </button>
  </article>;
}

export function ProductDetail({ product, onClose }: { product: Product; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const date = new Date(product.updated_at);
  const validDate = product.updated_at && !Number.isNaN(date.getTime());
  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return <dialog ref={dialogRef} className="product-dialog" aria-labelledby="detail-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="detail-layout">
      <button className="dialog-close" onClick={onClose} aria-label="Close product details" autoFocus>×</button>
      <div className="detail-image"><ProductImage product={product} eager /></div>
      <div className="detail-copy"><p className="eyebrow">{product.business_name} / {product.category}</p><h2 id="detail-title">{product.name}</h2><p className="detail-price">{price.format(product.price)}</p><StockBadge status={product.status} />
        <dl className="detail-facts"><div><dt>Business</dt><dd>{product.business_name}</dd></div><div><dt>Category</dt><dd>{product.category}</dd></div><div><dt>Available stock</dt><dd>{product.stock.toLocaleString()} {product.unit}</dd></div><div><dt>Product reference</dt><dd>{product.id}</dd></div>{validDate && <div><dt>Last updated</dt><dd><time dateTime={product.updated_at}>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)}</time></dd></div>}</dl>
        <p className="detail-note">Inventory as received from {product.business_name}. Availability may change.</p><button className="primary-button" onClick={onClose}>Continue exploring <span aria-hidden="true">↗</span></button>
      </div>
    </div>
  </dialog>;
}

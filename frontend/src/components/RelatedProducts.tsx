import { useEffect, useState } from 'react';
import type { Product } from '../types/product';
import { fetchRecommendations } from '../ai/aiApi';
import { hasNumber } from '../utils/product';
import { ProductImage, StockBadge } from './ProductPresentation';

interface Props {
  product: Product;
  onSelectProduct: (product: Product) => void;
}

interface Recommendation {
  product: Product;
  reason: string;
}

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export default function RelatedProducts({ product, onSelectProduct }: Props) {
  const [items, setItems] = useState<Recommendation[] | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    setItems(null);
    fetchRecommendations(product.id, product.business)
      .then(response => { if (active) setItems(response.data); })
      .catch(() => {
        // AI features must never break the page: fail silently and hide the section.
        if (active) setAvailable(false);
      });
    return () => { active = false; };
  }, [product.business, product.id]);

  if (!available || (items && items.length === 0)) return null;

  return (
    <section className="related-products" aria-labelledby="related-products-heading">
      <p className="eyebrow">04 / YOU MIGHT ALSO LIKE</p>
      <h3 id="related-products-heading">Related picks</h3>
      {!items && (
        <div className="related-products-grid" aria-busy="true" aria-label="Loading related products">
          {Array.from({ length: 4 }, (_, index) => <div className="skeleton-card" key={index}><div /><span /><span /></div>)}
        </div>
      )}
      {items && items.length > 0 && (
        <div className="related-products-grid">
          {items.map(item => (
            <button
              key={JSON.stringify([item.product.business, item.product.id])}
              type="button"
              className="related-product-card"
              onClick={() => onSelectProduct(item.product)}
            >
              <div className="product-image"><ProductImage product={item.product} /></div>
              <div className="related-product-info">
                <p className="related-product-business">{item.product.business_name}</p>
                <h4>{item.product.name}</h4>
                <div className="related-product-meta">
                  {hasNumber(item.product.price) && <strong>{price.format(item.product.price)}</strong>}
                  <StockBadge status={item.product.status} />
                </div>
                <p className="related-product-reason">{item.reason}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

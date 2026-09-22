import { useCallback, useEffect, useState } from 'react';
import { fetchBestSellers } from '../products/bestSellersApi';
import type { BestSeller, Product } from '../types/product';
import { ProductCard } from './ProductPresentation';

export default function BestSellersPage({ onSelect }: { onSelect: (product: Product) => void }) {
  const [items, setItems] = useState<BestSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);
  const load = useCallback(() => setRequestVersion(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void fetchBestSellers(10, (input, init) => fetch(input, { ...init, signal: controller.signal }))
      .then(result => setItems(result.data))
      .catch(requestError => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setItems([]); setError(requestError instanceof Error ? requestError.message : 'Unable to load best sellers right now.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [requestVersion]);

  return <main className="page-shell best-sellers-page">
    <section className="best-sellers-hero">
      <p className="eyebrow">CUSTOMER FAVOURITES</p>
      <h1>Best Sellers</h1>
      <p>Ranked by units sold from completed VAULT orders, paired with today&rsquo;s live product details.</p>
    </section>
    <section aria-labelledby="best-sellers-title">
      <div className="section-heading"><div><p className="eyebrow">TOP PRODUCTS</p><h2 id="best-sellers-title">The most purchased edit.</h2></div><p>Real completed sales. Current inventory.</p></div>
      <div aria-busy={loading}>
        {loading && <div className="product-grid" aria-label="Loading best sellers">{Array.from({ length: 4 }, (_, index) => <div className="skeleton-card" key={index}><div /><span /><span /></div>)}</div>}
        {!loading && error && <div className="empty-state" role="alert"><p className="eyebrow">LET&rsquo;S TRY THAT AGAIN</p><h3>Best Sellers are taking a moment.</h3><p>{error}</p><button className="primary-button" onClick={load}>Try again ↗</button></div>}
        {!loading && !error && items.length === 0 && <div className="empty-state"><p className="eyebrow">COMING INTO FOCUS</p><h3>No completed sales yet.</h3><p>Best Sellers will appear after customer orders are completed.</p></div>}
        {!loading && !error && items.length > 0 && <ol className="product-grid best-sellers-grid">{items.map(item => <li key={`${item.product.business}:${item.product.id}`} className="best-seller-item"><div className="best-seller-rank"><strong>#{item.rank}</strong>{item.rank <= 3 && <span>Best Seller</span>}<small>{item.units_sold.toLocaleString()} units sold</small></div><ProductCard product={item.product} onSelect={onSelect} /></li>)}</ol>}
      </div>
    </section>
  </main>;
}

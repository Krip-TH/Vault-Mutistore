import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Product } from '../types/product';
import { searchProductsWithAi } from '../ai/aiApi';
import { ProductCard } from './ProductPresentation';

interface Props {
  onSelectProduct: (product: Product) => void;
}

interface AiResult {
  data: Product[];
  explanation: string;
}

export default function AiSearchBar({ onSelectProduct }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [available, setAvailable] = useState(true);

  if (!available) return null;

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const response = await searchProductsWithAi(trimmed);
      setResult({ data: response.data, explanation: response.explanation });
    } catch {
      // AI features must never break the page: fail silently and hide the widget.
      setResult(null);
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setQuery('');
    setResult(null);
  }

  return (
    <div className="ai-search">
      <form className="ai-search-form" onSubmit={runSearch}>
        <label className="search-field ai-search-field">
          <span className="sr-only">Ask AI to find a product</span>
          <span aria-hidden="true">✦</span>
          <input
            type="search"
            placeholder="Try “find a power plug under 500 baht”…"
            value={query}
            disabled={loading}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <button className="primary-button ai-search-submit" type="submit" disabled={loading || !query.trim()}>
          {loading ? 'Searching…' : 'Ask AI'}<span aria-hidden="true">✦</span>
        </button>
        {result && <button type="button" className="text-button" onClick={clear}>Clear AI search</button>}
      </form>
      {loading && (
        <div className="product-grid" aria-label="Searching with AI" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => <div className="skeleton-card" key={index}><div /><span /><span /></div>)}
        </div>
      )}
      {!loading && result && (
        <div className="ai-search-results" aria-live="polite">
          <p className="ai-search-explanation"><span aria-hidden="true">✦</span> {result.explanation}</p>
          {result.data.length === 0
            ? (
              <div className="empty-state">
                <h3>No matches for that search.</h3>
                <p>Try describing the product, price, or business differently.</p>
              </div>
            )
            : (
              <div className="product-grid">
                {result.data.map(product => (
                  <ProductCard key={JSON.stringify([product.business, product.id])} product={product} onSelect={onSelectProduct} />
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

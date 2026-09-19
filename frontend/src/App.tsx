import { useEffect, useMemo, useState } from 'react';
import type { BusinessType, Product, ProductsResponse, StockStatus } from './types/product';
import { ProductCard, ProductDetail, ProductImage } from './components/ProductPresentation';

const businessOptions: Array<{ value: BusinessType; label: string }> = [
  { value: 'door', label: 'Door' },
  { value: 'plug', label: 'Plug' },
  { value: 'brandname', label: 'Brandname' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'powerbank', label: 'Powerbank' },
  { value: 'projector', label: 'Projector' },
];

const stockStatuses: StockStatus[] = ['In Stock', 'Low Stock', 'Out of Stock'];


function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [business, setBusiness] = useState<BusinessType | 'all'>('all');
  const [category, setCategory] = useState('all');
  const [stockStatus, setStockStatus] = useState<StockStatus | 'all'>('all');

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/products', {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`The products API returned HTTP ${response.status}.`);
        }

        const payload = (await response.json()) as ProductsResponse;

        if (!Array.isArray(payload.data)) {
          throw new Error('The products API returned an unexpected response.');
        }

        setProducts(payload.data);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return;
        }

        setProducts([]);
        setError(requestError instanceof Error ? requestError.message : 'Unable to load products.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadProducts();

    return () => controller.abort();
  }, [requestVersion]);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    return products.filter((product) => {
      const matchesSearch = !normalizedSearch || product.name.toLocaleLowerCase().includes(normalizedSearch);
      const matchesBusiness = business === 'all' || product.business === business;
      const matchesCategory = category === 'all' || product.category === category;
      const matchesStock = stockStatus === 'all' || product.status === stockStatus;

      return matchesSearch && matchesBusiness && matchesCategory && matchesStock;
    });
  }, [business, category, products, search, stockStatus]);

  const summary = useMemo(
    () => ({
      total: products.length,
      businesses: new Set(products.map((product) => product.business)).size,
      inStock: products.filter((product) => product.status === 'In Stock').length,
      lowStock: products.filter((product) => product.status === 'Low Stock').length,
      outOfStock: products.filter((product) => product.status === 'Out of Stock').length,
    }),
    [products],
  );

  const hasActiveFilters = search !== '' || business !== 'all' || category !== 'all' || stockStatus !== 'all';

  function clearFilters() {
    setSearch('');
    setBusiness('all');
    setCategory('all');
    setStockStatus('all');
  }


  const [selected, setSelected] = useState<Product | null>(null);
  const featured = products.find(product => product.image_url && product.stock > 0);
  const missing = businessOptions.filter(option => !products.some(product => product.business === option.value));
  return (
    <div id="home">
      <a className="skip-link" href="#explore">Skip to products</a>
      <header className="site-header">
        <a className="brand" href="#home"><span className="brand-symbol">m.</span><span>Moodeng<span className="brand-subtitle">MULTISTORE</span></span></a>
        <nav className="desktop-nav" aria-label="Main navigation"><a href="#home">Home</a><a href="#explore">Explore</a><a href="#businesses">Businesses</a></nav>
        <div className="header-actions"><a href="#search">Search <span aria-hidden="true">⌕</span></a><a className="inventory-link" href="#inventory">Inventory <span>{loading || error ? '—' : summary.total}</span></a></div>
      </header>
      <main className="page-shell">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy"><p className="eyebrow">SIX BUSINESSES. ONE DESTINATION.</p><h1 id="hero-title">A world of finds.<br /><em>All in one place.</em></h1><p className="hero-description">From the spaces you create to the essentials you carry. Discover products and explore live inventory from six independent businesses.</p><a className="primary-button" href="#explore">Explore the collection <span aria-hidden="true">↗</span></a><p className="hero-note"><span className="small-dot" /> Thoughtful discovery. A clearer view of stock.</p></div>
          <div className="hero-visual"><span className="eyebrow hero-caption">THE EVERYDAY, RECONSIDERED</span>
            {featured && !loading && !error ? <button className="hero-product" onClick={() => setSelected(featured)} aria-label={`View ${featured.name}`}><ProductImage product={featured} eager /><span className="hero-product-label"><span>{featured.business_name}<strong>{featured.name}</strong></span><span className="round-arrow" aria-hidden="true">↗</span></span></button> : <div className="hero-placeholder"><span className="editorial-mark">m.</span><p>Many perspectives.<br />One collection.</p></div>}
          </div>
        </section>
        <section className="inventory-strip" id="inventory" aria-label="Inventory summary"><div className="inventory-intro"><p className="eyebrow">AT A GLANCE</p><h2>The inventory edit.</h2><span>{loading ? 'Connecting to inventory…' : error ? 'Inventory unavailable' : 'From the latest response'}</span></div><dl className="metrics">{[['Total products', summary.total], ['Businesses', summary.businesses], ['In Stock', summary.inStock], ['Low Stock', summary.lowStock], ['Out of Stock', summary.outOfStock]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{loading || error ? '—' : value}</dd></div>)}</dl></section>
        <section id="explore" className="discovery" aria-labelledby="collection-title">
          <div className="section-heading"><div><p className="eyebrow">EXPLORE MOODENG</p><h2 id="collection-title">Find your next everyday.</h2></div><p>Distinct businesses. Endless possibilities.</p></div>
          <div id="businesses" className="business-chips" role="group" aria-label="Filter by business"><button aria-pressed={business === 'all'} onClick={() => setBusiness('all')}>All Businesses</button>{businessOptions.map(option => <button key={option.value} aria-pressed={business === option.value} onClick={() => setBusiness(option.value)}>{option.label}</button>)}</div>
          <div className="filter-bar">
            <label className="search-field"><span className="sr-only">Search by product name</span><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Search for something special…" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <label className="select-field"><span>Category</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="select-field"><span>Availability</span><select value={stockStatus} onChange={event => setStockStatus(event.target.value as StockStatus | 'all')}><option value="all">All stock statuses</option>{stockStatuses.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
          <div className="results-toolbar"><p role="status">{loading ? 'Gathering the collection…' : error ? 'Collection unavailable' : `${filteredProducts.length} of ${products.length} products`}</p><div>{hasActiveFilters && <button className="text-button" onClick={clearFilters}>Clear filters</button>}<button className="text-button" disabled={loading} onClick={() => setRequestVersion(version => version + 1)}>Refresh inventory</button></div></div>
          {!loading && !error && missing.length > 0 && <p className="availability-note">No products in this response from {missing.map(option => option.label).join(', ')}. Refresh to check again.</p>}
          <div aria-busy={loading}>
            {loading && <div className="product-grid" aria-label="Loading products">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-card" key={index}><div /><span /><span /></div>)}</div>}
            {!loading && error && <div className="empty-state" role="alert"><p className="eyebrow">LET’S TRY THAT AGAIN</p><h3>The collection is taking a moment.</h3><p>{error}</p><button className="primary-button" onClick={() => setRequestVersion(version => version + 1)}>Try again ↗</button></div>}
            {!loading && !error && products.length === 0 && <div className="empty-state"><h3>A little quiet here, for now.</h3><p>No products were returned. Refresh inventory to check again.</p></div>}
            {!loading && !error && products.length > 0 && filteredProducts.length === 0 && <div className="empty-state"><h3>Room for a different discovery.</h3><p>No products match your search and filters.</p><button className="primary-button" onClick={clearFilters}>Clear filters</button></div>}
            {!loading && !error && filteredProducts.length > 0 && <div className="product-grid">{filteredProducts.map(product => <ProductCard key={JSON.stringify([product.business, product.id])} product={product} onSelect={setSelected} />)}</div>}
          </div>
        </section>
        <footer className="site-footer"><a className="footer-brand" href="#home">Moodeng MultiStore</a><p>Six independent businesses. One shared perspective.</p><a href="#home">Back to top ↑</a></footer>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation"><a href="#home">Home</a><a href="#explore">Explore</a><a href="#businesses">Businesses</a><a href="#inventory">Inventory</a></nav>
      {selected && <ProductDetail product={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
export default App;

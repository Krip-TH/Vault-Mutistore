import { useEffect, useMemo, useState } from 'react';
import type { BusinessType, Product, ProductsResponse, StockStatus } from './types/product';

const businessOptions: Array<{ value: BusinessType; label: string }> = [
  { value: 'door', label: 'Door' },
  { value: 'plug', label: 'Plug' },
  { value: 'brandname', label: 'Brandname' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'powerbank', label: 'Powerbank' },
  { value: 'projector', label: 'Projector' },
];

const stockStatuses: StockStatus[] = ['In Stock', 'Low Stock', 'Out of Stock'];

const fallbackImage =
  'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22400%22 viewBox=%220 0 640 400%22%3E%3Crect width=%22640%22 height=%22400%22 fill=%22%231e293b%22/%3E%3Cpath d=%22M230 286l73-80 47 47 34-35 76 68H230z%22 fill=%22%23475569%22/%3E%3Ccircle cx=%22274%22 cy=%22149%22 r=%2229%22 fill=%22%2364758b%22/%3E%3Ctext x=%22320%22 y=%22342%22 text-anchor=%22middle%22 font-family=%22Arial,sans-serif%22 font-size=%2224%22 fill=%22%2394a3b8%22%3EImage unavailable%3C/text%3E%3C/svg%3E';

const priceFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 2,
});

const statusStyles: Record<StockStatus, string> = {
  'In Stock': 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  'Low Stock': 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  'Out of Stock': 'border-rose-400/30 bg-rose-400/10 text-rose-300',
};

function formatUpdatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Update unavailable';
  }

  return `Updated ${new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)}`;
}

function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-lg shadow-slate-950/20 transition duration-200 hover:-translate-y-1 hover:border-cyan-500/40">
      <div className="aspect-[16/10] overflow-hidden bg-slate-800">
        <img
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          src={product.image_url || fallbackImage}
          alt={product.name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = fallbackImage;
          }}
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300">
            {product.business_name}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[product.status]}`}>
            {product.status}
          </span>
        </div>

        <h3 className="product-title text-lg font-semibold leading-6 text-white" title={product.name}>
          {product.name}
        </h3>
        <p className="mt-2 text-sm text-slate-400">{product.category}</p>

        <div className="mt-auto pt-5">
          <p className="text-xl font-bold text-cyan-300">{priceFormatter.format(product.price)}</p>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3 text-sm">
            <span className="text-slate-400">Stock</span>
            <span className="font-semibold text-slate-200">
              {product.stock.toLocaleString()} {product.unit}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">{formatUpdatedAt(product.updated_at)}</p>
        </div>
      </div>
    </article>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading products">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="aspect-[16/10] animate-pulse bg-slate-800" />
          <div className="space-y-4 p-5">
            <div className="h-5 w-24 animate-pulse rounded bg-slate-800" />
            <div className="h-6 w-4/5 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-slate-800" />
            <div className="h-7 w-1/3 animate-pulse rounded bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400 sm:text-sm">
            Internet Programming Group Project
          </p>
          <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">Moodeng MultiStore</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Live inventory from six independent businesses, normalized into one clear product dashboard.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className={`h-2.5 w-2.5 rounded-full ${error ? 'bg-rose-400' : 'bg-emerald-400'}`} aria-hidden="true" />
              {error ? 'API unavailable' : loading ? 'Connecting to inventory' : 'Live inventory connected'}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
        <section aria-label="Inventory summary" className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ['Total products', summary.total, 'text-white'],
            ['Businesses', summary.businesses, 'text-cyan-300'],
            ['In stock', summary.inStock, 'text-emerald-300'],
            ['Low stock', summary.lowStock, 'text-amber-300'],
            ['Out of stock', summary.outOfStock, 'text-rose-300'],
          ].map(([label, value, valueClass]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className={`mt-2 text-2xl font-bold sm:text-3xl ${valueClass}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5" aria-label="Product filters">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="filter-label">Search products</span>
              <input
                className="filter-control"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by product name"
              />
            </label>

            <label className="block">
              <span className="filter-label">Business</span>
              <select className="filter-control" value={business} onChange={(event) => setBusiness(event.target.value as BusinessType | 'all')}>
                <option value="all">All Businesses</option>
                {businessOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="filter-label">Category</span>
              <select className="filter-control" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">All Categories</option>
                {categories.map((productCategory) => (
                  <option key={productCategory} value={productCategory}>{productCategory}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="filter-label">Stock status</span>
              <select className="filter-control" value={stockStatus} onChange={(event) => setStockStatus(event.target.value as StockStatus | 'all')}>
                <option value="all">All Stock Statuses</option>
                {stockStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

          {hasActiveFilters && (
            <button className="mt-4 text-sm font-semibold text-cyan-300 hover:text-cyan-200" type="button" onClick={clearFilters}>
              Clear all filters
            </button>
          )}
        </section>

        <section className="mt-8" aria-labelledby="products-heading">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="products-heading" className="text-2xl font-bold text-white">Product catalog</h2>
              {!loading && !error && (
                <p className="mt-1 text-sm text-slate-400">
                  Showing {filteredProducts.length} of {products.length} products
                </p>
              )}
            </div>
          </div>

          {loading && <LoadingCards />}

          {!loading && error && (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-6 py-12 text-center" role="alert">
              <h3 className="text-xl font-semibold text-rose-200">Unable to load inventory</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-rose-200/70">{error}</p>
              <button
                className="mt-6 rounded-lg bg-rose-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-rose-200"
                type="button"
                onClick={() => setRequestVersion((version) => version + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
              <h3 className="text-xl font-semibold text-white">No products available</h3>
              <p className="mt-2 text-sm text-slate-400">The connected businesses have not returned any products yet.</p>
            </div>
          )}

          {!loading && !error && products.length > 0 && filteredProducts.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
              <h3 className="text-xl font-semibold text-white">No matching products</h3>
              <p className="mt-2 text-sm text-slate-400">Try changing your search or filters.</p>
              <button className="mt-5 text-sm font-semibold text-cyan-300 hover:text-cyan-200" type="button" onClick={clearFilters}>
                Clear all filters
              </button>
            </div>
          )}

          {!loading && !error && filteredProducts.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard key={`${product.business}-${product.id}`} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BusinessAvailability, BusinessType, Product, ProductsResponse, StockStatus } from './types/product';
import { ProductCard, ProductImage } from './components/ProductPresentation';
import ProductDetail from './components/ProductDetail';
import AiSearchBar from './components/AiSearchBar';
import AiChatWidget from './components/AiChatWidget';
import CartDrawer from './components/CartDrawer';
import Checkout from './components/Checkout';
import OrderHistory from './components/OrderHistory';
import AccountMenu from './components/AccountMenu';
import AuthPage from './components/AuthPage';
import AdminDashboard from './components/AdminDashboard';
import { useAuth } from './auth/AuthContext';
import { parseRoute, resolveProtectedRoute, routeAfterAuthentication, routeAfterLogout, routeHash } from './auth/routes';
import type { AppRoute } from './auth/routes';
import { customerNavigation, isRouteActive } from './navigation';
import { useCart } from './cart/CartContext';
import { textValue } from './utils/product';
import type { AdminView } from './types/admin';
import CustomerProfile from './components/CustomerProfile';
import { HamburgerButton, NavigationDrawer } from './components/NavigationDrawer';

const adminViewByRoute: Partial<Record<AppRoute, AdminView>> = {
  admin: 'dashboard', 'admin-products': 'products', 'admin-orders': 'orders',
  'admin-users': 'users', 'admin-businesses': 'businesses',
};
const adminRouteByView: Record<AdminView, AppRoute> = {
  dashboard: 'admin', products: 'admin-products', orders: 'admin-orders', users: 'admin-users', businesses: 'admin-businesses',
};

function App() {
  const auth = useAuth();
  const [requestedRoute, setRequestedRoute] = useState<AppRoute>(() => parseRoute(window.location.hash));
  const navigate = useCallback((route: AppRoute, replace = false) => {
    const hash = routeHash(route);
    if (replace) window.history.replaceState(null, '', hash);
    else window.history.pushState(null, '', hash);
    setRequestedRoute(route);
  }, []);

  useEffect(() => {
    const onHashChange = () => setRequestedRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const route = resolveProtectedRoute(requestedRoute, auth.user);
  useEffect(() => {
    if (!auth.loading && route !== requestedRoute) navigate(route, true);
  }, [auth.loading, navigate, requestedRoute, route]);

  if (auth.loading) {
    return <main className="auth-loading" aria-busy="true"><span>V.</span><p>Opening VAULT…</p></main>;
  }
  if (!auth.user) {
    const isAdminLogin = route === 'admin-login';
    return <AuthPage view={route === 'register' ? 'register' : 'login'} mode={isAdminLogin ? 'admin' : 'customer'}
      onViewChange={view => navigate(view)}
      onAdminLogin={() => navigate('admin-login')}
      onCustomerLogin={() => navigate('login')}
      onAuthenticated={user => navigate(isAdminLogin ? 'admin' : routeAfterAuthentication(user), true)} />;
  }
  const adminView = adminViewByRoute[route];
  if (adminView) {
    return <AdminDashboard view={adminView}
      onViewChange={next => navigate(adminRouteByView[next])}
      onClose={() => navigate('home')}
      onLogout={async () => {
        const destination = routeAfterLogout(auth.user!);
        await auth.logout();
        navigate(destination, true);
      }} />;
  }
  return <Storefront route={route} navigate={navigate} />;
}

const businessOptions: Array<{ value: BusinessType; label: string }> = [
  { value: 'door', label: 'Door' },
  { value: 'plug', label: 'Plug' },
  { value: 'brandname', label: 'Brandname' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'powerbank', label: 'Powerbank' },
  { value: 'projector', label: 'Projector' },
];

const stockStatuses: StockStatus[] = ['In Stock', 'Low Stock', 'Out of Stock'];

type FavoriteState = { favorites: string[] };
const productKey = (product: Product) => JSON.stringify([product.business, product.id]);
function readFavorites(): FavoriteState {
  try {
    const value = JSON.parse(sessionStorage.getItem('moodeng-shopping') || '{}');
    return {
      favorites: Array.isArray(value.favorites) ? value.favorites.filter((key: unknown) => typeof key === 'string') : [],
    };
  } catch { return { favorites: [] }; }
}


function Storefront({ route, navigate }: { route: AppRoute; navigate: (route: AppRoute, replace?: boolean) => void }) {
  const cart = useCart();
  const auth = useAuth();
  const [favorites, setFavorites] = useState<FavoriteState>(readFavorites);
  useEffect(() => {
    try { sessionStorage.setItem('moodeng-shopping', JSON.stringify(favorites)); } catch { /* Favorites remain usable in memory. */ }
  }, [favorites]);
  const [products, setProducts] = useState<Product[]>([]);
  const [availability, setAvailability] = useState<BusinessAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [business, setBusiness] = useState<BusinessType | 'all'>('all');
  const [category, setCategory] = useState('all');
  const [stockStatus, setStockStatus] = useState<StockStatus | 'all'>('all');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | undefined>();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [navigationLogoutError, setNavigationLogoutError] = useState('');
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);
  const ordersOpen = route === 'orders';
  const logoutDestination = auth.user ? routeAfterLogout(auth.user) : 'login';

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
        setAvailability(Array.isArray(payload.businesses) ? payload.businesses : []);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return;
        }

        setProducts([]);
        setAvailability([]);
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
  useEffect(() => {
    if (!loading && !error) cart.syncProducts(products);
  }, [cart.syncProducts, error, loading, products]);
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      setCheckoutOpen(false);
      setSelectedOrderNo(undefined);
    }
  }, [auth.loading, auth.user]);
  useEffect(() => {
    if (route === 'cart') cart.openCart();
    if (route === 'products') requestAnimationFrame(() => document.querySelector('#explore')?.scrollIntoView());
    if (route === 'home') window.scrollTo({ top: 0 });
  }, [cart.openCart, route]);

  const categories = useMemo(
    () => [...new Set(products.map((product) => textValue(product.category)).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    return products.filter((product) => {
      const matchesSearch = !normalizedSearch || textValue(product.name).toLocaleLowerCase().includes(normalizedSearch);
      const matchesBusiness = business === 'all' || product.business === business;
      const matchesCategory = category === 'all' || textValue(product.category) === category;
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

  function openOrders(orderNo?: string) {
    setCheckoutOpen(false);
    setSelectedOrderNo(orderNo);
    navigate('orders');
  }

  function openCheckout() {
    setCheckoutOpen(true);
  }

  function openAdmin(view: AdminView) {
    if (auth.user?.role !== 'admin') return;
    navigate(adminRouteByView[view]);
  }

  const [selection, setSelected] = useState<Product | null>(null);
  const currentSelection = selection ? products.find(product => productKey(product) === productKey(selection)) : undefined;
  const selected = currentSelection ?? selection;
  const inventoryAvailable = !loading && !error && !!currentSelection;
  const featured = products.find(product => product.image_url && product.stock > 0);
  const missing = businessOptions.filter(option => !products.some(product => product.business === option.value));
  const unavailable = availability.filter(item => item.status === 'unavailable');
  const emptyBusinesses = availability.filter(item => item.status === 'online' && item.product_count === 0);
  return (
    <div id="home">
      <a className="skip-link" href="#explore">Skip to products</a>
      <header className="site-header">
        <div className="header-brand-group"><HamburgerButton expanded={navigationOpen} onClick={() => setNavigationOpen(true)} /><a className="brand" href="#/home"><span className="brand-symbol">V.</span><span>VAULT</span></a></div>
        <div className="header-actions"><button className={`header-cart ${route === 'cart' ? 'is-active' : ''}`} onClick={() => navigate('cart')} aria-label={`Open cart with ${cart.itemCount} items`}>Cart <span>{cart.itemCount}</span></button><AccountMenu onOrders={() => openOrders()} onProfile={() => navigate('profile')} onAdmin={() => openAdmin('dashboard')} onLogout={() => navigate(logoutDestination, true)} /></div>
      </header>
      <NavigationDrawer open={navigationOpen} title="VAULT" onClose={closeNavigation}>
        <nav className="nav-drawer-links" aria-label="Customer navigation">{customerNavigation.map(item => <button type="button" key={item.route} className={isRouteActive(route, item.route) ? 'is-active' : ''} aria-current={isRouteActive(route, item.route) ? 'page' : undefined} onClick={() => { closeNavigation(); navigate(item.route); }}>{item.label}{item.route === 'cart' && <span>{cart.itemCount}</span>}</button>)}</nav>
        <footer className="nav-drawer-footer"><div><strong>{auth.user?.name}</strong><span>{auth.user?.email}</span></div><button type="button" onClick={() => { setNavigationLogoutError(''); void auth.logout().then(() => { closeNavigation(); navigate(logoutDestination, true); }).catch(() => setNavigationLogoutError('Unable to sign out. Please try again.')); }}>Log out</button>{navigationLogoutError && <p className="account-error" role="alert">{navigationLogoutError}</p>}</footer>
      </NavigationDrawer>
      {route === 'profile' ? <CustomerProfile onLogout={async () => { await auth.logout(); navigate(logoutDestination, true); }} /> : <main className="page-shell">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy"><p className="eyebrow">SIX BUSINESSES. ONE DESTINATION.</p><h1 id="hero-title">A world of finds.<br /><em>All in one place.</em></h1><p className="hero-description">From the spaces you create to the essentials you carry. Discover products and explore live inventory from six independent businesses.</p><a className="primary-button" href="#explore">Explore the collection <span aria-hidden="true">↗</span></a><p className="hero-note"><span className="small-dot" /> Thoughtful discovery. A clearer view of stock.</p></div>
          <div className="hero-visual"><span className="eyebrow hero-caption">THE EVERYDAY, RECONSIDERED</span>
            {featured && !loading && !error ? <button className="hero-product" onClick={() => setSelected(featured)} aria-label={`View ${featured.name}`}><ProductImage product={featured} eager /><span className="hero-product-label"><span>{featured.business_name}<strong>{featured.name}</strong></span><span className="round-arrow" aria-hidden="true">↗</span></span></button> : <div className="hero-placeholder"><span className="editorial-mark">V.</span><p>Many perspectives.<br />One collection.</p></div>}
          </div>
        </section>
        <section className="inventory-strip" id="inventory" aria-label="Inventory summary"><div className="inventory-intro"><p className="eyebrow">AT A GLANCE</p><h2>The inventory edit.</h2><span>{loading ? 'Connecting to inventory…' : error ? 'Inventory unavailable' : 'From the latest response'}</span></div><dl className="metrics">{[['Total products', summary.total], ['Businesses', summary.businesses], ['In Stock', summary.inStock], ['Low Stock', summary.lowStock], ['Out of Stock', summary.outOfStock]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{loading || error ? '—' : value}</dd></div>)}</dl></section>
        <section id="explore" className="discovery" aria-labelledby="collection-title">
          <div className="section-heading"><div><p className="eyebrow">EXPLORE VAULT</p><h2 id="collection-title">Find your next everyday.</h2></div><p>Distinct businesses. Endless possibilities.</p></div>
          <div id="businesses" className="business-chips" role="group" aria-label="Filter by business"><button aria-pressed={business === 'all'} onClick={() => setBusiness('all')}>All Businesses</button>{businessOptions.map(option => <button key={option.value} aria-pressed={business === option.value} onClick={() => setBusiness(option.value)}>{option.label}</button>)}</div>
          <AiSearchBar onSelectProduct={setSelected} />
          <div className="filter-bar">
            <label className="search-field"><span className="sr-only">Search by product name</span><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Search for something special…" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <label className="select-field"><span>Category</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="select-field"><span>Availability</span><select value={stockStatus} onChange={event => setStockStatus(event.target.value as StockStatus | 'all')}><option value="all">All stock statuses</option>{stockStatuses.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
          <div className="results-toolbar"><p role="status">{loading ? 'Gathering the collection…' : error ? 'Collection unavailable' : `${filteredProducts.length} of ${products.length} products`}</p><div>{hasActiveFilters && <button className="text-button" onClick={clearFilters}>Clear filters</button>}<button className="text-button" disabled={loading} onClick={() => setRequestVersion(version => version + 1)}>Refresh inventory</button></div></div>
          {!loading && !error && unavailable.length > 0 && <p className="availability-note">Temporarily unavailable: {unavailable.map(item => item.business_name).join(', ')}. Available businesses remain browsable.</p>}
          {!loading && !error && emptyBusinesses.length > 0 && <p className="availability-note">Online with no products: {emptyBusinesses.map(item => item.business_name).join(', ')}.</p>}
          {!loading && !error && availability.length === 0 && missing.length > 0 && <p className="availability-note">No products in this response from {missing.map(option => option.label).join(', ')}. Refresh to check again.</p>}
          <div aria-busy={loading}>
            {loading && <div className="product-grid" aria-label="Loading products">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-card" key={index}><div /><span /><span /></div>)}</div>}
            {!loading && error && <div className="empty-state" role="alert"><p className="eyebrow">LET’S TRY THAT AGAIN</p><h3>The collection is taking a moment.</h3><p>{error}</p><button className="primary-button" onClick={() => setRequestVersion(version => version + 1)}>Try again ↗</button></div>}
            {!loading && !error && products.length === 0 && <div className="empty-state"><h3>A little quiet here, for now.</h3><p>No products were returned. Refresh inventory to check again.</p></div>}
            {!loading && !error && products.length > 0 && filteredProducts.length === 0 && <div className="empty-state"><h3>Room for a different discovery.</h3><p>No products match your search and filters.</p><button className="primary-button" onClick={clearFilters}>Clear filters</button></div>}
            {!loading && !error && filteredProducts.length > 0 && <div className="product-grid">{filteredProducts.map(product => <ProductCard key={JSON.stringify([product.business, product.id])} product={product} onSelect={setSelected} />)}</div>}
          </div>
        </section>
        <footer className="site-footer"><a className="footer-brand" href="#/home">VAULT — Multi-Store Marketplace Application</a><p>Six independent businesses. One shared perspective.</p><a href="#/home">Back to top ↑</a></footer>
      </main>}
      {selected && <ProductDetail key={productKey(selected)} product={selected} onClose={() => setSelected(null)}
        inventoryAvailable={inventoryAvailable}
        favorite={favorites.favorites.includes(productKey(selected))}
        onFavorite={() => setFavorites(current => ({ favorites: current.favorites.includes(productKey(selected)) ? current.favorites.filter(key => key !== productKey(selected)) : [...current.favorites, productKey(selected)] }))}
        onSelectProduct={setSelected} />}
      <CartDrawer onClose={() => { cart.closeCart(); if (route === 'cart') navigate('home'); }} onExplore={() => { navigate('products'); document.querySelector('#explore')?.scrollIntoView({ behavior: 'smooth' }); }} onCheckout={() => { navigate('home'); openCheckout(); }} />
      {checkoutOpen && <Checkout onClose={() => setCheckoutOpen(false)}
        onContinue={() => document.querySelector('#explore')?.scrollIntoView({ behavior: 'smooth' })}
        onViewOrder={openOrders} />}
      {ordersOpen && <OrderHistory key={selectedOrderNo || 'history'} initialOrderNo={selectedOrderNo}
        onClose={() => { setSelectedOrderNo(undefined); navigate('home'); }} />}
      <AiChatWidget />
    </div>
  );
}
export default App;

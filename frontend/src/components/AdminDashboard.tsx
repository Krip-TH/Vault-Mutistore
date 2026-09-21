import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminAnalytics, fetchAdminClaimStats, fetchAdminOrder, fetchAdminOrders, updateAdminOrderStatus,
} from '../admin/adminApi';
import type { AdminAnalytics as AdminAnalyticsData, AdminOrder, AdminOrderSummary, AdminView } from '../types/admin';
import type { ClaimStats } from '../types/claim';
import type { OrderStatus } from '../types/order';
import { useAuth } from '../auth/AuthContext';
import { adminNavigation } from '../navigation';
import AdminProducts from './AdminProducts';
import AdminClaims from './AdminClaims';
import { HamburgerButton, NavigationDrawer } from './NavigationDrawer';
import {AdminBusinesses,AdminUsers} from './AdminManagement';
import AdminAnalytics from './AdminAnalytics';

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const statuses: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'];
const adminTitles: Record<AdminView, string> = { dashboard: 'Dashboard', products: 'Products', orders: 'Orders', claims: 'Claims', users: 'Users', businesses: 'Businesses' };

export default function AdminDashboard({ view, onViewChange, onClose, onLogout }: {
  view: AdminView;
  onViewChange: (view: AdminView) => void;
  onClose: () => void;
  onLogout: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<AdminAnalyticsData | null>(null);
  const [claimStats, setClaimStats] = useState<ClaimStats | null>(null);
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelected(null);
    try {
      if (view === 'dashboard') {
        // Claim statistics are supplementary: the dashboard still renders if they fail.
        const [analytics, claims] = await Promise.all([
          fetchAdminAnalytics(),
          fetchAdminClaimStats().catch(() => null),
        ]);
        setDashboard(analytics);
        setClaimStats(claims);
      } else if (view === 'orders') setOrders(await fetchAdminOrders());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load admin data.');
    } finally { setLoading(false); }
  }, [view]);

  useEffect(() => { void load(); }, [load]);

  async function openOrder(orderNo: string) {
    setLoading(true);
    setError('');
    try { setSelected(await fetchAdminOrder(orderNo)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load this order.'); }
    finally { setLoading(false); }
  }

  async function logout() {
    setLoggingOut(true);
    setLogoutError('');
    try { await onLogout(); }
    catch { setLogoutError('Unable to sign out. Please try again.'); setLoggingOut(false); }
  }

  return <div className="admin-page" aria-labelledby="admin-title">
    <div className="admin-shell">
      <NavigationDrawer open={navigationOpen} title="VAULT ADMIN" onClose={closeNavigation}>
        <nav className="nav-drawer-links admin-drawer-links" aria-label="Admin navigation">{adminNavigation.map(item => <button type="button" key={item.view} className={view === item.view ? 'is-active' : ''} aria-current={view === item.view ? 'page' : undefined} onClick={() => { closeNavigation(); onViewChange(item.view); }}>{item.label}</button>)}</nav>
        <footer className="nav-drawer-footer"><button type="button" className="nav-return-store" onClick={() => { closeNavigation(); onClose(); }}>← Return to Store</button><div><strong>{user?.name}</strong><span>{user?.email}</span><small>Administrator</small></div><button type="button" onClick={() => void logout()} disabled={loggingOut}>{loggingOut ? 'Signing out…' : 'Log out'}</button>{logoutError && <p className="admin-logout-error" role="alert">{logoutError}</p>}</footer>
      </NavigationDrawer>
      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-header-title"><HamburgerButton expanded={navigationOpen} onClick={() => setNavigationOpen(true)} label="Open admin navigation" /><div><p className="eyebrow">VAULT ADMIN</p><h2 id="admin-title">{selected ? selected.order_no : adminTitles[view]}</h2></div></div>
        </header>
        {loading && <AdminState title="Loading admin data…" />}
        {!loading && error && <AdminState title="Unable to load admin data." detail={error} action={() => void load()} />}
        {!loading && !error && selected && <AdminOrderDetail order={selected} onBack={() => setSelected(null)}
          onUpdated={order => {
            setSelected(order);
            setOrders(current => current.map(item => item.order_no === order.order_no ? { ...item, status: order.status } : item));
            if (dashboard) void fetchAdminAnalytics().then(setDashboard).catch(() => { /* Detail remains usable if refresh fails. */ });
          }} />}
        {!loading && !error && !selected && view === 'dashboard' && dashboard && <>
          {claimStats && <ClaimStatsPanel stats={claimStats} onOpenClaims={() => onViewChange('claims')} />}
          <AdminAnalytics data={dashboard} onOpen={orderNo => void openOrder(orderNo)} />
        </>}
        {!loading && !error && !selected && view === 'orders' &&
          <OrdersView orders={orders} onOpen={orderNo => void openOrder(orderNo)} />}
        {!loading && !error && !selected && view === 'claims' && <AdminClaims />}
        {!loading && !error && !selected && view === 'products' && <AdminProducts />}
        {!loading && !error && !selected && view === 'users' && <AdminUsers />}
        {!loading && !error && !selected && view === 'businesses' && <AdminBusinesses />}
      </main>
    </div>
  </div>;
}

/** After-sales health, shown above the sales analytics on the dashboard. */
export function ClaimStatsPanel({ stats, onOpenClaims }: { stats: ClaimStats; onOpenClaims: () => void }) {
  const tiles: Array<[string, number]> = [
    ['Total claims', stats.total_claims],
    ['Awaiting review', stats.submitted_claims + stats.under_review_claims],
    ['In progress', stats.approved_claims + stats.processing_claims],
    ['Completed', stats.completed_claims],
    ['Rejected / cancelled', stats.rejected_claims + stats.cancelled_claims],
  ];
  return <div className="admin-content admin-claim-stats">
    <section className="admin-section">
      <div className="admin-section-heading">
        <div><p className="eyebrow">AFTER-SALES</p><h3>Product claims</h3></div>
        <button className="text-button" onClick={onOpenClaims}>Manage claims</button>
      </div>
      <section className="admin-metrics admin-order-metrics" aria-label="Claim statistics">
        {tiles.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </section>
      {stats.open_claims > 0 && <p className="admin-claim-alert" role="status">
        {stats.open_claims} claim{stats.open_claims === 1 ? '' : 's'} still need attention.
      </p>}
    </section>
  </div>;
}

function OrdersView({ orders, onOpen }: { orders: AdminOrderSummary[]; onOpen: (orderNo: string) => void }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const filtered = filterAdminOrders(orders, query, status);
  const metrics = orderMetrics(orders);
  return <div className="admin-content">
    <section className="admin-metrics admin-order-metrics" aria-label="Order summary">
      <article><span>Total orders</span><strong>{metrics.total}</strong></article>
      <article><span>Pending</span><strong>{metrics.pending}</strong></article>
      <article><span>Processing / active</span><strong>{metrics.active}</strong></article>
      <article><span>Delivered</span><strong>{metrics.completed}</strong></article>
      <article><span>Cancelled</span><strong>{metrics.cancelled}</strong></article>
    </section>
    <section className="admin-section">
      <div className="admin-section-heading"><div><p className="eyebrow">ORDER MANAGEMENT</p><h3>All customer orders</h3></div><span>{filtered.length} of {orders.length} orders</span></div>
      <div className="admin-order-tools">
        <label><span>Search orders</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Order ID, customer or email" /></label>
        <label><span>Status</span><select value={status} onChange={event => setStatus(event.target.value as 'all' | OrderStatus)}><option value="all">All statuses</option>{statuses.map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
      </div>
      <AdminOrderTable orders={filtered} onOpen={onOpen} emptyMessage="No orders match these filters." />
    </section>
  </div>;
}

function AdminOrderTable({ orders, onOpen, emptyMessage = 'No orders yet.' }: { orders: AdminOrderSummary[]; onOpen: (orderNo: string) => void; emptyMessage?: string }) {
  if (!orders.length) return <div className="admin-empty"><span>V.</span><h4>{emptyMessage}</h4></div>;
  return <div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th /></tr></thead>
    <tbody>{orders.map(order => <tr key={order.order_no}>
      <td><strong>{order.order_no}</strong></td><td>{order.customer_name}<small>{order.customer_email}</small></td>
      <td>{dateTime.format(new Date(order.created_at))}</td><td>{order.item_count}</td><td>{price.format(order.total)}</td>
      <td><span className={`order-status status-${order.status}`}>{statusLabel(order.status)}</span></td>
      <td><button className="text-button" onClick={() => onOpen(order.order_no)}>View details</button></td>
    </tr>)}</tbody>
  </table></div>;
}

function AdminOrderDetail({ order, onBack, onUpdated }: {
  order: AdminOrder;
  onBack: () => void;
  onUpdated: (order: AdminOrder) => void;
}) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const address = [order.shipping.address_line1, order.shipping.address_line2, order.shipping.district,
    order.shipping.province, order.shipping.postal_code, order.shipping.country].filter(Boolean);

  async function save() {
    setSaving(true); setError('');
    try { onUpdated(await updateAdminOrderStatus(order.order_no, status)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to update the status.'); }
    finally { setSaving(false); }
  }

  return <div className="admin-content admin-order-detail">
    <button className="admin-back" onClick={onBack}>← All orders</button>
    <div className="admin-detail-grid">
      <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">PRODUCTS</p><h3>Items ordered</h3></div><time>{dateTime.format(new Date(order.created_at))}</time></div>
        <div className="admin-items">{order.items.map(item => <article key={`${item.business}-${item.product_id}`}>
          <div><small>{item.business_name}</small><strong>{item.product_name}</strong><span>{item.category}</span></div>
          <dl><div><dt>Quantity</dt><dd>{item.quantity}</dd></div><div><dt>Unit price</dt><dd>{price.format(item.unit_price)}</dd></div><div><dt>Total</dt><dd>{price.format(item.line_total)}</dd></div></dl>
        </article>)}</div>
      </section>
      <aside className="admin-detail-aside">
        <section><p className="eyebrow">CUSTOMER</p><h3>{order.customer.name}</h3><a href={`mailto:${order.customer.email}`}>{order.customer.email}</a><a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a></section>
        <section><p className="eyebrow">SHIPPING</p><address>{address.map((part, index) => <span key={`${part}-${index}`}>{part}</span>)}</address></section>
        <section><p className="eyebrow">STATUS</p><label className="admin-status"><span>Order status</span><select value={status} disabled={order.status === 'completed' || order.status === 'cancelled'} onChange={event => setStatus(event.target.value as OrderStatus)}>{statuses.map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
          {(order.status === 'completed' || order.status === 'cancelled') && <p className="admin-status-note">This is a terminal status and cannot be changed.</p>}
          <button className="primary-button" disabled={saving || status === order.status || order.status === 'completed' || order.status === 'cancelled'} onClick={() => void save()}>{saving ? 'Saving…' : 'Update status'}</button>{error && <p className="checkout-error" role="alert">{error}</p>}</section>
        <dl className="admin-totals"><div><dt>Total items</dt><dd>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</dd></div><div><dt>Subtotal</dt><dd>{price.format(order.subtotal)}</dd></div><div><dt>Shipping</dt><dd>{price.format(order.shipping_fee)}</dd></div><div><dt>Discount</dt><dd>−{price.format(order.discount)}</dd></div><div><dt>Total</dt><dd>{price.format(order.total)}</dd></div></dl>
      </aside>
    </div>
  </div>;
}

function statusLabel(status: OrderStatus) {
  return status === 'completed' ? 'Delivered' : status[0].toUpperCase() + status.slice(1);
}

export function filterAdminOrders(orders: AdminOrderSummary[], query: string, status: 'all' | OrderStatus) {
  const needle = query.trim().toLocaleLowerCase();
  return orders.filter(order => (status === 'all' || order.status === status) && (!needle ||
    order.order_no.toLocaleLowerCase().includes(needle) ||
    order.customer_name.toLocaleLowerCase().includes(needle) ||
    order.customer_email.toLocaleLowerCase().includes(needle)));
}

export function orderMetrics(orders: AdminOrderSummary[]) {
  return {
    total: orders.length,
    pending: orders.filter(order => order.status === 'pending').length,
    active: orders.filter(order => ['confirmed', 'processing', 'shipped'].includes(order.status)).length,
    completed: orders.filter(order => order.status === 'completed').length,
    cancelled: orders.filter(order => order.status === 'cancelled').length,
  };
}

function AdminState({ title, detail, action }: { title: string; detail?: string; action?: () => void }) {
  return <div className="admin-state" role={detail ? 'alert' : 'status'}><span>V.</span><h3>{title}</h3>{detail && <p>{detail}</p>}{action && <button className="primary-button" onClick={action}>Try again</button>}</div>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAdminDashboard, fetchAdminOrder, fetchAdminOrders, updateAdminOrderStatus,
} from '../admin/adminApi';
import type { AdminDashboardData, AdminOrder, AdminOrderSummary, AdminView } from '../types/admin';
import type { OrderStatus } from '../types/order';

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const statuses: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'];

export default function AdminDashboard({ view, onViewChange, onClose }: {
  view: AdminView;
  onViewChange: (view: AdminView) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelected(null);
    try {
      if (view === 'dashboard') setDashboard(await fetchAdminDashboard());
      else setOrders(await fetchAdminOrders());
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

  return <dialog ref={dialogRef} className="admin-dialog" aria-labelledby="admin-title" onCancel={onClose}>
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="#home" onClick={event => { event.preventDefault(); onClose(); }}><span>V.</span> VAULT</a>
        <p>Administration</p>
        <nav aria-label="Admin navigation">
          <button className={view === 'dashboard' ? 'is-active' : ''} onClick={() => onViewChange('dashboard')}>Dashboard</button>
          <button className={view === 'orders' ? 'is-active' : ''} onClick={() => onViewChange('orders')}>Orders</button>
        </nav>
        <button className="admin-return" onClick={onClose}>← Return to store</button>
      </aside>
      <main className="admin-main">
        <header className="admin-header">
          <div><p className="eyebrow">VAULT ADMIN</p><h2 id="admin-title">{selected ? selected.order_no : view === 'dashboard' ? 'Dashboard' : 'Orders'}</h2></div>
          <button className="checkout-close" onClick={onClose} aria-label="Close admin dashboard">×</button>
        </header>
        {loading && <AdminState title="Loading admin data…" />}
        {!loading && error && <AdminState title="Unable to load admin data." detail={error} action={() => void load()} />}
        {!loading && !error && selected && <AdminOrderDetail order={selected} onBack={() => setSelected(null)}
          onUpdated={order => {
            setSelected(order);
            setOrders(current => current.map(item => item.order_no === order.order_no ? { ...item, status: order.status } : item));
            if (dashboard) void fetchAdminDashboard().then(setDashboard).catch(() => { /* Detail remains usable if refresh fails. */ });
          }} />}
        {!loading && !error && !selected && view === 'dashboard' && dashboard &&
          <DashboardView data={dashboard} onOpen={orderNo => void openOrder(orderNo)} />}
        {!loading && !error && !selected && view === 'orders' &&
          <OrdersView orders={orders} onOpen={orderNo => void openOrder(orderNo)} />}
      </main>
    </div>
  </dialog>;
}

function DashboardView({ data, onOpen }: { data: AdminDashboardData; onOpen: (orderNo: string) => void }) {
  const metrics: Array<[string, number | string]> = [
    ['Total orders', data.total_orders], ['Total customers', data.total_customers],
    ['Total revenue', price.format(data.total_revenue)], ['Pending', data.pending_orders],
    ['Confirmed', data.confirmed_orders], ['Processing', data.processing_orders],
    ['Shipped', data.shipped_orders], ['Completed', data.completed_orders], ['Cancelled', data.cancelled_orders],
  ];
  return <div className="admin-content">
    <section className="admin-metrics" aria-label="Order statistics">
      {metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </section>
    <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h3>Recent orders</h3></div></div>
      <AdminOrderTable orders={data.recent_orders} onOpen={onOpen} />
    </section>
  </div>;
}

function OrdersView({ orders, onOpen }: { orders: AdminOrderSummary[]; onOpen: (orderNo: string) => void }) {
  return <div className="admin-content"><section className="admin-section">
    <div className="admin-section-heading"><div><p className="eyebrow">ORDER MANAGEMENT</p><h3>All customer orders</h3></div><span>{orders.length} orders</span></div>
    <AdminOrderTable orders={orders} onOpen={onOpen} />
  </section></div>;
}

function AdminOrderTable({ orders, onOpen }: { orders: AdminOrderSummary[]; onOpen: (orderNo: string) => void }) {
  if (!orders.length) return <div className="admin-empty"><span>V.</span><h4>No orders yet.</h4></div>;
  return <div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th /></tr></thead>
    <tbody>{orders.map(order => <tr key={order.order_no}>
      <td><strong>{order.order_no}</strong></td><td>{order.customer_name}<small>{order.customer_email}</small></td>
      <td>{dateTime.format(new Date(order.created_at))}</td><td>{order.item_count}</td><td>{price.format(order.total)}</td>
      <td><span className={`order-status status-${order.status}`}>{order.status}</span></td>
      <td><button className="text-button" onClick={() => onOpen(order.order_no)}>Open</button></td>
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
        <section><p className="eyebrow">STATUS</p><label className="admin-status"><span>Order status</span><select value={status} onChange={event => setStatus(event.target.value as OrderStatus)}>{statuses.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <button className="primary-button" disabled={saving || status === order.status} onClick={() => void save()}>{saving ? 'Saving…' : 'Update status'}</button>{error && <p className="checkout-error" role="alert">{error}</p>}</section>
        <dl className="admin-totals"><div><dt>Subtotal</dt><dd>{price.format(order.subtotal)}</dd></div><div><dt>Shipping</dt><dd>{price.format(order.shipping_fee)}</dd></div><div><dt>Discount</dt><dd>−{price.format(order.discount)}</dd></div><div><dt>Total</dt><dd>{price.format(order.total)}</dd></div></dl>
      </aside>
    </div>
  </div>;
}

function AdminState({ title, detail, action }: { title: string; detail?: string; action?: () => void }) {
  return <div className="admin-state" role={detail ? 'alert' : 'status'}><span>V.</span><h3>{title}</h3>{detail && <p>{detail}</p>}{action && <button className="primary-button" onClick={action}>Try again</button>}</div>;
}

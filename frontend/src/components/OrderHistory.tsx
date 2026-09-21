import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOrder, fetchOrders } from '../checkout/orderApi';
import type { Order, OrderSummary } from '../types/order';
import GalleryImage from './GalleryImage';
import { orderStatusLabel } from '../orderStatus';

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default function OrderHistory({ initialOrderNo, onClose }: {
  initialOrderNo?: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNo, setSelectedNo] = useState<string | null>(initialOrderNo || null);
  const [order, setOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(!!initialOrderNo);
  const [detailError, setDetailError] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setOrders(await fetchOrders()); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load order history.'); }
    finally { setLoading(false); }
  }, []);

  const openOrder = useCallback(async (orderNo: string) => {
    setSelectedNo(orderNo);
    setOrder(null);
    setDetailLoading(true);
    setDetailError('');
    try { setOrder(await fetchOrder(orderNo)); }
    catch (requestError) { setDetailError(requestError instanceof Error ? requestError.message : 'Unable to load this order.'); }
    finally { setDetailLoading(false); }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);
  useEffect(() => { if (initialOrderNo) void openOrder(initialOrderNo); }, [initialOrderNo, openOrder]);

  function backToHistory() {
    setSelectedNo(null);
    setOrder(null);
    setDetailError('');
  }

  return <dialog ref={dialogRef} className="orders-dialog" aria-labelledby="orders-title" onCancel={onClose}>
    <header className="orders-header">
      {selectedNo ? <button type="button" onClick={backToHistory}><span aria-hidden="true">←</span> All orders</button> : <span className="eyebrow">ORDER HISTORY</span>}
      <button type="button" className="checkout-close" onClick={onClose} aria-label="Close orders">×</button>
    </header>
    {selectedNo ? <OrderDetail orderNo={selectedNo} order={order} loading={detailLoading} error={detailError} onRetry={() => void openOrder(selectedNo)} />
      : <OrderList orders={orders} loading={loading} error={error} onRetry={() => void loadOrders()} onOpen={orderNo => void openOrder(orderNo)} />}
  </dialog>;
}

function OrderList({ orders, loading, error, onRetry, onOpen }: {
  orders: OrderSummary[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onOpen: (orderNo: string) => void;
}) {
  return <main className="orders-page">
    <div className="orders-intro"><p className="eyebrow">YOUR ORDERS</p><h2 id="orders-title">Order history.</h2><p>Review saved orders and open any purchase for its complete details.</p></div>
    {loading && <div className="orders-state" role="status"><span className="orders-loader" /><h3>Gathering your orders…</h3></div>}
    {!loading && error && <div className="orders-state" role="alert"><h3>We couldn’t load your orders.</h3><p>{error}</p><button className="primary-button" onClick={onRetry}>Try again</button></div>}
    {!loading && !error && orders.length === 0 && <div className="orders-state"><span className="orders-empty-mark">V.</span><h3>No orders yet.</h3><p>Your confirmed purchases will appear here.</p></div>}
    {!loading && !error && orders.length > 0 && <div className="orders-list">{orders.map(summary => <button key={summary.order_no} className="order-row" onClick={() => onOpen(summary.order_no)}>
      <span className="order-row-primary"><small>Order number</small><strong>{summary.order_no}</strong><time dateTime={summary.created_at}>{dateTime.format(new Date(summary.created_at))}</time></span>
      <span><small>Total</small><strong>{price.format(summary.total)}</strong></span>
      <span><small>Items</small><strong>{summary.item_count}</strong></span>
      <span><small>Status</small><strong className={`order-status status-${summary.status.toLowerCase()}`}>{orderStatusLabel(summary.status)}</strong></span>
      <span className="round-arrow" aria-hidden="true">↗</span>
    </button>)}</div>}
  </main>;
}

function OrderDetail({ orderNo, order, loading, error, onRetry }: {
  orderNo: string;
  order: Order | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading) return <main className="orders-page"><div className="orders-state" role="status"><span className="orders-loader" /><h3>Loading {orderNo}…</h3></div></main>;
  if (error || !order) return <main className="orders-page"><div className="orders-state" role="alert"><h3>We couldn’t load this order.</h3><p>{error || 'The saved order was unavailable.'}</p><button className="primary-button" onClick={onRetry}>Try again</button></div></main>;

  const address = [order.shipping.address_line1, order.shipping.address_line2, order.shipping.district,
    order.shipping.province, order.shipping.postal_code, order.shipping.country].filter(Boolean);
  return <main className="orders-page order-detail-page">
    <div className="order-detail-heading">
      <div><p className="eyebrow">ORDER DETAILS</p><h2 id="orders-title">{order.order_no}</h2><time dateTime={order.created_at}>{dateTime.format(new Date(order.created_at))}</time></div>
      <span className={`order-status status-${order.status.toLowerCase()}`}>{orderStatusLabel(order.status)}</span>
    </div>
    <div className="order-detail-grid">
      <section className="order-products" aria-labelledby="order-products-title"><h3 id="order-products-title">Products</h3>
        {order.items.map(item => <article key={`${item.business}-${item.product_id}`}>
          <div className="order-product-image"><GalleryImage src={item.image_url} alt={item.product_name} /></div>
          <div className="order-product-copy"><p>{item.business_name}</p><h4>{item.product_name}</h4><span>{item.category}</span></div>
          <dl><div><dt>Quantity</dt><dd>{item.quantity}</dd></div><div><dt>Unit price</dt><dd>{price.format(item.unit_price)}</dd></div><div><dt>Line total</dt><dd>{price.format(item.line_total)}</dd></div></dl>
        </article>)}
      </section>
      <aside className="order-detail-aside">
        <section><p className="eyebrow">CUSTOMER</p><h3>{order.customer.name}</h3><a href={`mailto:${order.customer.email}`}>{order.customer.email}</a><a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a></section>
        <section><p className="eyebrow">SHIPPING ADDRESS</p><address>{address.map(part => <span key={part}>{part}</span>)}</address></section>
        <dl className="order-detail-totals"><div><dt>Subtotal</dt><dd>{price.format(order.subtotal)}</dd></div><div><dt>Shipping</dt><dd>{price.format(order.shipping_fee)}</dd></div><div><dt>Discount</dt><dd>−{price.format(order.discount)}</dd></div><div><dt>Grand total</dt><dd>{price.format(order.total)}</dd></div></dl>
      </aside>
    </div>
  </main>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOrder, fetchOrders } from '../checkout/orderApi';
import { fetchWarrantyDocument } from '../claims/claimApi';
import type { Order, OrderSummary } from '../types/order';
import type { ClaimWarrantyDocument } from '../types/claim';
import GalleryImage from './GalleryImage';
import { orderStatusLabel } from '../orderStatus';
import { WarrantyDocument } from './ClaimDocument';
import ClaimForm from './ClaimForm';

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/** Within the order dialog the customer can also open the claim document or the claim form. */
type ClaimView = 'document' | 'form';

export default function OrderHistory({ initialOrderNo, onClose, onViewClaim }: {
  initialOrderNo?: string;
  onClose: () => void;
  onViewClaim: (claimNumber: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNo, setSelectedNo] = useState<string | null>(initialOrderNo || null);
  const [order, setOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(!!initialOrderNo);
  const [detailError, setDetailError] = useState('');
  const [claimView, setClaimView] = useState<ClaimView | null>(null);
  const [submittedClaimNumber, setSubmittedClaimNumber] = useState('');

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
    setClaimView(null);
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
    setClaimView(null);
  }

  return <dialog ref={dialogRef} className="orders-dialog" aria-labelledby="orders-title" onCancel={onClose}>
    <header className="orders-header no-print">
      {selectedNo ? <button type="button" onClick={backToHistory}><span aria-hidden="true">←</span> All orders</button> : <span className="eyebrow">ORDER HISTORY</span>}
      <button type="button" className="checkout-close" onClick={onClose} aria-label="Close orders">×</button>
    </header>
    {selectedNo && claimView === 'document' && <WarrantyDocumentView orderNo={selectedNo}
      onBack={() => setClaimView(null)} onSubmitClaim={() => setClaimView('form')} />}
    {selectedNo && claimView === 'form' && <ClaimForm orderNo={selectedNo}
      onBack={() => setClaimView(null)} onSubmitted={claim => setSubmittedClaimNumber(claim.claim_number)}
      onViewClaims={() => onViewClaim(submittedClaimNumber)} />}
    {selectedNo && !claimView && <OrderDetail orderNo={selectedNo} order={order} loading={detailLoading} error={detailError}
      onRetry={() => void openOrder(selectedNo)} onOpenClaimView={setClaimView} />}
    {!selectedNo && <OrderList orders={orders} loading={loading} error={error} onRetry={() => void loadOrders()} onOpen={orderNo => void openOrder(orderNo)} />}
  </dialog>;
}

/** Loads the warranty document for one order and keeps the dialog's loading and error style. */
function WarrantyDocumentView({ orderNo, onBack, onSubmitClaim }: {
  orderNo: string;
  onBack: () => void;
  onSubmitClaim: () => void;
}) {
  const [document, setDocument] = useState<ClaimWarrantyDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setDocument(await fetchWarrantyDocument(orderNo)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load the claim and warranty document.'); }
    finally { setLoading(false); }
  }, [orderNo]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <main className="orders-page"><div className="orders-state" role="status"><span className="orders-loader" /><h3>Preparing the document…</h3></div></main>;
  if (error || !document) {
    return <main className="orders-page"><div className="orders-state" role="alert">
      <h3>We couldn’t build this document.</h3><p>{error || 'The document was unavailable.'}</p>
      <button className="primary-button" onClick={() => void load()}>Try again</button>
    </div></main>;
  }
  return <WarrantyDocument document={document} onBack={onBack} onSubmitClaim={onSubmitClaim} />;
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

function OrderDetail({ orderNo, order, loading, error, onRetry, onOpenClaimView }: {
  orderNo: string;
  order: Order | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onOpenClaimView: (view: ClaimView) => void;
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
        <section className="order-claim-panel">
          <p className="eyebrow">CLAIM / WARRANTY</p>
          <p>Every product on this order has a claim and warranty record. Open the document for the full details, or raise a claim if something arrived wrong.</p>
          <button type="button" className="primary-button" onClick={() => onOpenClaimView('document')}>View Claim / Warranty Document <span aria-hidden="true">↗</span></button>
          <button type="button" className="secondary-button" onClick={() => onOpenClaimView('form')}>Submit Claim</button>
        </section>
      </aside>
    </div>
  </main>;
}

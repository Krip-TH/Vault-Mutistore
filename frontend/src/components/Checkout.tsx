import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useCart } from '../cart/CartContext';
import { createOrderRequest, initialCheckoutForm, validateCheckout } from '../checkout/checkout';
import { completeCheckout } from '../checkout/orderApi';
import type { CheckoutErrors } from '../checkout/checkout';
import type { CheckoutForm, Order } from '../types/order';
import GalleryImage from './GalleryImage';

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export default function Checkout({ onClose, onContinue, onViewOrder }: {
  onClose: () => void;
  onContinue: () => void;
  onViewOrder: (orderNo: string) => void;
}) {
  const cart = useCart();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [form, setForm] = useState<CheckoutForm>(initialCheckoutForm);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);

  function update(field: keyof CheckoutForm, value: string) {
    setForm(current => ({ ...current, [field]: value }));
    if (errors[field]) setErrors(current => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    const nextErrors = validateCheckout(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!cart.items.length) { setSubmitError('Your cart is empty. Return to the collection to add products.'); return; }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      setOrder(await completeCheckout(createOrderRequest(form, cart.items), cart.clearCart));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to place the order. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return <dialog ref={dialogRef} className="checkout-dialog" aria-labelledby="checkout-title"
    onCancel={event => { if (submitting) event.preventDefault(); else onClose(); }}>
    {order ? <OrderConfirmation order={order}
      onViewOrder={() => onViewOrder(order.order_no)} onContinue={() => { onClose(); onContinue(); }} /> :
      <form className="checkout-shell" onSubmit={submit} noValidate>
        <header className="checkout-header">
          <button type="button" onClick={onClose} disabled={submitting}><span aria-hidden="true">←</span> Return to cart</button>
          <span className="eyebrow">SECURE ORDER</span>
          <button type="button" className="checkout-close" onClick={onClose} disabled={submitting} aria-label="Close checkout">×</button>
        </header>
        <div className="checkout-layout">
          <main className="checkout-form-copy">
            <p className="eyebrow">CHECKOUT</p><h2 id="checkout-title">Where should we send it?</h2>
            <fieldset><legend>Customer information</legend>
              <Field label="Full name" name="name" value={form.name} error={errors.name} autoComplete="name" onChange={update} />
              <div className="checkout-field-row">
                <Field label="Email" name="email" value={form.email} error={errors.email} type="email" autoComplete="email" onChange={update} />
                <Field label="Phone number" name="phone" value={form.phone} error={errors.phone} type="tel" autoComplete="tel" onChange={update} />
              </div>
            </fieldset>
            <fieldset><legend>Shipping address</legend>
              <Field label="Address line 1" name="address_line1" value={form.address_line1} error={errors.address_line1} autoComplete="address-line1" onChange={update} />
              <Field label="Address line 2" optional name="address_line2" value={form.address_line2} error={errors.address_line2} autoComplete="address-line2" onChange={update} />
              <div className="checkout-field-row">
                <Field label="District / Area" name="district" value={form.district} error={errors.district} autoComplete="address-level2" onChange={update} />
                <Field label="Province" name="province" value={form.province} error={errors.province} autoComplete="address-level1" onChange={update} />
              </div>
              <div className="checkout-field-row">
                <Field label="Postal code" name="postal_code" value={form.postal_code} error={errors.postal_code} autoComplete="postal-code" onChange={update} />
                <Field label="Country" name="country" value={form.country} error={errors.country} autoComplete="country-name" onChange={update} />
              </div>
            </fieldset>
          </main>
          <aside className="checkout-review" aria-labelledby="order-review-title">
            <div><p className="eyebrow">YOUR ORDER</p><h3 id="order-review-title">Order review</h3></div>
            <div className="checkout-items">{cart.items.map(item => <article key={item.key}>
              <div className="checkout-item-image"><GalleryImage src={item.product.image_url} alt={item.product.name || 'Product'} /></div>
              <div><p>{item.product.business_name || item.product.business}</p><h4>{item.product.name || 'Product'}</h4><span>{item.quantity} × {price.format(item.product.price)}</span></div>
              <strong>{price.format(item.product.price * item.quantity)}</strong>
            </article>)}</div>
            <dl className="checkout-totals">
              <div><dt>Subtotal</dt><dd>{price.format(cart.subtotal)}</dd></div>
              <div><dt>Shipping</dt><dd>{price.format(0)}</dd></div>
              <div><dt>Discount</dt><dd>−{price.format(0)}</dd></div>
              <div className="checkout-total"><dt>Total</dt><dd>{price.format(cart.subtotal)}</dd></div>
            </dl>
            {submitError && <p className="checkout-error" role="alert">{submitError}</p>}
            <button className="primary-button checkout-submit" type="submit" disabled={submitting || cart.hasUnavailableItems || !cart.items.length}>
              {submitting ? 'Placing order…' : 'Place order'} <span aria-hidden="true">↗</span>
            </button>
            <p className="checkout-assurance">Prices and stock are verified again before your order is confirmed. No payment is collected.</p>
          </aside>
        </div>
      </form>}
  </dialog>;
}

interface FieldProps {
  label: string; name: keyof CheckoutForm; value: string; error?: string; optional?: boolean;
  type?: 'text' | 'email' | 'tel'; autoComplete: string;
  onChange: (name: keyof CheckoutForm, value: string) => void;
}
function Field({ label, name, value, error, optional, type = 'text', autoComplete, onChange }: FieldProps) {
  const errorId = `${name}-error`;
  return <label className={`checkout-field ${error ? 'has-error' : ''}`}>
    <span>{label}{optional && <small>Optional</small>}</span>
    <input name={name} type={type} value={value} autoComplete={autoComplete} aria-invalid={!!error}
      aria-describedby={error ? errorId : undefined} onChange={event => onChange(name, event.target.value)} />
    {error && <small id={errorId}>{error}</small>}
  </label>;
}

function OrderConfirmation({ order, onViewOrder, onContinue }: {
  order: Order; onViewOrder: () => void; onContinue: () => void;
}) {
  return <section className="order-confirmation" aria-labelledby="checkout-title">
    <span className="confirmation-mark" aria-hidden="true">✓</span>
    <p className="eyebrow">ORDER CONFIRMED</p>
    <h2 id="checkout-title">Thank you, {order.customer.name}.</h2>
    <p>Your order has been saved. Keep the order number below for future reference.</p>
    <dl className="confirmation-facts">
      <div><dt>Order number</dt><dd>{order.order_no}</dd></div>
      <div><dt>Order total</dt><dd>{price.format(order.total)}</dd></div>
      <div><dt>Order date</dt><dd>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.created_at))}</dd></div>
      <div><dt>Status</dt><dd>{order.status}</dd></div>
    </dl>
    <div className="confirmation-items"><h3>Items ordered</h3>{order.items.map(item => <div key={`${item.business}-${item.product_id}`}><span>{item.product_name}<small>{item.business_name} · Quantity {item.quantity} · {price.format(item.unit_price)} each</small></span><strong>{price.format(item.line_total)}</strong></div>)}</div>
    <div className="confirmation-actions"><button className="primary-button" onClick={onContinue}>Continue shopping <span aria-hidden="true">↗</span></button><button className="secondary-button" onClick={onViewOrder}>View order</button></div>
  </section>;
}

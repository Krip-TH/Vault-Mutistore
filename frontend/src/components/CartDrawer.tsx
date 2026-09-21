import { useEffect, useMemo, useRef } from 'react';
import { useCart } from '../cart/CartContext';
import type { CartItem as CartItemType } from '../types/cart';
import GalleryImage from './GalleryImage';
import { StockBadge } from './ProductPresentation';

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export default function CartDrawer({ onClose, onExplore, onCheckout }: { onClose: () => void; onExplore: () => void; onCheckout: () => void }) {
  const cart = useCart();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const groups = useMemo(() => {
    const grouped = new Map<string, CartItemType[]>();
    for (const item of cart.items) {
      const label = item.product.business_name || item.product.business;
      grouped.set(label, [...(grouped.get(label) ?? []), item]);
    }
    return [...grouped.entries()];
  }, [cart.items]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !cart.isOpen) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [cart.isOpen]);
  if (!cart.isOpen) return null;

  return <dialog ref={dialogRef} className="cart-dialog" aria-labelledby="cart-title" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="cart-drawer">
      <header className="cart-header">
        <div><p className="eyebrow">YOUR SELECTION</p><h2 id="cart-title">Cart <span>/ {cart.itemCount}</span></h2></div>
        <button className="cart-close" onClick={onClose} aria-label="Close cart" autoFocus>×</button>
      </header>
      {cart.items.length === 0 ? <div className="cart-empty">
        <span className="cart-empty-mark" aria-hidden="true">V.</span>
        <h3>Your cart is empty.</h3>
        <p>Explore the collection and find something for your everyday.</p>
        <button className="primary-button" onClick={() => { cart.closeCart(); onExplore(); }}>Explore the collection <span aria-hidden="true">↗</span></button>
      </div> : <>
        <div className="cart-groups">
          {groups.map(([business, items]) => <section className="cart-business" key={business} aria-labelledby={`cart-business-${items[0].product.business}`}>
            <h3 id={`cart-business-${items[0].product.business}`}>{business}<span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span></h3>
            {items.map(item => <CartLine key={item.key} item={item} />)}
          </section>)}
        </div>
        <footer className="cart-summary">
          <dl><div><dt>Total items</dt><dd>{cart.itemCount}</dd></div><div className="cart-subtotal"><dt>Subtotal</dt><dd>{price.format(cart.subtotal)}</dd></div></dl>
          <p>Shipping, discounts and tax are calculated at checkout.</p>
          {cart.hasUnavailableItems && <p className="cart-warning" role="status">Remove unavailable products before checkout.</p>}
          <button className="primary-button cart-checkout" disabled={cart.hasUnavailableItems}
            onClick={() => { cart.closeCart(); onCheckout(); }}>Proceed to checkout <span aria-hidden="true">↗</span></button>
        </footer>
      </>}
    </div>
  </dialog>;
}

function CartLine({ item }: { item: CartItemType }) {
  const cart = useCart();
  const atMaximum = item.quantity >= item.product.stock;
  const unavailable = item.product.stock < 1 || item.product.status === 'Out of Stock';
  const unit = item.product.unit ? ` ${item.product.unit}` : '';
  return <article className={`cart-line ${unavailable ? 'is-unavailable' : ''}`}>
    <div className="cart-line-image"><GalleryImage src={item.product.image_url} alt={item.product.name || 'Product'} /></div>
    <div className="cart-line-copy">
      {item.product.category && <p>{item.product.category}</p>}
      <h4>{item.product.name || 'Product'}</h4>
      <span>{price.format(item.product.price)} each</span>
      <StockBadge status={item.product.status} />
      <div className="cart-line-actions">
        <div className="cart-quantity" role="group" aria-label={`Quantity for ${item.product.name || 'product'}`}>
          <button aria-label="Decrease quantity" disabled={unavailable || item.quantity <= 1}
            onClick={() => cart.setQuantity(item.key, item.quantity - 1)}>−</button>
          <output aria-live="polite">{item.quantity}</output>
          <button aria-label="Increase quantity" disabled={unavailable || atMaximum}
            onClick={() => cart.setQuantity(item.key, item.quantity + 1)}>+</button>
        </div>
        <button className="cart-remove" onClick={() => cart.removeItem(item.key)} aria-label={`Remove ${item.product.name || 'product'} from cart`}>Remove</button>
      </div>
      {atMaximum && !unavailable && <p className="cart-stock-note">Maximum available: {item.product.stock.toLocaleString()}{unit}</p>}
      {unavailable && <p className="cart-stock-note">Currently unavailable</p>}
    </div>
    <strong className="cart-line-total">{price.format(item.product.price * item.quantity)}</strong>
  </article>;
}

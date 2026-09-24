import { useEffect, useRef, useState } from 'react';
import type { Product } from '../types/product';
import { hasNumber, purchaseState, textValue } from '../utils/product';
import { useCart } from '../cart/CartContext';
import { cartKey } from '../cart/cartState';
import ProductGallery from './ProductGallery';
import { StockBadge } from './ProductPresentation';
import RelatedProducts from './RelatedProducts';
import AiDescription from './AiDescription';

interface Props {
  product: Product;
  onClose: () => void;
  favorite: boolean;
  onFavorite: () => void;
  inventoryAvailable?: boolean;
  onSelectProduct?: (product: Product) => void;
}

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export default function ProductDetail({ product, onClose, favorite, onFavorite, inventoryAvailable = true, onSelectProduct }: Props) {
  const cart = useCart();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addedTimerRef = useRef<number>();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [added, setAdded] = useState(false);
  const cartQuantity = cart.quantityFor(product);
  const purchase = purchaseState(product, cartQuantity, quantity, inventoryAvailable);
  const name = textValue(product.name) || 'Product';
  const business = textValue(product.business_name);
  const category = textValue(product.category);
  const description = textValue(product.description);
  const unit = textValue(product.unit);
  const knownStock = hasNumber(product.stock);
  const knownPrice = hasNumber(product.price);
  const status = textValue(product.status);
  const updatedAt = textValue(product.updated_at);
  const date = new Date(updatedAt);
  const validDate = updatedAt && !Number.isNaN(date.getTime());
  const stockLabel = knownStock ? [product.stock.toLocaleString(), unit].filter(Boolean).join(' ') : '';
  const buttonLabel = !inventoryAvailable ? 'Inventory unavailable' : !knownStock ? 'Availability unavailable' :
    purchase.stock === 0 || status === 'Out of Stock' ? 'Out of stock' : !knownPrice ? 'Price unavailable' :
      purchase.remaining === 0 ? 'All available stock in cart' : 'Add to cart';

  useEffect(() => { setQuantity(purchase.quantity); }, [purchase.quantity]);
  useEffect(() => () => {
    if (addedTimerRef.current !== undefined) window.clearTimeout(addedTimerRef.current);
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  function addToCart() {
    if (!purchase.canAdd) return;
    const addedQuantity = cart.addProduct(product, purchase.quantity);
    if (!addedQuantity) return;
    setMessage(`${addedQuantity}${unit ? ` ${unit}` : ''} added to your cart.`);
    setAdded(true);
    if (addedTimerRef.current !== undefined) window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => {
      setAdded(false);
      addedTimerRef.current = undefined;
    }, 1600);
    setQuantity(1);
  }

  return <dialog ref={dialogRef} className="product-dialog" aria-labelledby="detail-title" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="detail-topbar">
      <button className="back-to-collection" onClick={onClose} autoFocus><span aria-hidden="true">←</span> Back to collection</button>
      <button className="detail-bag-count" onClick={cart.openCart} aria-label={`Open cart with ${cart.itemCount} items`}>Cart / {cart.itemCount}</button>
      <button className="dialog-close" onClick={onClose} aria-label="Close product details">×</button>
    </div>
    <div className="detail-layout">
      <ProductGallery key={JSON.stringify([product.business, product.id])} product={product} />
      <div className="detail-copy">
        {(business || category) && <p className="eyebrow">{[business, category].filter(Boolean).join(' / ')}</p>}
        <h2 id="detail-title">{name}</h2>
        {knownPrice && <p className="detail-price">{price.format(product.price)} <span>THB</span></p>}
        {(status || knownStock) && <div className="detail-stock"><StockBadge status={product.status} />{knownStock && <p>{stockLabel} available</p>}</div>}
        {description && <p className="detail-description">{description}</p>}
        <AiDescription product={product} />
        <div className="purchase-panel">
          {!inventoryAvailable && <p className="detail-availability" role="status">Current inventory is unavailable. Return to the collection and refresh to check again.</p>}
          {cartQuantity > purchase.stock && knownStock && <p className="detail-availability" role="status">Your cart exceeds the latest available stock. Remove this item to choose a new quantity.</p>}
          <div className="quantity-row">
            <span id="quantity-label">Quantity</span>
            <div className="quantity-control" role="group" aria-labelledby="quantity-label">
              <button aria-label="Decrease quantity" disabled={!purchase.canAdd || purchase.quantity <= 1} onClick={() => setQuantity(purchase.quantity - 1)}>−</button>
              <output aria-live="polite" aria-label="Selected quantity">{purchase.quantity}</output>
              <button aria-label="Increase quantity" disabled={!purchase.canAdd || purchase.quantity >= purchase.remaining} onClick={() => setQuantity(purchase.quantity + 1)}>+</button>
            </div>
          </div>
          <div className="purchase-actions">
            <button className={`primary-button add-to-bag${added ? ' is-added' : ''}`} disabled={!purchase.canAdd || added}
              aria-live="polite" onClick={addToCart}>{added ? 'Added to cart' : buttonLabel}<span aria-hidden="true">{added ? '✓' : '↗'}</span></button>
          </div>
          <button className="save-for-later" aria-label={favorite ? 'Remove from favorites' : 'Save for later'} aria-pressed={favorite}
            onClick={() => { onFavorite(); setMessage(favorite ? 'Removed from favorites.' : 'Saved to your favorites.'); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>
            {favorite ? 'Saved for later' : 'Save for later'}
          </button>
          {message && <p className="bag-feedback" role="status">{message}</p>}
          {cartQuantity > 0 && <div className="bag-line">
            <span>In your cart: {cartQuantity}{knownPrice ? ` · ${price.format(product.price * cartQuantity)}` : ''}</span>
            <button className="text-button" onClick={() => { cart.removeItem(cartKey(product)); setMessage('Removed from your cart.'); }}>Remove</button>
          </div>}
          <p className="detail-note">Your cart is saved for this browser session. Adding items does not reserve stock.</p>
        </div>
      </div>
    </div>
    <div className="product-details-sections">
      {(category || textValue(product.id) || description) && <section aria-labelledby="spec-details">
        <p className="eyebrow">01 / THE PRODUCT</p><h3 id="spec-details">Details</h3>
        <dl className="detail-facts">
          {category && <div><dt>Category</dt><dd>{category}</dd></div>}
        </dl>
        {description && <p>{description}</p>}
        {textValue(product.id) && <p className="detail-reference">Product reference · {product.id}</p>}
      </section>}
      {(status || knownStock || validDate) && <section aria-labelledby="spec-inventory">
        <p className="eyebrow">02 / AVAILABILITY</p><h3 id="spec-inventory">Inventory</h3>
        <dl className="detail-facts">
          {status && <div><dt>Status</dt><dd>{status}</dd></div>}
          {knownStock && <div><dt>Available</dt><dd>{stockLabel}</dd></div>}
          {validDate && <div><dt>Updated</dt><dd><time dateTime={updatedAt}>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)}</time></dd></div>}
        </dl>
      </section>}
      {(business || category) && <section aria-labelledby="spec-business">
        <p className="eyebrow">03 / THE BUSINESS</p><h3 id="spec-business">Business</h3>
        <dl className="detail-facts">
          {business && <div><dt>Name</dt><dd>{business}</dd></div>}
          {category && <div><dt>Category</dt><dd>{category}</dd></div>}
        </dl>
        {business && <p>Inventory as received from {business}. Availability may change.</p>}
      </section>}
    </div>
    {onSelectProduct && <RelatedProducts product={product} onSelectProduct={onSelectProduct} />}
  </dialog>;
}

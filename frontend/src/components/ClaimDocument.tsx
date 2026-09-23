import { useEffect } from 'react';
import type { Claim, ClaimWarrantyDocument } from '../types/claim';
import { claimReasonLabel, claimStatusClass, claimStatusLabel, claimTotal } from '../claims/claimStatus';

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' });

const formatDate = (value: string | null) => value ? dateOnly.format(new Date(value)) : '—';
const formatDateTime = (value: string | null) => value ? dateTime.format(new Date(value)) : '—';

/**
 * Printing uses the browser's own print pipeline, which also provides "Save as PDF" on
 * every supported platform. The body class lets the print stylesheet isolate the document.
 */
export function printDocument() {
  document.body.classList.add('is-printing-document');
  window.print();
}

/** Clears the print class again even if the user cancels the print dialog. */
export function usePrintCleanup() {
  useEffect(() => {
    const clear = () => document.body.classList.remove('is-printing-document');
    window.addEventListener('afterprint', clear);
    return () => { window.removeEventListener('afterprint', clear); clear(); };
  }, []);
}

function DocumentActions({ onBack, backLabel, children }: { onBack: () => void; backLabel: string; children?: React.ReactNode }) {
  return <div className="claim-document-actions no-print">
    <button type="button" className="admin-back" onClick={onBack}>← {backLabel}</button>
    <div>
      {children}
      <button type="button" className="secondary-button" onClick={printDocument}>Print / Save as PDF</button>
    </div>
  </div>;
}

/**
 * The warranty document is built entirely from the order snapshot the backend returns,
 * so reprinting an old order never picks up today's catalogue prices.
 */
export function WarrantyDocument({ document: warranty, onBack, onSubmitClaim }: {
  document: ClaimWarrantyDocument;
  onBack: () => void;
  onSubmitClaim: () => void;
}) {
  usePrintCleanup();
  const claimable = warranty.items.reduce((sum, item) => sum + item.claimable_quantity, 0);

  return <main className="orders-page claim-document-page">
    <DocumentActions onBack={onBack} backLabel="Back to order">
      {warranty.eligible && <button type="button" className="primary-button" onClick={onSubmitClaim}>Submit Claim <span aria-hidden="true">↗</span></button>}
    </DocumentActions>

    <article className="claim-document">
      <header className="claim-document-header">
        <div><span className="claim-document-mark">V.</span><div><strong>VAULT</strong><span>Multi-Store Marketplace</span></div></div>
        <div className="claim-document-title">
          <p className="eyebrow">CLAIM &amp; WARRANTY DOCUMENT</p>
          <h2 id="orders-title">{warranty.order_no}</h2>
          <span className={`order-status status-${warranty.order_status}`}>{warranty.order_status}</span>
        </div>
      </header>

      <section className="claim-document-grid" aria-label="Order and customer details">
        <dl>
          <div><dt>Order number</dt><dd>{warranty.order_no}</dd></div>
          <div><dt>Order date</dt><dd>{formatDate(warranty.order_created_at)}</dd></div>
          <div><dt>Completed on</dt><dd>{formatDate(warranty.order_completed_at)}</dd></div>
          <div><dt>Order total</dt><dd>{price.format(warranty.order_total)}</dd></div>
        </dl>
        <dl>
          <div><dt>Customer</dt><dd>{warranty.customer_name}</dd></div>
          <div><dt>Email</dt><dd>{warranty.customer_email}</dd></div>
          <div><dt>Phone</dt><dd>{warranty.customer_phone}</dd></div>
          <div><dt>Claim window</dt><dd>{warranty.claim_window_days > 0
            ? `${warranty.claim_window_days} days — until ${formatDate(warranty.claim_window_expires_at)}`
            : 'No time limit'}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="warranty-products-title">
        <h3 id="warranty-products-title" className="claim-document-section-title">Covered products</h3>
        <div className="claim-document-table-wrap">
          <table className="claim-document-table">
            <thead><tr><th>Product</th><th>Business</th><th>Purchased</th><th>Unit price</th><th>Line total</th><th>Claimable</th></tr></thead>
            <tbody>{warranty.items.map(item => <tr key={item.order_item_id}>
              <td><strong>{item.product_name}</strong>{item.category && <small>{item.category}</small>}</td>
              <td>{item.business_name}</td>
              <td>{item.purchased_quantity}</td>
              <td>{price.format(item.unit_price)}</td>
              <td>{price.format(Math.round(item.unit_price * item.purchased_quantity * 100) / 100)}</td>
              <td>{item.claimable_quantity} of {item.purchased_quantity}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="claim-document-notice" aria-labelledby="warranty-how-title">
        <h3 id="warranty-how-title" className="claim-document-section-title">How to submit a claim</h3>
        {warranty.eligible
          ? <ol>
            <li>Open this order under <strong>My Orders</strong> and choose <strong>Submit Claim</strong>.</li>
            <li>Select the affected products and the number of units you are claiming ({claimable} unit{claimable === 1 ? '' : 's'} still available).</li>
            <li>Choose the reason, describe the problem, and attach at least one photo as evidence.</li>
            <li>Track progress under <strong>My Claims</strong>; every status change is recorded there.</li>
          </ol>
          : <p className="claim-document-ineligible">{warranty.ineligible_reason ?? 'This order is not eligible for a claim.'}</p>}
      </section>

      {warranty.existing_claims.length > 0 && <section aria-labelledby="warranty-claims-title">
        <h3 id="warranty-claims-title" className="claim-document-section-title">Claims raised on this order</h3>
        <div className="claim-document-table-wrap">
          <table className="claim-document-table">
            <thead><tr><th>Claim number</th><th>Product</th><th>Submitted</th><th>Status</th></tr></thead>
            <tbody>{warranty.existing_claims.map(claim => <tr key={claim.claim_number}>
              <td><strong>{claim.claim_number}</strong></td>
              <td>{claim.product_name}</td>
              <td>{formatDate(claim.created_at)}</td>
              <td><span className={`order-status ${claimStatusClass(claim.status)}`}>{claimStatusLabel(claim.status)}</span></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>}

      <footer className="claim-document-footer">
        <p>This document is generated from the stored order record and is valid without a signature. Issued {formatDateTime(new Date().toISOString())}.</p>
      </footer>
    </article>
  </main>;
}

/** The printable claim form, including the signature block a paper process needs. */
export function ClaimPrintDocument({ claim, customer, onBack }: {
  claim: Claim;
  customer: { name: string; email: string };
  onBack: () => void;
}) {
  usePrintCleanup();
  return <main className="orders-page claim-document-page">
    <DocumentActions onBack={onBack} backLabel="Back to claim" />
    <article className="claim-document">
      <header className="claim-document-header">
        <div><span className="claim-document-mark">V.</span><div><strong>VAULT</strong><span>Multi-Store Marketplace</span></div></div>
        <div className="claim-document-title">
          <p className="eyebrow">PRODUCT CLAIM FORM</p>
          <h2>{claim.claim_number}</h2>
          <span className={`order-status ${claimStatusClass(claim.status)}`}>{claimStatusLabel(claim.status)}</span>
        </div>
      </header>

      <section className="claim-document-grid" aria-label="Claim and customer details">
        <dl>
          <div><dt>Claim number</dt><dd>{claim.claim_number}</dd></div>
          <div><dt>Submitted</dt><dd>{formatDate(claim.created_at)}</dd></div>
          <div><dt>Order number</dt><dd>{claim.order_no}</dd></div>
          <div><dt>Last updated</dt><dd>{formatDate(claim.updated_at)}</dd></div>
        </dl>
        <dl>
          <div><dt>Customer</dt><dd>{customer.name}</dd></div>
          <div><dt>Email</dt><dd>{customer.email}</dd></div>
          <div><dt>Contact phone</dt><dd>{claim.contact_phone || '—'}</dd></div>
          <div><dt>Reason</dt><dd>{claimReasonLabel(claim.reason)}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="claim-products-title">
        <h3 id="claim-products-title" className="claim-document-section-title">Claimed products</h3>
        <div className="claim-document-table-wrap">
          <table className="claim-document-table">
            <thead><tr><th>Product</th><th>Business</th><th>Quantity</th><th>Unit price</th><th>Value</th></tr></thead>
            <tbody>{claim.items.map(item => <tr key={item.order_item_id}>
              <td><strong>{item.product_name}</strong></td>
              <td>{item.business_name}</td>
              <td>{item.quantity}</td>
              <td>{price.format(item.unit_price)}</td>
              <td>{price.format(item.line_total)}</td>
            </tr>)}</tbody>
            <tfoot><tr><td colSpan={4}>Total claimed value</td><td>{price.format(claimTotal(claim))}</td></tr></tfoot>
          </table>
        </div>
      </section>

      <section aria-labelledby="claim-problem-title">
        <h3 id="claim-problem-title" className="claim-document-section-title">Reported problem</h3>
        <p className="claim-document-description">{claim.description}</p>
        {claim.admin_note && <p className="claim-document-note"><strong>VAULT response:</strong> {claim.admin_note}</p>}
        <p className="claim-document-evidence-count">Evidence attached: {claim.evidence.length} photo{claim.evidence.length === 1 ? '' : 's'}.</p>
      </section>

      <section className="claim-document-signatures" aria-label="Signatures">
        <div><span /><p>Customer signature</p><small>Date</small></div>
        <div><span /><p>VAULT representative</p><small>Date</small></div>
      </section>

      <footer className="claim-document-footer">
        <p>Printed {formatDateTime(new Date().toISOString())}. Current status: {claimStatusLabel(claim.status)}.</p>
      </footer>
    </article>
  </main>;
}

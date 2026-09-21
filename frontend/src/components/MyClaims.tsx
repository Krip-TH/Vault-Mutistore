import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelClaim, fetchClaim, fetchClaims } from '../claims/claimApi';
import {
  buildClaimTimeline, canCancelClaim, claimReasonLabel, claimStatusClass, claimStatusLabel, claimTotal, claimUnitCount,
} from '../claims/claimStatus';
import type { Claim, ClaimHistoryEntry, ClaimStatus, ClaimSummary } from '../types/claim';
import { useAuth } from '../auth/AuthContext';
import { ClaimPrintDocument } from './ClaimDocument';

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const filters: Array<{ value: ClaimStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function MyClaims({ initialClaimNumber, onClose }: {
  initialClaimNumber?: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { user } = useAuth();
  const [claims, setClaims] = useState<ClaimSummary[]>([]);
  const [status, setStatus] = useState<ClaimStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNumber, setSelectedNumber] = useState<string | null>(initialClaimNumber || null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [detailLoading, setDetailLoading] = useState(!!initialClaimNumber);
  const [detailError, setDetailError] = useState('');
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async (value: ClaimStatus | 'all') => {
    setLoading(true);
    setError('');
    try { setClaims((await fetchClaims({ status: value })).claims); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load your claims.'); }
    finally { setLoading(false); }
  }, []);

  const open = useCallback(async (claimNumber: string) => {
    setSelectedNumber(claimNumber);
    setClaim(null);
    setPrinting(false);
    setDetailLoading(true);
    setDetailError('');
    try { setClaim(await fetchClaim(claimNumber)); }
    catch (requestError) { setDetailError(requestError instanceof Error ? requestError.message : 'Unable to load this claim.'); }
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

  useEffect(() => { void load(status); }, [load, status]);
  useEffect(() => { if (initialClaimNumber) void open(initialClaimNumber); }, [initialClaimNumber, open]);

  function backToList() {
    setSelectedNumber(null);
    setClaim(null);
    setDetailError('');
    setPrinting(false);
    void load(status);
  }

  return <dialog ref={dialogRef} className="orders-dialog" aria-labelledby="claims-title" onCancel={onClose}>
    <header className="orders-header no-print">
      {selectedNumber
        ? <button type="button" onClick={backToList}><span aria-hidden="true">←</span> All claims</button>
        : <span className="eyebrow">MY CLAIMS</span>}
      <button type="button" className="checkout-close" onClick={onClose} aria-label="Close claims">×</button>
    </header>
    {printing && claim
      ? <ClaimPrintDocument claim={claim} customer={{ name: user?.name ?? '', email: user?.email ?? '' }} onBack={() => setPrinting(false)} />
      : selectedNumber
        ? <ClaimDetail claimNumber={selectedNumber} claim={claim} loading={detailLoading} error={detailError}
          onRetry={() => void open(selectedNumber)} onPrint={() => setPrinting(true)} onChanged={setClaim} />
        : <ClaimList claims={claims} loading={loading} error={error} status={status}
          onStatusChange={setStatus} onRetry={() => void load(status)} onOpen={claimNumber => void open(claimNumber)} />}
  </dialog>;
}

function ClaimList({ claims, loading, error, status, onStatusChange, onRetry, onOpen }: {
  claims: ClaimSummary[];
  loading: boolean;
  error: string;
  status: ClaimStatus | 'all';
  onStatusChange: (status: ClaimStatus | 'all') => void;
  onRetry: () => void;
  onOpen: (claimNumber: string) => void;
}) {
  return <main className="orders-page">
    <div className="orders-intro">
      <p className="eyebrow">AFTER-SALES</p>
      <h2 id="claims-title">My claims.</h2>
      <p>Every claim you have raised, with its current status and full progress history.</p>
    </div>
    <div className="business-chips claim-filter-chips" role="group" aria-label="Filter claims by status">
      {filters.map(filter => <button key={filter.value} type="button" aria-pressed={status === filter.value}
        onClick={() => onStatusChange(filter.value)}>{filter.label}</button>)}
    </div>
    {loading && <div className="orders-state" role="status"><span className="orders-loader" /><h3>Gathering your claims…</h3></div>}
    {!loading && error && <div className="orders-state" role="alert"><h3>We couldn’t load your claims.</h3><p>{error}</p>
      <button className="primary-button" onClick={onRetry}>Try again</button></div>}
    {!loading && !error && claims.length === 0 && <div className="orders-state">
      <span className="orders-empty-mark">V.</span>
      <h3>{status === 'all' ? 'No claims yet.' : 'No claims with this status.'}</h3>
      <p>{status === 'all'
        ? 'Open a delivered order under My Orders and choose Submit Claim if something is wrong.'
        : 'Try a different status filter to see your other claims.'}</p>
    </div>}
    {!loading && !error && claims.length > 0 && <div className="orders-list">{claims.map(summary => <button key={summary.claim_number}
      className="order-row claim-row" onClick={() => onOpen(summary.claim_number)}>
      <span className="order-row-primary">
        <small>Claim number</small><strong>{summary.claim_number}</strong>
        <time dateTime={summary.created_at}>{dateTime.format(new Date(summary.created_at))}</time>
      </span>
      <span><small>Order</small><strong>{summary.order_no}</strong></span>
      <span><small>Product</small><strong>{summary.product_name}</strong>{summary.item_count > 1 && <em>+{summary.item_count - 1} more</em>}</span>
      <span><small>Business</small><strong>{summary.business_name}</strong></span>
      <span><small>Status</small><strong className={`order-status ${claimStatusClass(summary.status)}`}>{claimStatusLabel(summary.status)}</strong></span>
      <span className="round-arrow" aria-hidden="true">↗</span>
    </button>)}</div>}
  </main>;
}

function ClaimDetail({ claimNumber, claim, loading, error, onRetry, onPrint, onChanged }: {
  claimNumber: string;
  claim: Claim | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onPrint: () => void;
  onChanged: (claim: Claim) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [confirming, setConfirming] = useState(false);

  if (loading) return <main className="orders-page"><div className="orders-state" role="status"><span className="orders-loader" /><h3>Loading {claimNumber}…</h3></div></main>;
  if (error || !claim) {
    return <main className="orders-page"><div className="orders-state" role="alert"><h3>We couldn’t load this claim.</h3>
      <p>{error || 'The claim was unavailable.'}</p><button className="primary-button" onClick={onRetry}>Try again</button></div></main>;
  }

  async function cancel() {
    if (!claim) return;
    setCancelling(true);
    setCancelError('');
    try {
      onChanged(await cancelClaim(claim.claim_number));
      setConfirming(false);
    } catch (requestError) {
      setCancelError(requestError instanceof Error ? requestError.message : 'Unable to cancel this claim.');
    } finally { setCancelling(false); }
  }

  return <main className="orders-page order-detail-page">
    <div className="order-detail-heading">
      <div>
        <p className="eyebrow">CLAIM DETAILS</p>
        <h2 id="claims-title">{claim.claim_number}</h2>
        <time dateTime={claim.created_at}>{dateTime.format(new Date(claim.created_at))}</time>
      </div>
      <span className={`order-status ${claimStatusClass(claim.status)}`}>{claimStatusLabel(claim.status)}</span>
    </div>

    <div className="order-detail-grid">
      <section className="order-products" aria-labelledby="claim-detail-products">
        <h3 id="claim-detail-products">Claimed products</h3>
        {claim.items.map(item => <article key={item.order_item_id}>
          <div className="order-product-copy"><p>{item.business_name}</p><h4>{item.product_name}</h4><span>Order {claim.order_no}</span></div>
          <dl>
            <div><dt>Quantity</dt><dd>{item.quantity}</dd></div>
            <div><dt>Unit price</dt><dd>{price.format(item.unit_price)}</dd></div>
            <div><dt>Value</dt><dd>{price.format(item.line_total)}</dd></div>
          </dl>
        </article>)}

        <h3 className="claim-subheading">Reported problem</h3>
        <dl className="claim-facts">
          <div><dt>Reason</dt><dd>{claimReasonLabel(claim.reason)}</dd></div>
          <div><dt>Description</dt><dd>{claim.description}</dd></div>
          {claim.contact_phone && <div><dt>Contact phone</dt><dd>{claim.contact_phone}</dd></div>}
        </dl>

        <h3 className="claim-subheading">Evidence</h3>
        {claim.evidence.length === 0 ? <p className="claim-empty-note">No photos were attached.</p>
          : <ul className="claim-evidence-gallery">{claim.evidence.map((file, index) => <li key={file.id}>
            <a href={file.image_url} target="_blank" rel="noreferrer">
              <img src={file.image_url} alt={`Evidence ${index + 1} for claim ${claim.claim_number}`} loading="lazy" />
            </a>
          </li>)}</ul>}
      </section>

      <aside className="order-detail-aside">
        <section>
          <p className="eyebrow">PROGRESS</p>
          <ClaimTimeline status={claim.status} history={claim.history} />
        </section>
        {claim.admin_note && <section className="claim-admin-note">
          <p className="eyebrow">NOTE FROM VAULT</p>
          <p>{claim.admin_note}</p>
        </section>}
        <dl className="order-detail-totals">
          <div><dt>Order</dt><dd>{claim.order_no}</dd></div>
          <div><dt>Units claimed</dt><dd>{claimUnitCount(claim)}</dd></div>
          <div><dt>Claimed value</dt><dd>{price.format(claimTotal(claim))}</dd></div>
          <div><dt>Last updated</dt><dd>{dateTime.format(new Date(claim.updated_at))}</dd></div>
        </dl>
        <div className="claim-detail-actions">
          <button type="button" className="secondary-button" onClick={onPrint}>Print / Save as PDF</button>
          {canCancelClaim(claim.status) && !confirming &&
            <button type="button" className="text-button" onClick={() => setConfirming(true)}>Cancel this claim</button>}
          {confirming && <div className="claim-cancel-confirm">
            <p>Cancelling is permanent and releases the claimed units back to the order.</p>
            <div>
              <button type="button" className="primary-button" disabled={cancelling} onClick={() => void cancel()}>
                {cancelling ? 'Cancelling…' : 'Yes, cancel claim'}
              </button>
              <button type="button" className="text-button" disabled={cancelling} onClick={() => setConfirming(false)}>Keep claim</button>
            </div>
          </div>}
          {cancelError && <p className="claim-form-error" role="alert">{cancelError}</p>}
        </div>
      </aside>
    </div>
  </main>;
}

/** Shows what has actually happened, then what is still ahead, without conflating the two. */
export function ClaimTimeline({ status, history }: { status: ClaimStatus; history: ClaimHistoryEntry[] }) {
  const steps = buildClaimTimeline(status, history);
  return <ol className="claim-timeline">{steps.map((step, index) => <li key={`${step.status}-${index}`} className={`is-${step.state}`}>
    <span className="claim-timeline-mark" aria-hidden="true" />
    <div>
      <strong>{step.label}</strong>
      {step.at ? <time dateTime={step.at}>{dateTime.format(new Date(step.at))}</time> : <span className="claim-timeline-pending">Not yet reached</span>}
      {step.note && <p>{step.note}</p>}
    </div>
  </li>)}</ol>;
}

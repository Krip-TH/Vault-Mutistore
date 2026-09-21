import { useCallback, useEffect, useState } from 'react';
import { fetchAdminClaim, fetchAdminClaims, updateAdminClaimStatus } from '../admin/adminApi';
import {
  claimReasonLabel, claimStatusClass, claimStatusLabel, claimTotal, claimTransitions, claimUnitCount, isTerminalClaimStatus,
} from '../claims/claimStatus';
import type { AdminClaim, AdminClaimFilterInput, AdminClaimSummary, ClaimStatus } from '../types/claim';

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const statusOptions: ClaimStatus[] = [
  'submitted', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'cancelled',
];

const businessOptions = [
  { value: 'door', label: 'Door' },
  { value: 'plug', label: 'Plug' },
  { value: 'brandname', label: 'Brandname' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'powerbank', label: 'Powerbank' },
  { value: 'projector', label: 'Projector' },
  { value: 'vault', label: 'VAULT' },
];

export const emptyClaimFilters: AdminClaimFilterInput = {
  status: 'all', business: 'all', search: '', from: '', to: '',
};

export function claimMetrics(claims: AdminClaimSummary[]) {
  return {
    total: claims.length,
    open: claims.filter(claim => ['submitted', 'under_review'].includes(claim.status)).length,
    active: claims.filter(claim => ['approved', 'processing'].includes(claim.status)).length,
    completed: claims.filter(claim => claim.status === 'completed').length,
    closed: claims.filter(claim => ['rejected', 'cancelled'].includes(claim.status)).length,
  };
}

export default function AdminClaims() {
  const [filters, setFilters] = useState<AdminClaimFilterInput>(emptyClaimFilters);
  const [applied, setApplied] = useState<AdminClaimFilterInput>(emptyClaimFilters);
  const [claims, setClaims] = useState<AdminClaimSummary[]>([]);
  const [selected, setSelected] = useState<AdminClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (criteria: AdminClaimFilterInput) => {
    setLoading(true);
    setError('');
    try { setClaims(await fetchAdminClaims(criteria)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load claims.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(applied); }, [applied, load]);

  async function open(claimNumber: string) {
    setLoading(true);
    setError('');
    try { setSelected(await fetchAdminClaim(claimNumber)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load this claim.'); }
    finally { setLoading(false); }
  }

  if (loading) return <AdminClaimState title="Loading claims…" />;
  if (error) return <AdminClaimState title="Unable to load claims." detail={error} action={() => void load(applied)} />;

  if (selected) {
    return <AdminClaimDetail claim={selected} onBack={() => { setSelected(null); void load(applied); }}
      onUpdated={claim => {
        setSelected(claim);
        setClaims(current => current.map(item => item.claim_number === claim.claim_number ? { ...item, status: claim.status } : item));
      }} />;
  }

  const metrics = claimMetrics(claims);
  const hasFilters = JSON.stringify(applied) !== JSON.stringify(emptyClaimFilters);

  return <div className="admin-content">
    <section className="admin-metrics admin-order-metrics" aria-label="Claim summary">
      <article><span>Claims shown</span><strong>{metrics.total}</strong></article>
      <article><span>Awaiting review</span><strong>{metrics.open}</strong></article>
      <article><span>In progress</span><strong>{metrics.active}</strong></article>
      <article><span>Completed</span><strong>{metrics.completed}</strong></article>
      <article><span>Rejected / cancelled</span><strong>{metrics.closed}</strong></article>
    </section>

    <section className="admin-section">
      <div className="admin-section-heading">
        <div><p className="eyebrow">CLAIM MANAGEMENT</p><h3>Product claims</h3></div>
        <span>{claims.length} claim{claims.length === 1 ? '' : 's'}</span>
      </div>
      <form className="admin-order-tools admin-claim-tools" onSubmit={event => { event.preventDefault(); setApplied(filters); }}>
        <label><span>Search</span><input type="search" value={filters.search} placeholder="Claim, order, customer or email"
          onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} /></label>
        <label><span>Status</span><select value={filters.status}
          onChange={event => setFilters(current => ({ ...current, status: event.target.value as ClaimStatus | 'all' }))}>
          <option value="all">All statuses</option>
          {statusOptions.map(value => <option key={value} value={value}>{claimStatusLabel(value)}</option>)}
        </select></label>
        <label><span>Business</span><select value={filters.business}
          onChange={event => setFilters(current => ({ ...current, business: event.target.value }))}>
          <option value="all">All businesses</option>
          {businessOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <label><span>From</span><input type="date" value={filters.from}
          onChange={event => setFilters(current => ({ ...current, from: event.target.value }))} /></label>
        <label><span>To</span><input type="date" value={filters.to}
          onChange={event => setFilters(current => ({ ...current, to: event.target.value }))} /></label>
        <div className="admin-claim-tool-actions">
          <button type="submit" className="primary-button">Apply filters</button>
          {hasFilters && <button type="button" className="text-button"
            onClick={() => { setFilters(emptyClaimFilters); setApplied(emptyClaimFilters); }}>Clear</button>}
        </div>
      </form>

      {claims.length === 0
        ? <div className="admin-empty"><span>V.</span><h4>{hasFilters ? 'No claims match these filters.' : 'No claims have been submitted yet.'}</h4></div>
        : <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Claim</th><th>Customer</th><th>Order</th><th>Product</th><th>Business</th><th>Reason</th><th>Submitted</th><th>Status</th><th /></tr></thead>
          <tbody>{claims.map(claim => <tr key={claim.claim_number}>
            <td><strong>{claim.claim_number}</strong></td>
            <td>{claim.customer_name}<small>{claim.customer_email}</small></td>
            <td>{claim.order_no}</td>
            <td>{claim.product_name}{claim.item_count > 1 && <small>+{claim.item_count - 1} more</small>}</td>
            <td>{claim.business_name}</td>
            <td>{claimReasonLabel(claim.reason)}</td>
            <td>{dateTime.format(new Date(claim.created_at))}</td>
            <td><span className={`order-status ${claimStatusClass(claim.status)}`}>{claimStatusLabel(claim.status)}</span></td>
            <td><button className="text-button" onClick={() => void open(claim.claim_number)}>View details</button></td>
          </tr>)}</tbody>
        </table></div>}
    </section>
  </div>;
}

function AdminClaimDetail({ claim, onBack, onUpdated }: {
  claim: AdminClaim;
  onBack: () => void;
  onUpdated: (claim: AdminClaim) => void;
}) {
  const allowed = claimTransitions[claim.status];
  const [status, setStatus] = useState<ClaimStatus | ''>('');
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<'customer' | 'internal'>('customer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // A different claim may be opened while this component stays mounted.
  useEffect(() => { setStatus(''); setNote(''); setVisibility('customer'); setError(''); }, [claim.claim_number]);

  async function save() {
    if (!status) return;
    setSaving(true);
    setError('');
    try {
      onUpdated(await updateAdminClaimStatus(claim.claim_number, {
        status, note: note.trim() || undefined, note_visibility: visibility,
      }));
      setStatus('');
      setNote('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update the claim status.');
    } finally { setSaving(false); }
  }

  return <div className="admin-content admin-order-detail">
    <button className="admin-back" onClick={onBack}>← All claims</button>
    <div className="admin-detail-grid">
      <section className="admin-section">
        <div className="admin-section-heading">
          <div><p className="eyebrow">CLAIM {claim.claim_number}</p><h3>{claimReasonLabel(claim.reason)}</h3></div>
          <span className={`order-status ${claimStatusClass(claim.status)}`}>{claimStatusLabel(claim.status)}</span>
        </div>

        <div className="admin-items">{claim.items.map(item => <article key={item.order_item_id}>
          <div><small>{item.business_name}</small><strong>{item.product_name}</strong><span>Product {item.product_id}</span></div>
          <dl>
            <div><dt>Quantity</dt><dd>{item.quantity}</dd></div>
            <div><dt>Unit price</dt><dd>{price.format(item.unit_price)}</dd></div>
            <div><dt>Value</dt><dd>{price.format(item.line_total)}</dd></div>
          </dl>
        </article>)}</div>

        <h4 className="claim-subheading">Reported problem</h4>
        <p className="claim-admin-description">{claim.description}</p>

        <h4 className="claim-subheading">Evidence ({claim.evidence.length})</h4>
        {claim.evidence.length === 0 ? <p className="claim-empty-note">No photos were attached.</p>
          : <ul className="claim-evidence-gallery">{claim.evidence.map((file, index) => <li key={file.id}>
            <a href={file.image_url} target="_blank" rel="noreferrer">
              <img src={file.image_url} alt={`Evidence ${index + 1} for claim ${claim.claim_number}`} loading="lazy" />
            </a>
          </li>)}</ul>}

        <h4 className="claim-subheading">Claim history</h4>
        <ol className="claim-history">{claim.history.map((entry, index) => <li key={`${entry.created_at}-${index}`}>
          <div>
            <strong>{entry.previous_status ? `${claimStatusLabel(entry.previous_status)} → ` : ''}{claimStatusLabel(entry.new_status)}</strong>
            <time dateTime={entry.created_at}>{dateTime.format(new Date(entry.created_at))}</time>
          </div>
          <span className="claim-history-actor">{entry.changed_by_name ?? 'Removed account'} · {entry.changed_by_role}</span>
          {entry.note && <p>{entry.note}</p>}
          {entry.visibility === 'internal' && <em className="claim-history-internal">Internal note — not shown to the customer</em>}
        </li>)}</ol>
      </section>

      <aside className="admin-detail-aside">
        <section>
          <p className="eyebrow">CUSTOMER</p>
          <h3>{claim.customer_name}</h3>
          <a href={`mailto:${claim.customer_email}`}>{claim.customer_email}</a>
          <a href={`tel:${claim.contact_phone || claim.customer_phone}`}>{claim.contact_phone || claim.customer_phone}</a>
        </section>
        <section>
          <p className="eyebrow">ORDER</p>
          <h3>{claim.order_no}</h3>
          <span className={`order-status status-${claim.order_status}`}>{claim.order_status}</span>
          <p className="claim-order-meta">{price.format(claim.order_total)} · placed {dateTime.format(new Date(claim.order_created_at))}</p>
        </section>
        <section className="claim-status-editor">
          <p className="eyebrow">UPDATE STATUS</p>
          {allowed.length === 0
            ? <p className="admin-status-note">{claimStatusLabel(claim.status)} is a final status and cannot be changed.</p>
            : <>
              <label className="admin-status">
                <span>Next status</span>
                <select value={status} onChange={event => setStatus(event.target.value as ClaimStatus)}>
                  <option value="">Select a status…</option>
                  {allowed.map(value => <option key={value} value={value}>{claimStatusLabel(value)}</option>)}
                </select>
              </label>
              <label className="admin-status">
                <span>Note</span>
                <textarea rows={3} maxLength={1000} value={note} placeholder="Evidence verified. Replacement approved."
                  onChange={event => setNote(event.target.value)} />
              </label>
              <fieldset className="claim-note-visibility">
                <legend>Who can read this note?</legend>
                <label><input type="radio" name="note-visibility" checked={visibility === 'customer'}
                  onChange={() => setVisibility('customer')} /> Customer can read it</label>
                <label><input type="radio" name="note-visibility" checked={visibility === 'internal'}
                  onChange={() => setVisibility('internal')} /> Internal only</label>
              </fieldset>
              <button className="primary-button" disabled={saving || !status} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Update claim'}
              </button>
            </>}
          {error && <p className="claim-form-error" role="alert">{error}</p>}
        </section>
        {claim.admin_note && <section className="claim-admin-note">
          <p className="eyebrow">NOTE THE CUSTOMER SEES</p>
          <p>{claim.admin_note}</p>
        </section>}
        <dl className="admin-totals">
          <div><dt>Units claimed</dt><dd>{claimUnitCount(claim)}</dd></div>
          <div><dt>Claimed value</dt><dd>{price.format(claimTotal(claim))}</dd></div>
          <div><dt>Submitted</dt><dd>{dateTime.format(new Date(claim.created_at))}</dd></div>
          <div><dt>Last updated</dt><dd>{dateTime.format(new Date(claim.updated_at))}</dd></div>
          {claim.resolved_at && <div><dt>Resolved</dt><dd>{dateTime.format(new Date(claim.resolved_at))}</dd></div>}
          <div><dt>Final</dt><dd>{isTerminalClaimStatus(claim.status) ? 'Yes' : 'No'}</dd></div>
        </dl>
      </aside>
    </div>
  </div>;
}

function AdminClaimState({ title, detail, action }: { title: string; detail?: string; action?: () => void }) {
  return <div className="admin-state" role={detail ? 'alert' : 'status'}>
    <span>V.</span><h3>{title}</h3>{detail && <p>{detail}</p>}
    {action && <button className="primary-button" onClick={action}>Try again</button>}
  </div>;
}

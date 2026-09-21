import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildClaimFormData, fetchClaimableItems, submitClaim } from '../claims/claimApi';
import { claimReasonOptions } from '../claims/claimStatus';
import type { Claim, ClaimReason, ClaimableItem, ClaimableItemsResponse } from '../types/claim';
import GalleryImage from './GalleryImage';

const price = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export const acceptedEvidenceTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const maxEvidenceFiles = 5;
export const maxEvidenceBytes = 5 * 1024 * 1024;

export interface ClaimDraft {
  selection: Record<number, number>;
  reason: ClaimReason | '';
  description: string;
  contactPhone: string;
}

export const emptyClaimDraft: ClaimDraft = { selection: {}, reason: '', description: '', contactPhone: '' };

/** Mirrors the server rules so the customer sees problems before uploading photos. */
export function validateClaimDraft(draft: ClaimDraft, items: ClaimableItem[], files: File[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const chosen = Object.entries(draft.selection).filter(([, quantity]) => quantity > 0);
  if (!chosen.length) errors.items = 'Select at least one product to claim.';
  for (const [id, quantity] of chosen) {
    const item = items.find(value => value.order_item_id === Number(id));
    if (!item) { errors.items = 'One of the selected products is no longer part of this order.'; continue; }
    if (quantity > item.claimable_quantity) {
      errors.items = `${item.product_name}: you can claim at most ${item.claimable_quantity} unit${item.claimable_quantity === 1 ? '' : 's'}.`;
    }
  }
  if (!draft.reason) errors.reason = 'Choose what went wrong.';
  if (!draft.description.trim()) errors.description = 'Describe the problem so the team can review it.';
  else if (draft.description.trim().length > 2000) errors.description = 'Keep the description to 2000 characters or fewer.';
  if (draft.contactPhone.trim() && !/^[+\d][\d\s().-]{5,38}$/.test(draft.contactPhone.trim())) {
    errors.contactPhone = 'Enter a valid phone number.';
  }
  if (!files.length) errors.evidence = 'Attach at least one photo of the problem.';
  return errors;
}

export function validateEvidenceFiles(existing: File[], incoming: File[]): { accepted: File[]; error: string } {
  const accepted: File[] = [];
  let error = '';
  for (const file of incoming) {
    if (!acceptedEvidenceTypes.includes(file.type)) { error = 'Photos must be JPEG, PNG, or WEBP.'; continue; }
    if (file.size > maxEvidenceBytes) { error = 'Each photo must be 5 MB or smaller.'; continue; }
    if (existing.length + accepted.length >= maxEvidenceFiles) { error = `Attach up to ${maxEvidenceFiles} photos.`; continue; }
    accepted.push(file);
  }
  return { accepted, error };
}

export default function ClaimForm({ orderNo, onBack, onSubmitted, onViewClaims }: {
  orderNo: string;
  onBack: () => void;
  onSubmitted: (claim: Claim) => void;
  onViewClaims: () => void;
}) {
  const [source, setSource] = useState<ClaimableItemsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState<ClaimDraft>(emptyClaimDraft);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState<Claim | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try { setSource(await fetchClaimableItems(orderNo)); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Unable to load the products you can claim.'); }
    finally { setLoading(false); }
  }, [orderNo]);

  useEffect(() => { void load(); }, [load]);

  // Object URLs are created once per file and released when the file list changes.
  const previews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(preview => URL.revokeObjectURL(preview.url)), [previews]);

  const items = source?.items ?? [];

  function toggle(item: ClaimableItem) {
    setDraft(current => {
      const selection = { ...current.selection };
      if (selection[item.order_item_id]) delete selection[item.order_item_id];
      else selection[item.order_item_id] = 1;
      return { ...current, selection };
    });
  }

  function setQuantity(item: ClaimableItem, value: number) {
    const quantity = Math.min(item.claimable_quantity, Math.max(1, Math.floor(value) || 1));
    setDraft(current => ({ ...current, selection: { ...current.selection, [item.order_item_id]: quantity } }));
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const result = validateEvidenceFiles(files, [...incoming]);
    setFileError(result.error);
    if (result.accepted.length) setFiles(current => [...current, ...result.accepted]);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateClaimDraft(draft, items, files);
    setErrors(found);
    setSubmitError('');
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      const claim = await submitClaim(buildClaimFormData({
        orderNo,
        reason: draft.reason,
        description: draft.description.trim(),
        contactPhone: draft.contactPhone,
        items: Object.entries(draft.selection).filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => ({ order_item_id: Number(id), quantity })),
        files,
      }));
      setSubmitted(claim);
      onSubmitted(claim);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the claim. Please try again.');
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return <main className="orders-page"><div className="orders-state" role="status"><span className="orders-loader" /><h3>Preparing the claim form…</h3></div></main>;
  }
  if (loadError) {
    return <main className="orders-page"><div className="orders-state" role="alert"><h3>We couldn’t open the claim form.</h3><p>{loadError}</p>
      <button className="primary-button" onClick={() => void load()}>Try again</button></div></main>;
  }
  if (submitted) {
    return <main className="orders-page"><div className="orders-state" role="status">
      <span className="orders-empty-mark">V.</span>
      <h3>Claim {submitted.claim_number} submitted.</h3>
      <p>We have received {submitted.items.length} product{submitted.items.length === 1 ? '' : 's'} from order {submitted.order_no}. You can follow every update under My Claims.</p>
      <button className="primary-button" onClick={onViewClaims}>Go to My Claims <span aria-hidden="true">↗</span></button>
    </div></main>;
  }
  if (!source?.eligible || !items.length) {
    return <main className="orders-page"><div className="orders-state">
      <span className="orders-empty-mark">V.</span>
      <h3>This order cannot be claimed.</h3>
      <p>{source?.ineligible_reason ?? 'There are no products left to claim on this order.'}</p>
      <button className="primary-button" onClick={onBack}>Back to order</button>
    </div></main>;
  }

  return <main className="orders-page claim-form-page">
    <div className="orders-intro">
      <p className="eyebrow">SUBMIT A CLAIM</p>
      <h2 id="orders-title">Tell us what went wrong.</h2>
      <p>Order {orderNo}. Select the affected products, describe the problem, and attach photos as evidence.</p>
    </div>

    <form className="claim-form" onSubmit={submit} noValidate>
      <fieldset className="claim-form-section">
        <legend>1. Which products are affected?</legend>
        {errors.items && <p className="claim-form-error" role="alert">{errors.items}</p>}
        <ul className="claim-item-picker">{items.map(item => {
          const selected = draft.selection[item.order_item_id] ?? 0;
          return <li key={item.order_item_id} className={selected ? 'is-selected' : ''}>
            <label className="claim-item-choice">
              <input type="checkbox" checked={selected > 0} onChange={() => toggle(item)} />
              <span className="claim-item-thumb"><GalleryImage src={item.image_url} alt={item.product_name} /></span>
              <span className="claim-item-copy">
                <small>{item.business_name}</small>
                <strong>{item.product_name}</strong>
                <span>{price.format(item.unit_price)} · {item.claimable_quantity} of {item.purchased_quantity} still claimable</span>
              </span>
            </label>
            {selected > 0 && <label className="claim-item-quantity">
              <span>Claim quantity</span>
              <input type="number" min={1} max={item.claimable_quantity} value={selected}
                onChange={event => setQuantity(item, Number(event.target.value))} />
              <small>max {item.claimable_quantity}</small>
            </label>}
          </li>;
        })}</ul>
      </fieldset>

      <fieldset className="claim-form-section">
        <legend>2. What went wrong?</legend>
        <div className="claim-form-fields">
          <label className="checkout-field">
            <span>Reason</span>
            <select value={draft.reason} onChange={event => setDraft(current => ({ ...current, reason: event.target.value as ClaimReason }))}>
              <option value="">Select a reason…</option>
              {claimReasonOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {errors.reason && <small role="alert">{errors.reason}</small>}
          </label>
          <label className="checkout-field">
            <span>Contact phone (optional)</span>
            <input type="tel" value={draft.contactPhone} placeholder="+66 81 234 5678"
              onChange={event => setDraft(current => ({ ...current, contactPhone: event.target.value }))} />
            {errors.contactPhone && <small role="alert">{errors.contactPhone}</small>}
          </label>
        </div>
        <label className="checkout-field claim-form-description">
          <span>Description</span>
          <textarea rows={5} maxLength={2000} value={draft.description} placeholder="Describe what is wrong, when you noticed it, and what you would like us to do."
            onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} />
          <small className={errors.description ? 'is-error' : ''} role={errors.description ? 'alert' : undefined}>
            {errors.description ?? `${draft.description.trim().length} of 2000 characters`}
          </small>
        </label>
      </fieldset>

      <fieldset className="claim-form-section">
        <legend>3. Evidence photos</legend>
        <p className="claim-form-hint">Attach up to {maxEvidenceFiles} photos (JPEG, PNG, or WEBP, 5 MB each). At least one is required.</p>
        <div className="claim-evidence-picker">
          <input ref={fileInput} type="file" id="claim-evidence" accept={acceptedEvidenceTypes.join(',')} multiple
            onChange={event => addFiles(event.target.files)} />
          <label htmlFor="claim-evidence" className="secondary-button">Choose photos</label>
          <span>{files.length} of {maxEvidenceFiles} attached</span>
        </div>
        {(fileError || errors.evidence) && <p className="claim-form-error" role="alert">{fileError || errors.evidence}</p>}
        {previews.length > 0 && <ul className="claim-evidence-list">{previews.map((preview, index) => <li key={preview.url}>
          <img src={preview.url} alt={`Evidence ${index + 1}: ${preview.file.name}`} />
          <button type="button" aria-label={`Remove ${preview.file.name}`}
            onClick={() => setFiles(current => current.filter((_, position) => position !== index))}>×</button>
        </li>)}</ul>}
      </fieldset>

      {submitError && <p className="claim-form-error" role="alert">{submitError}</p>}
      <div className="claim-form-actions">
        <button type="button" className="secondary-button" onClick={onBack} disabled={submitting}>Cancel</button>
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit claim'} <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  </main>;
}

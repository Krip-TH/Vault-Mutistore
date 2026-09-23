import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildClaimTimeline, canCancelClaim, claimReasonLabel, claimStatusClass, claimStatusLabel,
  claimTotal, claimTransitions, claimUnitCount, isTerminalClaimStatus,
} from '../src/claims/claimStatus';
import { buildClaimFormData, cancelClaim, fetchClaim, fetchClaims, submitClaim } from '../src/claims/claimApi';
import { fetchAdminClaims, updateAdminClaimStatus } from '../src/admin/adminApi';
import { ClaimTimeline } from '../src/components/MyClaims';
import { ClaimPrintDocument, WarrantyDocument } from '../src/components/ClaimDocument';
import { ClaimStatsPanel } from '../src/components/AdminDashboard';
import { claimMetrics, emptyClaimFilters } from '../src/components/AdminClaims';
import { validateClaimDraft, validateEvidenceFiles, emptyClaimDraft } from '../src/components/ClaimForm';
import type { Claim, ClaimHistoryEntry, ClaimStatus, ClaimSummary, ClaimWarrantyDocument, ClaimableItem } from '../src/types/claim';

const submittedAt = '2026-09-20T08:00:00.000Z';
const reviewedAt = '2026-09-21T09:30:00.000Z';

function history(...entries: Array<[ClaimStatus | null, ClaimStatus, string, string | null]>): ClaimHistoryEntry[] {
  return entries.map(([previous, next, at, note]) => ({
    previous_status: previous, new_status: next, changed_by_role: previous ? 'admin' : 'customer', note, created_at: at,
  }));
}

const claim = (overrides: Partial<Claim> = {}): Claim => ({
  claim_number: 'CLM-20260920-000001', order_no: 'MDG-20260910-AAA111', status: 'under_review', reason: 'damaged',
  description: 'The door panel arrived cracked along the top edge.', contact_phone: '+66 81 234 5678',
  admin_note: 'Evidence received, a replacement is being prepared.',
  items: [{
    order_item_id: 11, quantity: 2, product_id: 'door-1', product_name: 'Walnut Entry Door',
    business: 'door', business_name: 'Door', unit_price: 2500, line_total: 5000,
  }],
  evidence: [{ id: 1, image_url: '/api/claims/CLM-20260920-000001/evidence/1', mime_type: 'image/png', file_size: 2048, created_at: submittedAt }],
  history: history([null, 'submitted', submittedAt, 'Claim submitted.'], ['submitted', 'under_review', reviewedAt, 'Evidence verified.']),
  created_at: submittedAt, updated_at: reviewedAt, resolved_at: null,
  ...overrides,
});

const claimableItem = (overrides: Partial<ClaimableItem> = {}): ClaimableItem => ({
  order_item_id: 11, product_id: 'door-1', product_name: 'Walnut Entry Door', business: 'door', business_name: 'Door',
  category: 'Entry doors', image_url: '', unit_price: 2500,
  purchased_quantity: 3, claimed_quantity: 1, claimable_quantity: 2, ...overrides,
});

const warranty = (overrides: Partial<ClaimWarrantyDocument> = {}): ClaimWarrantyDocument => ({
  order_no: 'MDG-20260910-AAA111', order_status: 'completed', order_created_at: '2026-09-10T08:00:00.000Z',
  order_completed_at: '2026-09-18T08:00:00.000Z', customer_name: 'Narin Chai', customer_email: 'narin@example.test',
  customer_phone: '+66 81 234 5678', items: [claimableItem()], order_total: 7500,
  claim_window_days: 90, claim_window_expires_at: '2026-12-17T08:00:00.000Z',
  eligible: true, ineligible_reason: null, existing_claims: [], ...overrides,
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// ------------------------------------------------------------ state machine

test('the frontend transition table matches the backend state machine', () => {
  // Kept in sync by hand; the backend stays the enforcing copy.
  assert.deepEqual(claimTransitions, {
    submitted: ['under_review', 'cancelled'],
    under_review: ['approved', 'rejected', 'cancelled'],
    approved: ['processing'],
    processing: ['completed'],
    rejected: [], completed: [], cancelled: [],
  });
  for (const status of ['rejected', 'completed', 'cancelled'] as ClaimStatus[]) {
    assert.equal(isTerminalClaimStatus(status), true, status);
  }
  assert.deepEqual(['submitted', 'under_review', 'approved', 'processing', 'completed', 'rejected', 'cancelled']
    .filter(status => canCancelClaim(status as ClaimStatus)), ['submitted', 'under_review']);
});

test('labels are human readable and status pills reuse the existing order styles', () => {
  assert.equal(claimStatusLabel('under_review'), 'Under Review');
  assert.equal(claimReasonLabel('wrong_item'), 'Wrong Product');
  assert.equal(claimStatusClass('rejected'), 'status-cancelled');
  assert.equal(claimStatusClass('submitted'), 'status-pending');
  assert.equal(claimStatusClass('completed'), '');
});

// ---------------------------------------------------------------- timeline

test('the timeline shows recorded history as done and the rest as upcoming only', () => {
  const steps = buildClaimTimeline('under_review', claim().history);
  assert.deepEqual(steps.map(step => [step.status, step.state]), [
    ['submitted', 'done'], ['under_review', 'current'],
    ['approved', 'upcoming'], ['processing', 'upcoming'], ['completed', 'upcoming'],
  ]);
  // Nothing in the future may carry a timestamp.
  for (const step of steps.filter(value => value.state === 'upcoming')) assert.equal(step.at, null);
  assert.equal(steps[0].at, submittedAt);
  assert.equal(steps[1].note, 'Evidence verified.');
});

test('a rejected claim ends at rejection with no further steps', () => {
  const steps = buildClaimTimeline('rejected',
    history([null, 'submitted', submittedAt, null], ['submitted', 'under_review', reviewedAt, null], ['under_review', 'rejected', reviewedAt, 'Outside warranty.']));
  assert.deepEqual(steps.map(step => step.status), ['submitted', 'under_review', 'rejected']);
  assert.equal(steps.at(-1)?.state, 'current');
});

test('a cancelled claim shows the cancellation and stops there', () => {
  const steps = buildClaimTimeline('cancelled', history([null, 'submitted', submittedAt, null], ['submitted', 'cancelled', reviewedAt, 'Cancelled by the customer.']));
  assert.deepEqual(steps.map(step => step.status), ['submitted', 'cancelled']);
  assert.equal(steps.some(step => step.state === 'upcoming'), false);
});

test('a claim with no recorded history still renders its current status', () => {
  const steps = buildClaimTimeline('submitted', []);
  assert.equal(steps[0].status, 'submitted');
  assert.equal(steps[0].state, 'current');
  assert.equal(steps[0].at, null);
});

test('the rendered timeline marks upcoming steps as not yet reached', () => {
  const html = renderToStaticMarkup(<ClaimTimeline status="approved" history={claim({ status: 'approved' }).history} />);
  assert.match(html, /is-current/);
  assert.match(html, /is-upcoming/);
  assert.match(html, /Not yet reached/);
});

// -------------------------------------------------------------- form rules

test('the claim form refuses an empty draft and reports every problem at once', () => {
  const errors = validateClaimDraft(emptyClaimDraft, [claimableItem()], []);
  assert.deepEqual(Object.keys(errors).sort(), ['description', 'evidence', 'items', 'reason']);
});

test('the claim form refuses more units than remain claimable', () => {
  const draft = { selection: { 11: 3 }, reason: 'damaged' as const, description: 'Cracked.', contactPhone: '' };
  assert.match(validateClaimDraft(draft, [claimableItem()], [new File([''], 'a.png')]).items ?? '', /at most 2 units/);
  assert.deepEqual(validateClaimDraft({ ...draft, selection: { 11: 2 } }, [claimableItem()], [new File([''], 'a.png')]), {});
});

test('the claim form validates the optional phone number and the description length', () => {
  const base = { selection: { 11: 1 }, reason: 'other' as const, description: 'Broken.', contactPhone: '' };
  const file = [new File([''], 'a.png')];
  assert.equal(validateClaimDraft({ ...base, contactPhone: 'call me' }, [claimableItem()], file).contactPhone, 'Enter a valid phone number.');
  assert.equal(validateClaimDraft({ ...base, contactPhone: '+66 81 234 5678' }, [claimableItem()], file).contactPhone, undefined);
  assert.match(validateClaimDraft({ ...base, description: 'x'.repeat(2001) }, [claimableItem()], file).description ?? '', /2000 characters/);
});

test('evidence files are filtered by type, size, and count before upload', () => {
  const png = (name: string, size = 1024) => {
    const file = new File([new Uint8Array(1)], name, { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };
  assert.equal(validateEvidenceFiles([], [png('a.png')]).accepted.length, 1);
  assert.match(validateEvidenceFiles([], [new File([''], 'x.pdf', { type: 'application/pdf' })]).error, /JPEG, PNG, or WEBP/);
  assert.match(validateEvidenceFiles([], [png('big.png', 6 * 1024 * 1024)]).error, /5 MB or smaller/);

  const existing = [png('1.png'), png('2.png'), png('3.png'), png('4.png'), png('5.png')];
  const overflow = validateEvidenceFiles(existing, [png('6.png')]);
  assert.deepEqual(overflow.accepted, []);
  assert.match(overflow.error, /up to 5 photos/);
});

// --------------------------------------------------------------------- api

test('the claim form data carries every field and one entry per photo', () => {
  const body = buildClaimFormData({
    orderNo: 'MDG-20260910-AAA111', reason: 'damaged', description: 'Cracked.', contactPhone: ' +66 81 234 5678 ',
    items: [{ order_item_id: 11, quantity: 2 }],
    files: [new File([''], 'a.png', { type: 'image/png' }), new File([''], 'b.png', { type: 'image/png' })],
  });
  assert.equal(body.get('order_no'), 'MDG-20260910-AAA111');
  assert.equal(body.get('contact_phone'), '+66 81 234 5678');
  assert.equal(body.get('items'), '[{"order_item_id":11,"quantity":2}]');
  assert.equal(body.getAll('evidence').length, 2);
});

test('an empty contact phone is omitted rather than sent as a blank field', () => {
  const body = buildClaimFormData({ orderNo: 'MDG-20260910-AAA111', reason: 'other', description: 'x', contactPhone: '   ', items: [], files: [] });
  assert.equal(body.has('contact_phone'), false);
});

test('the claim list request only sends the filters that are set', async () => {
  const urls: string[] = [];
  const fetcher = (async (url: string) => { urls.push(url); return json({ data: { claims: [], total: 0, page: 1, page_size: 20 } }); }) as unknown as typeof fetch;
  await fetchClaims({}, fetcher);
  await fetchClaims({ status: 'all', page: 1 }, fetcher);
  await fetchClaims({ status: 'approved', page: 3 }, fetcher);
  assert.deepEqual(urls, ['/api/claims', '/api/claims', '/api/claims?status=approved&page=3']);
});

test('claim requests surface the server error message', async () => {
  const failing = (async () => json({ error: { code: 'CLAIM_NOT_FOUND', message: 'Claim not found.' } }, 404)) as unknown as typeof fetch;
  await assert.rejects(fetchClaim('CLM-20260920-000001', failing), /Claim not found\./);
  await assert.rejects(cancelClaim('CLM-20260920-000001', failing), /Claim not found\./);
  await assert.rejects(submitClaim(new FormData(), failing), /Claim not found\./);

  const broken = (async () => new Response('<html>502</html>', { status: 502 })) as unknown as typeof fetch;
  await assert.rejects(fetchClaim('CLM-20260920-000001', broken), /Unable to load this claim\./);
});

test('the claim number is escaped into the request path', async () => {
  const urls: string[] = [];
  const fetcher = (async (url: string) => { urls.push(url); return json({ data: claim() }); }) as unknown as typeof fetch;
  await fetchClaim('../admin/claims', fetcher);
  assert.equal(urls[0], '/api/claims/..%2Fadmin%2Fclaims');
});

test('admin claim filters drop "all" and blank values', async () => {
  const urls: string[] = [];
  const fetcher = (async (url: string) => { urls.push(url); return json({ data: [] }); }) as unknown as typeof fetch;
  await fetchAdminClaims(emptyClaimFilters, fetcher);
  await fetchAdminClaims({ status: 'approved', business: 'door', search: 'CLM', from: '2026-09-01', to: '' }, fetcher);
  assert.equal(urls[0], '/api/admin/claims');
  assert.equal(urls[1], '/api/admin/claims?status=approved&business=door&search=CLM&from=2026-09-01');
});

test('an admin status update sends the note and its visibility', async () => {
  let body: unknown;
  const fetcher = (async (_url: string, init: RequestInit) => { body = JSON.parse(String(init.body)); return json({ data: claim() }); }) as unknown as typeof fetch;
  await updateAdminClaimStatus('CLM-20260920-000001', { status: 'approved', note: 'Verified.', note_visibility: 'internal' }, fetcher);
  assert.deepEqual(body, { status: 'approved', note: 'Verified.', note_visibility: 'internal' });
});

// --------------------------------------------------------------- documents

test('the warranty document shows the order snapshot, the window, and how to claim', () => {
  const html = renderToStaticMarkup(<WarrantyDocument document={warranty()} onBack={() => {}} onSubmitClaim={() => {}} />);
  for (const text of ['MDG-20260910-AAA111', 'Narin Chai', 'narin@example.test', 'Walnut Entry Door', 'Door', 'Entry doors']) {
    assert.ok(html.includes(text), text);
  }
  assert.match(html, /CLAIM &amp; WARRANTY DOCUMENT/);
  assert.match(html, /90 days/);
  assert.match(html, /17 December 2026/);
  assert.match(html, /2 of 3/);          // units still claimable
  assert.match(html, /How to submit a claim/);
  assert.match(html, /Print \/ Save as PDF/);
  assert.doesNotMatch(html, /password|hash|token/i);
});

test('an ineligible order explains itself and hides the submit action', () => {
  const html = renderToStaticMarkup(<WarrantyDocument onBack={() => {}} onSubmitClaim={() => {}}
    document={warranty({ eligible: false, ineligible_reason: 'The 90-day claim window for this order has closed.' })} />);
  assert.match(html, /claim window for this order has closed/);
  assert.doesNotMatch(html, /Submit Claim/);
});

test('a warranty document with no time limit says so instead of printing a date', () => {
  const html = renderToStaticMarkup(<WarrantyDocument onBack={() => {}} onSubmitClaim={() => {}}
    document={warranty({ claim_window_days: 0, claim_window_expires_at: null })} />);
  assert.match(html, /No time limit/);
});

test('the printable claim form carries the claim details and both signature lines', () => {
  const html = renderToStaticMarkup(<ClaimPrintDocument claim={claim()} customer={{ name: 'Narin Chai', email: 'narin@example.test' }} onBack={() => {}} />);
  for (const text of ['CLM-20260920-000001', 'MDG-20260910-AAA111', 'Damaged Product', 'Walnut Entry Door', 'arrived cracked']) {
    assert.ok(html.includes(text), text);
  }
  assert.match(html, /PRODUCT CLAIM FORM/);
  assert.match(html, /Customer signature/);
  assert.match(html, /VAULT representative/);
  assert.match(html, /Evidence attached: 1 photo\./);
  assert.match(html, /Under Review/);
});

test('claim totals are derived from the snapshot lines', () => {
  const multiple = claim({ items: [...claim().items, {
    order_item_id: 12, quantity: 1, product_id: 'plug-9', product_name: 'Brass Socket',
    business: 'plug', business_name: 'Plug', unit_price: 349.5, line_total: 349.5,
  }] });
  assert.equal(claimTotal(multiple), 5349.5);
  assert.equal(claimUnitCount(multiple), 3);
});

// ------------------------------------------------------------- admin views

test('claim metrics group the statuses the admin table reports', () => {
  const summary = (status: ClaimStatus): ClaimSummary => ({
    claim_number: `CLM-2026-${status}`, order_no: 'MDG-20260910-AAA111', status, reason: 'damaged',
    product_name: 'Walnut Entry Door', business: 'door', business_name: 'Door', item_count: 1,
    created_at: submittedAt, updated_at: reviewedAt,
  });
  const metrics = claimMetrics(['submitted', 'under_review', 'approved', 'processing', 'completed', 'rejected', 'cancelled']
    .map(status => ({ ...summary(status as ClaimStatus), customer_name: 'Narin Chai', customer_email: 'narin@example.test' })));
  assert.deepEqual(metrics, { total: 7, open: 2, active: 2, completed: 1, closed: 2 });
});

test('the dashboard claim panel totals the open work', () => {
  const html = renderToStaticMarkup(<ClaimStatsPanel onOpenClaims={() => {}} stats={{
    total_claims: 9, submitted_claims: 2, under_review_claims: 1, approved_claims: 1, processing_claims: 1,
    completed_claims: 3, rejected_claims: 1, cancelled_claims: 0, open_claims: 5,
  }} />);
  assert.match(html, /Total claims/);
  assert.match(html, /5 claims still need attention\./);
  assert.match(html, /Manage claims/);
});

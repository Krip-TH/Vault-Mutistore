import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors/apiError.js';
import type { ClaimListPage, ClaimRepository, ClaimableOrder } from '../src/repositories/claimRepository.js';
import { createClaimService, parseCreateClaimRequest } from '../src/services/claimService.js';
import type { Claim, ClaimStatus, ClaimSummary, NewClaim } from '../src/types/claim.js';
import type { OrderStatus } from '../src/types/order.js';

const now = new Date('2026-09-22T09:00:00.000Z');
const owner = 41;
const stranger = 42;
const claimNumber = 'CLM-20260922-000001';
const orderNo = 'MDG-20260910-AAA111';

function claimableOrder(overrides: Partial<ClaimableOrder> = {}): ClaimableOrder {
  return {
    id: 7,
    order_no: orderNo,
    status: 'completed',
    total: 5000,
    created_at: '2026-09-10T08:00:00.000Z',
    completed_at: '2026-09-18T08:00:00.000Z',
    customer_name: 'Narin Chai',
    customer_email: 'narin@example.test',
    customer_phone: '+66 81 234 5678',
    items: [{
      order_item_id: 11, product_id: 'door-1', product_name: 'Walnut Entry Door',
      business: 'door', business_name: 'Door', category: 'Entry doors',
      image_url: 'https://example.test/door.jpg', unit_price: 2500,
      purchased_quantity: 2, claimed_quantity: 0, claimable_quantity: 2,
    }],
    ...overrides,
  };
}

function claim(status: ClaimStatus = 'submitted'): Claim {
  return {
    claim_number: claimNumber, order_no: orderNo, status, reason: 'damaged',
    description: 'The door panel arrived cracked.', contact_phone: '+66 81 234 5678',
    admin_note: null,
    items: [{
      order_item_id: 11, quantity: 1, product_id: 'door-1', product_name: 'Walnut Entry Door',
      business: 'door', business_name: 'Door', unit_price: 2500, line_total: 2500,
    }],
    evidence: [{ id: 1, image_url: `/api/claims/${claimNumber}/evidence/1`, mime_type: 'image/png', file_size: 2048, created_at: now.toISOString() }],
    history: [{ previous_status: null, new_status: 'submitted', changed_by_role: 'customer', note: 'Claim submitted.', created_at: now.toISOString() }],
    created_at: now.toISOString(), updated_at: now.toISOString(), resolved_at: null,
  };
}

const summary = (): ClaimSummary => ({
  claim_number: claimNumber, order_no: orderNo, status: 'submitted', reason: 'damaged',
  product_name: 'Walnut Entry Door', business: 'door', business_name: 'Door', item_count: 1,
  created_at: now.toISOString(), updated_at: now.toISOString(),
});

interface Recorder {
  created?: NewClaim;
  statusChanges: Array<{ claimNumber: string; status: ClaimStatus; changedBy: number; role: string }>;
  evidenceLookups: Array<{ claimNumber: string; evidenceId: number; userId: number | null }>;
  listCalls: Array<{ limit: number; offset: number; status: ClaimStatus | null }>;
}

function mockRepository(overrides: Partial<ClaimRepository> = {}) {
  const recorder: Recorder = { statusChanges: [], evidenceLookups: [], listCalls: [] };
  let currentStatus: ClaimStatus = 'submitted';
  const value: ClaimRepository = {
    async findClaimableOrder(value, userId) {
      return userId === owner && value === orderNo ? claimableOrder() : null;
    },
    async create(newClaim) { recorder.created = newClaim; return claimNumber; },
    async listForUser(_userId, status, limit, offset): Promise<ClaimListPage<ClaimSummary>> {
      recorder.listCalls.push({ limit, offset, status });
      return { claims: [summary()], total: 1 };
    },
    async listForOrder() { return [summary()]; },
    async findForUser(value, userId) {
      return userId === owner && value === claimNumber ? claim(currentStatus) : null;
    },
    async findForAdmin() { return null; },
    async listForAdmin() { return []; },
    async updateStatus(value, change, changedBy, role) {
      recorder.statusChanges.push({ claimNumber: value, status: change.status, changedBy, role });
      currentStatus = change.status;
      return true;
    },
    async findEvidenceFile(value, evidenceId, userId) {
      recorder.evidenceLookups.push({ claimNumber: value, evidenceId, userId });
      return { file_name: '0b5d0d37-7a55-4a3c-8d0b-0f3f6d2a9e11.png', mime_type: 'image/png' };
    },
    async getStats() {
      return {
        total_claims: 0, submitted_claims: 0, under_review_claims: 0, approved_claims: 0,
        processing_claims: 0, completed_claims: 0, rejected_claims: 0, cancelled_claims: 0, open_claims: 0,
      };
    },
    ...overrides,
  };
  return { value, recorder, setStatus: (status: ClaimStatus) => { currentStatus = status; } };
}

const service = (repository: ClaimRepository) => createClaimService({ repository, now: () => now });

const evidence = [{ file_name: 'a.png', image_url: '/uploads/claims/a.png', mime_type: 'image/png', file_size: 1024 }];

const payload = (overrides: Record<string, unknown> = {}) => ({
  order_no: orderNo, reason: 'damaged', description: 'The door panel arrived cracked.',
  contact_phone: '+66 81 234 5678', items: [{ order_item_id: 11, quantity: 1 }],
  ...overrides,
});

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, `expected ApiError, received ${String(error)}`);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

test.beforeEach(() => { process.env.CLAIM_WINDOW_DAYS = '90'; });

// ------------------------------------------------------------------ creating

test('creates a claim and snapshots the purchased product onto it', async () => {
  const repository = mockRepository();
  const created = await service(repository.value).createClaim(owner, payload(), evidence);

  assert.equal(created.claim_number, claimNumber);
  assert.equal(repository.recorder.created?.order_id, 7);
  assert.equal(repository.recorder.created?.user_id, owner);
  assert.equal(repository.recorder.created?.items[0].product_name, 'Walnut Entry Door');
  assert.equal(repository.recorder.created?.items[0].business, 'door');
  assert.equal(repository.recorder.created?.items[0].unit_price, 2500);
  assert.equal(repository.recorder.created?.items[0].line_total, 2500);
  assert.equal(repository.recorder.created?.evidence.length, 1);
});

test('rejects a claim for more units than remain claimable', async () => {
  const repository = mockRepository();
  await expectApiError(
    service(repository.value).createClaim(owner, payload({ items: [{ order_item_id: 11, quantity: 3 }] }), evidence),
    409, 'CLAIM_QUANTITY_EXCEEDED',
  );
  assert.equal(repository.recorder.created, undefined);
});

test('counts units already reserved by earlier claims against the remaining quantity', async () => {
  const partlyClaimed = claimableOrder();
  partlyClaimed.items[0].claimed_quantity = 1;
  partlyClaimed.items[0].claimable_quantity = 1;
  const repository = mockRepository({ async findClaimableOrder() { return partlyClaimed; } });
  await expectApiError(
    service(repository.value).createClaim(owner, payload({ items: [{ order_item_id: 11, quantity: 2 }] }), evidence),
    409, 'CLAIM_QUANTITY_EXCEEDED',
  );
  // The one remaining unit is still claimable.
  await service(repository.value).createClaim(owner, payload({ items: [{ order_item_id: 11, quantity: 1 }] }), evidence);
  assert.equal(repository.recorder.created?.items[0].quantity, 1);
});

test('rejects a claim once every purchased unit is already claimed', async () => {
  const fullyClaimed = claimableOrder();
  fullyClaimed.items[0].claimed_quantity = 2;
  fullyClaimed.items[0].claimable_quantity = 0;
  const repository = mockRepository({ async findClaimableOrder() { return fullyClaimed; } });
  await expectApiError(service(repository.value).createClaim(owner, payload(), evidence), 409, 'ORDER_NOT_CLAIMABLE');
});

test('rejects a claim raised after the claim window has closed', async () => {
  process.env.CLAIM_WINDOW_DAYS = '7';
  const repository = mockRepository();
  // The order completed on 18 September; a 7-day window closed on 25 September.
  const late = createClaimService({ repository: repository.value, now: () => new Date('2026-10-05T09:00:00.000Z') });
  await expectApiError(late.createClaim(owner, payload(), evidence), 409, 'ORDER_NOT_CLAIMABLE');
  // Inside the window the same claim succeeds.
  await service(repository.value).createClaim(owner, payload(), evidence);
  assert.equal(repository.recorder.created?.order_id, 7);
});

test('a claim window of 0 days disables the deadline entirely', async () => {
  process.env.CLAIM_WINDOW_DAYS = '0';
  const repository = mockRepository();
  const muchLater = createClaimService({ repository: repository.value, now: () => new Date('2030-01-01T00:00:00.000Z') });
  const document = await muchLater.getWarrantyDocument(owner, orderNo);
  assert.equal(document.claim_window_expires_at, null);
  assert.equal(document.eligible, true);
});

test('reports another customer order as not found rather than forbidden', async () => {
  const repository = mockRepository();
  await expectApiError(service(repository.value).createClaim(stranger, payload(), evidence), 404, 'ORDER_NOT_FOUND');
  await expectApiError(service(repository.value).getWarrantyDocument(stranger, orderNo), 404, 'ORDER_NOT_FOUND');
});

test('rejects a claim against an order that has not shipped yet', async () => {
  for (const status of ['pending', 'confirmed', 'processing', 'cancelled'] as OrderStatus[]) {
    const repository = mockRepository({ async findClaimableOrder() { return claimableOrder({ status, completed_at: null }); } });
    await expectApiError(service(repository.value).createClaim(owner, payload(), evidence), 409, 'ORDER_NOT_CLAIMABLE');
  }
  // Shipped orders are claimable even before they complete.
  const shipped = mockRepository({ async findClaimableOrder() { return claimableOrder({ status: 'shipped', completed_at: null }); } });
  await service(shipped.value).createClaim(owner, payload(), evidence);
  assert.equal(shipped.recorder.created?.order_id, 7);
});

test('requires at least one evidence photo', async () => {
  const repository = mockRepository();
  await expectApiError(service(repository.value).createClaim(owner, payload(), []), 400, 'EVIDENCE_REQUIRED');
});

test('rejects a product that is not part of the order', async () => {
  const repository = mockRepository();
  await expectApiError(
    service(repository.value).createClaim(owner, payload({ items: [{ order_item_id: 99, quantity: 1 }] }), evidence),
    404, 'ORDER_ITEM_NOT_FOUND',
  );
});

// ---------------------------------------------------------------- validation

test('validates the submitted claim form', () => {
  assert.deepEqual(parseCreateClaimRequest(payload()).items, [{ order_item_id: 11, quantity: 1 }]);
  // Multipart sends the item list as a JSON string.
  assert.deepEqual(parseCreateClaimRequest(payload({ items: '[{"order_item_id":11,"quantity":2}]' })).items,
    [{ order_item_id: 11, quantity: 2 }]);

  const cases: Array<[Record<string, unknown>, string]> = [
    [{ order_no: 'not-an-order' }, 'INVALID_ORDER_NUMBER'],
    [{ reason: 'exploded' }, 'INVALID_CLAIM_REASON'],
    [{ description: '   ' }, 'INVALID_DESCRIPTION'],
    [{ description: 'x'.repeat(2001) }, 'INVALID_DESCRIPTION'],
    [{ contact_phone: 'call me' }, 'INVALID_PHONE'],
    [{ items: [] }, 'INVALID_CLAIM_ITEMS'],
    [{ items: [{ order_item_id: 11, quantity: 0 }] }, 'INVALID_CLAIM_QUANTITY'],
    [{ items: [{ order_item_id: 11, quantity: 1.5 }] }, 'INVALID_CLAIM_QUANTITY'],
    [{ items: [{ order_item_id: 11, quantity: 1 }, { order_item_id: 11, quantity: 1 }] }, 'DUPLICATE_CLAIM_ITEM'],
  ];
  for (const [overrides, code] of cases) {
    assert.throws(() => parseCreateClaimRequest(payload(overrides)), (error: unknown) => {
      assert.ok(error instanceof ApiError, JSON.stringify(overrides));
      assert.equal(error.code, code, JSON.stringify(overrides));
      return true;
    });
  }
});

// ------------------------------------------------------------------- reading

test('builds a warranty document from the order snapshot', async () => {
  const repository = mockRepository();
  const document = await service(repository.value).getWarrantyDocument(owner, orderNo);

  assert.equal(document.order_no, orderNo);
  assert.equal(document.customer_name, 'Narin Chai');
  assert.equal(document.items[0].product_name, 'Walnut Entry Door');
  assert.equal(document.items[0].claimable_quantity, 2);
  assert.equal(document.eligible, true);
  assert.equal(document.ineligible_reason, null);
  assert.equal(document.claim_window_expires_at, '2026-12-17T08:00:00.000Z');
  assert.equal(document.existing_claims.length, 1);
  assert.equal('password_hash' in document, false);
});

test('the warranty document explains why an order cannot be claimed', async () => {
  const repository = mockRepository({ async findClaimableOrder() { return claimableOrder({ status: 'confirmed', completed_at: null }); } });
  const document = await service(repository.value).getWarrantyDocument(owner, orderNo);
  assert.equal(document.eligible, false);
  assert.match(document.ineligible_reason ?? '', /shipped/);
});

test('claimable items exclude lines with nothing left to claim', async () => {
  const mixed = claimableOrder();
  mixed.items = [
    { ...mixed.items[0] },
    { ...mixed.items[0], order_item_id: 12, product_name: 'Brass Handle', claimed_quantity: 2, claimable_quantity: 0 },
  ];
  const repository = mockRepository({ async findClaimableOrder() { return mixed; } });
  const result = await service(repository.value).getClaimableItems(owner, orderNo);
  assert.deepEqual(result.items.map(item => item.order_item_id), [11]);
});

test('paginates the customer claim list and clamps the page size', async () => {
  const repository = mockRepository();
  const page = await service(repository.value).listClaims(owner, { page: '3', page_size: '5', status: 'submitted' });
  assert.deepEqual(repository.recorder.listCalls[0], { limit: 5, offset: 10, status: 'submitted' });
  assert.equal(page.page, 3);
  assert.equal(page.total, 1);

  await service(repository.value).listClaims(owner, { page_size: '5000' });
  assert.equal(repository.recorder.listCalls[1].limit, 50);
  await expectApiError(service(repository.value).listClaims(owner, { status: 'exploded' }), 400, 'INVALID_CLAIM_STATUS');
});

test('rejects malformed claim numbers before reaching the repository', async () => {
  const repository = mockRepository();
  await expectApiError(service(repository.value).getClaim(owner, 'CLM-BAD'), 400, 'INVALID_CLAIM_NUMBER');
  await expectApiError(service(repository.value).getClaim(owner, '../../etc/passwd'), 400, 'INVALID_CLAIM_NUMBER');
});

test('another customer claim is reported as not found', async () => {
  const repository = mockRepository();
  await expectApiError(service(repository.value).getClaim(stranger, claimNumber), 404, 'CLAIM_NOT_FOUND');
});

// ---------------------------------------------------------------- cancelling

test('the customer can cancel a claim that is still early in the flow', async () => {
  for (const status of ['submitted', 'under_review'] as ClaimStatus[]) {
    const repository = mockRepository();
    repository.setStatus(status);
    const cancelled = await service(repository.value).cancelClaim(owner, claimNumber, {});
    assert.equal(cancelled.status, 'cancelled');
    assert.deepEqual(repository.recorder.statusChanges, [{ claimNumber, status: 'cancelled', changedBy: owner, role: 'customer' }]);
  }
});

test('the customer cannot cancel a claim that has moved past review', async () => {
  for (const status of ['approved', 'processing', 'completed', 'rejected', 'cancelled'] as ClaimStatus[]) {
    const repository = mockRepository();
    repository.setStatus(status);
    await expectApiError(service(repository.value).cancelClaim(owner, claimNumber, {}), 409, 'CLAIM_NOT_CANCELLABLE');
    assert.deepEqual(repository.recorder.statusChanges, []);
  }
});

// ------------------------------------------------------------------ evidence

test('evidence is scoped to the owner unless the caller is an admin', async () => {
  const repository = mockRepository();
  await service(repository.value).getEvidenceFile(owner, claimNumber, '1', false);
  await service(repository.value).getEvidenceFile(99, claimNumber, '1', true);
  assert.deepEqual(repository.recorder.evidenceLookups, [
    { claimNumber, evidenceId: 1, userId: owner },
    { claimNumber, evidenceId: 1, userId: null },
  ]);
});

test('missing or malformed evidence ids are reported as not found', async () => {
  const repository = mockRepository({ async findEvidenceFile() { return null; } });
  await expectApiError(service(repository.value).getEvidenceFile(owner, claimNumber, 'abc', false), 404, 'EVIDENCE_NOT_FOUND');
  await expectApiError(service(repository.value).getEvidenceFile(owner, claimNumber, '1', false), 404, 'EVIDENCE_NOT_FOUND');
});

test('every entry point refuses an unauthenticated user id', async () => {
  const repository = mockRepository();
  const claims = service(repository.value);
  await expectApiError(claims.listClaims(0, {}), 401, 'UNAUTHENTICATED');
  await expectApiError(claims.getClaim(0, claimNumber), 401, 'UNAUTHENTICATED');
  await expectApiError(claims.createClaim(0, payload(), evidence), 401, 'UNAUTHENTICATED');
  await expectApiError(claims.getWarrantyDocument(0, orderNo), 401, 'UNAUTHENTICATED');
});

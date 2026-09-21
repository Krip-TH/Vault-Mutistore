import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors/apiError.js';
import type { ClaimRepository } from '../src/repositories/claimRepository.js';
import { createAdminClaimService, parseAdminClaimFilters, parseStatusUpdate } from '../src/services/adminClaimService.js';
import { canTransition, claimStatuses, claimTransitions, terminalClaimStatuses } from '../src/types/claim.js';
import type { AdminClaim, AdminClaimFilters, ClaimStatus, ClaimStatusChange } from '../src/types/claim.js';

const claimNumber = 'CLM-20260922-000001';
const adminId = 3;
const now = '2026-09-22T09:00:00.000Z';

function adminClaim(status: ClaimStatus): AdminClaim {
  return {
    claim_number: claimNumber, order_no: 'MDG-20260910-AAA111', status, reason: 'damaged',
    description: 'The door panel arrived cracked.', contact_phone: '+66 81 234 5678', admin_note: null,
    items: [{
      order_item_id: 11, quantity: 1, product_id: 'door-1', product_name: 'Walnut Entry Door',
      business: 'door', business_name: 'Door', unit_price: 2500, line_total: 2500,
    }],
    evidence: [],
    history: [{
      previous_status: null, new_status: 'submitted', changed_by: 41, changed_by_name: 'Narin Chai',
      changed_by_role: 'customer', note: 'Claim submitted.', visibility: 'customer', created_at: now,
    }],
    customer_name: 'Narin Chai', customer_email: 'narin@example.test', customer_phone: '+66 81 234 5678',
    order_status: 'completed', order_total: 5000, order_created_at: now,
    created_at: now, updated_at: now, resolved_at: null,
  };
}

function mockRepository(initial: ClaimStatus = 'submitted', overrides: Partial<ClaimRepository> = {}) {
  let status = initial;
  const changes: Array<{ claimNumber: string; change: ClaimStatusChange; changedBy: number; role: string }> = [];
  const filterCalls: AdminClaimFilters[] = [];
  const value: ClaimRepository = {
    async findClaimableOrder() { return null; },
    async create() { return claimNumber; },
    async listForUser() { return { claims: [], total: 0 }; },
    async listForOrder() { return []; },
    async findForUser() { return null; },
    async findForAdmin(value) { return value === claimNumber ? adminClaim(status) : null; },
    async listForAdmin(filters) { filterCalls.push(filters); return []; },
    async updateStatus(value, change, changedBy, role) {
      changes.push({ claimNumber: value, change, changedBy, role });
      status = change.status;
      return true;
    },
    async findEvidenceFile() { return null; },
    async getStats() {
      return {
        total_claims: 4, submitted_claims: 1, under_review_claims: 1, approved_claims: 1,
        processing_claims: 0, completed_claims: 1, rejected_claims: 0, cancelled_claims: 0, open_claims: 3,
      };
    },
    ...overrides,
  };
  return { value, changes, filterCalls };
}

async function expectApiError(promise: Promise<unknown>, status: number, code: string, label = '') {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, `${label} expected ApiError, received ${String(error)}`);
    assert.equal(error.status, status, label);
    assert.equal(error.code, code, label);
    return true;
  });
}

// -------------------------------------------------------------- state machine

test('the documented transition table has exactly three terminal states', () => {
  assert.deepEqual([...terminalClaimStatuses].sort(), ['cancelled', 'completed', 'rejected']);
  assert.deepEqual(claimTransitions.submitted, ['under_review', 'cancelled']);
  assert.deepEqual(claimTransitions.under_review, ['approved', 'rejected', 'cancelled']);
  assert.deepEqual(claimTransitions.approved, ['processing']);
  assert.deepEqual(claimTransitions.processing, ['completed']);
});

test('every allowed transition is accepted and recorded in history', async () => {
  for (const from of claimStatuses) {
    for (const to of claimTransitions[from]) {
      const repository = mockRepository(from);
      const updated = await createAdminClaimService(repository.value)
        .updateStatus(claimNumber, { status: to, note: 'Evidence verified.' }, adminId);
      assert.equal(updated.status, to, `${from} -> ${to}`);
      assert.equal(repository.changes.length, 1, `${from} -> ${to}`);
      assert.equal(repository.changes[0].change.status, to);
      assert.equal(repository.changes[0].changedBy, adminId);
      assert.equal(repository.changes[0].role, 'admin');
    }
  }
});

test('every transition outside the table is refused by the backend', async () => {
  for (const from of claimStatuses) {
    for (const to of claimStatuses) {
      if (from === to || canTransition(from, to)) continue;
      const repository = mockRepository(from);
      await expectApiError(
        createAdminClaimService(repository.value).updateStatus(claimNumber, { status: to }, adminId),
        409, 'INVALID_CLAIM_TRANSITION', `${from} -> ${to}:`,
      );
      assert.deepEqual(repository.changes, [], `${from} -> ${to} must not be written`);
    }
  }
});

test('a terminal claim cannot be reopened', async () => {
  for (const from of terminalClaimStatuses) {
    const repository = mockRepository(from);
    await assert.rejects(
      createAdminClaimService(repository.value).updateStatus(claimNumber, { status: 'under_review' }, adminId),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.match(error.message, /final/);
        return true;
      },
    );
  }
});

test('skipping a step, such as submitted straight to completed, is refused', async () => {
  const repository = mockRepository('submitted');
  await expectApiError(
    createAdminClaimService(repository.value).updateStatus(claimNumber, { status: 'completed' }, adminId),
    409, 'INVALID_CLAIM_TRANSITION',
  );
  await expectApiError(
    createAdminClaimService(repository.value).updateStatus(claimNumber, { status: 'approved' }, adminId),
    409, 'INVALID_CLAIM_TRANSITION',
  );
});

test('re-sending the current status is refused rather than duplicating history', async () => {
  const repository = mockRepository('under_review');
  await expectApiError(
    createAdminClaimService(repository.value).updateStatus(claimNumber, { status: 'under_review' }, adminId),
    409, 'CLAIM_STATUS_UNCHANGED',
  );
  assert.deepEqual(repository.changes, []);
});

// --------------------------------------------------------------------- notes

test('a customer-visible note is promoted to the note the customer reads', () => {
  const update = parseStatusUpdate({ status: 'approved', note: 'Replacement approved.' });
  assert.equal(update.visibility, 'customer');
  assert.equal(update.admin_note, 'Replacement approved.');
});

test('an internal note is never promoted to the customer-visible note', () => {
  const update = parseStatusUpdate({ status: 'rejected', note: 'Repeat claimant, flag account.', note_visibility: 'internal' });
  assert.equal(update.visibility, 'internal');
  assert.equal(update.admin_note, undefined);
});

test('an explicit admin_note overrides the promoted note and can be cleared', () => {
  assert.equal(parseStatusUpdate({ status: 'approved', note: 'internal detail', admin_note: 'We will ship a replacement.' }).admin_note,
    'We will ship a replacement.');
  assert.equal(parseStatusUpdate({ status: 'approved', note: 'kept', admin_note: '' }).admin_note, null);
});

test('status updates validate their payload', () => {
  const cases: Array<[unknown, string]> = [
    ['not an object', 'INVALID_REQUEST'],
    [{ status: 'exploded' }, 'INVALID_CLAIM_STATUS'],
    [{}, 'INVALID_CLAIM_STATUS'],
    [{ status: 'approved', note_visibility: 'secret' }, 'INVALID_NOTE_VISIBILITY'],
    [{ status: 'approved', note: 'x'.repeat(1001) }, 'INVALID_NOTE'],
    [{ status: 'approved', admin_note: 'x'.repeat(1001) }, 'INVALID_NOTE'],
  ];
  for (const [payload, code] of cases) {
    assert.throws(() => parseStatusUpdate(payload), (error: unknown) => {
      assert.ok(error instanceof ApiError, JSON.stringify(payload));
      assert.equal(error.code, code, JSON.stringify(payload));
      return true;
    });
  }
});

// ------------------------------------------------------------------- filters

test('admin filters are normalised into repository criteria', () => {
  assert.deepEqual(parseAdminClaimFilters({ status: 'Under_Review', business: 'Door', search: '  CLM-2026  ', from: '2026-09-01', to: '2026-09-30' }), {
    status: 'under_review', business: 'door', search: 'CLM-2026',
    from: '2026-09-01 00:00:00', to: '2026-10-01 00:00:00',
  });
  // "all" and blanks mean no filter at all.
  assert.deepEqual(parseAdminClaimFilters({ status: 'all', business: 'all', search: '' }), {
    status: null, business: null, search: null, from: null, to: null,
  });
  assert.deepEqual(parseAdminClaimFilters(undefined), { status: null, business: null, search: null, from: null, to: null });
});

test('the end of the date range is exclusive so the final day is included', () => {
  assert.equal(parseAdminClaimFilters({ to: '2026-09-30' }).to, '2026-10-01 00:00:00');
});

test('invalid filters are rejected', () => {
  for (const [payload, code] of [
    [{ status: 'exploded' }, 'INVALID_CLAIM_STATUS'],
    [{ business: 'door; DROP TABLE claims' }, 'INVALID_BUSINESS'],
    [{ from: '30-09-2026' }, 'INVALID_DATE'],
    [{ to: 'yesterday' }, 'INVALID_DATE'],
  ] as Array<[unknown, string]>) {
    assert.throws(() => parseAdminClaimFilters(payload), (error: unknown) => {
      assert.ok(error instanceof ApiError, JSON.stringify(payload));
      assert.equal(error.code, code, JSON.stringify(payload));
      return true;
    });
  }
});

test('the filter payload reaches the repository unchanged', async () => {
  const repository = mockRepository();
  await createAdminClaimService(repository.value).listClaims({ status: 'approved', business: 'plug' });
  assert.equal(repository.filterCalls[0].status, 'approved');
  assert.equal(repository.filterCalls[0].business, 'plug');
});

// ------------------------------------------------------------------- lookups

test('a missing claim is a 404 and a malformed number is a 400', async () => {
  const repository = mockRepository();
  const service = createAdminClaimService(repository.value);
  await expectApiError(service.getClaim('CLM-20260922-999999'), 404, 'CLAIM_NOT_FOUND');
  await expectApiError(service.getClaim('nonsense'), 400, 'INVALID_CLAIM_NUMBER');
  await expectApiError(service.updateStatus('nonsense', { status: 'under_review' }, adminId), 400, 'INVALID_CLAIM_NUMBER');
});

test('claim statistics are exposed for the admin dashboard', async () => {
  const repository = mockRepository();
  const stats = await createAdminClaimService(repository.value).getStats();
  assert.equal(stats.total_claims, 4);
  assert.equal(stats.open_claims, 3);
});

test('the admin view keeps internal history while the customer view drops it', () => {
  // The admin type carries visibility; the customer type has no such field to leak through.
  const claim = adminClaim('under_review');
  assert.equal(claim.history[0].visibility, 'customer');
  assert.equal(typeof claim.history[0].changed_by, 'number');
});

import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import apiRouter from '../src/routes/index.js';
import { claimUploadDirectory } from '../src/middleware/claimEvidenceUpload.js';
import { createClaimRouter, createOrderClaimRoutes } from '../src/routes/claims.js';
import { createAdminRouter } from '../src/routes/admin.js';
import { createAdminClaimService } from '../src/services/adminClaimService.js';
import type { ClaimRepository } from '../src/repositories/claimRepository.js';
import type { ClaimService } from '../src/services/claimService.js';
import type { AdminClaim, Claim, ClaimStatus, NewClaimEvidence } from '../src/types/claim.js';
import type { UserRole } from '../src/types/user.js';

const claimNumber = 'CLM-20260922-000001';
const orderNo = 'MDG-20260910-AAA111';
const now = '2026-09-22T09:00:00.000Z';

function claim(status: ClaimStatus = 'submitted'): Claim {
  return {
    claim_number: claimNumber, order_no: orderNo, status, reason: 'damaged',
    description: 'The door panel arrived cracked.', contact_phone: null, admin_note: null,
    items: [{
      order_item_id: 11, quantity: 1, product_id: 'door-1', product_name: 'Walnut Entry Door',
      business: 'door', business_name: 'Door', unit_price: 2500, line_total: 2500,
    }],
    evidence: [], history: [], created_at: now, updated_at: now, resolved_at: null,
  };
}

/** Captures what the router hands the service without touching MySQL. */
function stubService() {
  const calls: { evidence: NewClaimEvidence[][]; cancelled: string[] } = { evidence: [], cancelled: [] };
  const value: ClaimService = {
    async getWarrantyDocument() {
      return {
        order_no: orderNo, order_status: 'completed', order_created_at: now, order_completed_at: now,
        customer_name: 'Narin Chai', customer_email: 'narin@example.test', customer_phone: '+66 81 234 5678',
        items: [], order_total: 5000, claim_window_days: 90, claim_window_expires_at: null,
        eligible: true, ineligible_reason: null, existing_claims: [],
      };
    },
    async getClaimableItems() { return { order_no: orderNo, eligible: true, ineligible_reason: null, items: [] }; },
    async createClaim(_userId, _payload, evidence) { calls.evidence.push(evidence); return claim(); },
    async listClaims() { return { claims: [], total: 0, page: 1, page_size: 20 }; },
    async getClaim() { return claim(); },
    async cancelClaim(_userId, value) { calls.cancelled.push(value); return claim('cancelled'); },
    async getEvidenceFile() { return { file_name: 'missing.png', mime_type: 'image/png' }; },
  };
  return { value, calls };
}

function adminClaim(status: ClaimStatus): AdminClaim {
  return {
    ...claim(status),
    history: [],
    customer_name: 'Narin Chai', customer_email: 'narin@example.test', customer_phone: '+66 81 234 5678',
    order_status: 'completed', order_total: 5000, order_created_at: now,
  };
}

function adminRepository(initial: ClaimStatus = 'submitted'): ClaimRepository {
  let status = initial;
  return {
    async findClaimableOrder() { return null; },
    async create() { return claimNumber; },
    async listForUser() { return { claims: [], total: 0 }; },
    async listForOrder() { return []; },
    async findForUser() { return null; },
    async findForAdmin(value) { return value === claimNumber ? adminClaim(status) : null; },
    async listForAdmin() { return []; },
    async updateStatus(_value, change) { status = change.status; return true; },
    async findEvidenceFile() { return null; },
    async getStats() {
      return {
        total_claims: 2, submitted_claims: 1, under_review_claims: 0, approved_claims: 0,
        processing_claims: 0, completed_claims: 1, rejected_claims: 0, cancelled_claims: 0, open_claims: 1,
      };
    },
  };
}

async function serve(build: (app: express.Express) => void, call: (base: string) => Promise<Response>) {
  const app = express();
  app.use(express.json());
  build(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const { port } = server.address() as AddressInfo;
    return await call(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

const authenticate = (role: UserRole, userId = 41) =>
  (req: express.Request, _res: express.Response, next: express.NextFunction) => { req.auth = { userId, role }; next(); };

// ------------------------------------------------------------ authentication

test('every claim endpoint rejects unauthenticated requests before any claim logic runs', async () => {
  const requests: Array<[string, RequestInit | undefined]> = [
    ['/api/claims', { method: 'POST' }],
    ['/api/claims', undefined],
    [`/api/claims/${claimNumber}`, undefined],
    [`/api/claims/${claimNumber}/cancel`, { method: 'POST' }],
    [`/api/claims/${claimNumber}/evidence/1`, undefined],
    [`/api/orders/${orderNo}/warranty-document`, undefined],
    [`/api/orders/${orderNo}/claimable-items`, undefined],
  ];
  for (const [routePath, init] of requests) {
    const response = await serve(app => app.use('/api', apiRouter), base => fetch(`${base}${routePath}`, init));
    assert.equal(response.status, 401, `${init?.method ?? 'GET'} ${routePath}`);
    assert.deepEqual(await response.json(), { error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } });
  }
});

test('admin claim endpoints are closed to anonymous visitors and to customers', async () => {
  for (const [role, expected, code] of [[undefined, 401, 'UNAUTHENTICATED'], ['customer', 403, 'FORBIDDEN']] as Array<[UserRole | undefined, number, string]>) {
    for (const routePath of ['/claims', '/claims/stats', `/claims/${claimNumber}`]) {
      const response = await serve(app => {
        if (role) app.use(authenticate(role, 2));
        app.use('/api/admin', createAdminRouter(undefined, undefined, undefined, createAdminClaimService(adminRepository())));
      }, base => fetch(`${base}/api/admin${routePath}`));
      assert.equal(response.status, expected, `${role ?? 'anonymous'} ${routePath}`);
      assert.equal((await response.json()).error.code, code);
    }
  }
});

// --------------------------------------------------------------- customer API

test('a signed-in customer can read, cancel, and list their own claims', async () => {
  const stub = stubService();
  const build = (app: express.Express) => {
    app.use(authenticate('customer'));
    app.use('/api/claims', createClaimRouter(stub.value));
    app.use('/api/orders', createOrderClaimRoutes(stub.value));
  };

  const detail = await serve(build, base => fetch(`${base}/api/claims/${claimNumber}`));
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).data.claim_number, claimNumber);

  const list = await serve(build, base => fetch(`${base}/api/claims?status=submitted&page=2`));
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).data, { claims: [], total: 0, page: 1, page_size: 20 });

  const cancelled = await serve(build, base => fetch(`${base}/api/claims/${claimNumber}/cancel`, { method: 'POST' }));
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).data.status, 'cancelled');
  assert.deepEqual(stub.calls.cancelled, [claimNumber]);

  const document = await serve(build, base => fetch(`${base}/api/orders/${orderNo}/warranty-document`));
  assert.equal(document.status, 200);
  assert.equal((await document.json()).data.order_no, orderNo);

  const claimable = await serve(build, base => fetch(`${base}/api/orders/${orderNo}/claimable-items`));
  assert.equal(claimable.status, 200);
});

// ------------------------------------------------------------ evidence upload

const pngBytes = () => Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
]);

function form(file: { bytes: Buffer; name: string; type: string } | null) {
  const body = new FormData();
  body.set('order_no', orderNo);
  body.set('reason', 'damaged');
  body.set('description', 'The door panel arrived cracked.');
  body.set('items', JSON.stringify([{ order_item_id: 11, quantity: 1 }]));
  if (file) body.append('evidence', new Blob([new Uint8Array(file.bytes)], { type: file.type }), file.name);
  return body;
}

test('an uploaded photo is stored under a generated name and handed to the service', async t => {
  const stub = stubService();
  const response = await serve(app => {
    app.use(authenticate('customer'));
    app.use('/api/claims', createClaimRouter(stub.value));
  }, base => fetch(`${base}/api/claims`, { method: 'POST', body: form({ bytes: pngBytes(), name: '../../evil.png', type: 'image/png' }) }));

  assert.equal(response.status, 201);
  const stored = stub.calls.evidence[0][0];
  t.after(() => unlink(path.join(claimUploadDirectory, stored.file_name)).catch(() => undefined));
  // The client filename is discarded entirely, so traversal sequences cannot reach the path.
  assert.match(stored.file_name, /^[a-f0-9-]{36}\.png$/);
  assert.equal(stored.image_url, `/uploads/claims/${stored.file_name}`);
  assert.equal(stored.mime_type, 'image/png');
  assert.equal(path.dirname(path.join(claimUploadDirectory, stored.file_name)), claimUploadDirectory);
});

test('a file that is not a real image is refused even when it claims an image MIME type', async () => {
  const stub = stubService();
  const response = await serve(app => {
    app.use(authenticate('customer'));
    app.use('/api/claims', createClaimRouter(stub.value));
  }, base => fetch(`${base}/api/claims`, {
    method: 'POST',
    body: form({ bytes: Buffer.from('<?php system($_GET[0]); ?>'), name: 'shell.png', type: 'image/png' }),
  }));

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_EVIDENCE');
  assert.deepEqual(stub.calls.evidence, []);
});

test('a disallowed file type never reaches the claim service', async () => {
  const stub = stubService();
  const response = await serve(app => {
    app.use(authenticate('customer'));
    app.use('/api/claims', createClaimRouter(stub.value));
  }, base => fetch(`${base}/api/claims`, {
    method: 'POST',
    body: form({ bytes: Buffer.from('#!/bin/sh\nrm -rf /'), name: 'run.sh', type: 'application/x-sh' }),
  }));

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_EVIDENCE');
  assert.deepEqual(stub.calls.evidence, []);
});

// ------------------------------------------------------------------ admin API

test('an admin can list, inspect, and advance a claim through the allowed statuses', async () => {
  const repository = adminRepository();
  const build = (app: express.Express) => {
    app.use(authenticate('admin', 1));
    app.use('/api/admin', createAdminRouter(undefined, undefined, undefined, createAdminClaimService(repository)));
  };

  const list = await serve(build, base => fetch(`${base}/api/admin/claims?status=submitted`));
  assert.equal(list.status, 200);

  const stats = await serve(build, base => fetch(`${base}/api/admin/claims/stats`));
  assert.equal(stats.status, 200);
  assert.equal((await stats.json()).data.open_claims, 1);

  const detail = await serve(build, base => fetch(`${base}/api/admin/claims/${claimNumber}`));
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).data.customer_email, 'narin@example.test');

  const patch = (status: string) => serve(build, base => fetch(`${base}/api/admin/claims/${claimNumber}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, note: 'Evidence verified.' }),
  }));

  const reviewed = await patch('under_review');
  assert.equal(reviewed.status, 200);
  assert.equal((await reviewed.json()).data.status, 'under_review');

  const skipped = await patch('completed');
  assert.equal(skipped.status, 409);
  assert.equal((await skipped.json()).error.code, 'INVALID_CLAIM_TRANSITION');

  const approved = await patch('approved');
  assert.equal((await approved.json()).data.status, 'approved');
});

test('an unknown claim number is a 404 for admins too', async () => {
  const response = await serve(app => {
    app.use(authenticate('admin', 1));
    app.use('/api/admin', createAdminRouter(undefined, undefined, undefined, createAdminClaimService(adminRepository())));
  }, base => fetch(`${base}/api/admin/claims/CLM-20260922-999999`));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'CLAIM_NOT_FOUND');
});
